/**
 * Domain model for the hospital SaaS.
 *
 * Shapes deliberately mirror the FHIR R4 resources they map to (Patient, Encounter,
 * Observation, ServiceRequest, MedicationRequest, Claim, …) so the interoperability layer is a
 * mapping, not a redesign — see `domain/interop.ts`. Everything is plain serialisable data:
 * the store persists it to IndexedDB as-is.
 */
import type { Region } from "./region"

export type ID = string
/** ISO 8601 date-time string. */
export type ISODate = string

// ---------------------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------------------

/** Administrative sex as recorded for clinical decision support (FHIR `gender`). */
export type Gender = "male" | "female"

/**
 * Who pays. US: Medicare / Medicaid / commercial plans / self-pay.
 * UK: NHS-funded care, private medical insurance, or chargeable overseas visitors.
 */
export type PayerType = "medicare" | "medicaid" | "commercial" | "self-pay" | "nhs" | "private" | "overseas"

export interface Coverage {
  /** Payer organisation, e.g. "Medicare Part A/B", "Aetna", "Bupa". */
  payerName: string
  plan?: string
  memberId: string
  group?: string
}

export interface Allergy {
  substance: string
  reaction: string
  severity: "mild" | "moderate" | "severe"
  /** FHIR AllergyIntolerance.type */
  type?: "allergy" | "intolerance"
}

/**
 * Resuscitation status — shown on the banner and wristband of every screen.
 * UK charts record DNACPR (ReSPECT form); US charts record DNR / DNI orders or POLST.
 */
export type CodeStatus = "full" | "dnr" | "dnr-dni" | "comfort"

export type PatientFlag = "fall-risk" | "latex-allergy" | "contact-isolation" | "droplet-isolation" | "interpreter"

export interface Patient {
  id: ID
  /** Facility medical record number. */
  mrn: string
  /** UK NHS number (10 digits, Modulus 11 check digit). */
  nhsNumber?: string
  name: string
  gender: Gender
  birthDate: ISODate
  phone: string
  address: string
  /** US ZIP code or UK postcode. */
  postcode: string
  preferredLanguage?: string
  allergies: Allergy[]
  payer: PayerType
  coverage?: Coverage
  /** US primary care provider or UK registered GP practice (with ODS code). */
  primaryCare?: string
  nextOfKin?: string
  codeStatus: CodeStatus
  /** Advance directive / POLST / ReSPECT form on file. */
  advanceDirective?: boolean
  flags?: PatientFlag[]
  createdAt: ISODate
}

export type RoleId =
  | "admin"
  | "doctor"
  | "nurse"
  | "frontdesk"
  | "pharmacist"
  | "labtech"
  | "radiographer"
  | "cashier"
  | "coder"
  | "manager"

export interface Staff {
  id: ID
  name: string
  role: RoleId
  title: string
  specialty?: string
  unitId?: ID
  phone: string
  /** Professional licence / registration (state board, GMC, NMC, GPhC, HCPC …). */
  license?: { body: string; number: string; expires: ISODate }
  /** US National Provider Identifier (10 digits, Luhn check digit). */
  npi?: string
  /** US DEA registration expiry for controlled-substance prescribers. */
  deaExpires?: ISODate
  /** BLS / ACLS (US) or Resus Council ILS / ALS (UK) certification expiry. */
  resusCertExpires?: ISODate
}

// ---------------------------------------------------------------------------------------
// Facility structure
// ---------------------------------------------------------------------------------------

export type UnitKind = "clinic" | "ed" | "ward" | "icu" | "or" | "lab" | "rad" | "pharmacy" | "admin"

export interface Unit {
  id: ID
  name: string
  kind: UnitKind
  /** Short code staff use on boards and wristbands, e.g. "4W", "MICU". */
  code?: string
}

export type BedType = "med-surg" | "telemetry" | "icu" | "isolation" | "private"
export type BedStatus = "available" | "occupied" | "cleaning" | "maintenance" | "reserved"

export interface Bed {
  id: ID
  unitId: ID
  code: string
  bedType: BedType
  status: BedStatus
  encounterId?: ID
}

