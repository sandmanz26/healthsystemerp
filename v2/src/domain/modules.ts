/**
 * Module catalog — the heart of the "start small, grow later" model.
 *
 * Rules the rest of the app relies on:
 * - `requires` is hard: a module cannot be on unless all of these are on.
 * - `enhances` is soft: the module works alone, but turning these on unlocks extra behaviour
 *   (shown as suggestions in the Module Center).
 * - Core modules are always on and never listed as toggleable.
 * - Turning a module off hides it; its data stays (re-enabling restores everything).
 */
import type { Region } from "./region"
import type { RoleId } from "./types"

export type ModuleId =
  | "patients"
  | "settings"
  | "registration"
  | "appointments"
  | "emr"
  | "outpatient"
  | "emergency"
  | "inpatient"
  | "nursing"
  | "surgery"
  | "laboratory"
  | "radiology"
  | "pharmacy"
  | "billing"
  | "claims"
  | "inventory"
  | "hr"
  | "quality"
  | "reports"
  | "payer"
  | "interop"

export type ModuleCategory = "core" | "front" | "clinical" | "support" | "finance" | "operations" | "quality" | "integration"

interface ModuleText {
  name: string
  /** One line, plain language: what problem it solves. */
  summary: string
  features: string[]
  setup: { id: string; label: string }[]
}

export interface ModuleDef extends ModuleText {
  id: ModuleId
  category: ModuleCategory
  core?: boolean
  requires: ModuleId[]
  enhances: { module: ModuleId; benefit: string }[]
  /** Roles that work inside this module (drives navigation visibility). */
  roles: RoleId[]
  /** Market-specific wording where the work itself differs (e.g. X12 vs NHS Spine). */
  regional?: Partial<Record<Region, Partial<ModuleText>>>
}

export const CATEGORY_LABEL: Record<ModuleCategory, string> = {
  core: "Core",
  front: "Patient access",
  clinical: "Clinical",
  support: "Diagnostics & pharmacy",
  finance: "Revenue cycle",
  operations: "Operations",
  quality: "Quality & analytics",
  integration: "Interoperability",
}

export const CATEGORY_ORDER: ModuleCategory[] = ["core", "front", "clinical", "support", "finance", "operations", "quality", "integration"]

const ALL_CLINICAL: RoleId[] = ["doctor", "nurse"]

