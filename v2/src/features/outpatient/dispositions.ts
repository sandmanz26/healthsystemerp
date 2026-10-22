/**
 * Discharge disposition labels. US wording follows UB-04 patient discharge status (FL 17);
 * UK wording follows the NHS Data Dictionary "discharge destination".
 */
import type { Region } from "@v2/domain/region"
import type { Disposition } from "@v2/domain/types"

const LABEL: Record<Disposition, Record<Region, string>> = {
  home: { us: "Home / self-care", uk: "Usual place of residence" },
  "home-health": { us: "Home with home health", uk: "Home with community care" },
  "follow-up": { us: "Home — follow-up in clinic", uk: "Discharged — clinic follow-up" },
  admit: { us: "Admit", uk: "Admit" },
  transfer: { us: "Transfer to another hospital", uk: "Transfer to another provider" },
  snf: { us: "Skilled nursing facility", uk: "Care home with nursing" },
  hospice: { us: "Hospice", uk: "Hospice / palliative care" },
  ama: { us: "Left against medical advice", uk: "Self-discharged" },
  expired: { us: "Expired", uk: "Died" },
}

/** UB-04 patient status codes, shown next to the US label. */
export const UB04_STATUS: Record<Disposition, string> = {
  home: "01",
  "home-health": "06",
  "follow-up": "01",
  admit: "—",
  transfer: "02",
  snf: "03",
  hospice: "50",
  ama: "07",
  expired: "20",
}

export const dispositionLabel = (d: Disposition, region: Region) => LABEL[d][region]

/** Dispositions offered at the end of a clinic visit. */
export const CLINIC_DISPOSITIONS: Disposition[] = ["home", "follow-up", "admit", "transfer"]
