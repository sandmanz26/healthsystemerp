/**
 * Status chips. Every status shows text + colour (never colour alone), with one mapping
 * per domain status so the same state reads the same everywhere.
 */
import { Chip } from "@heroui/react"
import { TriageTag } from "@v2/components/clinical/triage-tag"
import type {
  BedStatus, ClaimStatus, EncounterStatus, InvoiceStatus, OrderStatus, PayerType, PrescriptionStatus, Priority, ResultFlag,
  SyncStatus, TriageLevel,
} from "@v2/domain/types"

type Color = "default" | "accent" | "success" | "warning" | "danger"
type Def = { label: string; color: Color }

function StatusChip({ def, size = "sm" }: { def: Def; size?: "sm" | "md" }) {
  return (
    <Chip color={def.color} variant="soft" size={size} className="whitespace-nowrap">
      {def.label}
    </Chip>
  )
}

const ENCOUNTER: Record<EncounterStatus, Def> = {
  registered: { label: "Waiting", color: "default" },
  triaged: { label: "Triaged", color: "accent" },
  called: { label: "Called", color: "warning" },
  "in-progress": { label: "With provider", color: "accent" },
  "awaiting-admission": { label: "Awaiting bed", color: "warning" },
  finished: { label: "Completed", color: "success" },
  cancelled: { label: "Cancelled", color: "danger" },
}
export const EncounterStatusChip = ({ status }: { status: EncounterStatus }) => <StatusChip def={ENCOUNTER[status]} />

const ORDER: Record<OrderStatus, Def> = {
  ordered: { label: "Ordered", color: "default" },
  collected: { label: "Collected", color: "accent" },
  "in-progress": { label: "In process", color: "accent" },
  resulted: { label: "Resulted", color: "warning" },
  validated: { label: "Verified", color: "success" },
  cancelled: { label: "Cancelled", color: "danger" },
}
export const OrderStatusChip = ({ status }: { status: OrderStatus }) => <StatusChip def={ORDER[status]} />

const RX: Record<PrescriptionStatus, Def> = {
  new: { label: "Pending verification", color: "default" },
  reviewed: { label: "Verified", color: "accent" },
  prepared: { label: "Ready", color: "warning" },
  dispensed: { label: "Dispensed", color: "success" },
  cancelled: { label: "Discontinued", color: "danger" },
}
export const RxStatusChip = ({ status }: { status: PrescriptionStatus }) => <StatusChip def={RX[status]} />

const INVOICE: Record<InvoiceStatus, Def> = {
  open: { label: "Balance due", color: "warning" },
  paid: { label: "Paid", color: "success" },
  claim: { label: "Billed to payer", color: "accent" },
  void: { label: "Void", color: "danger" },
}
export const InvoiceStatusChip = ({ status }: { status: InvoiceStatus }) => <StatusChip def={INVOICE[status]} />

const CLAIM: Record<ClaimStatus, Def> = {
  draft: { label: "Not coded", color: "default" },
  coded: { label: "Ready to bill", color: "accent" },
  submitted: { label: "Submitted", color: "accent" },
  accepted: { label: "Accepted", color: "success" },
  denied: { label: "Denied", color: "danger" },
  appealed: { label: "Appealed", color: "warning" },
  paid: { label: "Paid", color: "success" },
}
export const ClaimStatusChip = ({ status }: { status: ClaimStatus }) => <StatusChip def={CLAIM[status]} />

const BED: Record<BedStatus, Def> = {
  available: { label: "Clean / ready", color: "success" },
  occupied: { label: "Occupied", color: "accent" },
  cleaning: { label: "Dirty (EVS)", color: "warning" },
  maintenance: { label: "Blocked", color: "danger" },
  reserved: { label: "Assigned", color: "default" },
}
export const BedStatusChip = ({ status }: { status: BedStatus }) => <StatusChip def={BED[status]} />

const PAYER: Record<PayerType, Def> = {
  medicare: { label: "Medicare", color: "accent" },
  medicaid: { label: "Medicaid", color: "accent" },
  commercial: { label: "Commercial", color: "success" },
  "self-pay": { label: "Self-pay", color: "warning" },
  nhs: { label: "NHS", color: "accent" },
  private: { label: "Private", color: "success" },
  overseas: { label: "Overseas visitor", color: "warning" },
}
export const PayerChip = ({ payer }: { payer: PayerType }) => <StatusChip def={PAYER[payer]} />

const SYNC: Record<SyncStatus, Def> = {
  pending: { label: "Queued", color: "default" },
  synced: { label: "Delivered", color: "success" },
  failed: { label: "Error", color: "danger" },
  "not-required": { label: "Off", color: "default" },
}
export const SyncChip = ({ status }: { status: SyncStatus }) => <StatusChip def={SYNC[status]} />

export function TriageChip({ level }: { level?: TriageLevel }) {
  return <TriageTag level={level} />
}

export function PriorityChip({ priority }: { priority: Priority }) {
  return priority === "stat" ? <StatusChip def={{ label: "STAT", color: "danger" }} /> : <StatusChip def={{ label: "Routine", color: "default" }} />
}

const FLAG: Record<ResultFlag, Def> = {
  N: { label: "Normal", color: "success" },
  L: { label: "Low", color: "warning" },
  H: { label: "High", color: "warning" },
  LL: { label: "Critical low", color: "danger" },
  HH: { label: "Critical high", color: "danger" },
}
export const FlagChip = ({ flag }: { flag: ResultFlag }) => <StatusChip def={FLAG[flag]} />
