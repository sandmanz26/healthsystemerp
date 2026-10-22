/**
 * Laboratory & imaging orders (ServiceRequest → DiagnosticReport).
 */
import { LAB_MAP, PANEL_MAP, RAD_MAP, rangeFor } from "@v2/domain/catalog"
import { flagResult, isCritical } from "@v2/domain/clinical"
import type { OrderKind, Priority, ServiceOrder } from "@v2/domain/types"
import { uid } from "@v2/lib/id"
import { addCharge, audit, findEncounter, notify, nowIso, patientName, queueSync, regionOf, type Draft, type SetFn } from "../helpers"

export function orderActions(set: SetFn) {
  const withOrder = (id: string, fn: (o: ServiceOrder, d: Draft) => void) =>
    set((d) => {
      const o = d.orders.find((x) => x.id === id)
      if (o) fn(o, d)
    })

  return {
    placeOrder(input: { encounterId: string; kind: OrderKind; testCodes: string[]; priority: Priority; clinicalNote: string }): string {
      const id = uid(input.kind)
      set((d) => {
        const enc = findEncounter(d, input.encounterId)
        const region = regionOf(d)
        const patient = d.patients.find((p) => p.id === enc.patientId)
        // Advanced imaging for commercial / Medicare Advantage outpatients needs prior auth.
        const needsAuth =
          input.kind === "rad" && region === "us" && enc.kind === "outpatient" && input.testCodes.some((c) => RAD_MAP[c]?.priorAuth) &&
          (enc.payer === "commercial" || !!patient?.coverage?.plan?.includes("Advantage"))
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
          auth: needsAuth ? "pending" : undefined,
        })
        // Lab bills per panel (CPT 85025, 80048 …); imaging per exam.
        if (input.kind === "lab")
          for (const panel of new Set(input.testCodes.map((c) => LAB_MAP[c]?.panel).filter(Boolean))) {
            const def = PANEL_MAP[panel]
            addCharge(d, enc, { category: "laboratory", description: def.name, code: def.cpt, revCode: "0300", qty: 1, price: def.price[region], ref: id })
          }
        else
          for (const code of input.testCodes) {
            const def = RAD_MAP[code]
            addCharge(d, enc, { category: "radiology", description: def.name, code: def.cpt, revCode: def.revCode, qty: 1, price: def.price[region], ref: id })
          }
        if (input.priority === "stat")
          notify(d, { level: "warning", title: `STAT ${input.kind === "lab" ? "lab" : "imaging"} order`, body: `${patientName(d, enc.patientId)} — ${input.testCodes.length} test(s).`, href: input.kind === "lab" ? "/laboratory" : "/radiology", roles: [input.kind === "lab" ? "labtech" : "radiographer"] })
        if (needsAuth)
          notify(d, { level: "info", title: "Prior authorization required", body: `${patientName(d, enc.patientId)}: ${input.testCodes.map((c) => RAD_MAP[c]?.name).join(", ")} — submit 278 request.`, href: "/radiology", roles: ["frontdesk", "coder"] })
        queueSync(d, "hl7v2", "ORM^O01", id)
        audit(d, input.kind === "lab" ? "Ordered labs" : "Ordered imaging", `${patientName(d, enc.patientId)}: ${input.testCodes.join(", ")}`)
      })
      return id
    },

    setOrderAuth(id: string, auth: ServiceOrder["auth"]) {
      withOrder(id, (o, d) => {
        o.auth = auth
        audit(d, `Prior auth ${auth}`, patientName(d, o.patientId))
      })
    },

    collectSample(id: string) {
      withOrder(id, (o, d) => {
        o.status = "collected"
        o.collectedAt = nowIso()
        audit(d, o.kind === "lab" ? "Collected specimen" : "Exam performed", patientName(d, o.patientId))
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
        const region = regionOf(d)
        o.results = o.testCodes
          .filter((c) => (values[c] ?? "").trim() !== "")
          .map((c) => ({ testCode: c, value: values[c].trim(), unit: LAB_MAP[c] ? rangeFor(LAB_MAP[c], region)?.unit : undefined, flag: flagResult(c, values[c], region) }))
        o.status = "resulted"
        o.resultedAt = nowIso()
        const critical = o.results.filter((r) => isCritical(r.flag))
        if (critical.length)
          notify(d, {
            level: "danger",
            title: "Critical lab value",
            body: `${patientName(d, o.patientId)}: ${critical.map((r) => `${LAB_MAP[r.testCode].name} ${r.value} ${r.unit ?? ""}`.trim()).join(", ")}. Call the responsible provider and document read-back.`,
            href: `/encounters/${o.encounterId}`,
            roles: ["doctor", "nurse", "labtech"],
          })
        audit(d, "Entered lab results", patientName(d, o.patientId))
      })
    },

    /** Documents the critical-value call (who received it, read-back confirmed). */
    recordCriticalCall(id: string, to: string) {
      withOrder(id, (o, d) => {
        o.criticalCall = { at: nowIso(), to, by: d.session.userId }
        audit(d, "Critical value called (read-back confirmed)", `${patientName(d, o.patientId)} → ${to}`)
      })
    },

    saveReport(id: string, report: string) {
      withOrder(id, (o, d) => {
        o.report = report
        o.status = "resulted"
        o.resultedAt = nowIso()
        audit(d, "Dictated imaging report", patientName(d, o.patientId))
      })
    },

    validateOrder(id: string) {
      withOrder(id, (o, d) => {
        o.status = "validated"
        o.validatedBy = d.session.userId
        queueSync(d, "hl7v2", "ORU^R01", o.id)
        queueSync(d, "fhir", o.kind === "lab" ? "Observation" : "DiagnosticReport", o.id)
        audit(d, "Verified results", patientName(d, o.patientId))
      })
    },

    cancelOrder(id: string) {
      withOrder(id, (o, d) => {
        o.status = "cancelled"
        const inv = d.invoices.find((i) => i.encounterId === o.encounterId)
        if (inv) inv.charges = inv.charges.filter((c) => c.ref !== o.id)
        audit(d, "Cancelled order", patientName(d, o.patientId))
      })
    },
  }
}
