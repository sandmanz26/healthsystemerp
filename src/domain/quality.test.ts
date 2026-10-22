import { describe, expect, it } from "vitest"
import { censusIndicators } from "./indicators"
import { indicatorRate, riskGrade } from "./quality"

describe("riskGrade (5×5 consequence × likelihood)", () => {
  it("bands the score", () => {
    expect(riskGrade(1, 1)).toBe("low")
    expect(riskGrade(2, 2)).toBe("moderate")
    expect(riskGrade(2, 4)).toBe("high")
    expect(riskGrade(3, 5)).toBe("extreme")
    expect(riskGrade(5, 5)).toBe("extreme")
  })
})

describe("indicatorRate", () => {
  it("handles percentages and per-1,000 rates", () => {
    expect(indicatorRate({ indicatorId: "x", period: "", numerator: 45, denominator: 50 })).toBeCloseTo(90)
    expect(indicatorRate({ indicatorId: "x", period: "", numerator: 3, denominator: 1000 }, "per 1,000")).toBeCloseTo(3)
  })
})

describe("censusIndicators (Barber-Johnson)", () => {
  it("computes occupancy, ALOS and turnover interval", () => {
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
