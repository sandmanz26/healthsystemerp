/**
 * Pharmacy: verification queue → preparation → dispensing. The pharmacist sees the same
 * clinical decision support alerts the prescriber saw (allergy, interaction, duplication,
 * high-alert, controlled, non-formulary) plus a formal verification checklist. Stock is
 * issued first-expiry-first-out (FEFO).
 */
import { Button, Checkbox, Chip, Label } from "@heroui/react"
import { AlertTriangle, Clock, Info, PackageCheck, Pill, ShieldAlert, ShieldX } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { PayerChip, RxStatusChip } from "@v2/components/status"
import { DataTable, type Column } from "@v2/components/ui/data-table"
import { Empty } from "@v2/components/ui/empty"
import { TextAreaInput } from "@v2/components/ui/fields"
import { Page, PageHeader } from "@v2/components/ui/page"
import { Panel } from "@v2/components/ui/panel"
import { Segmented } from "@v2/components/ui/segmented"
import { SidePanel } from "@v2/components/ui/side-panel"
import { Stat } from "@v2/components/ui/stat"
import { frequencyLabel } from "@v2/domain/catalog"
import { minutesSince, reviewPrescription, type DrugAlert } from "@v2/domain/clinical"
import type { Region } from "@v2/domain/region"
import type { InventoryItem, Patient, Prescription, PrescriptionStatus } from "@v2/domain/types"
import { PatientBanner } from "@v2/features/patients/patient-banner"
import { DrugBadges } from "./drug-badges"
import { cn } from "@v2/lib/cn"
import { formatDate, formatDuration, formatMoney } from "@v2/lib/format"
import { toast } from "@v2/lib/toast"
import { useNow } from "@v2/lib/use-now"
import { useActions, useStore } from "@v2/store"
import { stockOf, useInventoryMap, useModuleEnabled, usePatientMap, useRegion, useStaffMap, useUnitName } from "@v2/store/selectors"

type Stage = "new" | "reviewed" | "prepared" | "dispensed"

const REVIEW_ITEMS: Record<Region, { id: string; label: string }[]> = {
  us: [
    { id: "order", label: "Order appropriate: indication, drug, dose, route, frequency and duration" },
    { id: "patient", label: "Patient-specific: age, weight, renal / hepatic function, pregnancy & lactation" },
    { id: "safety", label: "Allergies, interactions and therapeutic duplication reviewed (CDS alerts addressed)" },
  ],
  uk: [
    { id: "legal", label: "Legal & administrative check: prescriber, patient identifiers, signature, date" },
    { id: "clinical", label: "Clinical screen: indication, dose, route, frequency, renal / hepatic function" },
    { id: "safety", label: "Allergies, interactions and duplication reviewed; medicines reconciliation done" },
  ],
}

const ALERT_STYLE: Record<DrugAlert["level"], { icon: typeof Info; className: string }> = {
  danger: { icon: ShieldX, className: "bg-danger-soft text-danger-soft-foreground" },
  warning: { icon: AlertTriangle, className: "bg-warning-soft text-warning-soft-foreground" },
  info: { icon: Info, className: "bg-accent-soft text-accent-soft-foreground" },
}

function CdsAlerts({ alerts }: { alerts: DrugAlert[] }) {
  if (!alerts.length) return <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success-soft-foreground">No clinical decision support alerts.</p>
  return (
    <ul className="space-y-1.5">
      {alerts.map((a, i) => {
        const s = ALERT_STYLE[a.level]
        return (
          <li key={i} className={cn("flex items-start gap-2 rounded-lg px-3 py-2 text-sm", s.className)}>
            <s.icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{a.message}</span>
          </li>
        )
      })}
    </ul>
  )
}

