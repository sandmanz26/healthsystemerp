/**
 * Clinical decision support: pure functions, no React, no store.
 * Each rule cites its source so clinicians can check it.
 */
import { LAB_MAP, rangeFor } from "./catalog"
import type { Region } from "./region"
import type { Allergy, InventoryItem, Patient, ResultFlag, TriageLevel, Vitals } from "./types"

// ---------------------------------------------------------------------------------------
// Age
// ---------------------------------------------------------------------------------------

export function ageOf(birthDate: string, now = new Date()): { years: number; months: number } {
  const b = new Date(birthDate)
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth())
  if (now.getDate() < b.getDate()) months -= 1
  return { years: Math.floor(months / 12), months: months % 12 }
}

/** "34 y", or "8 mo" for infants — the way ages are written on charts. */
export function ageLabel(birthDate: string): string {
  const { years, months } = ageOf(birthDate)
  return years >= 1 ? `${years} y` : `${months} mo`
}

// ---------------------------------------------------------------------------------------
// NEWS2 — National Early Warning Score 2 (Royal College of Physicians, 2017).
// Mandated across NHS England; widely adopted by US systems alongside MEWS / Rothman.
// ---------------------------------------------------------------------------------------

export interface News2 {
  score: number
  /** At least one parameter scored 3 — escalate even if the total is low. */
  redFlag: boolean
  risk: "low" | "medium" | "high"
  /** What the protocol asks the nurse to do. */
  response: string
}

function band(value: number | undefined, bands: [number, number, number][]): number {
  if (value === undefined || Number.isNaN(value)) return 0
  for (const [lo, hi, pts] of bands) if (value >= lo && value <= hi) return pts
  return 0
}

/** Returns null when too few parameters are recorded to score meaningfully. */
export function news2(v: Vitals): News2 | null {
  const recorded = [v.respRate, v.spo2, v.systolic, v.heartRate, v.temperature].filter((x) => x !== undefined).length
  if (recorded < 3) return null
  const parts = [
    band(v.respRate, [[0, 8, 3], [9, 11, 1], [12, 20, 0], [21, 24, 2], [25, 99, 3]]),
    band(v.spo2, [[0, 91, 3], [92, 93, 2], [94, 95, 1], [96, 100, 0]]),
    v.onOxygen ? 2 : 0,
    band(v.systolic, [[0, 90, 3], [91, 100, 2], [101, 110, 1], [111, 219, 0], [220, 400, 3]]),
    band(v.heartRate, [[0, 40, 3], [41, 50, 1], [51, 90, 0], [91, 110, 1], [111, 130, 2], [131, 300, 3]]),
    v.consciousness && v.consciousness !== "A" ? 3 : 0,
    band(v.temperature, [[0, 35, 3], [35.1, 36, 1], [36.1, 38, 0], [38.1, 39, 1], [39.1, 45, 2]]),
  ]
  const score = parts.reduce((a, b) => a + b, 0)
  const redFlag = parts.some((p) => p === 3)
  if (score >= 7) return { score, redFlag, risk: "high", response: "Emergency response: rapid response / critical care outreach; continuous monitoring" }
  if (score >= 5) return { score, redFlag, risk: "medium", response: "Urgent review by clinician within 1 h; observations at least hourly" }
  if (redFlag) return { score, redFlag, risk: "medium", response: "Single parameter scored 3 — urgent ward-based review; observations at least hourly" }
  return { score, redFlag, risk: "low", response: score === 0 ? "Observations at least every 12 h" : "Inform registered nurse; observations at least every 4–6 h" }
}

// ---------------------------------------------------------------------------------------
// Triage scales
// ESI v5 (ENA, 2023) in the US — acuity plus expected resources, no time targets.
// Manchester Triage System (3rd ed.) in the UK & much of Europe — maximum time to clinician.
// ---------------------------------------------------------------------------------------

export interface TriageInfo {
  label: string
  /** Maximum wait to be seen by a clinician, minutes (MTS) or local door-to-provider goal (ESI). */
  targetMin: number
  /** Colour name of the physical tag. */
  colour: "red" | "orange" | "yellow" | "green" | "blue"
  criteria: string
}

