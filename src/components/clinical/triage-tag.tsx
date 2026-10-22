import { triageInfo, TRIAGE_SCALES } from "@/domain/clinical"
import type { TriageLevel } from "@/domain/types"
import { cn } from "@/lib/cn"
import { useRegion } from "@/store/selectors"
import { TRIAGE_BG } from "./labels"

/** Triage level as the physical tag tied to the patient (colour + number + label). ESI in the US, MTS in the UK. */
export function TriageTag({ level }: { level?: TriageLevel }) {
  const region = useRegion()
  if (!level)
    return (
      <span className="triage-tag label-caps inline-flex items-center gap-1.5 bg-default py-1 pl-5 pr-2.5 text-muted">
        Not triaged
      </span>
    )
  const scale = region === "us" ? "ESI" : "MTS"
  return (
    <span className={cn("triage-tag inline-flex items-center gap-1.5 py-1 pl-5 pr-2.5", TRIAGE_BG[level])} title={`${TRIAGE_SCALES[region].name} ${level}: ${triageInfo(region, level).criteria}`}>
      <span className="num text-sm font-bold leading-none">
        <span className="sr-only">{scale} </span>
        {level}
      </span>
      <span className="label-caps leading-none">{triageInfo(region, level).label}</span>
    </span>
  )
}
