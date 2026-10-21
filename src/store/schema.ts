import type { FacilityType, ModuleId } from "@/domain/modules"
import type {
  Appointment, AuditEntry, Bed, Claim, DoctorSchedule, Encounter, Incident, IndicatorValue, InventoryItem, Invoice,
  MarEntry, Notification, Patient, Prescription, PurchaseRequest, RoleId, RosterEntry, ServiceOrder, Staff,
  StockMovement, Surgery, SyncJob, Unit,
} from "@/domain/types"

export interface FacilityProfile {
  name: string
  type: FacilityType
  city: string
  /** Kode faskes BPJS / Kemenkes. */
  code: string
  /** SATUSEHAT Organization ID. */
  orgId: string
}

export interface ModuleState {
  enabled: boolean
  enabledAt?: string
  /** Setup checklist items marked done. */
  setupDone: string[]
}

/** All persisted data. Pure JSON; no functions, no Dates. */
export interface HospitalData {
  version: number
  /** Day (yyyy-mm-dd) the demo data was generated for — the UI offers a refresh on later days. */
  seededOn: string
  onboarded: boolean
  facility: FacilityProfile
  modules: Record<ModuleId, ModuleState>
  /** The demo has no login; this is "who is using the screen now". */
  session: { role: RoleId; userId: string; locked: boolean }
  units: Unit[]
  staff: Staff[]
  patients: Patient[]
  beds: Bed[]
  encounters: Encounter[]
  orders: ServiceOrder[]
  prescriptions: Prescription[]
  mar: MarEntry[]
  inventory: InventoryItem[]
  purchases: PurchaseRequest[]
  movements: StockMovement[]
  schedules: DoctorSchedule[]
  appointments: Appointment[]
  roster: RosterEntry[]
  surgeries: Surgery[]
  invoices: Invoice[]
  claims: Claim[]
  incidents: Incident[]
  indicators: IndicatorValue[]
  syncJobs: SyncJob[]
  audit: AuditEntry[]
  notifications: Notification[]
  /** Daily queue counters per unit: `${dayKey}:${unitId}` → last number issued. */
  queueCounters: Record<string, number>
  invoiceCounter: number
  mrnCounter: number
}

export const DATA_VERSION = 2
