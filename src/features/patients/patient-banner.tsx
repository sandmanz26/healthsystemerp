/**
 * Patient identification for every screen that acts on one patient — rendered as the
 * wristband (see components/clinical/wristband.tsx). Patient safety goal #1: two
 * identifiers and allergy/fall/DNR markers always visible.
 */
import type { ReactNode } from "react"
import { Wristband } from "@/components/clinical/wristband"
import type { Encounter, Patient } from "@/domain/types"

interface PatientBannerProps {
  patient: Patient
  encounter?: Encounter
  /** Extra content on the right (bed, queue number, actions). */
  aside?: ReactNode
  compact?: boolean
}

export function PatientBanner({ patient, encounter, aside, compact }: PatientBannerProps) {
  return <Wristband patient={patient} payer={encounter?.payer} compact={compact} aside={aside} meta={encounter?.sepNumber ? <span>SEP {encounter.sepNumber}</span> : undefined} />
}
