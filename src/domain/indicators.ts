/**
 * Inpatient efficiency indicators (Barber-Johnson), as reported in RL / SIRS.
 * Definitions follow the Kemenkes technical guidance.
 */
export interface CensusInput {
  beds: number
  periodDays: number
  /** Sum of occupied beds for each day of the period (hari perawatan). */
  patientDays: number
  /** Patients discharged alive + dead in the period. */
  discharges: number
  deaths: number
  deathsOver48h: number
  /** Sum of length of stay of discharged patients (lama dirawat). */
  totalLos: number
}

export interface CensusIndicators {
  /** Bed Occupancy Ratio, ideal 60–85%. */
  bor: number
  /** Average Length of Stay, ideal 6–9 days. */
  alos: number
  /** Turn Over Interval, ideal 1–3 days. */
  toi: number
  /** Bed Turn Over, ideal 40–50 times/year. */
  bto: number
  /** Net Death Rate ‰, ideal < 25. */
  ndr: number
  /** Gross Death Rate ‰, ideal < 45. */
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

export const IDEAL = {
  bor: [60, 85],
  alos: [6, 9],
  toi: [1, 3],
  bto: [40, 50],
} as const
