/**
 * Patient identification banner. Shown on every screen that acts on one patient.
 * Patient safety goal #1: two identifiers (name + No. RM + date of birth) always visible,
 * allergies in red, never hidden behind a click.
 */
import { Avatar, Chip } from "@heroui/react"
import { AlertTriangle, ShieldCheck } from "lucide-react"
import { Link } from "react-router-dom"
import { PayerChip } from "@/components/status"
import { ageLabel } from "@/domain/clinical"
import type { Encounter, Patient } from "@/domain/types"
import { cn } from "@/lib/cn"
import { formatDate, initials } from "@/lib/format"

interface PatientBannerProps {
  patient: Patient
  encounter?: Encounter
  /** Extra content on the right (bed, queue number, actions). */
  aside?: React.ReactNode
  compact?: boolean
}

export function PatientBanner({ patient, encounter, aside, compact }: PatientBannerProps) {
  const hasAllergy = patient.allergies.length > 0
  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between", hasAllergy && "border-danger/40")}>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar color={patient.gender === "female" ? "danger" : "accent"} variant="soft" size={compact ? "sm" : "md"}>
          <Avatar.Fallback>{initials(patient.name)}</Avatar.Fallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link to={`/patients/${patient.id}`} className="truncate text-base font-semibold hover:underline">
              {patient.name}
            </Link>
            <span className="text-sm text-muted">
              {patient.gender === "female" ? "P" : "L"} · {ageLabel(patient.birthDate)}
            </span>
            <PayerChip payer={encounter?.payer ?? patient.payer} />
          </div>
          <div className="tabular mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
            <span>
              No. RM <b className="text-foreground">{patient.mrn}</b>
            </span>
            <span>Tgl lahir {formatDate(patient.birthDate)}</span>
            {patient.bloodType && <span>Gol. darah {patient.bloodType}</span>}
            {encounter?.sepNumber && <span>SEP {encounter.sepNumber}</span>}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {hasAllergy ? (
          <Chip color="danger" variant="primary" size="sm">
            <AlertTriangle className="size-3.5" aria-hidden />
            Alergi: {patient.allergies.map((a) => a.substance).join(", ")}
          </Chip>
        ) : (
          <Chip color="default" variant="soft" size="sm">
            <ShieldCheck className="size-3.5" aria-hidden />
            Tidak ada alergi tercatat
          </Chip>
        )}
        {aside}
      </div>
    </div>
  )
}