export const TRIAGE_SCALES: Record<Region, { name: string; levels: Record<TriageLevel, TriageInfo> }> = {
  us: {
    name: "Emergency Severity Index v5",
    levels: {
      1: { label: "Resuscitation", targetMin: 0, colour: "red", criteria: "Requires immediate life-saving intervention (airway, defibrillation, emergency meds)" },
      2: { label: "Emergent", targetMin: 10, colour: "orange", criteria: "High-risk situation, new confusion/lethargy, or severe pain/distress" },
      3: { label: "Urgent", targetMin: 30, colour: "yellow", criteria: "Stable; expected to need two or more resources (labs, imaging, IV meds)" },
      4: { label: "Less urgent", targetMin: 60, colour: "green", criteria: "Stable; one resource expected" },
      5: { label: "Non-urgent", targetMin: 120, colour: "blue", criteria: "Stable; no resources expected (exam, Rx only)" },
    },
  },
  uk: {
    name: "Manchester Triage System",
    levels: {
      1: { label: "Immediate", targetMin: 0, colour: "red", criteria: "Airway compromise, inadequate breathing, shock, unresponsive" },
      2: { label: "Very urgent", targetMin: 10, colour: "orange", criteria: "Very low SpO₂, cardiac pain, severe pain, altered conscious level" },
      3: { label: "Urgent", targetMin: 60, colour: "yellow", criteria: "Moderate pain, persistent vomiting, hot adult, significant history" },
      4: { label: "Standard", targetMin: 120, colour: "green", criteria: "Mild pain, recent problem, warm" },
      5: { label: "Non-urgent", targetMin: 240, colour: "blue", criteria: "No discriminators met" },
    },
  },
}

export const triageInfo = (region: Region, level: TriageLevel) => TRIAGE_SCALES[region].levels[level]

/** UK four-hour standard: arrival to admission, transfer or discharge. */
export const ED_FOUR_HOUR_MIN = 240

// ---------------------------------------------------------------------------------------
// Lab result flagging (values are in the region's unit system)
// ---------------------------------------------------------------------------------------

export function flagResult(testCode: string, raw: string, region: Region): ResultFlag {
  const test = LAB_MAP[testCode]
  const range = test ? rangeFor(test, region) : undefined
  if (test?.normalText) {
    const v = raw.trim().toLowerCase()
    return v === "" || v.startsWith(test.normalText.toLowerCase().slice(0, 8)) || v.startsWith("neg") || v.startsWith("no growth") ? "N" : "H"
  }
  const value = Number(raw.replace(",", "."))
  if (!range || raw.trim() === "" || Number.isNaN(value)) return "N"
  if (range.criticalLow !== undefined && value < range.criticalLow) return "LL"
  if (range.criticalHigh !== undefined && value > range.criticalHigh) return "HH"
  if (range.low !== undefined && value < range.low) return "L"
  if (range.high !== undefined && value > range.high) return "H"
  return "N"
}

export const isCritical = (flag: ResultFlag) => flag === "LL" || flag === "HH"

/** "3.5–5.1 mmol/L" — the reference range as printed on a lab report. */
export function rangeLabel(testCode: string, region: Region): string {
  const test = LAB_MAP[testCode]
  if (!test) return ""
  if (test.normalText) return test.normalText
  const r = rangeFor(test, region)
  if (!r) return ""
  const span = r.low !== undefined && r.high !== undefined ? `${r.low}–${r.high}` : r.high !== undefined ? `< ${r.high}` : r.low !== undefined ? `> ${r.low}` : ""
  return `${span} ${r.unit}`.trim()
}

// ---------------------------------------------------------------------------------------
// Sepsis
// US: CMS SEP-1 severe sepsis criteria (suspected infection + ≥ 2 SIRS + organ dysfunction).
// UK: NICE NG51 / UK Sepsis Trust "red flag sepsis" — any single red flag with infection.
// ---------------------------------------------------------------------------------------

export interface SepsisScreen {
  positive: boolean
  /** Criteria met, in plain words. */
  criteria: string[]
  /** What the screen means in the local protocol. */
  label: string
}

