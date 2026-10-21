/**
 * Shared worklist for laboratory and radiology: order → sample/exam → result → validate.
 * CITO orders always sort to the top; critical lab values block validation until the
 * analyst confirms the DPJP was called (hospital quality indicator: report ≤ 30 min).
 */
import { Button, Checkbox, Label } from "@heroui/react"
import { AlertOctagon, FlaskConical, ScanLine } from "lucide-react"
import { useMemo, useState } from "react"
import { OrderStatusChip, PayerChip, PriorityChip } from "@/components/status"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Empty } from "@/components/ui/empty"
import { SelectInput, TextAreaInput, TextInput } from "@/components/ui/fields"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Segmented } from "@/components/ui/segmented"
import { SidePanel } from "@/components/ui/side-panel"
import { Stat } from "@/components/ui/stat"
import { FlagChip } from "@/components/status"
import { LAB_MAP, orderTitle } from "@/domain/catalog"
import { flagResult, isCritical, minutesSince } from "@/domain/clinical"
import type { OrderKind, OrderStatus, ServiceOrder } from "@/domain/types"
import { OrderResults } from "@/features/emr/clinical-widgets"
import { PatientBanner } from "@/features/patients/patient-banner"
import { cn } from "@/lib/cn"
import { formatDateTime, formatDuration } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useNow } from "@/lib/use-now"
import { useActions, useStore } from "@/store"
import { usePatientMap, useStaffMap, useUnitName } from "@/store/selectors"

type Stage = "todo" | "process" | "validate" | "done"
const STAGE_OF: Record<OrderStatus, Stage | null> = { ordered: "todo", collected: "process", "in-progress": "process", resulted: "validate", validated: "done", cancelled: null }

const RAD_TEMPLATES: Record<string, string> = {
  normal: "Tidak tampak kelainan pada pemeriksaan ini.\nKesan: dalam batas normal.",
  thorax: "Cor: tidak membesar (CTR < 50%).\nPulmo: tidak tampak infiltrat. Sinus kostofrenikus tajam. Diafragma licin.\nKesan: cor dan pulmo dalam batas normal.",
}

