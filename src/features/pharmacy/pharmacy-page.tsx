/**
 * Pharmacy: prescription queue through review (telaah), preparation and hand-over, with
 * the same automatic checks the prescriber saw plus the formal review checklist
 * (administratif, farmasetik, klinis).
 */
import { Button, Checkbox, Chip, Label } from "@heroui/react"
import { Clock, PackageCheck, Pill, ShieldAlert } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { PayerChip, RxStatusChip } from "@/components/status"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Empty } from "@/components/ui/empty"
import { TextAreaInput } from "@/components/ui/fields"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Segmented } from "@/components/ui/segmented"
import { SidePanel } from "@/components/ui/side-panel"
import { Stat } from "@/components/ui/stat"
import { minutesSince, reviewPrescription } from "@/domain/clinical"
import type { Prescription, PrescriptionStatus } from "@/domain/types"
import { AlertList } from "@/features/emr/prescription-section"
import { PatientBanner } from "@/features/patients/patient-banner"
import { cn } from "@/lib/cn"
import { formatDate, formatDuration, formatRupiah } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useNow } from "@/lib/use-now"
import { useActions, useStore } from "@/store"
import { stockOf, useInventoryMap, useModuleEnabled, usePatientMap, useStaffMap, useUnitName } from "@/store/selectors"

type Stage = "new" | "reviewed" | "prepared" | "dispensed"

const REVIEW_ITEMS = [
  { id: "adm", label: "Administratif: identitas pasien & dokter, tanggal, paraf/TTE" },
  { id: "farm", label: "Farmasetik: bentuk & kekuatan sediaan, stabilitas, kompatibilitas" },
  { id: "klinis", label: "Klinis: ketepatan indikasi & dosis, duplikasi, alergi, interaksi" },
]