// ---------------------------------------------------------------------------------------
// Encounters
// ---------------------------------------------------------------------------------------

export type EncounterKind = "outpatient" | "emergency" | "inpatient"

/**
 * One lifecycle for every encounter kind keeps worklists uniform. Not every kind uses every
 * state: outpatient skips `triaged`, inpatient starts at `in-progress`.
 */
export type EncounterStatus =
  | "registered"
  | "triaged"
  | "called"
  | "in-progress"
  | "awaiting-admission"
  | "finished"
  | "cancelled"

/** ESI 1–5 (US) or Manchester Triage category 1–5 (UK). 1 is most urgent in both. */
export type TriageLevel = 1 | 2 | 3 | 4 | 5

/**
 * Discharge disposition. Values map to UB-04 patient status codes (US) and to the NHS
 * "discharge destination" data item (UK).
 */
export type Disposition =
  | "home"
  | "home-health"
  | "follow-up"
  | "admit"
  | "transfer"
  | "snf"
  | "hospice"
  | "ama"
  | "expired"

/** US inpatient vs outpatient observation status (Two-Midnight Rule). */
export type AdmissionClass = "inpatient" | "observation"

export interface Diagnosis {
  code: string
  display: string
  primary: boolean
  /** ICD-10-CM present-on-admission indicator (US inpatient claims). */
  poa?: "Y" | "N" | "U" | "W"
}

export interface Procedure {
  code: string
  display: string
}

export interface Vitals {
  id: ID
  at: ISODate
  by: ID
  systolic?: number
  diastolic?: number
  heartRate?: number
  respRate?: number
  /** Always stored in °C; displayed in °F for US facilities. */
  temperature?: number
  spo2?: number
  onOxygen?: boolean
  /** ACVPU — NEWS2 uses "C" for new confusion. */
  consciousness?: "A" | "C" | "V" | "P" | "U"
  painScore?: number
  /** Always stored in kg. */
  weight?: number
}

export type NoteType = "h&p" | "progress" | "nursing" | "ed" | "consult"

/** Progress note in SOAP form (FHIR DocumentReference / Composition). */
export interface ClinicalNote {
  id: ID
  at: ISODate
  authorId: ID
  role: RoleId
  type?: NoteType
  subjective: string
  objective: string
  assessment: string
  plan: string
  /** Attending co-signature of a note written by a resident, APP or nurse. */
  verifiedBy?: ID
}

/** SBAR handover between shifts. */
export interface HandoverNote {
  id: ID
  at: ISODate
  authorId: ID
  situation: string
  background: string
  assessment: string
  recommendation: string
}

/** Validated nursing risk assessments. */
export type AssessmentKind = "morse" | "braden"

export interface Assessment {
  id: ID
  at: ISODate
  by: ID
  kind: AssessmentKind
  score: number
  answers: Record<string, number>
}

/**
 * Sepsis episode. Time zero is when sepsis was recognised; each bundle element records
 * when it was completed (CMS SEP-1 in the US, the Sepsis Six in the UK).
 */
export interface SepsisEpisode {
  identifiedAt: ISODate
  identifiedBy: ID
  septicShock: boolean
  done: Record<string, ISODate>
}

export interface DischargePlan {
  /** Expected (estimated) date of discharge. */
  edd: ISODate
  barriers: string[]
  /** UK: patient no longer meets the criteria to reside. US: medically ready for discharge. */
  medicallyReady: boolean
  /** US: Important Message from Medicare delivered (required within 2 days of admission). */
  imNotice?: boolean
}

export type SyncStatus = "pending" | "synced" | "failed" | "not-required"

/** X12 270/271 (US) or Spine PDS trace (UK) result captured at registration. */
export interface EligibilityCheck {
  at: ISODate
  status: "active" | "inactive" | "not-found"
  /** Human summary, e.g. "Copay $40 · deductible remaining $850". */
  summary: string
  /** Transaction reference (271 trace number / PDS request id). */
  reference: string
}

