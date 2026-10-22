import { describe, expect, it } from "vitest"
import { news2 } from "@/domain/clinical"
import { isValidNhsNumber } from "@/domain/interop"
import type { Region } from "@/domain/region"
import { isActive } from "@/store/selectors"
import { createSeed } from "./seed"

describe.each(["us", "uk"] as Region[])("demo dataset (%s)", (region) => {
  const data = createSeed(undefined, region)
  const patient = new Map(data.patients.map((p) => [p.id, p]))
  const ageOf = (id: string) => (Date.now() - new Date(patient.get(id)!.birthDate).getTime()) / (365.25 * 86400000)

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
  it("only puts obstetric cases on women and pediatric cases on children", () => {
    for (const e of data.encounters) {
      if (e.diagnoses.some((d) => d.code.startsWith("O"))) expect(patient.get(e.patientId)!.gender).toBe("female")
      if (e.unitId === "clinic-peds" || e.unitId === "peds") expect(ageOf(e.patientId)).toBeLessThan(13)
    }
    for (const s of data.surgeries.filter((x) => /cesarean|caesarean/i.test(x.procedure))) expect(patient.get(s.patientId)!.gender).toBe("female")
  })
  it("never orders a pregnancy test for men", () => {
    for (const o of data.orders.filter((x) => x.testCodes.includes("HCG"))) expect(patient.get(o.patientId)!.gender).toBe("female")
  })
  it("has realistic early-warning prevalence on the wards (no alarm fatigue)", () => {
    const inpatients = data.encounters.filter((e) => e.kind === "inpatient" && e.status === "in-progress")
    const high = inpatients.filter((e) => {
      const latest = [...e.vitals].sort((a, b) => b.at.localeCompare(a.at))[0]
      return latest && (news2(latest)?.score ?? 0) >= 5
    })
    expect(inpatients.length).toBeGreaterThan(20)
    expect(high.length).toBeGreaterThanOrEqual(1)
    expect(high.length).toBeLessThanOrEqual(6)
  })
  it("creates claims only for insured encounters, with the market's payment model", () => {
    const byId = new Map(data.encounters.map((e) => [e.id, e]))
    for (const c of data.claims) expect(["self-pay", "overseas"]).not.toContain(byId.get(c.encounterId)!.payer)
    const groupers = new Set(data.claims.map((c) => c.grouper))
    if (region === "us") expect([...groupers].sort()).toEqual(["FFS", "MS-DRG"])
    else expect(groupers.has("MS-DRG")).toBe(false)
  })
  it("uses the market's identifiers and payers", () => {
    if (region === "uk") {
      expect(data.patients.every((p) => p.nhsNumber && isValidNhsNumber(p.nhsNumber))).toBe(true)
      expect(data.patients.every((p) => ["nhs", "private", "overseas"].includes(p.payer))).toBe(true)
    } else {
      expect(data.patients.every((p) => !p.nhsNumber)).toBe(true)
      expect(data.patients.filter((p) => ageOf(p.id) >= 65).every((p) => p.payer === "medicare" || p.payer === "commercial")).toBe(true)
    }
  })
  it("documents the call-back for every verified critical result", () => {
    for (const o of data.orders.filter((x) => x.status === "validated" && x.results.some((r) => r.flag === "HH" || r.flag === "LL"))) expect(o.criticalCall).toBeTruthy()
  })
  it("is deterministic for a given day", () => {
    expect(createSeed(undefined, region).patients.map((p) => p.name)).toEqual(data.patients.map((p) => p.name))
  })
})
