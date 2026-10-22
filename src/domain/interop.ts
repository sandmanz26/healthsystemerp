/**
 * Interoperability: identifier validation, FHIR R4 resources and HL7 v2 messages built from
 * the domain model. These are the payloads the integration engine would send; the UI shows
 * them so implementers can check mappings without a separate tool.
 */
import { DX_MAP, dxByCode } from "./catalog"
import { REGIONS, type Region } from "./region"
import type { Encounter, Patient, Unit } from "./types"

// ---------------------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------------------

/** NHS number check digit: Modulus 11 with weights 10..2. Returns null when invalid (10). */
export function nhsCheckDigit(first9: string): number | null {
  const sum = [...first9].reduce((s, d, i) => s + Number(d) * (10 - i), 0)
  const check = 11 - (sum % 11)
  if (check === 11) return 0
  if (check === 10) return null
  return check
}

export function isValidNhsNumber(value: string): boolean {
  const digits = value.replace(/\s/g, "")
  if (!/^\d{10}$/.test(digits)) return false
  return nhsCheckDigit(digits.slice(0, 9)) === Number(digits[9])
}

/** "943 476 5919" — NHS numbers are always displayed 3-3-4. */
export const formatNhsNumber = (v: string) => v.replace(/\s/g, "").replace(/^(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3")

/** NPI check digit: Luhn over the 9-digit base prefixed with 80840 (CMS NPI standard). */
export function npiCheckDigit(first9: string): number {
  const digits = `80840${first9}`
  let sum = 0
  for (let i = digits.length - 1, double = true; i >= 0; i--, double = !double) {
    let d = Number(digits[i])
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return (10 - (sum % 10)) % 10
}

export function isValidNpi(value: string): boolean {
  return /^\d{10}$/.test(value) && npiCheckDigit(value.slice(0, 9)) === Number(value[9])
}

// ---------------------------------------------------------------------------------------
// FHIR R4
// ---------------------------------------------------------------------------------------

const PROFILE: Record<Region, { patient: string; encounter: string; condition: string }> = {
  us: {
    patient: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
    encounter: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter",
    condition: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-encounter-diagnosis",
  },
  uk: {
    patient: "https://fhir.hl7.org.uk/StructureDefinition/UKCore-Patient",
    encounter: "https://fhir.hl7.org.uk/StructureDefinition/UKCore-Encounter",
    condition: "https://fhir.hl7.org.uk/StructureDefinition/UKCore-Condition",
  },
}

const DX_SYSTEM: Record<Region, string> = {
  us: "http://hl7.org/fhir/sid/icd-10-cm",
  uk: "http://hl7.org/fhir/sid/icd-10",
}

/** Local MRN namespace. A real tenant uses its own OID / URI. */
const MRN_SYSTEM = "urn:oid:2.16.840.1.113883.3.9999.1"

export function toFhirPatient(p: Patient, region: Region) {
  const [given, ...family] = p.name.split(" ")
  return {
    resourceType: "Patient",
    id: p.id,
    meta: { profile: [PROFILE[region].patient] },
    identifier: [
      { use: "usual", type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "MR" }] }, system: MRN_SYSTEM, value: p.mrn },
      ...(p.nhsNumber ? [{ use: "official", system: "https://fhir.nhs.uk/Id/nhs-number", value: p.nhsNumber }] : []),
    ],
    name: [{ use: "official", family: family.join(" "), given: [given] }],
    gender: p.gender,
    birthDate: p.birthDate.slice(0, 10),
    telecom: [{ system: "phone", value: p.phone, use: "mobile" }],
    address: [{ use: "home", text: p.address, postalCode: p.postcode, country: region === "us" ? "US" : "GB" }],
    ...(p.preferredLanguage ? { communication: [{ language: { text: p.preferredLanguage }, preferred: true }] } : {}),
  }
}

const ENC_CLASS: Record<Encounter["kind"], { code: string; display: string }> = {
  outpatient: { code: "AMB", display: "ambulatory" },
  emergency: { code: "EMER", display: "emergency" },
  inpatient: { code: "IMP", display: "inpatient encounter" },
}

const FHIR_STATUS: Record<Encounter["status"], string> = {
  registered: "arrived",
  triaged: "triaged",
  called: "arrived",
  "in-progress": "in-progress",
  "awaiting-admission": "in-progress",
  finished: "finished",
  cancelled: "cancelled",
}

