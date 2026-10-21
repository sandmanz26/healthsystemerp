/**
 * Patient safety & quality rules (KKPRS risk matrix, Indikator Mutu Nasional).
 */
import type { IndicatorValue, RiskGrade } from "./types"

export const INCIDENT_TYPES = {
  KTD: "Kejadian Tidak Diharapkan — insiden yang mencederai pasien",
  KNC: "Kejadian Nyaris Cedera — insiden belum terpapar ke pasien",
  KTC: "Kejadian Tidak Cedera — terpapar ke pasien tetapi tidak cedera",
  KPC: "Kondisi Potensial Cedera — kondisi berisiko, belum terjadi insiden",
  Sentinel: "Kejadian Sentinel — kematian atau cedera permanen/berat",
} as const

export const IMPACT_LABEL = ["", "Tidak signifikan", "Minor", "Moderat", "Mayor", "Katastropik"]
export const PROBABILITY_LABEL = ["", "Sangat jarang (>5 th)", "Jarang (2–5 th)", "Mungkin (1–2 th)", "Sering (beberapa kali/th)", "Sangat sering (tiap minggu/bulan)"]

/**
 * Risk grading matrix from the national patient safety guideline (KKPRS).
 * Rows = probability 1..5, columns = impact 1..5.
 */
const MATRIX: RiskGrade[][] = [
  ["biru", "biru", "hijau", "kuning", "kuning"],
  ["biru", "biru", "hijau", "kuning", "kuning"],
  ["biru", "hijau", "kuning", "kuning", "merah"],
  ["biru", "hijau", "kuning", "merah", "merah"],
  ["hijau", "kuning", "kuning", "merah", "merah"],
]

export function riskGrade(probability: number, impact: number): RiskGrade {
  return MATRIX[probability - 1][impact - 1]
}

export const GRADE_INFO: Record<RiskGrade, { label: string; action: string; color: "accent" | "success" | "warning" | "danger" }> = {
  biru: { label: "Biru (rendah)", action: "Investigasi sederhana oleh atasan langsung, maks. 1 minggu", color: "accent" },
  hijau: { label: "Hijau (moderat)", action: "Investigasi sederhana oleh atasan langsung, maks. 2 minggu", color: "success" },
  kuning: { label: "Kuning (tinggi)", action: "Investigasi komprehensif / RCA oleh tim KPRS, maks. 45 hari", color: "warning" },
  merah: { label: "Merah (ekstrem)", action: "RCA oleh tim KPRS, lapor direksi segera, maks. 45 hari", color: "danger" },
}

export interface IndicatorDef {
  id: string
  name: string
  /** Target as a percentage, interpreted with `direction`. */
  target: number
  direction: "min" | "max"
  unit: "%"
}

/** The 13 Indikator Mutu Nasional for hospitals. */
export const INM: IndicatorDef[] = [
  { id: "hand-hygiene", name: "Kepatuhan kebersihan tangan", target: 85, direction: "min", unit: "%" },
  { id: "apd", name: "Kepatuhan penggunaan APD", target: 100, direction: "min", unit: "%" },
  { id: "patient-id", name: "Kepatuhan identifikasi pasien", target: 100, direction: "min", unit: "%" },
  { id: "sc-emergency", name: "Waktu tanggap SC emergensi ≤ 30 menit", target: 80, direction: "min", unit: "%" },
  { id: "op-wait", name: "Waktu tunggu rawat jalan ≤ 60 menit", target: 80, direction: "min", unit: "%" },
  { id: "or-delay", name: "Penundaan operasi elektif", target: 5, direction: "max", unit: "%" },
  { id: "visit-time", name: "Kepatuhan waktu visite dokter", target: 80, direction: "min", unit: "%" },
  { id: "critical-lab", name: "Pelaporan hasil kritis laboratorium ≤ 30 menit", target: 100, direction: "min", unit: "%" },
  { id: "fornas", name: "Kepatuhan penggunaan Formularium Nasional", target: 80, direction: "min", unit: "%" },
  { id: "cpg", name: "Kepatuhan terhadap alur klinis (clinical pathway)", target: 80, direction: "min", unit: "%" },
  { id: "fall-risk", name: "Kepatuhan upaya pencegahan risiko jatuh", target: 100, direction: "min", unit: "%" },
  { id: "complaint", name: "Kecepatan waktu tanggap komplain", target: 80, direction: "min", unit: "%" },
  { id: "satisfaction", name: "Kepuasan pasien", target: 76.61, direction: "min", unit: "%" },
]

export function indicatorRate(v: IndicatorValue): number {
  return v.denominator === 0 ? 0 : (v.numerator / v.denominator) * 100
}

export function meetsTarget(def: IndicatorDef, rate: number): boolean {
  return def.direction === "min" ? rate >= def.target : rate <= def.target
}
