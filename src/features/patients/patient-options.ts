/**
 * Region-specific option lists and identifier checks for the patient registry screens
 * (code status, payer class, allergy severity, ZIP / postcode, MBI).
 */
import { PAYER_LABEL, PAYERS_BY_REGION } from "@/domain/finance"
import type { Region } from "@/domain/region"
import type { Allergy, CodeStatus, EncounterKind, PayerType } from "@/domain/types"
import type { Option } from "@/components/ui/fields"

/** Code status choices as each market documents them. */
export function codeStatusOptions(region: Region): Option<CodeStatus>[] {
  return region === "us"
    ? [
        { value: "full", label: "Full code", description: "All resuscitative measures" },
        { value: "dnr", label: "DNR", description: "No CPR; intubation permitted" },
        { value: "dnr-dni", label: "DNR / DNI", description: "No CPR, no intubation" },
        { value: "comfort", label: "Comfort care", description: "Comfort measures only" },
      ]
    : [
        { value: "full", label: "For CPR", description: "For cardiopulmonary resuscitation" },
        { value: "dnr", label: "DNACPR", description: "Do not attempt CPR — ReSPECT form" },
      ]
}

const PAYER_HINT: Record<PayerType, string> = {
  medicare: "Traditional Medicare or Medicare Advantage",
  medicaid: "State Medicaid / managed care",
  commercial: "Employer or marketplace plan",
  "self-pay": "Uninsured — Good Faith Estimate applies",
  nhs: "Ordinarily resident — NHS-funded",
  private: "Private medical insurance (PMI)",
  overseas: "Chargeable under the 2015 Overseas Visitors Regulations",
}

export function payerOptions(region: Region): Option<PayerType>[] {
  return PAYERS_BY_REGION[region].map((p) => ({ value: p, label: PAYER_LABEL[p], description: PAYER_HINT[p] }))
}

export const SEVERITY_OPTIONS: Option<Allergy["severity"]>[] = [
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe (anaphylaxis)" },
]

export const ALLERGY_TYPE_OPTIONS: Option<NonNullable<Allergy["type"]>>[] = [
  { value: "allergy", label: "Allergy", description: "Immune-mediated" },
  { value: "intolerance", label: "Intolerance", description: "Non-immune adverse reaction" },
]

/** Medicare Beneficiary Identifier: 11 characters, CMS format (no S, L, O, I, B, Z). */
export const isValidMbi = (v: string) => /^[1-9][AC-HJKMNP-RT-Y][AC-HJKMNP-RT-Y0-9]\d[AC-HJKMNP-RT-Y][AC-HJKMNP-RT-Y0-9]\d[AC-HJKMNP-RT-Y]{2}\d{2}$/.test(v.replace(/-/g, "").toUpperCase())

export const isValidZip = (v: string) => /^\d{5}(-\d{4})?$/.test(v.trim())
export const isValidPostcode = (v: string) => /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(v.trim())

/** Encounter class as each market names it. */
export const kindLabel = (kind: EncounterKind, region: Region) =>
  kind === "outpatient" ? "Outpatient" : kind === "inpatient" ? (region === "us" ? "Inpatient" : "Admitted patient care") : region === "us" ? "Emergency" : "A&E"