export function OrderWorklistPage({ kind }: { kind: OrderKind }) {
  const orders = useStore((s) => s.orders)
  const encounters = useStore((s) => s.encounters)
  const patients = usePatientMap()
  const unitName = useUnitName()
  const now = useNow()
  const [stage, setStage] = useState<Stage>("todo")
  const [openId, setOpenId] = useState<string>()

  const mine = useMemo(() => orders.filter((o) => o.kind === kind && STAGE_OF[o.status]), [orders, kind])
  const encById = useMemo(() => new Map(encounters.map((e) => [e.id, e])), [encounters])
  const byStage = (s: Stage) => mine.filter((o) => STAGE_OF[o.status] === s)
  const rows = byStage(stage)
    .filter((o) => stage !== "done" || minutesSince(o.orderedAt, now) < 3 * 1440)
    .sort((a, b) => (a.priority === b.priority ? a.orderedAt.localeCompare(b.orderedAt) : a.priority === "cito" ? -1 : 1))
  const open = orders.find((o) => o.id === openId)
  const critical = mine.filter((o) => o.status === "resulted" && o.results.some((r) => isCritical(r.flag)))
  const Icon = kind === "lab" ? FlaskConical : ScanLine

  const columns: Column<ServiceOrder>[] = [
    { id: "priority", header: "Prioritas", cell: (o) => <PriorityChip priority={o.priority} /> },
    {
      id: "patient",
      header: "Pasien",
      isRowHeader: true,
      cell: (o) => {
        const p = patients.get(o.patientId)!
        return (
          <div>
            <div className="font-medium">{p.name}</div>
            <div className="tabular text-xs text-muted">
              RM {p.mrn} · {unitName(encById.get(o.encounterId)?.unitId)}
            </div>
          </div>
        )
      },
    },
    { id: "tests", header: "Pemeriksaan", cell: (o) => <span className="line-clamp-2 text-sm">{orderTitle(o)}</span> },
    { id: "payer", header: "Penjamin", cell: (o) => <PayerChip payer={encById.get(o.encounterId)?.payer ?? "umum"} /> },
    {
      id: "time",
      header: "Order",
      cell: (o) => {
        const m = minutesSince(o.orderedAt, now)
        const slow = o.status !== "validated" && (o.priority === "cito" ? m > 60 : m > 180)
        return <span className={cn("tabular text-sm", slow ? "font-semibold text-danger" : "text-muted")}>{formatDuration(m)} lalu</span>
      },
    },
    {
      id: "status",
      header: "Status",
      cell: (o) => (
        <div className="flex items-center gap-1.5">
          <OrderStatusChip status={o.status} />
          {o.results.some((r) => isCritical(r.flag)) && <AlertOctagon className="size-4 text-danger" aria-label="Nilai kritis" />}
        </div>
      ),
    },
  ]

  return (
    <Page>
      <PageHeader
        title={kind === "lab" ? "Laboratorium" : "Radiologi"}
        description={kind === "lab" ? "Worklist order dari semua unit. CITO di atas; nilai kritis wajib dilaporkan ke DPJP ≤ 30 menit." : "Worklist pemeriksaan pencitraan dan ekspertise radiolog."}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={kind === "lab" ? "Perlu ambil sampel" : "Perlu diperiksa"} value={byStage("todo").length} icon={Icon} tone="accent" onClick={() => setStage("todo")} />
        <Stat label="Sedang diproses" value={byStage("process").length} tone="warning" onClick={() => setStage("process")} />
        <Stat label="Perlu validasi" value={byStage("validate").length} tone={byStage("validate").length ? "warning" : "default"} onClick={() => setStage("validate")} />
        {kind === "lab" ? <Stat label="Nilai kritis belum divalidasi" value={critical.length} icon={AlertOctagon} tone={critical.length ? "danger" : "success"} /> : <Stat label="CITO aktif" value={mine.filter((o) => o.priority === "cito" && o.status !== "validated").length} tone="danger" />}
      </div>
      <Panel flush>
        <div className="border-b border-separator p-4">
          <Segmented
            label="Tahap"
            value={stage}
            onChange={setStage}
            options={[
              { value: "todo", label: kind === "lab" ? "Ambil sampel" : "Belum diperiksa", count: byStage("todo").length },
              { value: "process", label: "Diproses", count: byStage("process").length },
              { value: "validate", label: "Validasi", count: byStage("validate").length },
              { value: "done", label: "Selesai (3 hari)", count: byStage("done").filter((o) => minutesSince(o.orderedAt, now) < 3 * 1440).length },
            ]}
          />
        </div>
        <DataTable label="Worklist" rows={rows} columns={columns} rowKey={(o) => o.id} onRowAction={(o) => setOpenId(o.id)} empty={<Empty icon={Icon} title="Tidak ada order di tahap ini" />} />
      </Panel>
      {open && <OrderPanel order={open} onClose={() => setOpenId(undefined)} />}
    </Page>
  )
}