export function sepsisScreen(region: Region, v: Vitals | undefined, labs: { wbc?: number; lactate?: number } = {}): SepsisScreen {
  if (!v) return { positive: false, criteria: [], label: "No observations" }
  if (region === "us") {
    const sirs = [
      v.temperature !== undefined && (v.temperature > 38.3 || v.temperature < 36) && "Temp > 38.3 °C or < 36 °C",
      v.heartRate !== undefined && v.heartRate > 90 && "HR > 90",
      v.respRate !== undefined && v.respRate > 20 && "RR > 20",
      labs.wbc !== undefined && (labs.wbc > 12 || labs.wbc < 4) && "WBC > 12 or < 4",
    ].filter(Boolean) as string[]
    const organ = [
      v.systolic !== undefined && v.systolic < 90 && "SBP < 90 mmHg",
      labs.lactate !== undefined && labs.lactate > 2 && "Lactate > 2 mmol/L",
      v.consciousness && v.consciousness !== "A" && "Acutely altered mental status",
    ].filter(Boolean) as string[]
    const positive = sirs.length >= 2 && organ.length > 0
    return { positive, criteria: [...sirs, ...organ], label: positive ? "Meets SEP-1 severe sepsis criteria" : sirs.length >= 2 ? "SIRS positive — assess for infection & organ dysfunction" : "Screen negative" }
  }
  const red = [
    v.consciousness && v.consciousness !== "A" && "New confusion / altered mental state",
    v.systolic !== undefined && v.systolic <= 90 && "Systolic BP ≤ 90 mmHg",
    v.heartRate !== undefined && v.heartRate > 130 && "Heart rate > 130",
    v.respRate !== undefined && v.respRate >= 25 && "Respiratory rate ≥ 25",
    v.onOxygen && v.spo2 !== undefined && v.spo2 < 92 && "Needs O₂ to keep SpO₂ ≥ 92%",
    labs.lactate !== undefined && labs.lactate >= 2 && "Lactate ≥ 2 mmol/L",
  ].filter(Boolean) as string[]
  const score = news2(v)?.score ?? 0
  const positive = red.length > 0 || score >= 5
  return { positive, criteria: score >= 5 ? [`NEWS2 ${score}`, ...red] : red, label: positive ? "Red flag sepsis — start the Sepsis Six within 1 hour" : "No red flags" }
}

export interface BundleItem {
  id: string
  label: string
  /** Minutes from time zero. */
  dueMin: number
  /** Only applies when the patient is in septic shock / hypotensive. */
  shockOnly?: boolean
}

/** CMS SEP-1 3-hour and 6-hour bundles (US) or the UK Sepsis Six, all within one hour. */
export function sepsisBundle(region: Region): { name: string; items: BundleItem[] } {
  if (region === "us")
    return {
      name: "CMS SEP-1 bundle",
      items: [
        { id: "lactate", label: "Initial lactate", dueMin: 180 },
        { id: "cultures", label: "Blood cultures before antibiotics", dueMin: 180 },
        { id: "antibiotics", label: "Broad-spectrum antibiotics", dueMin: 180 },
        { id: "fluids", label: "30 mL/kg crystalloid (hypotension or lactate ≥ 4)", dueMin: 180, shockOnly: true },
        { id: "repeat-lactate", label: "Repeat lactate if initial > 2", dueMin: 360 },
        { id: "vasopressors", label: "Vasopressors for persistent hypotension", dueMin: 360, shockOnly: true },
        { id: "reassess", label: "Volume status & tissue perfusion reassessment", dueMin: 360, shockOnly: true },
      ],
    }
  return {
    name: "Sepsis Six",
    items: [
      { id: "oxygen", label: "Give oxygen to target SpO₂ 94–98% (88–92% if CO₂ retainer)", dueMin: 60 },
      { id: "cultures", label: "Take blood cultures", dueMin: 60 },
      { id: "antibiotics", label: "Give IV antibiotics", dueMin: 60 },
      { id: "fluids", label: "Give IV fluids", dueMin: 60 },
      { id: "lactate", label: "Measure lactate & full blood count", dueMin: 60 },
      { id: "urine", label: "Measure urine output", dueMin: 60 },
    ],
  }
}