export default function PharmacyPage() {
  const prescriptions = useStore((s) => s.prescriptions)
  const inventory = useStore((s) => s.inventory)
  const encounters = useStore((s) => s.encounters)
  const patients = usePatientMap()
  const unitName = useUnitName()
  const inventoryOn = useModuleEnabled("inventory")
  const now = useNow()
  const [stage, setStage] = useState<Stage>("new")
  const [openId, setOpenId] = useState<string>()
  const encById = useMemo(() => new Map(encounters.map((e) => [e.id, e])), [encounters])
  const recent = prescriptions.filter((p) => p.status !== "cancelled" && (p.status !== "dispensed" || minutesSince(p.dispensedAt ?? p.prescribedAt, now) < 1440))
  const byStage = (s: Stage) => recent.filter((p) => p.status === s).sort((a, b) => a.prescribedAt.localeCompare(b.prescribedAt))
  const lowStock = inventory.filter((i) => i.category === "obat" && stockOf(i) < i.minStock)
  const open = prescriptions.find((p) => p.id === openId)

  const columns: Column<Prescription>[] = [
    {
      id: "patient",
      header: "Pasien",
      isRowHeader: true,
      cell: (rx) => {
        const p = patients.get(rx.patientId)!
        const enc = encById.get(rx.encounterId)
        return (
          <div>
            <div className="font-medium">{p.name}</div>
            <div className="tabular text-xs text-muted">
              RM {p.mrn} · {unitName(enc?.unitId)}
            </div>
          </div>
        )
      },
    },
    { id: "items", header: "Obat", cell: (rx) => <span className="text-sm">{rx.items.length} item</span> },
    {
      id: "flags",
      header: "Telaah otomatis",
      cell: (rx) => {
        const items = rx.items.map((l) => inventory.find((i) => i.id === l.itemId)!).filter(Boolean)
        const alerts = reviewPrescription(patients.get(rx.patientId)!, items)
        const danger = alerts.filter((a) => a.level === "danger").length
        const warn = alerts.filter((a) => a.level === "warning").length
        if (!alerts.length) return <Chip size="sm" color="success" variant="soft">Aman</Chip>
        return (
          <div className="flex gap-1">
            {danger > 0 && <Chip size="sm" color="danger" variant="primary">{danger} alergi</Chip>}
            {warn > 0 && <Chip size="sm" color="warning" variant="soft">{warn} peringatan</Chip>}
          </div>
        )
      },
    },
    { id: "payer", header: "Penjamin", cell: (rx) => <PayerChip payer={encById.get(rx.encounterId)?.payer ?? "umum"} /> },
    {
      id: "wait",
      header: "Tunggu",
      cell: (rx) => {
        const m = minutesSince(rx.prescribedAt, now)
        return rx.status === "dispensed" ? <span className="text-muted">—</span> : <span className={cn("tabular text-sm", m > 60 ? "font-semibold text-danger" : "text-muted")}>{formatDuration(m)}</span>
      },
    },
    { id: "status", header: "Status", cell: (rx) => <RxStatusChip status={rx.status} /> },
  ]

  return (
    <Page>
      <PageHeader title="Farmasi" description="Antrean resep dari semua unit. Waktu tunggu obat > 60 menit ditandai merah." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Perlu telaah" value={byStage("new").length} icon={ShieldAlert} tone="warning" onClick={() => setStage("new")} />
        <Stat label="Sedang disiapkan" value={byStage("reviewed").length} icon={Pill} tone="accent" onClick={() => setStage("reviewed")} />
        <Stat label="Siap diserahkan" value={byStage("prepared").length} icon={PackageCheck} tone="success" onClick={() => setStage("prepared")} />
        <Stat label="Obat di bawah stok minimum" value={lowStock.length} icon={Clock} tone={lowStock.length ? "danger" : "default"} hint={inventoryOn ? <Link to="/inventory" className="text-accent hover:underline">Buka inventori</Link> : "Aktifkan modul Logistik untuk pengadaan"} />
      </div>
      <Panel flush>
        <div className="border-b border-separator p-4">
          <Segmented
            label="Tahap resep"
            value={stage}
            onChange={setStage}
            options={[
              { value: "new", label: "Telaah", count: byStage("new").length },
              { value: "reviewed", label: "Disiapkan", count: byStage("reviewed").length },
              { value: "prepared", label: "Siap diserahkan", count: byStage("prepared").length },
              { value: "dispensed", label: "Selesai 24 jam", count: byStage("dispensed").length },
            ]}
          />
        </div>
        <DataTable label="Antrean resep" rows={byStage(stage)} columns={columns} rowKey={(r) => r.id} onRowAction={(r) => setOpenId(r.id)} empty={<Empty icon={Pill} title="Tidak ada resep di tahap ini" />} />
      </Panel>
      {open && <RxPanel rx={open} onClose={() => setOpenId(undefined)} />}
    </Page>
  )
}

const NEXT_LABEL: Partial<Record<PrescriptionStatus, string>> = { new: "Telaah selesai", reviewed: "Obat sudah disiapkan", prepared: "Serahkan ke pasien" }

