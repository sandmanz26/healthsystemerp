/**
 * Patient identification for every screen that acts on one patient — rendered as the
 * wristband (see components/clinical/wristband.tsx). Joint Commission NPSG.01.01.01 /
 * NHS positive patient identification: two identifiers and allergy / fall / code-status
 * markers always visible.
 */
import type { ReactNode } from "react"
import { Wristband } from "@v2/components/clinical/wristband"
import type { Encounter, Patient } from "@v2/domain/types"
import { useRegion } from "@v2/store/selectors"

interface PatientBannerProps {
  patient: Patient
  encounter?: Encounter
  /** Extra content on the right (bed, queue number, actions). */
  aside?: ReactNode
  compact?: boolean
}

export function PatientBanner({ patient, encounter, aside, compact }: PatientBannerProps) {
  const region = useRegion()
  const meta = encounter?.accountNumber ? (
    <span>
      {region === "us" ? "Acct" : "Spell"} <b className="font-semibold text-foreground">{encounter.accountNumber}</b>
    </span>
  ) : undefined
  return <Wristband patient={patient} payer={encounter?.payer} compact={compact} aside={aside} meta={meta} />
}
