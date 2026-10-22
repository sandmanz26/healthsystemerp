import { describe, expect, it } from "vitest"
import type { InventoryItem, Patient, Vitals } from "./types"
import { bradenRisk, flagResult, morseRisk, news2, reviewPrescription, sepsisBundle, sepsisScreen } from "./clinical"

const v = (p: Partial<Vitals>): Vitals => ({ id: "v", at: "", by: "", ...p })

describe("news2", () => {
  it("scores a healthy adult 0", () => {
    expect(news2(v({ respRate: 16, spo2: 98, systolic: 120, heartRate: 75, temperature: 36.8, consciousness: "A" }))?.score).toBe(0)
  })
  it("escalates on a single red-flag parameter", () => {
    const s = news2(v({ respRate: 16, spo2: 98, systolic: 120, heartRate: 75, temperature: 36.8, consciousness: "V" }))!
    expect(s.score).toBe(3)
    expect(s.redFlag).toBe(true)
    expect(s.risk).toBe("medium")
  })
  it("flags high risk at 7+", () => {
    expect(news2(v({ respRate: 26, spo2: 90, onOxygen: true, systolic: 95, heartRate: 120, temperature: 38.5 }))?.risk).toBe("high")
  })
  it("refuses to score with fewer than 3 parameters", () => {
    expect(news2(v({ heartRate: 140 }))).toBeNull()
  })
})

describe("flagResult", () => {
  it("uses conventional ranges in the US", () => {
    expect(flagResult("K", "4.2", "us")).toBe("N")
    expect(flagResult("K", "5.6", "us")).toBe("H")
    expect(flagResult("K", "6.9", "us")).toBe("HH")
    expect(flagResult("GLU", "35", "us")).toBe("LL")
    expect(flagResult("CREAT", "2.1", "us")).toBe("H")
  })
  it("uses SI ranges in the UK", () => {
    expect(flagResult("GLU", "5.4", "uk")).toBe("N")
    expect(flagResult("CREAT", "186", "uk")).toBe("H")
    expect(flagResult("HGB", "65", "uk")).toBe("LL")
    // 5.2 mmol/L potassium is normal on UK ranges (3.5–5.3) but high on US ones (3.5–5.1).
    expect(flagResult("K", "5.2", "uk")).toBe("N")
    expect(flagResult("K", "5.2", "us")).toBe("H")
  })
  it("flags qualitative results", () => {
    expect(flagResult("BCX", "No growth to date", "us")).toBe("N")
    expect(flagResult("BCX", "Gram-positive cocci in pairs", "us")).toBe("H")
  })
})

describe("sepsis", () => {
  const septic = v({ temperature: 39.2, heartRate: 118, respRate: 26, systolic: 86, spo2: 90, onOxygen: true, consciousness: "C" })
  it("meets SEP-1 severe sepsis criteria (SIRS + organ dysfunction)", () => {
    const s = sepsisScreen("us", septic, { lactate: 4.1 })
    expect(s.positive).toBe(true)
    expect(s.criteria).toContain("SBP < 90 mmHg")
  })
  it("needs organ dysfunction, not SIRS alone, for SEP-1", () => {
    expect(sepsisScreen("us", v({ temperature: 38.6, heartRate: 104, respRate: 18, systolic: 128 })).positive).toBe(false)
  })
  it("fires on any single UK red flag", () => {
    expect(sepsisScreen("uk", v({ heartRate: 135, respRate: 18, systolic: 120, temperature: 37 })).positive).toBe(true)
  })
  it("uses 3/6-hour bundles in the US and a 1-hour Sepsis Six in the UK", () => {
    expect(Math.max(...sepsisBundle("us").items.map((i) => i.dueMin))).toBe(360)
    expect(sepsisBundle("uk").items).toHaveLength(6)
    expect(sepsisBundle("uk").items.every((i) => i.dueMin === 60)).toBe(true)
  })
})

describe("risk scales", () => {
  it("bands Morse at 25 and 45", () => {
    expect(morseRisk(20).level).toBe("low")
    expect(morseRisk(25).level).toBe("moderate")
    expect(morseRisk(45).level).toBe("high")
  })
  it("bands Braden (lower is worse)", () => {
    expect(bradenRisk(9).level).toBe("very-high")
    expect(bradenRisk(14).level).toBe("moderate")
    expect(bradenRisk(20).level).toBe("none")
  })
})

describe("reviewPrescription", () => {
  const patient = { allergies: [{ substance: "Penicillin", reaction: "Hives", severity: "moderate" }], payer: "commercial" } as Patient
  const drug = (p: Partial<InventoryItem>): InventoryItem => ({ id: "x", name: "X", category: "drug", unit: "tab", price: 1, minStock: 0, batches: [], formulary: true, ...p })

  it("blocks cross-reactive allergies", () => {
    const alerts = reviewPrescription(patient, [drug({ name: "Ceftriaxone 1 g", drugClass: "cephalosporin" })], "us")
    expect(alerts.some((a) => a.level === "danger")).toBe(true)
  })
  it("warns about interactions and high-alert drugs", () => {
    const alerts = reviewPrescription({ ...patient, allergies: [] }, [drug({ name: "Apixaban", drugClass: "anticoagulant", highAlert: true }), drug({ name: "Ibuprofen", drugClass: "nsaid" })], "us")
    expect(alerts.map((a) => a.message).join()).toMatch(/bleeding/)
    expect(alerts.map((a) => a.message).join()).toMatch(/high-alert/)
  })
  it("names the controlled-drug regime of the market", () => {
    const oxy = drug({ name: "Oxycodone", drugClass: "opioid", controlled: "II" })
    expect(reviewPrescription({ ...patient, allergies: [] }, [oxy], "us")[0].message).toMatch(/DEA Schedule II/)
    expect(reviewPrescription({ ...patient, allergies: [] }, [{ ...oxy, controlled: "2" }], "uk")[0].message).toMatch(/CD register/)
  })
  it("notes non-formulary drugs", () => {
    expect(reviewPrescription({ ...patient, allergies: [] }, [drug({ name: "Nexium", formulary: false })], "us")).toHaveLength(1)
  })
})
