/**
 * Domain model for the hospital SaaS.
 *
 * Shapes are deliberately close to the FHIR resources they map to (Patient, Encounter,
 * Observation, ServiceRequest, MedicationRequest, …) so the SATUSEHAT connector can be a
 * mapping layer rather than a redesign. Everything is plain serialisable data: the store
 * persists it to IndexedDB as-is.
 */

export type ID = string
/** ISO 8601 date-time string. */
export type ISODate = string

// ---------------------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------------------

export type Gender = "male" | "female"
export type PayerType = "umum" | "bpjs" | "asuransi"

export interface Allergy {
  substance: string
  reaction: string
  severity: "ringan" | "sedang" | "berat"
}

export interface Patient {
  id: ID
  /** Nomor rekam medis — facility-scoped, human facing. */
  mrn: string
  nik: string
  name: string
  gender: Gender
  birthDate: ISODate
  phone: string
  address: string
  bloodType?: "A" | "B" | "AB" | "O"
  allergies: Allergy[]
  payer: PayerType
  bpjsNumber?: string
  /** BPJS class entitlement; KRIS replaces it for wards but it still drives non-ward tariffs. */
  bpjsClass?: 1 | 2 | 3
  insurer?: string
  /** Safety markers worn as coloured wristbands (kuning = risiko jatuh, ungu = DNR). */
  flags?: PatientFlag[]
  createdAt: ISODate
}

export type PatientFlag = "fall-risk" | "dnr"

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
  /** Surat Tanda Registrasi / Surat Izin Praktik expiry. Missing for non-clinical staff. */
  strExpires?: ISODate
  sipExpires?: ISODate
}

// ---------------------------------------------------------------------------------------
// Facility structure
// ---------------------------------------------------------------------------------------

export type UnitKind = "poli" | "er" | "ward" | "icu" | "or" | "lab" | "rad" | "pharmacy" | "admin"

export interface Unit {
  id: ID
  name: string
  kind: UnitKind
  /** BPJS poli code for Antrean Online (outpatient units only). */
  bpjsCode?: string
}

export type BedClass = "KRIS" | "VIP" | "VVIP" | "ICU" | "Isolasi"
export type BedStatus = "available" | "occupied" | "cleaning" | "maintenance" | "reserved"

export interface Bed {
  id: ID
  unitId: ID
  code: string
  bedClass: BedClass
  status: BedStatus
  encounterId?: ID
}

// ---------------------------------------------------------------------------------------
// Encounters (kunjungan)
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

export type TriageLevel = 1 | 2 | 3 | 4 | 5

export type Disposition = "pulang" | "rawat-inap" | "rujuk" | "kontrol" | "meninggal" | "pulang-aps"

export interface Diagnosis {
  code: string
  display: string
  primary: boolean
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
  temperature?: number
  spo2?: number
  onOxygen?: boolean
  consciousness?: "A" | "C" | "V" | "P" | "U"
  painScore?: number
  weight?: number
}

/** CPPT entry (Catatan Perkembangan Pasien Terintegrasi) in SOAP form. */
export interface ClinicalNote {
  id: ID
  at: ISODate
  authorId: ID
  role: RoleId
  subjective: string
  objective: string
  assessment: string
  plan: string
  /** Doctor's verification of a note written by another profession (required for CPPT). */
  verifiedBy?: ID
}

export interface HandoverNote {
  id: ID
  at: ISODate
  authorId: ID
  situation: string
  background: string
  assessment: string
  recommendation: string
}

export type SyncStatus = "pending" | "synced" | "failed" | "not-required"

