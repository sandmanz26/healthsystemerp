/**
 * The patient wristband — Medisphere's identity element. It mirrors the physical band staff
 * check before every action: two identifiers (name + date of birth, plus MRN — and NHS
 * number in the UK), and clip-on alert bands in the colours US state hospital associations
 * standardised (red allergy, yellow fall risk, purple DNR) and the NPSA red allergy band in
 * the UK. Alerts can never be hidden behind a click.
 */
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ageLabel } from "@/domain/clinical"
import { PAYER_LABEL } from "@/domain/finance"
import { formatNhsNumber } from "@/domain/interop"
import type { Patient, PayerType } from "@/domain/types"
import { cn } from "@/lib/cn"
import { formatDate } from "@/lib/format"
import { useRegion } from "@/store/selectors"
import { Barcode } from "./barcode"
import { codeStatusLabel } from "./labels"

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
  const region = useRegion()
  const markers = Markers({ patient, region })
  const name = (
    <span className={cn("font-display font-semibold leading-tight tracking-tight", compact ? "text-base" : "text-xl")}>{patient.name}</span>
  )
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
      <div className={cn("relative flex min-w-0 flex-1 items-stretch overflow-hidden rounded-2xl border border-border bg-surface", markers.length > 0 && "lg:rounded-r-md")}>
        {/* Barcode strip: the band is scanned before medication, specimens and blood. */}
        <div className="flex shrink-0 items-center gap-2 bg-foreground px-3 text-background">
          <span className="size-3 rounded-full border-2 border-white/80 bg-white/20" aria-hidden />
          <Barcode value={patient.mrn} height={compact ? 26 : 34} className="w-12 opacity-90" />
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
              {patient.gender === "female" ? "F" : "M"} · {ageLabel(patient.birthDate)}
            </span>
          </div>
          <div className="num flex flex-wrap gap-x-3 text-[11.5px] text-muted">
            <span>
              DOB <b className="font-semibold text-foreground">{formatDate(patient.birthDate)}</b>
            </span>
            <span>
              MRN <b className="font-semibold text-foreground">{patient.mrn}</b>
            </span>
            {patient.nhsNumber && (
              <span>
                NHS <b className="font-semibold text-foreground">{formatNhsNumber(patient.nhsNumber)}</b>
              </span>
            )}
            {meta}
          </div>
        </div>
        <div className="hidden shrink-0 items-center pr-4 sm:flex">
          <span className="label-caps rounded-md border border-dashed border-border px-2 py-1 text-muted">{PAYER_LABEL[payer ?? patient.payer]}</span>
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
function Markers({ patient, region }: { patient: Patient; region: "us" | "uk" }): ReactNode[] {
  const out: ReactNode[] = []
  if (patient.allergies.length)
    out.push(<Band key="allergy" className="bg-band-allergy text-white" label="Allergy" value={patient.allergies.map((a) => a.substance).join(", ")} />)
  if (patient.flags?.includes("fall-risk")) out.push(<Band key="fall" className="bg-band-fall text-[oklch(0.25_0.05_90)]" label="Fall risk" value="High" />)
  if (patient.codeStatus !== "full") out.push(<Band key="dnr" className="bg-band-dnr text-white" label="Code status" value={codeStatusLabel(patient.codeStatus, region)} />)
  if (patient.flags?.includes("contact-isolation")) out.push(<Band key="iso" className="bg-triage-4 text-[oklch(0.18_0.04_150)]" label="Isolation" value="Contact" />)
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
  if (patient.allergies.length) dots.push({ cls: "bg-band-allergy", label: `Allergy: ${patient.allergies.map((a) => a.substance).join(", ")}` })
  if (patient.flags?.includes("fall-risk")) dots.push({ cls: "bg-band-fall", label: "Fall risk" })
  if (patient.codeStatus !== "full") dots.push({ cls: "bg-band-dnr", label: "Not for resuscitation" })
  if (patient.flags?.includes("contact-isolation")) dots.push({ cls: "bg-triage-4", label: "Contact isolation" })
  if (!dots.length) return null
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={dots.map((d) => d.label).join(", ")}>
      {dots.map((d) => (
        <span key={d.label} title={d.label} className={cn("h-3 w-1.5 rounded-[2px]", d.cls)} />
      ))}
    </span>
  )
}