export interface Encounter {
  id: ID
  kind: EncounterKind
  patientId: ID
  unitId: ID
  practitionerId?: ID
  payer: PayerType
  status: EncounterStatus
  /** Hospital account / visit number (US) or spell number (UK). */
  accountNumber: string
  queueNumber?: string
  createdAt: ISODate
  calledAt?: ISODate
  startedAt?: ISODate
  endedAt?: ISODate
  chiefComplaint: string
  triage?: TriageLevel
  bedId?: ID
  admissionClass?: AdmissionClass
  eligibility?: EligibilityCheck
  /** Prior authorisation / pre-certification number (US commercial & Medicare Advantage). */
  authNumber?: string
  /** Referral reference (US referral or UK e-RS Unique Booking Reference). */
  referralNumber?: string
  diagnoses: Diagnosis[]
  procedures: Procedure[]
  notes: ClinicalNote[]
  vitals: Vitals[]
  handovers: HandoverNote[]
  assessments: Assessment[]
  sepsis?: SepsisEpisode
  dischargePlan?: DischargePlan
  disposition?: Disposition
  dispositionNote?: string
  /** FHIR / HIE export status. */
  exchange: SyncStatus
  /** Encounter that led to this one (e.g. ED → inpatient). */
  parentId?: ID
}

// ---------------------------------------------------------------------------------------
// Orders & results
// ---------------------------------------------------------------------------------------

export type OrderKind = "lab" | "rad"
export type OrderStatus = "ordered" | "collected" | "in-progress" | "resulted" | "validated" | "cancelled"
export type Priority = "routine" | "stat"
export type ResultFlag = "N" | "L" | "H" | "LL" | "HH"

export interface ResultValue {
  testCode: string
  value: string
  /** Unit the value was reported in (conventional or SI). */
  unit?: string
  flag: ResultFlag
}

export type AuthStatus = "not-required" | "pending" | "approved" | "denied"

export interface ServiceOrder {
  id: ID
  kind: OrderKind
  encounterId: ID
  patientId: ID
  testCodes: string[]
  priority: Priority
  clinicalNote: string
  status: OrderStatus
  orderedBy: ID
  orderedAt: ISODate
  collectedAt?: ISODate
  resultedAt?: ISODate
  validatedBy?: ID
  results: ResultValue[]
  /** Radiology narrative report. */
  report?: string
  /** Prior authorisation for advanced imaging (US commercial payers). */
  auth?: AuthStatus
  /** Critical result read-back documented (who was called, when). */
  criticalCall?: { at: ISODate; to: string; by: ID }
}

// ---------------------------------------------------------------------------------------
// Pharmacy & inventory
// ---------------------------------------------------------------------------------------

export interface Batch {
  /** Lot number. */
  batch: string
  expiry: ISODate
  qty: number
}

export interface InventoryItem {
  id: ID
  name: string
  category: "drug" | "supply" | "reagent" | "general"
  form?: string
  strength?: string
  unit: string
  price: number
  minStock: number
  batches: Batch[]
  /** WHO ATC code. */
  atc?: string
  /** Barcode on the unit-dose package (NDC in the US, GTIN in the UK) — scanned at BCMA. */
  barcode?: string
  /** On the hospital formulary (P&T committee / Trust formulary). */
  formulary?: boolean
  /** ISMP high-alert medication. */
  highAlert?: boolean
  /** DEA schedule (US) or Misuse of Drugs Regulations schedule (UK). */
  controlled?: string
  /** Drug class used by the interaction & allergy checker, e.g. "penicillin", "nsaid". */
  drugClass?: string
}

export interface PrescriptionItem {
  itemId: ID
  dose: string
  frequency: string
  route: string
  days: number
  qty: number
  instructions?: string
}

export type PrescriptionStatus = "new" | "reviewed" | "prepared" | "dispensed" | "cancelled"

export interface Prescription {
  id: ID
  encounterId: ID
  patientId: ID
  items: PrescriptionItem[]
  status: PrescriptionStatus
  prescribedBy: ID
  prescribedAt: ISODate
  reviewedBy?: ID
  reviewNote?: string
  dispensedAt?: ISODate
}

