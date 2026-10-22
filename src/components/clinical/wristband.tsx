/**
 * The patient wristband — Medisphere's identity element. It mirrors the physical band
 * nurses check before every action: identity colour (biru laki-laki / merah muda
 * perempuan), two identifiers (name + No. RM + date of birth), and clip-on marker bands
 * (merah alergi, kuning risiko jatuh, ungu DNR) that can never be hidden behind a click.
 */
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ageLabel } from "@/domain/clinical"
import type { Patient, PayerType } from "@/domain/types"
import { cn } from "@/lib/cn"
import { formatDate } from "@/lib/format"
import { Barcode } from "./barcode"

const PAYER: Record<PayerType, string> = { bpjs: "JKN · BPJS", umum: "UMUM", asuransi: "ASURANSI" }

interface WristbandProps {
  patient: Patient
  payer?: PayerType
  /** Extra identifiers for this visit, e.g. SEP or queue number. */
  meta?: ReactNode
  aside?: ReactNode
  compact?: boolean
  /** Link the name to the patient chart (off inside the chart itself). */
  linked?: boolean
}

export function Wristband({ patient, payer, meta, aside, compact, linked = true }: WristbandProps) {
  const female = patient.gender === "female"
  const markers = Markers({ patient })
  const name = (
    <span className={cn("font-display font-semibold leading-tight tracking-tight", compact ? "text-base" : "text-xl")}>{patient.name}</span>
  )
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
      <div className={cn("relative flex min-w-0 flex-1 items-stretch overflow-hidden rounded-2xl border border-border bg-surface", markers.length > 0 && "lg:rounded-r-md")}>
        {/* Identity strip: colour by sex, as on the physical band. */}
        <div className={cn("flex shrink-0 items-center gap-2 px-3 text-white", female ? "bg-band-female" : "bg-band-male")}>
          <span className="size-3 rounded-full border-2 border-white/80 bg-white/20" aria-hidden />
          <Barcode value={patient.mrn} height={compact ? 26 : 34} className="w-12 text-white/90" />
        </div>
        <div className={cn("flex min-w-0 flex-1 flex-col justify-center gap-1", compact ? "px-3 py-2" : "px-4 py-3")}>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {linked ? (
              <Link to={`/patients/${patient.id}`} className="hover:underline">
                {name}
              </Link>
            ) : (
              name
            )}
            <span className="num text-xs text-muted">
              {female ? "P" : "L"} · {ageLabel(patient.birthDate)}
            </span>
          </div>
          <div className="num flex flex-wrap gap-x-3 text-[11.5px] text-muted">
            <span>
              RM <b className="font-semibold text-foreground">{patient.mrn}</b>
            </span>
            <span>Lahir {formatDate(patient.birthDate)}</span>
            {patient.bloodType && !compact && <span>Gol. {patient.bloodType}</span>}
            {meta}
          </div>
        </div>
        <div className="hidden shrink-0 items-center pr-4 sm:flex">
          <span className="label-caps rounded-md border border-dashed border-border px-2 py-1 text-muted">{PAYER[payer ?? patient.payer]}</span>
        </div>
      </div>
      {(markers.length > 0 || aside) && (
        <div className="flex flex-wrap items-stretch gap-1.5">
          {markers}
          {aside && <div className="flex flex-wrap items-center gap-2 lg:pl-2">{aside}</div>}
        </div>
      )}
    </div>
  )
}

/** Clip-on marker bands. Returned as an array so callers can tell if there are any. */
function Markers({ patient }: { patient: Patient }): ReactNode[] {
  const out: ReactNode[] = []
  if (patient.allergies.length)
    out.push(<Band key="allergy" className="bg-band-allergy text-white" label="Alergi" value={patient.allergies.map((a) => a.substance).join(", ")} />)
  if (patient.flags?.includes("fall-risk")) out.push(<Band key="fall" className="bg-band-fall text-[oklch(0.25_0.05_90)]" label="Risiko" value="Jatuh" />)
  if (patient.flags?.includes("dnr")) out.push(<Band key="dnr" className="bg-band-dnr text-white" label="DNR" value="Jangan resusitasi" />)
  return out
}

function Band({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className={cn("flex min-w-24 flex-col justify-center rounded-md px-3 py-1.5 shadow-sm lg:rounded-l-sm", className)} title={`${label}: ${value}`}>
      <span className="label-caps opacity-80">{label}</span>
      <span className="max-w-44 truncate text-sm font-semibold">{value}</span>
    </div>
  )
}

/** Tiny marker dots for dense lists (bed tiles, worklists). */
export function MarkerDots({ patient }: { patient: Patient }) {
  const dots: { cls: string; label: string }[] = []
  if (patient.allergies.length) dots.push({ cls: "bg-band-allergy", label: `Alergi ${patient.allergies.map((a) => a.substance).join(", ")}` })
  if (patient.flags?.includes("fall-risk")) dots.push({ cls: "bg-band-fall", label: "Risiko jatuh" })
  if (patient.flags?.includes("dnr")) dots.push({ cls: "bg-band-dnr", label: "DNR" })
  if (!dots.length) return null
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={dots.map((d) => d.label).join(", ")}>
      {dots.map((d) => (
        <span key={d.label} title={d.label} className={cn("h-3 w-1.5 rounded-[2px]", d.cls)} />
      ))}
    </span>
  )
}
