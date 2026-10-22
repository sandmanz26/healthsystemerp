/** How an appointment was booked, in each market's words. */
import type { Region } from "@v2/domain/region"
import type { AppointmentSource } from "@v2/domain/types"

const LABEL: Record<AppointmentSource, Record<Region, string>> = {
  portal: { us: "Patient portal", uk: "NHS App / portal" },
  phone: { us: "Phone", uk: "Phone" },
  referral: { us: "Referral", uk: "e-RS referral" },
  "walk-in": { us: "Walk-in", uk: "Walk-in" },
}

export const sourceLabel = (s: AppointmentSource, region: Region) => LABEL[s][region]
export const APPOINTMENT_SOURCES: AppointmentSource[] = ["portal", "phone", "referral", "walk-in"]