function RxPanel({ rx, onClose }: { rx: Prescription; onClose: () => void }) {
  const patient = useStore((s) => s.patients.find((p) => p.id === rx.patientId))!
  const encounter = useStore((s) => s.encounters.find((e) => e.id === rx.encounterId))
  const items = useInventoryMap()
  const staff = useStaffMap()
  const { reviewPrescription: review, preparePrescription, dispensePrescription, cancelPrescription } = useActions()
  const [checks, setChecks] = useState<string[]>([])
  const [note, setNote] = useState(rx.reviewNote ?? "")
  const [counselled, setCounselled] = useState(false)
  const lines = rx.items.map((l) => ({ line: l, item: items.get(l.itemId)! }))
  const alerts = reviewPrescription(patient, lines.map((l) => l.item))
  const blocked = alerts.some((a) => a.level === "danger")
  const total = lines.reduce((s, l) => s + l.item.price * l.line.qty, 0)

  const advance = () => {
    if (rx.status === "new") {
      review(rx.id, note || undefined)
      toast.success("Resep lolos telaah")
    } else if (rx.status === "reviewed") {
      preparePrescription(rx.id)
      toast.success("Siap diserahkan", { description: "Panggil pasien ke loket penyerahan." })
    } else if (rx.status === "prepared") {
      const { shortages } = dispensePrescription(rx.id)
      if (shortages.length) toast.warning("Diserahkan sebagian", { description: shortages.join("; ") })
      else toast.success("Obat diserahkan", { description: "Stok berkurang (FEFO) dan biaya masuk tagihan." })
      onClose()
    }
  }

  const canAdvance = rx.status === "new" ? checks.length === REVIEW_ITEMS.length && !blocked : rx.status === "prepared" ? counselled : true

  return (
    <SidePanel
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title="Resep"
      description={`${staff.get(rx.prescribedBy)?.name} · ${formatDate(rx.prescribedAt)}`}
      footer={
        rx.status !== "dispensed" && rx.status !== "cancelled" ? (
          <div className="flex w-full justify-between gap-2">
            <Button
              variant="ghost"
              isDisabled={!note.trim()}
              onPress={() => {
                cancelPrescription(rx.id, note.trim())
                toast("Resep dikembalikan ke dokter")
                onClose()
              }}
            >
              Kembalikan ke dokter
            </Button>
            <Button variant="primary" isDisabled={!canAdvance} onPress={advance}>
              {blocked && rx.status === "new" ? "Ada alergi — konfirmasi dokter" : NEXT_LABEL[rx.status]}
            </Button>
          </div>
        ) : undefined
      }
    >
      <PatientBanner patient={patient} encounter={encounter} compact />
      <Panel title="Item resep" flush>
        <ul className="divide-y divide-separator">
          {lines.map(({ line, item }) => {
            const stock = stockOf(item)
            const nextBatch = [...item.batches].sort((a, b) => a.expiry.localeCompare(b.expiry))[0]
            return (
              <li key={line.itemId} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{item.name}</b>
                  {item.highAlert && <Chip size="sm" color="danger" variant="soft">High alert</Chip>}
                  {!item.fornas && <Chip size="sm" variant="soft">Non-Fornas</Chip>}
                </div>
                <div className="text-muted">
                  {line.dose} · {line.frequency} · {line.route} · {line.days} hari · <b className="text-foreground">{line.qty} {item.unit}</b>
                </div>
                <div className={cn("tabular text-xs", stock < line.qty ? "font-semibold text-danger" : "text-muted")}>
                  Stok {stock} {item.unit}
                  {nextBatch && ` · FEFO batch ${nextBatch.batch} (ED ${formatDate(nextBatch.expiry)})`}
                </div>
              </li>
            )
          })}
        </ul>
        <div className="tabular border-t border-separator px-5 py-2 text-right text-sm">Total {formatRupiah(total)}</div>
      </Panel>
      <AlertList alerts={alerts} />
      {rx.status === "new" && (
        <div className="space-y-2">
          <div className="text-sm font-semibold">Checklist telaah resep</div>
          {REVIEW_ITEMS.map((r) => (
            <Checkbox key={r.id} isSelected={checks.includes(r.id)} onChange={(on) => setChecks((c) => (on ? [...c, r.id] : c.filter((x) => x !== r.id)))}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Label className="text-sm">{r.label}</Label>
              </Checkbox.Content>
            </Checkbox>
          ))}
        </div>
      )}
      {rx.status === "prepared" && (
        <Checkbox isSelected={counselled} onChange={setCounselled}>
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Label className="text-sm">Identitas dicek ulang & PIO diberikan (cara pakai, efek samping, penyimpanan)</Label>
          </Checkbox.Content>
        </Checkbox>
      )}
      {rx.status !== "dispensed" && <TextAreaInput label="Catatan apoteker" value={note} onChange={setNote} rows={2} description="Wajib diisi bila resep dikembalikan ke dokter" />}
    </SidePanel>
  )
}
