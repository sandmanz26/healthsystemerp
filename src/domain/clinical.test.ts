import { describe, expect, it } from "vitest"
import type { InventoryItem, Patient, Vitals } from "./types"
import { flagResult, news2, reviewPrescription } from "./clinical"

const v = (p: Partial<Vitals>): Vitals => ({ id: "v", at: "", by: "", ...p })

describe("news2", () => {
  it("scores a healthy adult 0", () => {
    expect(news2(v({ respRate: 16, spo2: 98, systolic: 120, heartRate: 75, temperature: 36.8, consciousness: "A" }))?.score).toBe(0)
  })
  it("escalates on a single red-flag parameter", () => {
    const s = news2(v({ respRate: 16, spo2: 98, systolic: 120, heartRate: 75, temperature: 36.8, consciousness: "V" }))!
    expect(s.score).toBe(3)
    expect(s.redFlag).toBe(true)
    expect(s.risk).toBe("sedang")
  })
  it("flags high risk at 7+", () => {
    expect(news2(v({ respRate: 26, spo2: 90, onOxygen: true, systolic: 95, heartRate: 120, temperature: 38.5 }))?.risk).toBe("tinggi")
  })
  it("refuses to score with fewer than 3 parameters", () => {
    expect(news2(v({ heartRate: 140 }))).toBeNull()
  })
})

describe("flagResult", () => {
  it("uses reference and critical ranges", () => {
    expect(flagResult("K", "4.2")).toBe("N")
    expect(flagResult("K", "5.6")).toBe("H")
    expect(flagResult("K", "6.9")).toBe("HH")
    expect(flagResult("TROMBO", "40")).toBe("LL")
    expect(flagResult("NS1", "Positif")).toBe("N")
  })
})

describe("reviewPrescription", () => {
  const patient = { allergies: [{ substance: "Penisilin", reaction: "ruam", severity: "sedang" }], payer: "bpjs" } as Patient
  const drug = (p: Partial<InventoryItem>): InventoryItem => ({ id: "x", name: "X", category: "obat", unit: "tab", price: 1, minStock: 0, batches: [], fornas: true, ...p })

  it("blocks cross-reactive allergies", () => {
    const alerts = reviewPrescription(patient, [drug({ name: "Amoksisilin", drugClass: "penicillin" })])
    expect(alerts.some((a) => a.level === "danger")).toBe(true)
  })
  it("warns about interactions and high-alert drugs", () => {
    const alerts = reviewPrescription({ ...patient, allergies: [] }, [drug({ name: "Warfarin", drugClass: "warfarin", highAlert: true }), drug({ name: "Ibuprofen", drugClass: "nsaid" })])
    expect(alerts.map((a) => a.message).join()).toMatch(/perdarahan/)
    expect(alerts.map((a) => a.message).join()).toMatch(/high-alert/)
  })
  it("notes non-Fornas drugs for JKN patients only", () => {
    const item = drug({ name: "Vitamin", fornas: false })
    expect(reviewPrescription({ ...patient, allergies: [] }, [item])).toHaveLength(1)
    expect(reviewPrescription({ ...patient, allergies: [], payer: "umum" }, [item])).toHaveLength(0)
  })
})
