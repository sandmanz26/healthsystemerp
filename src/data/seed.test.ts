import { describe, expect, it } from "vitest"
import { news2 } from "@/domain/clinical"
import { isActive } from "@/store/selectors"
import { createSeed } from "./seed"

const data = createSeed()
const patient = new Map(data.patients.map((p) => [p.id, p]))
const ageOf = (id: string) => (Date.now() - new Date(patient.get(id)!.birthDate).getTime()) / (365.25 * 86400000)

describe("demo dataset", () => {
  it("gives each patient at most one active encounter", () => {
    const active = data.encounters.filter(isActive).map((e) => e.patientId)
    expect(new Set(active).size).toBe(active.length)
  })
  it("keeps beds and encounters consistent", () => {
    for (const bed of data.beds.filter((b) => b.status === "occupied")) {
      const enc = data.encounters.find((e) => e.id === bed.encounterId)
      expect(enc?.bedId).toBe(bed.id)
      expect(enc?.status).toBe("in-progress")
    }
  })
  it("only puts obstetric cases on women and paediatric cases on children", () => {
    for (const e of data.encounters) {
      if (e.diagnoses.some((d) => d.code.startsWith("O"))) expect(patient.get(e.patientId)!.gender).toBe("female")
      if (e.unitId === "poli-anak") expect(ageOf(e.patientId)).toBeLessThan(13)
    }
  })
  it("has realistic early-warning prevalence on the wards (no alarm fatigue)", () => {
    const inpatients = data.encounters.filter((e) => e.kind === "inpatient" && e.status === "in-progress")
    const high = inpatients.filter((e) => {
      const latest = [...e.vitals].sort((a, b) => b.at.localeCompare(a.at))[0]
      return latest && (news2(latest)?.score ?? 0) >= 5
    })
    expect(inpatients.length).toBeGreaterThan(20)
    expect(high.length).toBeGreaterThanOrEqual(1)
    expect(high.length).toBeLessThanOrEqual(5)
  })
  it("creates claims only for insured encounters", () => {
    const byId = new Map(data.encounters.map((e) => [e.id, e]))
    for (const c of data.claims) expect(byId.get(c.encounterId)!.payer).not.toBe("umum")
    expect(data.claims.filter((c) => c.payer === "asuransi").every((c) => c.grouper === "FFS")).toBe(true)
  })
  it("is deterministic for a given day", () => {
    expect(createSeed().patients.map((p) => p.name)).toEqual(data.patients.map((p) => p.name))
  })
})
