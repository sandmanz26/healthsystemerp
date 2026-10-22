/**
 * Market regions. The product ships one codebase with two regulatory "packs":
 *
 * - `us` — United States: ICD-10-CM / CPT / HCPCS, MS-DRG, X12 EDI, HL7 v2 + FHIR US Core,
 *   ESI triage, CMS quality measures, HIPAA.
 * - `uk` — United Kingdom / Europe, modelled on NHS England: WHO ICD-10 (5th ed.) / OPCS-4,
 *   HRG, NHS number & Spine services, FHIR UK Core, Manchester Triage, NEWS2, GDPR.
 *
 * Continental European hospitals share most of the UK pack (WHO ICD-10, SI units, MTS,
 * GDPR, 24-hour clock); national code sets (e.g. G-DRG, OPS, CCAM) plug in the same way.
 *
 * The region is chosen at onboarding and stored on the facility. Anything that differs by
 * market reads it from here rather than branching on strings in components.
 */
export type Region = "us" | "uk"

export interface RegionInfo {
  id: Region
  name: string
  short: string
  /** BCP 47 locale used for dates and numbers. */
  locale: string
  currency: "USD" | "GBP"
  /** Lab values: conventional (mg/dL) or SI (mmol/L, µmol/L). */
  labUnits: "conventional" | "si"
  temperature: "F" | "C"
  weight: "lb" | "kg"
  /** Diagnosis code system. */
  dxSystem: string
  /** Procedure code system for billing/coding. */
  pxSystem: string
  /** Inpatient case-mix grouper. */
  grouper: string
  triage: "ESI" | "MTS"
  /** National patient identifier label (none in the US). */
  nationalId?: string
  privacyLaw: string
  fhirProfile: string
}

export const REGIONS: Record<Region, RegionInfo> = {
  us: {
    id: "us",
    name: "United States",
    short: "US",
    locale: "en-US",
    currency: "USD",
    labUnits: "conventional",
    temperature: "F",
    weight: "lb",
    dxSystem: "ICD-10-CM",
    pxSystem: "CPT / HCPCS",
    grouper: "MS-DRG",
    triage: "ESI",
    privacyLaw: "HIPAA",
    fhirProfile: "US Core 6.1.0",
  },
  uk: {
    id: "uk",
    name: "United Kingdom & Europe (NHS model)",
    short: "UK/EU",
    locale: "en-GB",
    currency: "GBP",
    labUnits: "si",
    temperature: "C",
    weight: "kg",
    dxSystem: "ICD-10 (WHO 5th ed.)",
    pxSystem: "OPCS-4.10",
    grouper: "HRG4+",
    triage: "MTS",
    nationalId: "NHS number",
    privacyLaw: "UK GDPR / DPA 2018",
    fhirProfile: "UK Core STU3",
  },
}

/** Picks the regional variant of a value: `byRegion(region, { us: "ER", uk: "ED" })`. */
export function byRegion<T>(region: Region, values: Record<Region, T>): T {
  return values[region]
}

/** Medical record number format: 8 digits (US) or a trust-prefixed hospital number (UK). */
export const formatMrn = (region: Region, n: number) => (region === "us" ? String(n).padStart(8, "0") : `NG${String(n).padStart(7, "0")}`)
