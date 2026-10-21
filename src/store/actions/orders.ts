/**
 * Laboratory & radiology orders (ServiceRequest → DiagnosticReport).
 */
import { LAB_MAP, RAD_MAP } from "@/domain/catalog"
import { flagResult, isCritical } from "@/domain/clinical"
import type { OrderKind, Priority, ServiceOrder } from "@/domain/types"
import { uid } from "@/lib/id"
import { addCharge, audit, findEncounter, notify, nowIso, patientName, queueSync, type SetFn } from "../helpers"

export function orderActions(set: SetFn) {
  const withOrder = (id: string, fn: (o: ServiceOrder, d: Parameters<Parameters<SetFn>[0]>[0]) => void) =>
    set((d) => {
      const o = d.orders.find((x) => x.id === id)
      if (o) fn(o, d)
    })

  return {
    placeOrder(input: { encounterId: string; kind: OrderKind; testCodes: string[]; priority: Priority; clinicalNote: string }): string {
      const id = uid(input.kind)
      set((d) => {
        const enc = findEncounter(d, input.encounterId)
        d.orders.push({
          id,
          kind: input.kind,
          encounterId: enc.id,
          patientId: enc.patientId,
          testCodes: input.testCodes,
          priority: input.priority,
          clinicalNote: input.clinicalNote,
          status: "ordered",
          orderedBy: d.session.userId,
          orderedAt: nowIso(),
          results: [],
        })
        for (const code of input.testCodes) {
          const def = input.kind === "lab" ? LAB_MAP[code] : RAD_MAP[code]
          addCharge(d, enc, { category: input.kind === "lab" ? "laboratorium" : "radiologi", description: def.name, qty: 1, price: def.price, ref: id })
        }
        if (input.priority === "cito")
          notify(d, { level: "warning", title: `Order ${input.kind === "lab" ? "lab" : "radiologi"} CITO`, body: `${patientName(d, enc.patientId)} — ${input.testCodes.length} pemeriksaan.`, href: input.kind === "lab" ? "/laboratory" : "/radiology", roles: [input.kind === "lab" ? "labtech" : "radiographer"] })
        audit(d, `Order ${input.kind === "lab" ? "laboratorium" : "radiologi"}`, `${patientName(d, enc.patientId)}: ${input.testCodes.join(", ")}`)
      })
      return id
    },

    collectSample(id: string) {
      withOrder(id, (o, d) => {
        o.status = "collected"
        o.collectedAt = nowIso()
        audit(d, o.kind === "lab" ? "Mengambil sampel" : "Pasien diperiksa", patientName(d, o.patientId))
      })
    },

    startProcessing(id: string) {
      withOrder(id, (o) => {
        o.status = "in-progress"
        o.collectedAt ??= nowIso()
      })
    },

    /** Saves lab values (flags computed here so the UI cannot disagree with the rules). */
    enterResults(id: string, values: Record<string, string>) {
      withOrder(id, (o, d) => {
        o.results = o.testCodes.filter((c) => (values[c] ?? "").trim() !== "").map((c) => ({ testCode: c, value: values[c].trim(), flag: flagResult(c, values[c]) }))
        o.status = "resulted"
        o.resultedAt = nowIso()
        const critical = o.results.filter((r) => isCritical(r.flag))
        if (critical.length)
          notify(d, {
            level: "danger",
            title: "Nilai kritis laboratorium",
            body: `${patientName(d, o.patientId)}: ${critical.map((r) => `${LAB_MAP[r.testCode].name} ${r.value}`).join(", ")}. Lapor DPJP ≤ 30 menit.`,
            href: `/encounters/${o.encounterId}`,
            roles: ["doctor", "nurse", "labtech"],
          })
        audit(d, "Input hasil laboratorium", patientName(d, o.patientId))
      })
    },

    saveReport(id: string, report: string) {
      withOrder(id, (o, d) => {
        o.report = report
        o.status = "resulted"
        o.resultedAt = nowIso()
        audit(d, "Menulis ekspertise radiologi", patientName(d, o.patientId))
      })
    },

    validateOrder(id: string) {
      withOrder(id, (o, d) => {
        o.status = "validated"
        o.validatedBy = d.session.userId
        queueSync(d, "satusehat", o.kind === "lab" ? "Observation" : "DiagnosticReport", o.id)
        audit(d, "Validasi hasil", patientName(d, o.patientId))
      })
    },

    cancelOrder(id: string) {
      withOrder(id, (o, d) => {
        o.status = "cancelled"
        const inv = d.invoices.find((i) => i.encounterId === o.encounterId)
        if (inv) inv.charges = inv.charges.filter((c) => c.ref !== o.id)
        audit(d, "Membatalkan order", patientName(d, o.patientId))
      })
    },
  }
}
