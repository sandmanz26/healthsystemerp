import type { Patient } from "./types"

/** Patient search across the identifiers front-desk staff actually type: name, MRN, NHS number, member ID, DOB. */
export function matchPatient(p: Patient, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  const digits = s.replace(/\s/g, "")
  return (
    p.name.toLowerCase().includes(s) ||
    p.mrn.toLowerCase().includes(s) ||
    (!!digits && (p.nhsNumber ?? "").includes(digits)) ||
    (p.coverage?.memberId ?? "").toLowerCase().includes(s) ||
    p.birthDate.slice(0, 10) === s
  )
}
