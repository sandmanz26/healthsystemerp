/** Shared inpatient helpers: bed type labels, LOS arithmetic and discharge-planning vocab. */
import { minutesSince } from "@/domain/clinical"
import type { Region } from "@/domain/region"
import type { BedType, Encounter } from "@/domain/types"

export const BED_TYPE_LABEL: Record<BedType, string> = {
  "med-surg": "Med/Surg",
  telemetry: "Telemetry",
  icu: "ICU",
  isolation: "Isolation",
  private: "Private",
}

export const BARRIERS: Record<Region, string[]> = {
  us: [
    "Awaiting SNF bed / payer authorization",
    "Home health set-up pending",
    "Pending test or imaging",
    "Pending specialist consult",
    "Awaiting DME delivery",
    "Transportation",
    "Family / caregiver meeting",
    "Medically not ready",
  ],
  uk: [
    "Awaiting package of care (social care)",
    "Awaiting care home placement",
    "Awaiting therapy assessment (PT/OT)",
    "Awaiting TTO medications",
    "Pending investigation",
    "Awaiting specialist review",
    "Continuing Healthcare assessment",
    "Awaiting patient transport",
  ],
}

/** Whole days since admission (day of admission = day 1). */
export const losDays = (e: Encounter, now = Date.now()) => Math.max(1, Math.ceil(minutesSince(e.startedAt ?? e.createdAt, now) / 1440))
export const obsHours = (e: Encounter, now = Date.now()) => Math.max(0, Math.round(minutesSince(e.startedAt ?? e.createdAt, now) / 60))
/** Days from admission to EDD (planned LOS). */
export const plannedLos = (e: Encounter) => (e.dischargePlan ? Math.max(1, Math.round((new Date(e.dischargePlan.edd).getTime() - new Date(e.startedAt ?? e.createdAt).getTime()) / 86400000)) : undefined)

export function readyLabel(region: Region) {
  return region === "us" ? "Medically ready" : "No criteria to reside (NCTR)"
}

/** Medicare IM notice is overdue after 2 calendar days without delivery. */
export const imOverdue = (e: Encounter, now = Date.now()) => e.dischargePlan?.imNotice === false && minutesSince(e.startedAt ?? e.createdAt, now) > 2 * 1440
