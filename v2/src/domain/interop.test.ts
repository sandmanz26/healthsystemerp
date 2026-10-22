import { describe, expect, it } from "vitest"
import { formatNhsNumber, isValidNhsNumber, isValidNpi, toFhirPatient, toHl7Adt } from "./interop"
import type { Encounter, Patient } from "./types"

describe("identifiers", () => {
  it("validates NHS numbers with Modulus 11", () => {
    // Published NHS Digital example.
    expect(isValidNhsNumber("943 476 5919")).toBe(true)
    expect(isValidNhsNumber("9434765918")).toBe(false)
    expect(formatNhsNumber("9434765919")).toBe("943 476 5919")
  })
  it("validates NPIs with the Luhn check over 80840 + base", () => {
    // CMS example NPI from the NPI check-digit specification.
    expect(isValidNpi("1234567893")).toBe(true)
    expect(isValidNpi("1234567890")).toBe(false)
  })
})

describe("message builders", () => {
  const patient = { id: "pt1", mrn: "40102340", nhsNumber: "9434765919", name: "Margaret Smith", gender: "female", birthDate: "1948-03-02T00:00:00Z", phone: "07700 900123", address: "1 York Road, Leeds", postcode: "LS9 7AA", allergies: [], payer: "nhs", codeStatus: "full", createdAt: "" } as Patient
  const enc = { id: "enc1", kind: "inpatient", patientId: "pt1", unitId: "4w", payer: "nhs", status: "in-progress", accountNumber: "SP00000001", createdAt: "2026-10-20T08:00:00Z", chiefComplaint: "Pneumonia", diagnoses: [{ code: "J18.9", display: "Pneumonia, unspecified", primary: true }], procedures: [], notes: [], vitals: [], handovers: [], assessments: [], exchange: "pending" } as Encounter
  it("puts the NHS number on a UK Core Patient", () => {
    const fhir = toFhirPatient(patient, "uk")
    expect(fhir.meta.profile[0]).toMatch(/UKCore-Patient/)
    expect(fhir.identifier.some((i) => i.system === "https://fhir.nhs.uk/Id/nhs-number")).toBe(true)
  })
  it("builds an HL7 v2.5.1 ADT^A01 with PID, PV1 and DG1 segments", () => {
    const msg = toHl7Adt("A01", patient, enc, "uk", "NORTHGATE", "4W", "4W-01").split("\n")
    expect(msg[0]).toMatch(/^MSH\|\^~\\&\|.*ADT\^A01\^ADT_A01.*\|2\.5\.1$/)
    expect(msg.find((s) => s.startsWith("PID"))).toContain("9434765919^^^NHS^NH")
    expect(msg.find((s) => s.startsWith("DG1"))).toContain("J18.9^Pneumonia, unspecified^I10")
  })
})
