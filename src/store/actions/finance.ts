/**
 * Billing & claims.
 */
import { estimateGroup } from "@/domain/finance"
import type { ClaimStatus, Encounter, PaymentMethod } from "@/domain/types"
import { uid } from "@/lib/id"
import { audit, ensureInvoice, findEncounter, nowIso, patientName, type Draft, type SetFn } from "../helpers"

/** Insured encounters become claims when they finish; the invoice moves to "claim". */
export function createClaimIfNeeded(d: Draft, enc: Encounter) {
  if (enc.payer === "umum") return
  const inv = ensureInvoice(d, enc)
  inv.status = "claim"
  inv.closedAt = nowIso()
  if (d.claims.some((c) => c.encounterId === enc.id)) return
  d.claims.push({ id: uid("clm"), encounterId: enc.id, invoiceId: inv.id, payer: enc.payer, grouper: enc.payer === "bpjs" ? "iDRG" : "FFS", status: "draft", updatedAt: nowIso() })
}

export function financeActions(set: SetFn) {
  return {
    addPayment(invoiceId: string, method: PaymentMethod, amount: number) {
      set((d) => {
        const inv = d.invoices.find((i) => i.id === invoiceId)
        if (!inv || amount <= 0) return
        inv.payments.push({ id: uid("pay"), at: nowIso(), method, amount, by: d.session.userId })
        const total = inv.charges.reduce((s, c) => s + c.qty * c.price, 0)
        const paid = inv.payments.reduce((s, p) => s + p.amount, 0)
        if (paid >= total) {
          inv.status = "paid"
          inv.closedAt = nowIso()
        }
        audit(d, "Menerima pembayaran", `${inv.number} · ${method}`)
      })
    },

    removeCharge(invoiceId: string, chargeId: string) {
      set((d) => {
        const inv = d.invoices.find((i) => i.id === invoiceId)
        if (!inv || inv.status !== "open") return
        const c = inv.charges.find((x) => x.id === chargeId)
        inv.charges = inv.charges.filter((x) => x.id !== chargeId)
        audit(d, "Menghapus item tagihan", `${inv.number}: ${c?.description ?? chargeId}`)
      })
    },

    /** Runs the grouper on the encounter's current coding (fee-for-service claims take the bill total). */
    groupClaim(claimId: string) {
      set((d) => {
        const claim = d.claims.find((c) => c.id === claimId)
        if (!claim) return
        if (claim.grouper === "FFS") {
          const inv = d.invoices.find((i) => i.id === claim.invoiceId)
          claim.tariff = inv ? inv.charges.reduce((s, c) => s + c.qty * c.price, 0) : 0
          claim.status = "coded"
          claim.updatedAt = nowIso()
          return
        }
        const g = estimateGroup(findEncounter(d, claim.encounterId), claim.grouper)
        if (!g) return
        claim.groupCode = g.code
        claim.groupName = g.name
        claim.tariff = g.tariff
        claim.status = "coded"
        claim.updatedAt = nowIso()
        audit(d, "Grouping klaim", `${claim.grouper} ${g.code}`)
      })
    },

    setClaimGrouper(claimId: string, grouper: "iDRG" | "INA-CBG") {
      set((d) => {
        const claim = d.claims.find((c) => c.id === claimId)
        if (!claim) return
        claim.grouper = grouper
        claim.groupCode = claim.groupName = undefined
        claim.tariff = undefined
        if (claim.status === "coded") claim.status = "draft"
      })
    },

    setClaimStatus(claimId: string, status: ClaimStatus, note?: string) {
      set((d) => {
        const claim = d.claims.find((c) => c.id === claimId)
        if (!claim) return
        claim.status = status
        claim.note = note
        claim.updatedAt = nowIso()
        audit(d, `Klaim ${status}`, patientName(d, findEncounter(d, claim.encounterId).patientId))
      })
    },
  }
}