// ---------------------------------------------------------------------------------------
// Nursing risk assessments
// Morse Fall Scale (Morse 1989) and Braden Scale for pressure injury risk (Bergstrom 1987).
// ---------------------------------------------------------------------------------------

export interface ScaleItem {
  id: string
  label: string
  options: { label: string; points: number }[]
}

export const MORSE_ITEMS: ScaleItem[] = [
  { id: "history", label: "History of falling (immediate or within 3 months)", options: [{ label: "No", points: 0 }, { label: "Yes", points: 25 }] },
  { id: "secondary", label: "Secondary diagnosis", options: [{ label: "No", points: 0 }, { label: "Yes", points: 15 }] },
  { id: "aid", label: "Ambulatory aid", options: [{ label: "None / bed rest / nurse assist", points: 0 }, { label: "Crutches / cane / walker", points: 15 }, { label: "Furniture", points: 30 }] },
  { id: "iv", label: "IV therapy / heparin lock", options: [{ label: "No", points: 0 }, { label: "Yes", points: 20 }] },
  { id: "gait", label: "Gait", options: [{ label: "Normal / bed rest / wheelchair", points: 0 }, { label: "Weak", points: 10 }, { label: "Impaired", points: 20 }] },
  { id: "mental", label: "Mental status", options: [{ label: "Oriented to own ability", points: 0 }, { label: "Overestimates / forgets limitations", points: 15 }] },
]

export function morseRisk(score: number): { level: "low" | "moderate" | "high"; action: string } {
  if (score >= 45) return { level: "high", action: "High fall risk: yellow wristband & socks, bed alarm, hourly rounding, toileting schedule" }
  if (score >= 25) return { level: "moderate", action: "Moderate risk: standard fall precautions, call light in reach, non-slip footwear" }
  return { level: "low", action: "Low risk: standard safety measures" }
}

export const BRADEN_ITEMS: ScaleItem[] = [
  { id: "sensory", label: "Sensory perception", options: [{ label: "Completely limited", points: 1 }, { label: "Very limited", points: 2 }, { label: "Slightly limited", points: 3 }, { label: "No impairment", points: 4 }] },
  { id: "moisture", label: "Moisture", options: [{ label: "Constantly moist", points: 1 }, { label: "Very moist", points: 2 }, { label: "Occasionally moist", points: 3 }, { label: "Rarely moist", points: 4 }] },
  { id: "activity", label: "Activity", options: [{ label: "Bedfast", points: 1 }, { label: "Chairfast", points: 2 }, { label: "Walks occasionally", points: 3 }, { label: "Walks frequently", points: 4 }] },
  { id: "mobility", label: "Mobility", options: [{ label: "Completely immobile", points: 1 }, { label: "Very limited", points: 2 }, { label: "Slightly limited", points: 3 }, { label: "No limitation", points: 4 }] },
  { id: "nutrition", label: "Nutrition", options: [{ label: "Very poor", points: 1 }, { label: "Probably inadequate", points: 2 }, { label: "Adequate", points: 3 }, { label: "Excellent", points: 4 }] },
  { id: "friction", label: "Friction & shear", options: [{ label: "Problem", points: 1 }, { label: "Potential problem", points: 2 }, { label: "No apparent problem", points: 3 }] },
]

export function bradenRisk(score: number): { level: "very-high" | "high" | "moderate" | "mild" | "none"; action: string } {
  if (score <= 9) return { level: "very-high", action: "Very high risk: pressure-redistribution mattress, 2-hourly turns, wound care / dietitian referral" }
  if (score <= 12) return { level: "high", action: "High risk: turning schedule, heel offloading, moisture management" }
  if (score <= 14) return { level: "moderate", action: "Moderate risk: turning schedule, support surface, nutrition review" }
  if (score <= 18) return { level: "mild", action: "At risk: reposition, protect heels, maximise mobility" }
  return { level: "none", action: "No significant risk: reassess daily and on change of condition" }
}