export type MarStatus = "due" | "given" | "held" | "refused"

/** One scheduled administration on the eMAR. */
export interface MarEntry {
  id: ID
  encounterId: ID
  itemId: ID
  dose: string
  route: string
  scheduledAt: ISODate
  status: MarStatus
  by?: ID
  at?: ISODate
  note?: string
  /** Barcode medication administration: both the wristband and the dose were scanned. */
  scanned?: boolean
  /** Independent double-check for high-alert drugs. */
  witnessId?: ID
}

export type PurchaseStatus = "draft" | "submitted" | "approved" | "received" | "rejected"

export interface PurchaseRequest {
  id: ID
  createdAt: ISODate
  createdBy: ID
  lines: { itemId: ID; qty: number }[]
  status: PurchaseStatus
  note?: string
}

export interface StockMovement {
  id: ID
  at: ISODate
  itemId: ID
  qty: number
  reason: "dispense" | "receive" | "adjust" | "expire"
  ref?: string
}

// ---------------------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------------------

export interface DoctorSchedule {
  id: ID
  practitionerId: ID
  unitId: ID
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number
  start: string
  end: string
  quota: number
}

export type AppointmentStatus = "booked" | "checked-in" | "no-show" | "cancelled"
/** How the slot was booked. "referral" is an e-RS booking in the UK. */
export type AppointmentSource = "portal" | "phone" | "referral" | "walk-in"

export interface Appointment {
  id: ID
  patientId: ID
  practitionerId: ID
  unitId: ID
  date: ISODate
  time: string
  status: AppointmentStatus
  source: AppointmentSource
  encounterId?: ID
}

/** 12-hour nursing shifts (07–19 day, 19–07 night) plus off. */
export type ShiftCode = "D" | "N" | "OFF"

export interface RosterEntry {
  staffId: ID
  /** yyyy-mm-dd */
  date: string
  shift: ShiftCode
}

export type SurgeryStatus = "scheduled" | "sign-in" | "time-out" | "sign-out" | "done" | "cancelled"

export interface Surgery {
  id: ID
  patientId: ID
  encounterId?: ID
  procedure: string
  /** CPT (US) or OPCS-4 (UK) code. */
  procedureCode?: string
  surgeonId: ID
  anesthetistId?: ID
  room: string
  scheduledAt: ISODate
  durationMin: number
  status: SurgeryStatus
  /** Prior authorisation for elective cases (US). */
  auth?: AuthStatus
  /** WHO Surgical Safety Checklist / Joint Commission Universal Protocol items ticked. */
  checklist: Record<string, boolean>
}

// ---------------------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------------------

export type ChargeCategory = "registration" | "professional" | "procedure" | "laboratory" | "radiology" | "pharmacy" | "room" | "surgery" | "emergency"

export interface Charge {
  id: ID
  at: ISODate
  category: ChargeCategory
  description: string
  /** CPT / HCPCS (US) or OPCS-4 / local tariff code (UK). */
  code?: string
  /** UB-04 revenue code (US institutional claims). */
  revCode?: string
  qty: number
  price: number
  ref?: string
}

export type PaymentMethod = "card" | "cash" | "bank-transfer" | "check" | "payer"

export interface Payment {
  id: ID
  at: ISODate
  method: PaymentMethod
  amount: number
  by: ID
}

export type InvoiceStatus = "open" | "paid" | "claim" | "void"

export interface Invoice {
  id: ID
  number: string
  encounterId: ID
  patientId: ID
  payer: PayerType
  charges: Charge[]
  payments: Payment[]
  status: InvoiceStatus
  createdAt: ISODate
  closedAt?: ISODate
}

/**
 * Claim lifecycle. US: 837 → 277CA acknowledgement → 835 remittance (paid / denied → appeal).
 * UK: coded spell → SUS+ submission → accepted (NHS) or insurer invoice (private).
 */
export type ClaimStatus = "draft" | "coded" | "submitted" | "accepted" | "denied" | "appealed" | "paid"