function OrderPanel({ order, onClose }: { order: ServiceOrder; onClose: () => void }) {
  const patient = useStore((s) => s.patients.find((p) => p.id === order.patientId))!
  const encounter = useStore((s) => s.encounters.find((e) => e.id === order.encounterId))
  const staff = useStaffMap()
  const { collectSample, startProcessing, enterResults, saveReport, validateOrder, cancelOrder } = useActions()
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(order.results.map((r) => [r.testCode, r.value])))
  const [report, setReport] = useState(order.report ?? "")
  const [calledDpjp, setCalledDpjp] = useState(false)
  const hasCritical = order.results.some((r) => isCritical(r.flag))
  const lab = order.kind === "lab"

  const footer = (() => {
    switch (order.status) {
      case "ordered":
        return (
          <>
            <Button variant="ghost" onPress={() => { cancelOrder(order.id); toast("Order dibatalkan"); onClose() }}>
              Batalkan order
            </Button>
            <Button variant="primary" onPress={() => { collectSample(order.id); toast.success(lab ? "Sampel diambil" : "Pasien diperiksa") }}>
              {lab ? "Sampel sudah diambil" : "Pasien sudah diperiksa"}
            </Button>
          </>
        )
      case "collected":
        return (
          <Button variant="primary" onPress={() => startProcessing(order.id)}>
            Mulai proses
          </Button>
        )
      case "in-progress":
        return lab ? (
          <Button variant="primary" isDisabled={!Object.values(values).some((v) => v.trim())} onPress={() => { enterResults(order.id, values); toast.success("Hasil tersimpan") }}>
            Simpan hasil
          </Button>
        ) : (
          <Button variant="primary" isDisabled={report.trim().length < 10} onPress={() => { saveReport(order.id, report); toast.success("Ekspertise tersimpan") }}>
            Simpan ekspertise
          </Button>
        )
      case "resulted":
        return (
          <Button variant="primary" isDisabled={hasCritical && !calledDpjp} onPress={() => { validateOrder(order.id); toast.success("Hasil divalidasi", { description: "Hasil langsung tampil di rekam medis." }); onClose() }}>
            Validasi hasil
          </Button>
        )
      default:
        return null
    }
  })()

  return (
    <SidePanel isOpen onOpenChange={(o) => !o && onClose()} title={orderTitle(order)} description={`Order ${formatDateTime(order.orderedAt)} oleh ${staff.get(order.orderedBy)?.name ?? "-"}`} footer={footer ? <div className="flex w-full justify-end gap-2">{footer}</div> : undefined}>
      <PatientBanner patient={patient} encounter={encounter} compact />
      <div className="flex flex-wrap gap-2">
        <PriorityChip priority={order.priority} />
        <OrderStatusChip status={order.status} />
      </div>
      <p className="text-sm">
        <span className="text-muted">Keterangan klinis:</span> {order.clinicalNote || "—"}
      </p>

      {order.status === "in-progress" && lab && (
        <div className="space-y-3">
          {order.testCodes.map((code) => {
            const t = LAB_MAP[code]
            const flag = flagResult(code, values[code] ?? "")
            return (
              <div key={code} className="grid grid-cols-[1fr_auto] items-end gap-3">
                <TextInput label={t.name} value={values[code] ?? ""} onChange={(v) => setValues((x) => ({ ...x, [code]: v }))} suffix={t.unit} description={t.low !== undefined && t.high !== undefined ? `Rujukan ${t.low}–${t.high}` : "Kualitatif"} />
                <div className="pb-6">{(values[code] ?? "").trim() && <FlagChip flag={flag} />}</div>
              </div>
            )
          })}
        </div>
      )}

      {order.status === "in-progress" && !lab && (
        <div className="space-y-2">
          <SelectInput label="Template" value={null} placeholder="Pakai template…" onChange={(k) => setReport(RAD_TEMPLATES[k])} options={[{ value: "normal", label: "Normal" }, { value: "thorax", label: "Thorax normal" }]} />
          <TextAreaInput label="Ekspertise" value={report} onChange={setReport} rows={8} placeholder="Temuan…\nKesan: …" />
        </div>
      )}

      {(order.status === "resulted" || order.status === "validated") && (
        <Panel title="Hasil">
          <OrderResults order={order} />
        </Panel>
      )}

      {order.status === "resulted" && hasCritical && (
        <div className="space-y-2 rounded-xl bg-danger-soft p-3 text-sm text-danger-soft-foreground">
          <div className="flex items-center gap-2 font-semibold">
            <AlertOctagon className="size-4" aria-hidden /> Ada nilai kritis
          </div>
          <p>Hubungi DPJP ({staff.get(encounter?.practitionerId ?? "")?.name ?? "dokter jaga"}) dan lakukan read-back sebelum validasi.</p>
          <Checkbox isSelected={calledDpjp} onChange={setCalledDpjp}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Label className="text-sm">DPJP sudah dihubungi & hasil dibacakan ulang</Label>
            </Checkbox.Content>
          </Checkbox>
        </div>
      )}
    </SidePanel>
  )
}
