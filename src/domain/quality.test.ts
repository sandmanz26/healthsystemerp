import { describe, expect, it } from "vitest"
import { censusIndicators } from "./indicators"
import { riskGrade } from "./quality"

describe("riskGrade (KKPRS matrix)", () => {
  it("grades the corners correctly", () => {
    expect(riskGrade(1, 1)).toBe("biru")
    expect(riskGrade(5, 5)).toBe("merah")
    expect(riskGrade(1, 5)).toBe("kuning")
    expect(riskGrade(5, 1)).toBe("hijau")
  })
})

describe("censusIndicators (Barber-Johnson)", () => {
  it("computes BOR, ALOS and TOI", () => {
    const c = censusIndicators({ beds: 10, periodDays: 30, patientDays: 225, discharges: 45, deaths: 2, deathsOver48h: 1, totalLos: 225 })
    expect(c.bor).toBeCloseTo(75)
    expect(c.alos).toBeCloseTo(5)
    expect(c.toi).toBeCloseTo(75 / 45)
    expect(c.gdr).toBeCloseTo((2 / 45) * 1000)
  })
  it("does not divide by zero", () => {
    expect(censusIndicators({ beds: 0, periodDays: 0, patientDays: 0, discharges: 0, deaths: 0, deathsOver48h: 0, totalLos: 0 }).bor).toBe(0)
  })
})