export default function PharmacyPage() {
  const prescriptions = useStore((s) => s.prescriptions)
  const inventory = useStore((s) => s.inventory)
  const encounters = useStore((s) => s.encounters)
  const patients = usePatientMap()
  const items = useInventoryMap()
  const unitName = useUnitName()
  const region = useRegion()
  const inventoryOn = useModuleEnabled("inventory")
  const now = useNow()
  const [stage, setStage] = useState<Stage>("new")
  const [openId, setOpenId] = useState<string>()
  const encById = useMemo(() => new Map(encounters.map((e) => [e.id, e])), [encounters])
  const recent = prescriptions.filter((p) => p.status !== "cancelled" && (p.status !== "dispensed" || minutesSince(p.dispensedAt ?? p.prescribedAt, now) < 1440))
  const byStage = (s: Stage) => recent.filter((p) => p.status === s).sort((a, b) => a.prescribedAt.localeCompare(b.prescribedAt))
  const lowStock = inventory.filter((i) => i.category === "drug" && stockOf(i) < i.minStock)
  const open = prescriptions.find((p) => p.id === openId)
  const alertsFor = (rx: Prescription, patient: Patient | undefined) =>
    patient ? reviewPrescription(patient, rx.items.map((l) => items.get(l.itemId)).filter((i): i is InventoryItem => !!i), region) : []

  const columns: Column<Prescription>[] = [
    {
      id: "patient",
      header: "Patient",
      isRowHeader: true,
      cell: (rx) => {
        const p = patients.get(rx.patientId)
        const enc = encById.get(rx.encounterId)
        return (
          <div>
            <div className="font-medium">{p?.name}</div>
            <div className="num text-xs text-muted">
              MRN {p?.mrn} · {unitName(enc?.unitId)}
            </div>
          </div>
        )
      },
    },
    {
      id: "items",
      header: "Medications",
      cell: (rx) => (
        <div className="space-y-0.5 text-sm">
          {rx.items.slice(0, 3).map((l) => {
            const item = items.get(l.itemId)
            return (
              <div key={l.itemId} className="flex flex-wrap items-center gap-1.5">
                <span>{item?.name ?? l.itemId}</span>
                <span className="num text-xs text-muted">{frequencyLabel(l.frequency, region)}</span>
                {item && <DrugBadges item={item} region={region} />}
              </div>
            )
          })}
          {rx.items.length > 3 && <div className="text-xs text-muted">+{rx.items.length - 3} more</div>}
        </div>
      ),
    },
    {
      id: "flags",
      header: "CDS alerts",
      cell: (rx) => {
        const alerts = alertsFor(rx, patients.get(rx.patientId))
        const danger = alerts.filter((a) => a.level === "danger").length
        const warn = alerts.filter((a) => a.level === "warning").length
        if (!danger && !warn)
          return (
            <Chip size="sm" color="success" variant="soft">
              Clear
            </Chip>
          )
        return (
          <div className="flex flex-wrap gap-1">
            {danger > 0 && (
              <Chip size="sm" color="danger" variant="primary">
                {danger} allergy
              </Chip>
            )}
            {warn > 0 && (
              <Chip size="sm" color="warning" variant="soft">
                {warn} warning{warn > 1 ? "s" : ""}
              </Chip>
            )}
          </div>
        )
      },
    },
    {
      id: "payer",
      header: "Payer",
      cell: (rx) => {
        const payer = encById.get(rx.encounterId)?.payer
        return payer ? <PayerChip payer={payer} /> : <span className="text-muted">—</span>
      },
    },
    {
      id: "wait",
      header: "Waiting",
      cell: (rx) => {
        const m = minutesSince(rx.prescribedAt, now)
        return rx.status === "dispensed" ? <span className="text-muted">—</span> : <span className={cn("num text-sm", m > 60 ? "font-semibold text-danger" : "text-muted")}>{formatDuration(m)}</span>
      },
    },
    { id: "status", header: "Status", cell: (rx) => <RxStatusChip status={rx.status} /> },
  ]

  return (
    <Page>
      <PageHeader title="Pharmacy" description="Verification queue for orders from every unit. Turnaround over 60 minutes is flagged red." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pending verification" value={byStage("new").length} icon={ShieldAlert} tone="warning" onClick={() => setStage("new")} />
        <Stat label="In preparation" value={byStage("reviewed").length} icon={Pill} tone="accent" onClick={() => setStage("reviewed")} />
        <Stat label="Ready to dispense" value={byStage("prepared").length} icon={PackageCheck} tone="success" onClick={() => setStage("prepared")} />
        <Stat
          label="Drugs below par"
          value={lowStock.length}
          icon={Clock}
          tone={lowStock.length ? "danger" : "default"}
          hint={inventoryOn ? <Link to="/inventory" className="text-accent hover:underline">Open inventory</Link> : "Enable Supply Chain for purchasing"}
        />
      </div>
      <Panel flush>
        <div className="border-b border-separator p-4">
          <Segmented
            label="Queue"
            value={stage}
            onChange={setStage}
            options={[
              { value: "new", label: "Verify", count: byStage("new").length },
              { value: "reviewed", label: "Prepare", count: byStage("reviewed").length },
              { value: "prepared", label: "Dispense", count: byStage("prepared").length },
              { value: "dispensed", label: "Dispensed (24 h)", count: byStage("dispensed").length },
            ]}
          />
        </div>
        <DataTable label="Verification queue" rows={byStage(stage)} columns={columns} rowKey={(r) => r.id} onRowAction={(r) => setOpenId(r.id)} empty={<Empty icon={Pill} title="Nothing in this queue" />} />
      </Panel>
      {open && <RxPanel rx={open} onClose={() => setOpenId(undefined)} />}
    </Page>
  )
}

const NEXT_LABEL: Partial<Record<PrescriptionStatus, string>> = { new: "Verify order", reviewed: "Mark prepared", prepared: "Dispense" }

