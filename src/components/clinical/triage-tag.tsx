import { TRIAGE } from "@/domain/clinical"
import type { TriageLevel } from "@/domain/types"
import { cn } from "@/lib/cn"

const TAG: Record<TriageLevel, string> = {
  1: "bg-ats-1 text-white",
  2: "bg-ats-2 text-[oklch(0.2_0.04_50)]",
  3: "bg-ats-3 text-[oklch(0.18_0.04_150)]",
  4: "bg-ats-4 text-white",
  5: "bg-ats-5 text-[oklch(0.3_0.02_90)] ring-1 ring-inset ring-border",
}

/** ATS triage level as the physical tag tied to the patient (colour + number + label). */
export function TriageTag({ level }: { level?: TriageLevel }) {
  if (!level)
    return (
      <span className="triage-tag label-caps inline-flex items-center gap-1.5 bg-default py-1 pl-5 pr-2.5 text-muted">
        Belum triase
      </span>
    )
  return (
    <span className={cn("triage-tag inline-flex items-center gap-1.5 py-1 pl-5 pr-2.5", TAG[level])}>
      <span className="num text-sm font-bold leading-none">{level}</span>
      <span className="label-caps leading-none">{TRIAGE[level].label}</span>
    </span>
  )
}
