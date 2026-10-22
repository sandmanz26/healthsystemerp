/**
 * Status chips. Every status shows text + colour (never colour alone), with one mapping
 * per domain status so the same state reads the same everywhere.
 */
import { Chip } from "@heroui/react"
import { TriageTag } from "@/components/clinical/triage-tag"
import type {
  BedStatus, ClaimStatus, EncounterStatus, InvoiceStatus, OrderStatus, PayerType, PrescriptionStatus, Priority, ResultFlag,
  SyncStatus, TriageLevel,
} from "@/domain/types"

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
  registered: { label: "Menunggu", color: "default" },
  triaged: { label: "Sudah triase", color: "accent" },
  called: { label: "Dipanggil", color: "warning" },
  "in-progress": { label: "Diperiksa", color: "accent" },
  "awaiting-admission": { label: "Menunggu kamar", color: "warning" },
  finished: { label: "Selesai", color: "success" },
  cancelled: { label: "Batal", color: "danger" },
}
export const EncounterStatusChip = ({ status }: { status: EncounterStatus }) => <StatusChip def={ENCOUNTER[status]} />

const ORDER: Record<OrderStatus, Def> = {
  ordered: { label: "Diorder", color: "default" },
  collected: { label: "Sampel diambil", color: "accent" },
  "in-progress": { label: "Diproses", color: "accent" },
  resulted: { label: "Hasil keluar", color: "warning" },
  validated: { label: "Tervalidasi", color: "success" },
  cancelled: { label: "Batal", color: "danger" },
}
export const OrderStatusChip = ({ status }: { status: OrderStatus }) => <StatusChip def={ORDER[status]} />

const RX: Record<PrescriptionStatus, Def> = {
  new: { label: "Baru", color: "default" },
  reviewed: { label: "Ditelaah", color: "accent" },
  prepared: { label: "Siap diserahkan", color: "warning" },
  dispensed: { label: "Diserahkan", color: "success" },
  cancelled: { label: "Batal", color: "danger" },
}
export const RxStatusChip = ({ status }: { status: PrescriptionStatus }) => <StatusChip def={RX[status]} />

const INVOICE: Record<InvoiceStatus, Def> = {
  open: { label: "Belum bayar", color: "warning" },
  paid: { label: "Lunas", color: "success" },
  claim: { label: "Ditagihkan ke penjamin", color: "accent" },
  void: { label: "Batal", color: "danger" },
}
export const InvoiceStatusChip = ({ status }: { status: InvoiceStatus }) => <StatusChip def={INVOICE[status]} />

const CLAIM: Record<ClaimStatus, Def> = {
  draft: { label: "Belum dikoding", color: "default" },
  coded: { label: "Siap kirim", color: "accent" },
  submitted: { label: "Terkirim", color: "accent" },
  pending: { label: "Pending", color: "warning" },
  approved: { label: "Disetujui", color: "success" },
  rejected: { label: "Ditolak", color: "danger" },
  paid: { label: "Dibayar", color: "success" },
}
export const ClaimStatusChip = ({ status }: { status: ClaimStatus }) => <StatusChip def={CLAIM[status]} />

const BED: Record<BedStatus, Def> = {
  available: { label: "Kosong", color: "success" },
  occupied: { label: "Terisi", color: "accent" },
  cleaning: { label: "Dibersihkan", color: "warning" },
  maintenance: { label: "Perbaikan", color: "danger" },
  reserved: { label: "Dipesan", color: "default" },
}
export const BedStatusChip = ({ status }: { status: BedStatus }) => <StatusChip def={BED[status]} />

const PAYER: Record<PayerType, Def> = {
  bpjs: { label: "BPJS", color: "success" },
  umum: { label: "Umum", color: "default" },
  asuransi: { label: "Asuransi", color: "accent" },
}
export const PayerChip = ({ payer }: { payer: PayerType }) => <StatusChip def={PAYER[payer]} />

const SYNC: Record<SyncStatus, Def> = {
  pending: { label: "Antre", color: "default" },
  synced: { label: "Terkirim", color: "success" },
  failed: { label: "Gagal", color: "danger" },
  "not-required": { label: "Tidak aktif", color: "default" },
}
export const SyncChip = ({ status }: { status: SyncStatus }) => <StatusChip def={SYNC[status]} />

export function TriageChip({ level }: { level?: TriageLevel }) {
  return <TriageTag level={level} />
}

export function PriorityChip({ priority }: { priority: Priority }) {
  return priority === "cito" ? <StatusChip def={{ label: "CITO", color: "danger" }} /> : <StatusChip def={{ label: "Rutin", color: "default" }} />
}

const FLAG: Record<ResultFlag, Def> = {
  N: { label: "Normal", color: "success" },
  L: { label: "Rendah", color: "warning" },
  H: { label: "Tinggi", color: "warning" },
  LL: { label: "Kritis rendah", color: "danger" },
  HH: { label: "Kritis tinggi", color: "danger" },
}
export const FlagChip = ({ flag }: { flag: ResultFlag }) => <StatusChip def={FLAG[flag]} />