export const MODULES: ModuleDef[] = [
  {
    id: "patients",
    name: "Patient Index (EMPI)",
    category: "core",
    core: true,
    summary: "One identity per patient across every service: MRN, coverage, allergies, code status.",
    features: ["Search by name, MRN, DOB or national ID", "Duplicate-record detection", "Visit history, allergies & advance directives"],
    requires: [],
    enhances: [],
    roles: ["admin", "frontdesk", "doctor", "nurse", "pharmacist", "labtech", "radiographer", "cashier", "coder", "manager"],
    setup: [],
    regional: { uk: { summary: "One identity per patient: MRN, NHS number (PDS-verified), registered GP, allergies, DNACPR status." } },
  },
  {
    id: "settings",
    name: "Settings & Access",
    category: "core",
    core: true,
    summary: "Facility profile, units, role-based access and the audit trail.",
    features: ["Units & clinics", "Role × module access matrix", "Access audit log with break-the-glass review"],
    requires: [],
    enhances: [],
    roles: ["admin"],
    setup: [],
    regional: {
      us: { features: ["Units & clinics", "Role × module access matrix", "HIPAA access audit log (45 CFR 164.312(b)) with break-the-glass review"] },
      uk: { features: ["Units & clinics", "Role × module access matrix (NHS RBAC)", "Access audit log (UK GDPR Art. 30) with break-the-glass review"] },
    },
  },
  {
    id: "registration",
    name: "Registration & Queue",
    category: "front",
    summary: "Register a visit in seconds and run the waiting-room queue per clinic.",
    features: ["Outpatient & ED registration", "Queue numbers per clinic", "Waiting-room display", "Wristband & label printing"],
    requires: [],
    enhances: [
      { module: "payer", benefit: "Real-time eligibility check at the front desk" },
      { module: "appointments", benefit: "Check in patients who booked ahead" },
      { module: "billing", benefit: "Copays collected at check-in post to the account" },
    ],
    roles: ["frontdesk", "admin"],
    setup: [
      { id: "units", label: "Confirm the clinic list" },
      { id: "display", label: "Mount the waiting-room display" },
    ],
  },
  {
    id: "appointments",
    name: "Scheduling",
    category: "front",
    summary: "Provider templates with slot limits; bookings from the portal, phone or referrals.",
    features: ["Weekly provider templates & slot caps", "Booking & check-in", "No-show tracking"],
    requires: ["registration"],
    enhances: [{ module: "payer", benefit: "Referral bookings arrive with their reference" }],
    roles: ["frontdesk", "admin", "doctor"],
    setup: [{ id: "schedules", label: "Load provider schedule templates" }],
    regional: { uk: { summary: "Clinic templates with slot limits; bookings from e-RS referrals, the NHS App or phone." } },
  },
  {
    id: "emr",
    name: "Electronic Health Record",
    category: "clinical",
    summary: "Notes, problem list, diagnoses, procedures and allergies in one chart.",
    features: ["SOAP progress notes with co-signature", "Diagnosis & procedure coding", "Patient summary & history", "Note templates"],
    requires: [],
    enhances: [
      { module: "interop", benefit: "Encounters & results flow out over HL7 v2 and FHIR" },
      { module: "laboratory", benefit: "Lab orders & results inside the chart" },
      { module: "pharmacy", benefit: "e-Prescribing with allergy & interaction checks" },
    ],
    roles: ALL_CLINICAL,
    setup: [{ id: "templates", label: "Review note templates per specialty" }],
    regional: {
      us: { summary: "Notes, problem list, ICD-10-CM diagnoses, CPT procedures and allergies — ONC-certifiable data (USCDI v3)." },
      uk: { summary: "Notes, problem list, ICD-10 / SNOMED CT diagnoses, OPCS-4 procedures and allergies (PRSB standards)." },
    },
  },
  {
    id: "outpatient",
    name: "Ambulatory Clinics",
    category: "clinical",
    summary: "Clinic worklist: call the patient, document and close the visit on one screen.",
    features: ["Worklist per clinic & provider", "Call patient to the waiting-room display", "Disposition: home, follow-up, referral, admit"],
    requires: ["registration", "emr"],
    enhances: [{ module: "appointments", benefit: "See today's booked patients" }],
    roles: ALL_CLINICAL,
    setup: [],
  },
  {
    id: "emergency",
    name: "Emergency Department",
    category: "clinical",
    summary: "5-level triage, a live tracking board, sepsis screening and time targets.",
    features: ["ESI v5 triage", "Tracking board with door-to-provider times", "Sepsis screen & SEP-1 bundle timer", "Disposition & admission requests"],
    requires: ["registration", "emr"],
    enhances: [{ module: "inpatient", benefit: "Admit straight from the ED to a bed" }],
    roles: ALL_CLINICAL,
    setup: [{ id: "triage", label: "Agree door-to-provider goals per acuity" }],
    regional: { uk: { features: ["Manchester Triage System", "Tracking board with the 4-hour clock & 12-hour breaches", "NEWS2 red-flag sepsis & Sepsis Six timer", "Disposition & admission requests"] } },
  },
  {
    id: "inpatient",
    name: "Inpatient & Bed Management",
    category: "clinical",
    summary: "Real-time bed board, admit / transfer / discharge, and discharge planning.",
    features: ["Bed board by unit and bed type", "Admit, transfer, discharge (ADT)", "Observation vs inpatient status (Two-Midnight Rule)", "Expected discharge date vs GMLOS"],
    requires: ["emr"],
    enhances: [
      { module: "nursing", benefit: "Vitals, eMAR & handover for every inpatient" },
      { module: "billing", benefit: "Room & board posts daily" },
    ],
    roles: [...ALL_CLINICAL, "frontdesk", "admin"],
    setup: [{ id: "beds", label: "Check the bed master & bed types" }],
    regional: { uk: { features: ["Bed board by ward and side room", "Admit, transfer, discharge (ADT)", "Criteria to reside & expected date of discharge", "Discharge summary to the GP within 24 h"] } },
  },
  {
    id: "nursing",
    name: "Nursing",
    category: "clinical",
    summary: "Vitals with early-warning scores, barcode medication administration and SBAR handover.",
    features: ["Vitals with automatic NEWS2", "eMAR with wristband + dose barcode scanning (BCMA)", "Morse fall & Braden pressure-injury assessments", "Shift handover (SBAR)"],
    requires: ["emr"],
    enhances: [{ module: "pharmacy", benefit: "Verified orders appear on the eMAR automatically" }],
    roles: ALL_CLINICAL,
    setup: [],
  },
  {
    id: "surgery",
    name: "Perioperative",
    category: "clinical",
    summary: "OR schedule with the WHO Surgical Safety Checklist / Universal Protocol.",
    features: ["OR schedule per room", "Sign in · time out · sign out", "Case charges post automatically"],
    requires: ["emr"],
    enhances: [{ module: "inpatient", benefit: "Cases linked to the inpatient stay" }],
    roles: [...ALL_CLINICAL, "admin"],
    setup: [{ id: "rooms", label: "Register operating rooms" }],
  },
  {
    id: "laboratory",
    name: "Laboratory (LIS)",
    category: "support",
    summary: "Order → collect → result → verify, with critical-value call-back.",
    features: ["Collection worklist with tube types", "LOINC-coded results with reference ranges", "Critical value read-back documentation"],
    requires: ["emr"],
    enhances: [{ module: "billing", benefit: "Panel charges post to the account" }],
    roles: ["labtech", "doctor", "nurse"],
    setup: [{ id: "catalog", label: "Review test catalogue & reference ranges" }],
  },
  {
    id: "radiology",
    name: "Imaging (RIS)",
    category: "support",
    summary: "Imaging orders, modality worklist and radiologist reports.",
    features: ["Exam worklist by modality", "Structured report templates", "Prior-auth & pregnancy checks"],
    requires: ["emr"],
    enhances: [{ module: "billing", benefit: "Exam charges post to the account" }],
    roles: ["radiographer", "doctor"],
    setup: [],
  },
  {
    id: "pharmacy",
    name: "Pharmacy",
    category: "support",
    summary: "Pharmacist verification (allergy, interaction, high-alert, formulary), dispensing and controlled drugs.",
    features: ["Verification queue", "Automatic checks: allergy, interaction, ISMP high-alert, formulary", "FEFO dispensing by lot"],
    requires: ["emr"],
    enhances: [
      { module: "inventory", benefit: "Par levels & purchase requests" },
      { module: "nursing", benefit: "Inpatient doses scheduled on the eMAR" },
    ],
    roles: ["pharmacist", "doctor"],
    setup: [{ id: "drugs", label: "Complete the drug master & formulary" }],
  },
  {
    id: "billing",
    name: "Patient Accounting",
    category: "finance",
    summary: "Charges post from every service; cashiers take payments and statements.",
    features: ["Itemised account per visit (CPT + revenue code)", "Card, cash, bank transfer", "Patient statements & receipts"],
    requires: ["registration"],
    enhances: [{ module: "claims", benefit: "Insured accounts move to claims" }],
    roles: ["cashier", "manager", "admin"],
    setup: [{ id: "tariffs", label: "Load the chargemaster" }],
    regional: { uk: { summary: "Private patient & overseas visitor invoicing — NHS-funded care produces no patient bill.", features: ["Itemised invoices for private & overseas patients", "Card, cash, bank transfer", "Overseas Visitor charging (NHS Charging Regulations)"], setup: [{ id: "tariffs", label: "Load the private patient tariff" }] } },
  },
  {
    id: "claims",
    name: "Coding & Claims",
    category: "finance",
    summary: "Coding work queue, MS-DRG grouping, pre-bill edits, 837 submission and denial management.",
    features: ["Pre-bill edits (eligibility, auth, POA, specificity)", "MS-DRG grouping with GMLOS", "835 remittance & CARC denial work queue"],
    requires: ["billing", "emr"],
    enhances: [{ module: "payer", benefit: "Eligibility & auth results attach to the claim" }],
    roles: ["coder", "manager"],
    setup: [],
    regional: { uk: { name: "Clinical Coding & SUS+", summary: "Code spells in ICD-10 / OPCS-4, group to HRG4+, submit to SUS+ and invoice private insurers.", features: ["Coding completeness checks", "HRG4+ grouping", "SUS+ submission & private insurer invoices"] } },
  },
  {
    id: "inventory",
    name: "Supply Chain",
    category: "operations",
    summary: "Stock by lot and expiry, par levels and purchase requests.",
    features: ["Lot & expiry tracking", "Below-par alerts", "Purchase requests & receiving"],
    requires: [],
    enhances: [{ module: "pharmacy", benefit: "Stock decrements on dispensing" }],
    roles: ["pharmacist", "admin", "manager"],
    setup: [{ id: "count", label: "Run the initial stock count" }],
  },
  {
    id: "hr",
    name: "Workforce & Credentialing",
    category: "operations",
    summary: "Staff directory, licence and certification expiry, 12-hour shift roster.",
    features: ["Licence / registration expiry alerts", "BLS / ACLS certification tracking", "Day / night roster"],
    requires: [],
    enhances: [],
    roles: ["admin", "manager", "nurse"],
    setup: [{ id: "staff", label: "Complete licence & certification data" }],
    regional: { uk: { features: ["GMC / NMC / HCPC registration expiry alerts", "Resuscitation Council ILS / ALS tracking", "Day / night rota"] } },
  },
  {
    id: "quality",
    name: "Quality & Patient Safety",
    category: "quality",
    summary: "Incident reporting with harm grading and the quality measures you report externally.",
    features: ["Anonymous incident reporting", "5×5 risk matrix", "CMS / Joint Commission measures"],
    requires: [],
    enhances: [],
    roles: ["admin", "manager", "nurse", "doctor", "frontdesk", "pharmacist", "labtech", "radiographer", "cashier", "coder"],
    setup: [{ id: "team", label: "Name the patient safety committee" }],
    regional: { uk: { features: ["Anonymous incident reporting (LFPSE-ready)", "5×5 risk matrix & PSIRF responses", "NHS constitutional standards & safety measures"] } },
  },
  {
    id: "reports",
    name: "Analytics",
    category: "quality",
    summary: "Volumes, occupancy, length of stay, payer mix and top diagnoses.",
    features: ["Occupancy, ALOS, turnover", "Revenue by payer", "Top 10 diagnoses"],
    requires: [],
    enhances: [
      { module: "inpatient", benefit: "Occupancy, ALOS vs GMLOS" },
      { module: "billing", benefit: "Revenue by payer" },
    ],
    roles: ["manager", "admin"],
    setup: [],
  },
  {
    id: "payer",
    name: "Eligibility & Authorization",
    category: "integration",
    summary: "Real-time eligibility (X12 270/271), prior authorization (278) and e-prescribing via Surescripts.",
    features: ["Eligibility & benefits at registration", "Prior authorization requests", "Surescripts NewRx & medication history"],
    requires: ["registration"],
    enhances: [],
    roles: ["frontdesk", "coder", "admin"],
    setup: [{ id: "credentials", label: "Enter clearinghouse submitter ID & Surescripts credentials" }],
    regional: {
      uk: {
        name: "NHS Spine Services",
        summary: "PDS demographics trace, Electronic Prescription Service, e-Referrals and GP Connect.",
        features: ["PDS trace on registration (NHS number)", "EPS prescriptions to community pharmacy", "e-RS referrals & GP Connect record access"],
        setup: [{ id: "credentials", label: "Install the Spine endpoint certificate & ODS code" }],
      },
    },
  },
  {
    id: "interop",
    name: "Interoperability Hub",
    category: "integration",
    summary: "HL7 v2 interfaces (ADT, ORM, ORU) and a FHIR R4 API with US Core profiles.",
    features: ["Message log with retry", "FHIR R4 API (US Core 6.1.0, SMART on FHIR)", "Location & practitioner mapping"],
    requires: ["emr"],
    enhances: [],
    roles: ["admin"],
    setup: [
      { id: "endpoints", label: "Register interface endpoints (MLLP / HTTPS)" },
      { id: "mapping", label: "Map units to HL7 PV1 locations" },
    ],
    regional: { uk: { summary: "HL7 v2 interfaces, a FHIR R4 API with UK Core profiles, and SUS+ submissions via MESH.", features: ["Message log with retry", "FHIR R4 API (UK Core)", "MESH mailbox for SUS+ & GP discharge summaries"] } },
  },
]