export interface Encounter {
  id: ID
  kind: EncounterKind
  patientId: ID
  unitId: ID
  practitionerId?: ID
  payer: PayerType
  status: EncounterStatus
  queueNumber?: string
  createdAt: ISODate
  calledAt?: ISODate
  startedAt?: ISODate
  endedAt?: ISODate
  chiefComplaint: string
  triage?: TriageLevel
  bedId?: ID
  /** Surat Eligibilitas Peserta (BPJS). */
  sepNumber?: string
  referralNumber?: string
  diagnoses: Diagnosis[]
  procedures: Procedure[]
  notes: ClinicalNote[]
  vitals: Vitals[]
  handovers: HandoverNote[]
  disposition?: Disposition
  dispositionNote?: string
  satusehat: SyncStatus
  /** Encounter that led to this one (e.g. ER → inpatient). */
  parentId?: ID
}

// ---------------------------------------------------------------------------------------
// Orders & results
// ---------------------------------------------------------------------------------------

export type OrderKind = "lab" | "rad"
export type OrderStatus = "ordered" | "collected" | "in-progress" | "resulted" | "validated" | "cancelled"
export type Priority = "rutin" | "cito"
export type ResultFlag = "N" | "L" | "H" | "LL" | "HH"

export interface ResultValue {
  testCode: string
  value: string
  flag: ResultFlag
}

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
  /** Radiology narrative report (ekspertise). */
  report?: string
}

// ---------------------------------------------------------------------------------------
// Pharmacy & inventory
// ---------------------------------------------------------------------------------------

export interface Batch {
  batch: string
  expiry: ISODate
  qty: number
}

export interface InventoryItem {
  id: ID
  name: string
  category: "obat" | "bmhp" | "reagen" | "umum"
  form?: string
  strength?: string
  unit: string
  price: number
  minStock: number
  batches: Batch[]
  /** Formularium Nasional. */
  fornas?: boolean
  highAlert?: boolean
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
export type AppointmentSource = "mobile-jkn" | "telepon" | "web" | "loket"

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

export type ShiftCode = "P" | "S" | "M" | "L"

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
  surgeonId: ID
  anesthetistId?: ID
  room: string
  scheduledAt: ISODate
  durationMin: number
  status: SurgeryStatus
  /** WHO Surgical Safety Checklist items ticked, keyed by item id. */
  checklist: Record<string, boolean>
}

// ---------------------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------------------

export type ChargeCategory = "administrasi" | "konsultasi" | "tindakan" | "laboratorium" | "radiologi" | "obat" | "kamar" | "operasi"

export interface Charge {
  id: ID
  at: ISODate
  category: ChargeCategory
  description: string
  qty: number
  price: number
  ref?: string
}

export type PaymentMethod = "tunai" | "debit" | "qris" | "transfer" | "penjamin"

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

export type ClaimStatus = "draft" | "coded" | "submitted" | "pending" | "approved" | "rejected" | "paid"
/** iDRG / INA-CBG for JKN; FFS = fee-for-service (private insurers pay the itemised bill). */
export type Grouper = "iDRG" | "INA-CBG" | "FFS"

export interface Claim {
  id: ID
  encounterId: ID
  invoiceId: ID
  payer: PayerType
  grouper: Grouper
  groupCode?: string
  groupName?: string
  tariff?: number
  status: ClaimStatus
  note?: string
  updatedAt: ISODate
}

// ---------------------------------------------------------------------------------------
// Quality
// ---------------------------------------------------------------------------------------

export type IncidentType = "KTD" | "KNC" | "KTC" | "KPC" | "Sentinel"
export type RiskGrade = "biru" | "hijau" | "kuning" | "merah"
export type IncidentStatus = "dilaporkan" | "investigasi" | "selesai"

export interface Incident {
  id: ID
  at: ISODate
  reportedAt: ISODate
  type: IncidentType
  unitId: ID
  description: string
  immediateAction: string
  impact: 1 | 2 | 3 | 4 | 5
  probability: 1 | 2 | 3 | 4 | 5
  grade: RiskGrade
  status: IncidentStatus
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

export type IntegrationId = "satusehat" | "bpjs-vclaim" | "bpjs-antrean"

export interface SyncJob {
  id: ID
  integration: IntegrationId
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