function RxPanel({ rx, onClose }: { rx: Prescription; onClose: () => void }) {
  const patient = useStore((s) => s.patients.find((p) => p.id === rx.patientId))
  const encounter = useStore((s) => s.encounters.find((e) => e.id === rx.encounterId))
  const items = useInventoryMap()
  const staff = useStaffMap()
  const region = useRegion()
  const { reviewPrescription: verify, preparePrescription, dispensePrescription, cancelPrescription } = useActions()
  const [checks, setChecks] = useState<string[]>([])
  const [note, setNote] = useState(rx.reviewNote ?? "")
  const [counselled, setCounselled] = useState(false)
  const lines = rx.items.flatMap((l) => {
    const item = items.get(l.itemId)
    return item ? [{ line: l, item }] : []
  })
  const alerts = patient ? reviewPrescription(patient, lines.map((l) => l.item), region) : []
  const blocked = alerts.some((a) => a.level === "danger")
  const total = lines.reduce((s, l) => s + l.item.price * l.line.qty, 0)
  const checklist = REVIEW_ITEMS[region]

  const advance = () => {
    if (rx.status === "new") {
      verify(rx.id, note || undefined)
      toast.success("Order verified")
    } else if (rx.status === "reviewed") {
      preparePrescription(rx.id)
      toast.success("Ready to dispense", { description: "Final check done — label and bag." })
    } else if (rx.status === "prepared") {
      const { shortages } = dispensePrescription(rx.id)
      if (shortages.length) toast.warning("Partially dispensed", { description: shortages.join("; ") })
      else toast.success("Dispensed", { description: "Stock issued FEFO; charges posted to the account." })
      onClose()
    }
  }

  const canAdvance = rx.status === "new" ? checks.length === checklist.length && !blocked : rx.status === "prepared" ? counselled : true

  return (
    <SidePanel
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title="Medication order"
      description={`${staff.get(rx.prescribedBy)?.name ?? "—"} · ${formatDate(rx.prescribedAt)}`}
      footer={
        rx.status !== "dispensed" && rx.status !== "cancelled" ? (
          <div className="flex w-full justify-between gap-2">
            <Button
              variant="ghost"
              isDisabled={!note.trim()}
              onPress={() => {
                cancelPrescription(rx.id, note.trim())
                toast("Returned to prescriber")
                onClose()
              }}
            >
              Return to prescriber
            </Button>
            <Button variant="primary" isDisabled={!canAdvance} onPress={advance}>
              {blocked && rx.status === "new" ? "Allergy — contact prescriber" : NEXT_LABEL[rx.status]}
            </Button>
          </div>
        ) : undefined
      }
    >
      {patient && <PatientBanner patient={patient} encounter={encounter} compact />}
      <Panel title="Order lines" flush>
        <ul className="divide-y divide-separator">
          {lines.map(({ line, item }) => {
            const stock = stockOf(item)
            const fefo = [...item.batches].filter((b) => b.qty > 0).sort((a, b) => a.expiry.localeCompare(b.expiry))[0]
            return (
              <li key={line.itemId} className="space-y-0.5 px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{item.name}</b>
                  <DrugBadges item={item} region={region} />
                </div>
                <div className="text-muted">
                  {line.dose} · {line.route} · <span className="num">{frequencyLabel(line.frequency, region)}</span> · {line.days} day{line.days === 1 ? "" : "s"} ·{" "}
                  <b className="text-foreground">
                    {line.qty} {item.unit}
                  </b>
                </div>
                {line.instructions && <div className="text-xs text-muted">Sig: {line.instructions}</div>}
                <div className="flex flex-wrap gap-x-3">
                  {item.atc && <span className="num text-[11px] text-muted">ATC {item.atc}</span>}
                  {item.barcode && <span className="num text-[11px] text-muted">{region === "us" ? "NDC" : "GTIN"} {item.barcode}</span>}
                </div>
                <div className={cn("num text-xs", stock < line.qty ? "font-semibold text-danger" : "text-muted")}>
                  On hand {stock} {item.unit}
                  {fefo && ` · FEFO lot ${fefo.batch} (exp ${formatDate(fefo.expiry)})`}
                </div>
              </li>
            )
          })}
        </ul>
        <div className="num border-t border-separator px-5 py-2 text-right text-sm">Total {formatMoney(total)}</div>
      </Panel>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Clinical decision support</span>
          <span className="label-caps text-muted">{region === "us" ? "ISMP · FDA boxed warnings" : "BNF · ISMP"}</span>
        </div>
        <CdsAlerts alerts={alerts} />
      </div>
      {rx.status === "new" && (
        <div className="space-y-2">
          <div className="text-sm font-semibold">{region === "us" ? "Pharmacist verification" : "Pharmacist clinical check"}</div>
          {checklist.map((r) => (
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
            <Label className="text-sm">
              {region === "us" ? "Two identifiers checked; counseling offered (OBRA '90) — use, side effects, storage" : "Identity checked; patient counselled — use, side effects, storage"}
            </Label>
          </Checkbox.Content>
        </Checkbox>
      )}
      {rx.status !== "dispensed" && <TextAreaInput label="Pharmacist note" value={note} onChange={setNote} rows={2} description="Required when returning the order to the prescriber" />}
    </SidePanel>
  )
}