/** The module's wording for a market. */
export function moduleText(id: ModuleId, region: Region): ModuleDef {
  const base = MODULE_MAP[id]
  const o = base.regional?.[region]
  return o ? { ...base, ...Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) } : base
}

export const MODULE_MAP: Record<ModuleId, ModuleDef> = Object.fromEntries(MODULES.map((m) => [m.id, m])) as Record<ModuleId, ModuleDef>

export const CORE_MODULES: ModuleId[] = MODULES.filter((m) => m.core).map((m) => m.id)

// ---------------------------------------------------------------------------------------
// Dependency resolution
// ---------------------------------------------------------------------------------------

/** Everything `id` needs, transitively, excluding `id` itself. */
export function requiredClosure(id: ModuleId): ModuleId[] {
  const seen = new Set<ModuleId>()
  const visit = (m: ModuleId) => {
    for (const dep of MODULE_MAP[m].requires) {
      if (!seen.has(dep)) {
        seen.add(dep)
        visit(dep)
      }
    }
  }
  visit(id)
  return [...seen]
}

/** Modules that must also be switched on to enable `id` given the current set. */
export function missingForEnable(id: ModuleId, enabled: ReadonlySet<ModuleId>): ModuleId[] {
  return requiredClosure(id).filter((m) => !enabled.has(m))
}