export function toFhirEncounter(e: Encounter, region: Region, unit?: Unit) {
  const cls = e.kind === "inpatient" && e.admissionClass === "observation" ? { code: "OBSENC", display: "observation encounter" } : ENC_CLASS[e.kind]
  return {
    resourceType: "Encounter",
    id: e.id,
    meta: { profile: [PROFILE[region].encounter] },
    identifier: [{ system: `${MRN_SYSTEM}.2`, value: e.accountNumber }],
    status: FHIR_STATUS[e.status],
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", ...cls },
    subject: { reference: `Patient/${e.patientId}` },
    ...(e.practitionerId ? { participant: [{ individual: { reference: `Practitioner/${e.practitionerId}` } }] } : {}),
    period: { start: e.startedAt ?? e.createdAt, ...(e.endedAt ? { end: e.endedAt } : {}) },
    reasonCode: [{ text: e.chiefComplaint }],
    ...(e.diagnoses.length
      ? {
          diagnosis: e.diagnoses.map((d, i) => ({
            condition: { reference: `Condition/${e.id}-dx${i + 1}`, display: `${d.code} ${d.display}` },
            rank: i + 1,
            use: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/diagnosis-role", code: d.primary ? "AD" : "CM" }] },
          })),
        }
      : {}),
    ...(unit ? { location: [{ location: { display: unit.name } }] } : {}),
  }
}

export function toFhirConditions(e: Encounter, region: Region) {
  return e.diagnoses.map((d, i) => {
    const concept = dxByCode(region, d.code)
    const snomed = concept?.snomed ?? DX_MAP[concept?.key ?? ""]?.snomed
    return {
      resourceType: "Condition",
      id: `${e.id}-dx${i + 1}`,
      meta: { profile: [PROFILE[region].condition] },
      category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-category", code: "encounter-diagnosis" }] }],
      code: {
        coding: [
          { system: DX_SYSTEM[region], code: d.code, display: d.display },
          ...(snomed ? [{ system: "http://snomed.info/sct", code: snomed }] : []),
        ],
      },
      subject: { reference: `Patient/${e.patientId}` },
      encounter: { reference: `Encounter/${e.id}` },
    }
  })
}

/** Patient + Encounter + Conditions as a FHIR transaction-style Bundle (for display). */
export function toFhirBundle(p: Patient, e: Encounter, region: Region, unit?: Unit) {
  const entries = [toFhirPatient(p, region), toFhirEncounter(e, region, unit), ...toFhirConditions(e, region)]
  return {
    resourceType: "Bundle",
    type: "collection",
    meta: { tag: [{ display: REGIONS[region].fhirProfile }] },
    entry: entries.map((resource) => ({ fullUrl: `urn:uuid:${resource.id}`, resource })),
  }
}

// ---------------------------------------------------------------------------------------
// HL7 v2.5.1
// ---------------------------------------------------------------------------------------

const hl7Time = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`
}

/** PID-11 XAD: street ^ other ^ city ^ state ^ postal code ^ country. */
function hl7Address(p: Patient, region: Region): string {
  const parts = p.address.split(",").map((x) => x.trim())
  const street = parts[0] ?? ""
  if (region === "us") {
    const [city = "", stateZip = ""] = parts.slice(1)
    return `${street}^^${city}^${stateZip.split(" ")[0]}^${p.postcode}^USA`
  }
  const city = (parts[1] ?? "").replace(p.postcode, "").trim()
  return `${street}^^${city}^^${p.postcode}^GBR`
}

const PATIENT_CLASS: Record<Encounter["kind"], string> = { outpatient: "O", emergency: "E", inpatient: "I" }

/**
 * ADT message (A04 register outpatient/ED, A01 admit, A03 discharge). Segments are joined with
 * carriage returns in production; here with newlines so they read on screen.
 */
export function toHl7Adt(event: "A01" | "A03" | "A04", p: Patient, e: Encounter, region: Region, facility: string, unitCode = "", bedCode = ""): string {
  const [given, ...family] = p.name.split(" ")
  const now = hl7Time(new Date().toISOString())
  const pid3 = p.nhsNumber ? `${p.mrn}^^^MED^MR~${p.nhsNumber}^^^NHS^NH` : `${p.mrn}^^^MED^MR`
  const patientClass = e.kind === "inpatient" && e.admissionClass === "observation" ? "O" : PATIENT_CLASS[e.kind]
  const dg1 = e.diagnoses.map((d, i) => `DG1|${i + 1}||${d.code}^${d.display}^${region === "us" ? "I10C" : "I10"}||${now}|${d.primary ? "A" : "W"}`)
  return [
    `MSH|^~\\&|MEDISPHERE|${facility}|HIE|HIE|${now}||ADT^${event}^ADT_A01|${e.id.toUpperCase()}${event}|P|2.5.1`,
    `EVN|${event}|${now}`,
    `PID|1||${pid3}||${family.join(" ").toUpperCase()}^${given.toUpperCase()}||${p.birthDate.slice(0, 10).replaceAll("-", "")}|${p.gender === "male" ? "M" : "F"}|||${hl7Address(p, region)}`,
    `PV1|1|${patientClass}|${unitCode}^${bedCode}||||${e.practitionerId ?? ""}|||||||||||${e.accountNumber}|||||||||||||||||||||||||${hl7Time(e.startedAt ?? e.createdAt)}${e.endedAt ? `|${hl7Time(e.endedAt)}` : ""}`,
    ...dg1,
  ].join("\n")
}
