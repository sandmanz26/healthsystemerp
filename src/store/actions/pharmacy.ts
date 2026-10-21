/**
 * Prescriptions, dispensing (FEFO) and inventory.
 */
import type { PrescriptionItem, PurchaseStatus, StockMovement } from "@/domain/types"
import { uid } from "@/lib/id"
import { addCharge, audit, findEncounter, isOn, notify, nowIso, patientName, type Draft, type SetFn } from "../helpers"

const FREQ_HOURS: Record<string, number[]> = { "1x1": [8], "2x1": [8, 20], "3x1": [6, 14, 22], "4x1": [6, 12, 18, 24], "Tiap 8 jam": [6, 14, 22], "Tiap 12 jam": [8, 20] }

/** Takes stock from the batches that expire first. Returns the quantity it could not cover. */
function takeFefo(d: Draft, itemId: string, qty: number, ref: string): number {
  const item = d.inventory.find((i) => i.id === itemId)
  if (!item) return qty
  let left = qty
  for (const b of [...item.batches].sort((a, b) => a.expiry.localeCompare(b.expiry))) {
    if (left <= 0) break
    const take = Math.min(b.qty, left)
    b.qty -= take
    left -= take
  }
  item.batches = item.batches.filter((b) => b.qty > 0)
  d.movements.unshift({ id: uid("mv"), at: nowIso(), itemId, qty: -(qty - left), reason: "dispense", ref } satisfies StockMovement)
  const stock = item.batches.reduce((s, b) => s + b.qty, 0)
  if (stock < item.minStock)
    notify(d, { level: "warning", title: "Stok di bawah minimum", body: `${item.name}: sisa ${stock} ${item.unit} (min ${item.minStock}).`, href: "/inventory", roles: ["pharmacist", "admin"] })
  return left
}

export function pharmacyActions(set: SetFn) {
  return {
    prescribe(encounterId: string, items: PrescriptionItem[]): string {
      const id = uid("rx")
      set((d) => {
        const enc = findEncounter(d, encounterId)
        d.prescriptions.push({ id, encounterId, patientId: enc.patientId, items, status: "new", prescribedBy: d.session.userId, prescribedAt: nowIso() })
        audit(d, "Menulis resep", `${patientName(d, enc.patientId)}: ${items.length} item`)
      })
      return id
    },

    reviewPrescription(id: string, note?: string) {
      set((d) => {
        const rx = d.prescriptions.find((p) => p.id === id)
        if (!rx) return
        rx.status = "reviewed"
        rx.reviewedBy = d.session.userId
        rx.reviewNote = note
        audit(d, "Menelaah resep", patientName(d, rx.patientId))
      })
    },

    preparePrescription(id: string) {
      set((d) => {
        const rx = d.prescriptions.find((p) => p.id === id)
        if (rx) rx.status = "prepared"
      })
    },

    /** Hands drugs over: deducts stock, bills them, and schedules inpatient doses on the eMAR. */
    dispensePrescription(id: string): { shortages: string[] } {
      const shortages: string[] = []
      set((d) => {
        const rx = d.prescriptions.find((p) => p.id === id)
        if (!rx) return
        const enc = findEncounter(d, rx.encounterId)
        for (const line of rx.items) {
          const item = d.inventory.find((i) => i.id === line.itemId)
          if (!item) continue
          const short = takeFefo(d, line.itemId, line.qty, rx.id)
          if (short > 0) shortages.push(`${item.name} kurang ${short} ${item.unit}`)
          addCharge(d, enc, { category: "obat", description: item.name, qty: line.qty - short, price: item.price, ref: rx.id })
          if (enc.kind === "inpatient" && isOn(d, "nursing")) {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            for (const h of FREQ_HOURS[line.frequency] ?? []) {
              const at = today.getTime() + h * 3600000
              if (at < Date.now()) continue
              d.mar.push({ id: uid("mar"), encounterId: enc.id, itemId: line.itemId, dose: line.dose, route: line.route, scheduledAt: new Date(at).toISOString(), status: "due" })
            }
          }
        }
        rx.status = "dispensed"
        rx.dispensedAt = nowIso()
        audit(d, "Menyerahkan obat", patientName(d, rx.patientId))
      })
      return { shortages }
    },

    cancelPrescription(id: string, reason: string) {
      set((d) => {
        const rx = d.prescriptions.find((p) => p.id === id)
        if (!rx) return
        rx.status = "cancelled"
        rx.reviewNote = reason
        audit(d, "Membatalkan resep", `${patientName(d, rx.patientId)} — ${reason}`)
      })
    },

    adjustStock(itemId: string, qty: number, reason: "adjust" | "expire", batch?: string) {
      set((d) => {
        const item = d.inventory.find((i) => i.id === itemId)
        if (!item) return
        if (qty < 0) {
          const target = batch ? item.batches.find((b) => b.batch === batch) : undefined
          if (target) target.qty = Math.max(0, target.qty + qty)
          else takeFefo(d, itemId, -qty, reason)
          item.batches = item.batches.filter((b) => b.qty > 0)
        } else {
          item.batches.push({ batch: batch ?? `ADJ${Date.now().toString().slice(-5)}`, expiry: new Date(Date.now() + 365 * 86400000).toISOString(), qty })
        }
        if (reason === "expire" || qty > 0) d.movements.unshift({ id: uid("mv"), at: nowIso(), itemId, qty, reason })
        audit(d, reason === "expire" ? "Memusnahkan stok kedaluwarsa" : "Penyesuaian stok", `${item.name} (${qty > 0 ? "+" : ""}${qty})`)
      })
    },

    createPurchase(lines: { itemId: string; qty: number }[], note?: string): string {
      const id = uid("pr")
      set((d) => {
        d.purchases.unshift({ id, createdAt: nowIso(), createdBy: d.session.userId, lines, status: "submitted", note })
        audit(d, "Membuat permintaan pembelian", `${lines.length} item`)
      })
      return id
    },

    setPurchaseStatus(id: string, status: PurchaseStatus) {
      set((d) => {
        const pr = d.purchases.find((p) => p.id === id)
        if (!pr) return
        pr.status = status
        if (status === "received") {
          for (const line of pr.lines) {
            const item = d.inventory.find((i) => i.id === line.itemId)
            if (!item) continue
            item.batches.push({ batch: `RCV${Date.now().toString().slice(-6)}`, expiry: new Date(Date.now() + 540 * 86400000).toISOString(), qty: line.qty })
            d.movements.unshift({ id: uid("mv"), at: nowIso(), itemId: line.itemId, qty: line.qty, reason: "receive", ref: pr.id })
          }
        }
        audit(d, `Permintaan pembelian: ${status}`, pr.id)
      })
    },
  }
}