/**
 * Payment model. MS-DRG = Medicare/most payers for inpatient stays; FFS = line-item CPT
 * (outpatient/ED and private insurers); HRG = NHS Payment Scheme currency.
 */
export type Grouper = "MS-DRG" | "HRG" | "FFS"

export interface Denial {
  /** X12 Claim Adjustment Reason Code, e.g. "CO-197". */
  carc: string
  /** Remittance Advice Remark Code. */
  rarc?: string
  text: string
}

export interface Claim {
  id: ID
  /** Payer claim control number / SUS+ submission id. */
  number: string
  encounterId: ID
  invoiceId: ID
  payer: PayerType
  payerName: string
  grouper: Grouper
  groupCode?: string
  groupName?: string
  /** MS-DRG relative weight (approximate). */
  weight?: number
  /** Geometric mean length of stay for the DRG (approximate). */
  gmlos?: number
  /** Billed charges. */
  billed?: number
  /** Expected / allowed reimbursement. */
  tariff?: number
  paid?: number
  patientResponsibility?: number
  status: ClaimStatus
  denial?: Denial
  note?: string
  updatedAt: ISODate
}

// ---------------------------------------------------------------------------------------
// Quality & patient safety
// ---------------------------------------------------------------------------------------

/** Harm level (AHRQ Common Formats in the US, LFPSE in England). */
export type HarmLevel = "near-miss" | "none" | "low" | "moderate" | "severe" | "death"
export type IncidentCategory =
  | "medication"
  | "fall"
  | "identification"
  | "pressure-injury"
  | "surgery"
  | "specimen"
  | "equipment"
  | "infection"
  | "diagnosis"
/** 5×5 risk matrix rating (consequence × likelihood). */
export type RiskGrade = "low" | "moderate" | "high" | "extreme"
export type IncidentStatus = "reported" | "under-review" | "closed"

export interface Incident {
  id: ID
  at: ISODate
  reportedAt: ISODate
  category: IncidentCategory
  harm: HarmLevel
  unitId: ID
  description: string
  immediateAction: string
  /** Consequence 1–5. */
  impact: 1 | 2 | 3 | 4 | 5
  /** Likelihood of recurrence 1–5. */
  probability: 1 | 2 | 3 | 4 | 5
  grade: RiskGrade
  status: IncidentStatus
  /** Joint Commission sentinel event / NHS Never Event. */
  sentinel?: boolean
  /** Anonymous reporting is allowed; reporter is then omitted. */
  reportedBy?: ID
}

export interface IndicatorValue {
  indicatorId: string
  /** yyyy-mm */
  period: string
  numerator: number
  denominator: number
}

// ---------------------------------------------------------------------------------------
// Integrations & audit
// ---------------------------------------------------------------------------------------

/**
 * Interfaces. Shared: HL7 v2 feeds and the FHIR API. US: X12 clearinghouse, Surescripts,
 * state immunisation registry. UK: NHS Spine (PDS, EPS), e-RS, GP Connect, SUS+ via MESH.
 */
export type IntegrationId =
  | "hl7v2"
  | "fhir"
  | "x12"
  | "surescripts"
  | "iis"
  | "pds"
  | "eps"
  | "gp-connect"
  | "sus"

export interface SyncJob {
  id: ID
  integration: IntegrationId
  /** Message or resource type, e.g. "ADT^A01", "Encounter", "837I". */
  resource: string
  ref: ID
  status: Exclude<SyncStatus, "not-required">
  at: ISODate
  attempts: number
  error?: string
}

export interface AuditEntry {
  id: ID
  at: ISODate
  userId: ID
  action: string
  target: string
  /** Access to a record outside the user's care relationship ("break the glass"). */
  breakGlass?: { reason: string }
}

export interface Notification {
  id: ID
  at: ISODate
  level: "info" | "warning" | "danger"
  title: string
  body: string
  /** In-app route the notification links to. */
  href?: string
  roles: RoleId[]
  read: boolean
}

export type { Region }
