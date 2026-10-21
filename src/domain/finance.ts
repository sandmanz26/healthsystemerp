/**
 * Billing & claims rules.
 */
import { ICD10 } from "./catalog"
import type { Claim, Encounter, Invoice, Patient } from "./types"

export const invoiceTotal = (inv: Invoice) => inv.charges.reduce((sum, c) => sum + c.qty * c.price, 0)
export const invoicePaid = (inv: Invoice) => inv.payments.reduce((sum, p) => sum + p.amount, 0)
export const invoiceBalance = (inv: Invoice) => invoiceTotal(inv) - invoicePaid(inv)

export interface ClaimCheck {
  id: string
  label: string
  ok: boolean
}

/** Berkas klaim completeness — the reasons BPJS most often returns a claim as "pending". */
export function claimChecklist(enc: Encounter, patient: Patient): ClaimCheck[] {
  const primary = enc.diagnoses.find((d) => d.primary)
  return [
    { id: "sep", label: "SEP terbit", ok: patient.payer !== "bpjs" || !!enc.sepNumber },
    { id: "dx", label: "Diagnosis utama terisi", ok: !!primary },
    { id: "dx-specific", label: "Diagnosis utama spesifik (bukan kode R/simtom)", ok: !!primary && !primary.code.startsWith("R") },
    { id: "resume", label: "Resume medis / CPPT dokter ada", ok: enc.notes.some((n) => n.role === "doctor") },
    { id: "procedure", label: "Tindakan dikoding (rawat inap/operasi)", ok: enc.kind !== "inpatient" || enc.procedures.length > 0 },
    { id: "closed", label: "Kunjungan sudah selesai", ok: enc.status === "finished" },
  ]
}

/**
 * Mock grouper. The real iDRG/INA-CBG grouper runs in the Kemenkes E-Klaim application;
 * this only produces a plausible estimate so coders can see the shape of the result.
 */
export function estimateGroup(enc: Encounter, grouper: Exclude<Claim["grouper"], "FFS">): { code: string; name: string; tariff: number } | null {
  const primary = enc.diagnoses.find((d) => d.primary)
  if (!primary) return null
  const chapter = primary.code[0]
  const severity = Math.min(3, 1 + enc.diagnoses.length - 1 + (enc.procedures.length > 0 ? 1 : 0))
  const setting = enc.kind === "inpatient" ? "I" : enc.kind === "emergency" ? "E" : "Q"
  const base = enc.kind === "inpatient" ? 4_200_000 : enc.kind === "emergency" ? 850_000 : 215_000
  const factor = 1 + (severity - 1) * 0.45 + (enc.procedures.length > 0 ? 0.8 : 0)
  const name = ICD10.find((c) => c.code === primary.code)?.display ?? primary.display
  const roman = ["I", "II", "III"][severity - 1]
  const code = grouper === "iDRG" ? `${chapter}${setting}-${String(primary.code.charCodeAt(1) % 90).padStart(2, "0")}-${roman}` : `${chapter}-${setting === "I" ? 4 : 1}-${String(primary.code.length * 7).padStart(2, "0")}-${roman}`
  return { code, name: `${name} (tingkat ${roman})`, tariff: Math.round((base * factor) / 1000) * 1000 }
}
