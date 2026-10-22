/** Shared labels and colour classes for the clinical components. */
import type { CodeStatus, TriageLevel } from "@v2/domain/types"

/** Code status as written on the band and banner, per market. */
export function codeStatusLabel(status: CodeStatus, region: "us" | "uk"): string {
  if (status === "full") return region === "us" ? "Full code" : "For CPR"
  if (status === "comfort") return region === "us" ? "Comfort care" : "End-of-life care"
  if (region === "uk") return "DNACPR"
  return status === "dnr-dni" ? "DNR / DNI" : "DNR"
}

export const TRIAGE_BG: Record<TriageLevel, string> = {
  1: "bg-triage-1 text-white",
  2: "bg-triage-2 text-[oklch(0.22_0.05_55)]",
  3: "bg-triage-3 text-[oklch(0.25_0.05_95)]",
  4: "bg-triage-4 text-[oklch(0.18_0.04_150)]",
  5: "bg-triage-5 text-white",
}
