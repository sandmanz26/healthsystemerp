import type { Patient } from "./types"

/** Patient search across the identifiers front-desk staff actually type: No. RM, NIK, BPJS number, name. */
export function matchPatient(p: Patient, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return p.name.toLowerCase().includes(s) || p.mrn.includes(s) || p.nik.includes(s) || (p.bpjsNumber ?? "").includes(s)
}