// ---------------------------------------------------------------------------------------
// Prescription review (pharmacist verification)
// ---------------------------------------------------------------------------------------

export interface DrugAlert {
  level: "danger" | "warning" | "info"
  message: string
}

/** Pairs of drug classes with a clinically significant interaction. */
const INTERACTIONS: { a: string; b: string; message: string }[] = [
  { a: "anticoagulant", b: "nsaid", message: "Anticoagulant + NSAID: major bleeding risk — avoid or add GI protection" },
  { a: "anticoagulant", b: "antiplatelet", message: "Anticoagulant + antiplatelet: bleeding risk — confirm indication (e.g. recent stent)" },
  { a: "ace-inhibitor", b: "potassium-sparing", message: "ACE inhibitor + potassium-sparing diuretic: hyperkalemia risk — monitor K⁺" },
  { a: "ace-inhibitor", b: "nsaid", message: "ACE inhibitor + NSAID: reduced antihypertensive effect, AKI risk (\"triple whammy\" with a diuretic)" },
  { a: "macrolide", b: "statin", message: "Macrolide + statin: myopathy / rhabdomyolysis risk — hold simvastatin" },
  { a: "opioid", b: "benzodiazepine", message: "Opioid + benzodiazepine: respiratory depression (FDA boxed warning)" },
  { a: "quinolone", b: "antacid", message: "Fluoroquinolone + antacid: chelation reduces absorption — separate by 2 h" },
]

/** Allergy substances map to the drug classes they cross-react with. */
const ALLERGY_CLASSES: Record<string, string[]> = {
  penicillin: ["penicillin", "cephalosporin"],
  amoxicillin: ["penicillin"],
  sulfa: ["sulfonamide"],
  "sulfonamide antibiotics": ["sulfonamide"],
  nsaids: ["nsaid"],
  ibuprofen: ["nsaid"],
  aspirin: ["nsaid", "antiplatelet"],
  cephalosporins: ["cephalosporin"],
  codeine: ["opioid"],
  morphine: ["opioid"],
}

function allergyHits(allergies: Allergy[], item: InventoryItem): Allergy | undefined {
  return allergies.find((a) => {
    const key = a.substance.toLowerCase()
    if (item.name.toLowerCase().includes(key)) return true
    const classes = ALLERGY_CLASSES[key] ?? []
    return !!item.drugClass && classes.includes(item.drugClass)
  })
}

export function reviewPrescription(patient: Patient, items: InventoryItem[], region: Region): DrugAlert[] {
  const alerts: DrugAlert[] = []
  for (const item of items) {
    const hit = allergyHits(patient.allergies, item)
    if (hit) alerts.push({ level: "danger", message: `${item.name}: documented ${hit.substance} allergy (${hit.reaction}, ${hit.severity})` })
    if (item.highAlert) alerts.push({ level: "warning", message: `${item.name} is an ISMP high-alert medication — independent double check required` })
    if (item.controlled)
      alerts.push({
        level: "info",
        message: region === "us" ? `${item.name}: DEA Schedule ${item.controlled} — prescriber DEA number and PDMP check required` : `${item.name}: Schedule ${item.controlled} controlled drug — CD register entry and witnessed administration`,
      })
    if (item.category === "drug" && item.formulary === false) alerts.push({ level: "info", message: `${item.name} is non-formulary — therapeutic interchange or pharmacy approval needed` })
  }
  const classes = items.map((i) => i.drugClass).filter((c): c is string => !!c)
  for (const rule of INTERACTIONS) {
    if (classes.includes(rule.a) && classes.includes(rule.b)) alerts.push({ level: "warning", message: rule.message })
  }
  const dup = classes.filter((c, i) => classes.indexOf(c) !== i && !["fluid", "electrolyte"].includes(c))
  for (const c of new Set(dup)) alerts.push({ level: "warning", message: `Therapeutic duplication: more than one ${c}` })
  return alerts
}

// ---------------------------------------------------------------------------------------
// Encounter wait time
// ---------------------------------------------------------------------------------------

export function minutesSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
}
