/**
 * Patient safety & quality.
 *
 * Incidents use a harm scale (AHRQ Common Formats in the US, LFPSE in England) and the
 * 5×5 consequence × likelihood risk matrix used by NHS trusts and most US ERM programmes.
 * Measures are the ones each market actually reports: CMS / Joint Commission in the US,
 * NHS Oversight Framework & constitutional standards in the UK.
 */
import type { Region } from "./region"
import type { HarmLevel, IncidentCategory, IndicatorValue, RiskGrade } from "./types"

export const HARM_LABEL: Record<HarmLevel, string> = {
  "near-miss": "Near miss (did not reach patient)",
  none: "No harm",
  low: "Low harm",
  moderate: "Moderate harm",
  severe: "Severe harm",
  death: "Death",
}

export const CATEGORY_LABEL: Record<IncidentCategory, string> = {
  medication: "Medication",
  fall: "Fall",
  identification: "Patient identification",
  "pressure-injury": "Pressure injury",
  surgery: "Surgery / procedure",
  specimen: "Specimen / lab",
  equipment: "Medical device / equipment",
  infection: "Healthcare-associated infection",
  diagnosis: "Delayed / missed diagnosis",
}

export const IMPACT_LABEL = ["", "Negligible", "Minor", "Moderate", "Major", "Catastrophic"]
export const PROBABILITY_LABEL = ["", "Rare", "Unlikely", "Possible", "Likely", "Almost certain"]

/** Score = consequence × likelihood; bands as in the NPSA 5×5 risk matrix. */
export function riskGrade(probability: number, impact: number): RiskGrade {
  const score = probability * impact
  if (score >= 15) return "extreme"
  if (score >= 8) return "high"
  if (score >= 4) return "moderate"
  return "low"
}

export const GRADE_INFO: Record<RiskGrade, { label: string; action: string; color: "accent" | "success" | "warning" | "danger" }> = {
  low: { label: "Low (1–3)", action: "Local review by the unit manager", color: "success" },
  moderate: { label: "Moderate (4–6)", action: "After-action review / swarm huddle within 2 weeks", color: "accent" },
  high: { label: "High (8–12)", action: "Comprehensive review (RCA² / PSII) — risk & safety committee", color: "warning" },
  extreme: { label: "Extreme (15–25)", action: "Immediate escalation to CMO/CNO; RCA² within 45 days; external reporting", color: "danger" },
}

/** Where an incident must be reported beyond the hospital. */
export function externalReporting(region: Region, harm: HarmLevel, sentinel?: boolean): string {
  if (region === "uk")
    return sentinel ? "Never Event — report to LFPSE and the ICB within 2 working days; consider PSII" : harm === "moderate" || harm === "severe" || harm === "death" ? "Report to LFPSE; Duty of Candour applies (notify patient/family)" : "Report to LFPSE"
  return sentinel ? "Sentinel event — Joint Commission comprehensive systematic analysis within 45 business days; state reporting if required" : harm === "severe" || harm === "death" ? "Serious reportable event — submit to PSO (AHRQ Common Formats) and state agency if listed" : "Submit to PSO (AHRQ Common Formats)"
}

export interface IndicatorDef {
  id: string
  name: string
  /** Who defines / receives the measure. */
  source: string
  target: number
  direction: "min" | "max"
  unit: "%" | "per 1,000"
}

export const MEASURES: Record<Region, IndicatorDef[]> = {
  us: [
    { id: "sep-1", name: "SEP-1 severe sepsis / septic shock bundle compliance", source: "CMS Hospital IQR", target: 75, direction: "min", unit: "%" },
    { id: "hand-hygiene", name: "Hand hygiene compliance", source: "Joint Commission NPSG.07.01.01", target: 90, direction: "min", unit: "%" },
    { id: "two-ids", name: "Two patient identifiers used before care", source: "Joint Commission NPSG.01.01.01", target: 100, direction: "min", unit: "%" },
    { id: "critical-results", name: "Critical results reported ≤ 60 min", source: "Joint Commission NPSG.02.03.01", target: 95, direction: "min", unit: "%" },
    { id: "door-provider", name: "ED door-to-provider ≤ 30 min", source: "CMS OP-18 context / local", target: 80, direction: "min", unit: "%" },
    { id: "lwbs", name: "ED left without being seen", source: "CMS OP-22", target: 2, direction: "max", unit: "%" },
    { id: "readmit", name: "30-day all-cause readmission", source: "CMS HRRP", target: 15, direction: "max", unit: "%" },
    { id: "falls-injury", name: "Inpatient falls with injury", source: "NDNQI", target: 0.6, direction: "max", unit: "per 1,000" },
    { id: "hapi", name: "Hospital-acquired pressure injury, stage 2+", source: "NDNQI / CMS HAC", target: 1, direction: "max", unit: "%" },
    { id: "cauti", name: "CAUTI per 1,000 catheter days", source: "CDC NHSN", target: 1, direction: "max", unit: "per 1,000" },
    { id: "vte", name: "VTE prophylaxis by day 2", source: "Joint Commission VTE-1", target: 90, direction: "min", unit: "%" },
    { id: "bcma", name: "Barcode scanning compliance (meds administered)", source: "Leapfrog BCMA", target: 95, direction: "min", unit: "%" },
    { id: "hcahps", name: "HCAHPS overall rating 9–10 (top box)", source: "CMS HCAHPS", target: 72, direction: "min", unit: "%" },
  ],
  uk: [
    { id: "four-hour", name: "ED attendances within 4 hours", source: "NHS constitutional standard", target: 78, direction: "min", unit: "%" },
    { id: "twelve-hour", name: "ED patients > 12 h from arrival", source: "NHS Oversight Framework", target: 2, direction: "max", unit: "%" },
    { id: "news2-on-time", name: "NEWS2 observations recorded on time", source: "RCP NEWS2 / Trust", target: 90, direction: "min", unit: "%" },
    { id: "sepsis-abx", name: "Sepsis: IV antibiotics within 1 hour", source: "NICE NG51", target: 90, direction: "min", unit: "%" },
    { id: "vte-ra", name: "VTE risk assessment on admission", source: "NICE NG89", target: 95, direction: "min", unit: "%" },
    { id: "hand-hygiene", name: "Hand hygiene compliance", source: "IPC audit", target: 95, direction: "min", unit: "%" },
    { id: "falls", name: "Inpatient falls", source: "LFPSE / NAIF", target: 6.6, direction: "max", unit: "per 1,000" },
    { id: "pressure", name: "Category 2+ pressure ulcers", source: "NHS Safety Thermometer", target: 1, direction: "max", unit: "per 1,000" },
    { id: "rtt", name: "RTT incomplete pathways < 18 weeks", source: "NHS constitutional standard (interim)", target: 65, direction: "min", unit: "%" },
    { id: "readmit", name: "Emergency readmission within 30 days", source: "NHS Digital", target: 12, direction: "max", unit: "%" },
    { id: "before-noon", name: "Discharges before noon", source: "NHS UEC plan", target: 33, direction: "min", unit: "%" },
    { id: "fft", name: "Friends & Family Test — inpatient positive", source: "NHS England", target: 94, direction: "min", unit: "%" },
  ],
}

export function indicatorRate(v: IndicatorValue, unit: IndicatorDef["unit"] = "%"): number {
  if (v.denominator === 0) return 0
  return (v.numerator / v.denominator) * (unit === "%" ? 100 : 1000)
}

export function meetsTarget(def: IndicatorDef, rate: number): boolean {
  return def.direction === "min" ? rate >= def.target : rate <= def.target
}
