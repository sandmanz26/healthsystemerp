/**
 * Clinical decision support: pure functions, no React, no store.
 * Each rule cites its source so clinicians can check it.
 */
import { LAB_MAP } from "./catalog"
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

/** "34 th", or "8 bln" for infants — what clinicians write on charts. */
export function ageLabel(birthDate: string): string {
  const { years, months } = ageOf(birthDate)
  return years >= 1 ? `${years} th` : `${months} bln`
}

// ---------------------------------------------------------------------------------------
// NEWS2 — National Early Warning Score 2 (Royal College of Physicians, 2017)
// ---------------------------------------------------------------------------------------

export interface News2 {
  score: number
  /** At least one parameter scored 3 — escalate even if the total is low. */
  redFlag: boolean
  risk: "rendah" | "sedang" | "tinggi"
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
  if (score >= 7) return { score, redFlag, risk: "tinggi", response: "Panggil tim reaksi cepat; monitoring kontinu" }
  if (score >= 5 || redFlag) return { score, redFlag, risk: "sedang", response: "Lapor DPJP segera; observasi tiap 1 jam" }
  return { score, redFlag, risk: "rendah", response: score === 0 ? "Observasi tiap 12 jam" : "Observasi tiap 4–6 jam" }
}

// ---------------------------------------------------------------------------------------
// Triage — Australasian Triage Scale (ATS), the scale most Indonesian ERs train on
// ---------------------------------------------------------------------------------------

export const TRIAGE: Record<TriageLevel, { label: string; color: "danger" | "warning" | "success" | "accent" | "default"; targetMin: number; examples: string }> = {
  1: { label: "Resusitasi", color: "danger", targetMin: 0, examples: "Henti jantung/napas, syok berat, GCS < 9" },
  2: { label: "Emergensi", color: "danger", targetMin: 10, examples: "Nyeri dada khas, sesak berat, stroke < 4 jam" },
  3: { label: "Urgen", color: "warning", targetMin: 30, examples: "Hipertensi berat, nyeri sedang-berat, dehidrasi sedang" },
  4: { label: "Semi-urgen", color: "success", targetMin: 60, examples: "Cedera ringan, nyeri ringan, demam tanpa tanda bahaya" },
  5: { label: "Tidak urgen", color: "default", targetMin: 120, examples: "Keluhan kronis stabil, luka kecil, kontrol" },
}

// ---------------------------------------------------------------------------------------
// Lab result flagging
// ---------------------------------------------------------------------------------------

export function flagResult(testCode: string, raw: string): ResultFlag {
  const test = LAB_MAP[testCode]
  const value = Number(raw.replace(",", "."))
  if (!test || raw.trim() === "" || Number.isNaN(value)) return "N"
  if (test.criticalLow !== undefined && value < test.criticalLow) return "LL"
  if (test.criticalHigh !== undefined && value > test.criticalHigh) return "HH"
  if (test.low !== undefined && value < test.low) return "L"
  if (test.high !== undefined && value > test.high) return "H"
  return "N"
}

export const isCritical = (flag: ResultFlag) => flag === "LL" || flag === "HH"

// ---------------------------------------------------------------------------------------
// Prescription review (telaah resep)
// ---------------------------------------------------------------------------------------

export interface DrugAlert {
  level: "danger" | "warning" | "info"
  message: string
}

/** Pairs of drug classes with a clinically significant interaction. */
const INTERACTIONS: { a: string; b: string; message: string }[] = [
  { a: "warfarin", b: "nsaid", message: "Warfarin + NSAID: risiko perdarahan meningkat" },
  { a: "ace-inhibitor", b: "potassium-sparing", message: "ACE inhibitor + diuretik hemat kalium: risiko hiperkalemia" },
  { a: "ace-inhibitor", b: "nsaid", message: "ACE inhibitor + NSAID: menurunkan efek antihipertensi, risiko gangguan ginjal" },
  { a: "macrolide", b: "statin", message: "Makrolida + statin: risiko miopati/rabdomiolisis" },
  { a: "quinolone", b: "antacid", message: "Kuinolon + antasida: absorpsi kuinolon menurun, beri jeda 2 jam" },
]

/** Allergy substances map to the drug classes they cross-react with. */
const ALLERGY_CLASSES: Record<string, string[]> = {
  penisilin: ["penicillin", "cephalosporin"],
  amoksisilin: ["penicillin"],
  sulfa: ["sulfonamide"],
  nsaid: ["nsaid"],
  ibuprofen: ["nsaid"],
  aspirin: ["nsaid"],
  sefalosporin: ["cephalosporin"],
}

function allergyHits(allergies: Allergy[], item: InventoryItem): Allergy | undefined {
  return allergies.find((a) => {
    const key = a.substance.toLowerCase()
    if (item.name.toLowerCase().includes(key)) return true
    const classes = ALLERGY_CLASSES[key] ?? []
    return !!item.drugClass && classes.includes(item.drugClass)
  })
}

export function reviewPrescription(patient: Patient, items: InventoryItem[]): DrugAlert[] {
  const alerts: DrugAlert[] = []
  for (const item of items) {
    const hit = allergyHits(patient.allergies, item)
    if (hit) alerts.push({ level: "danger", message: `${item.name}: pasien alergi ${hit.substance} (${hit.reaction})` })
    if (item.highAlert) alerts.push({ level: "warning", message: `${item.name} adalah obat high-alert — perlu double check` })
    if (patient.payer === "bpjs" && item.category === "obat" && !item.fornas)
      alerts.push({ level: "info", message: `${item.name} di luar Fornas — perlu justifikasi untuk pasien JKN` })
  }
  const classes = items.map((i) => i.drugClass).filter((c): c is string => !!c)
  for (const rule of INTERACTIONS) {
    if (classes.includes(rule.a) && classes.includes(rule.b)) alerts.push({ level: "warning", message: rule.message })
  }
  const dup = classes.filter((c, i) => classes.indexOf(c) !== i)
  for (const c of new Set(dup)) alerts.push({ level: "warning", message: `Duplikasi terapi: lebih dari satu obat golongan ${c}` })
  return alerts
}

// ---------------------------------------------------------------------------------------
// Encounter wait time
// ---------------------------------------------------------------------------------------

export function minutesSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
}
