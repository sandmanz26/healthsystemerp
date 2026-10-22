/**
 * Inpatient capacity & flow indicators (Barber-Johnson family), as used in bed management
 * dashboards on both sides of the Atlantic.
 */
export interface CensusInput {
  beds: number
  periodDays: number
  /** Sum of occupied beds for each day of the period (patient days / bed days). */
  patientDays: number
  /** Patients discharged alive + dead in the period. */
  discharges: number
  deaths: number
  deathsOver48h: number
  /** Sum of length of stay of discharged patients. */
  totalLos: number
}

export interface CensusIndicators {
  /** Bed occupancy, %. */
  bor: number
  /** Average length of stay, days. */
  alos: number
  /** Turnover interval: days a bed stays empty between patients. */
  toi: number
  /** Bed turnover: discharges per bed in the period. */
  bto: number
  /** Net death rate ‰ (deaths > 48 h after admission). */
  ndr: number
  /** Gross death rate ‰. */
  gdr: number
}

export function censusIndicators(c: CensusInput): CensusIndicators {
  const safe = (n: number, d: number) => (d === 0 ? 0 : n / d)
  return {
    bor: safe(c.patientDays, c.beds * c.periodDays) * 100,
    alos: safe(c.totalLos, c.discharges),
    toi: safe(c.beds * c.periodDays - c.patientDays, c.discharges),
    bto: safe(c.discharges, c.beds),
    ndr: safe(c.deathsOver48h, c.discharges) * 1000,
    gdr: safe(c.deaths, c.discharges) * 1000,
  }
}

/**
 * Operating ranges. 85% occupancy is the classic safety threshold for acute beds (Bagust et
 * al., BMJ 1999); NHS England plans to 92%. US acute ALOS ≈ 4.5–5.5 days (AHA).
 */
export const IDEAL = {
  bor: [75, 85],
  alos: [3.5, 5.5],
  toi: [0.5, 2],
  bto: [3, 6],
} as const