/** Enabled modules that would break if `id` were switched off. */
export function blockersForDisable(id: ModuleId, enabled: ReadonlySet<ModuleId>): ModuleId[] {
  return MODULES.filter((m) => enabled.has(m.id) && m.id !== id && requiredClosure(m.id).includes(id)).map((m) => m.id)
}

// ---------------------------------------------------------------------------------------
// Facility presets
// ---------------------------------------------------------------------------------------

export type FacilityType = "clinic" | "urgent-care" | "community" | "general" | "academic"

export interface FacilityPreset {
  id: FacilityType
  name: Record<Region, string>
  description: string
  /** Modules recommended to start with — deliberately small. */
  start: ModuleId[]
  /** Modules worth adding once the start set runs smoothly. */
  next: ModuleId[]
}

export const FACILITY_PRESETS: FacilityPreset[] = [
  {
    id: "clinic",
    name: { us: "Physician practice", uk: "Outpatient clinic" },
    description: "Office visits, prescriptions, simple billing.",
    start: ["registration", "emr", "outpatient", "pharmacy", "billing"],
    next: ["appointments", "payer", "interop", "inventory"],
  },
  {
    id: "urgent-care",
    name: { us: "Urgent care center", uk: "Urgent treatment centre" },
    description: "Walk-in unscheduled care with point-of-care lab and X-ray.",
    start: ["registration", "emr", "emergency", "laboratory", "radiology", "pharmacy", "billing"],
    next: ["payer", "interop", "claims", "reports"],
  },
  {
    id: "community",
    name: { us: "Community / critical access hospital", uk: "Community hospital" },
    description: "Small hospital with an ED, inpatient beds and core diagnostics.",
    start: ["registration", "emr", "outpatient", "emergency", "inpatient", "nursing", "laboratory", "pharmacy", "billing", "payer", "interop"],
    next: ["claims", "radiology", "inventory", "quality", "reports"],
  },
  {
    id: "general",
    name: { us: "General acute care hospital", uk: "District general hospital" },
    description: "Specialist clinics, ED, ICU, operating rooms and full revenue cycle.",
    start: [
      "registration", "appointments", "emr", "outpatient", "emergency", "inpatient", "nursing", "surgery", "laboratory",
      "radiology", "pharmacy", "billing", "claims", "payer", "interop", "inventory",
    ],
    next: ["hr", "quality", "reports"],
  },
  {
    id: "academic",
    name: { us: "Academic medical center", uk: "Teaching hospital (NHS trust)" },
    description: "Tertiary referral centre with every service.",
    start: MODULES.filter((m) => !m.core).map((m) => m.id),
    next: [],
  },
]

/** Adds every module required by the ones in `set` (used by the onboarding picker). */
export function withDependencies(set: Iterable<ModuleId>): Set<ModuleId> {
  const out = new Set(set)
  for (const id of [...out]) for (const dep of requiredClosure(id)) out.add(dep)
  return out
}

/** Removes `id` and every module that (transitively) requires it. */
export function withoutDependents(id: ModuleId, set: Iterable<ModuleId>): Set<ModuleId> {
  const out = new Set(set)
  out.delete(id)
  for (const m of [...out]) if (requiredClosure(m).includes(id)) out.delete(m)
  return out
}
