/**
 * Shared worklist for laboratory and radiology: order → collect / perform → result → verify.
 * STAT orders always sort to the top. Critical lab values block verification until the call-back
 * to a licensed caregiver (with read-back) is documented. Imaging that needs prior
 * authorization cannot be performed until the payer approves.
 */
import { Button, Chip } from "@heroui/react"
import { AlertOctagon, FlaskConical, ScanLine, ShieldQuestion } from "lucide-react"
import { useMemo, useState } from "react"
import { OrderStatusChip, PayerChip, PriorityChip } from "@/components/status"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Empty } from "@/components/ui/empty"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Segmented } from "@/components/ui/segmented"
import { SidePanel } from "@/components/ui/side-panel"
import { Stat } from "@/components/ui/stat"
import { LAB_PANELS, orderTitle } from "@/domain/catalog"
import { ageOf, isCritical, minutesSince } from "@/domain/clinical"
import type { OrderKind, OrderStatus, ServiceOrder } from "@/domain/types"
import { AuthChip, AuthPanel, ExamList, RadReportEditor } from "@/features/radiology/rad-parts"
import { MODALITIES, MODALITY_LABEL, orderExams, orderModalities, reportComplete } from "@/features/radiology/rad-utils"
import { PatientBanner } from "@/features/patients/patient-banner"
import { cn } from "@/lib/cn"
import { formatDateTime, formatDuration } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useNow } from "@/lib/use-now"
import { useActions, useStore } from "@/store"
import { usePatientMap, useRegion, useStaffMap, useUnitName } from "@/store/selectors"
import { Code, CriticalCallForm, LabResultEntry, LabResultTable, SpecimenList, TubeDot } from "./lab-parts"
import { orderPanels } from "./lab-utils"

type Stage = "todo" | "process" | "validate" | "done"
type ModalityFilter = "all" | (typeof MODALITIES)[number]
const STAGE_OF: Record<OrderStatus, Stage | null> = { ordered: "todo", collected: "process", "in-progress": "process", resulted: "validate", validated: "done", cancelled: null }

export function OrderWorklistPage({ kind }: { kind: OrderKind }) {
  const orders = useStore((s) => s.orders)
  const encounters = useStore((s) => s.encounters)
  const patients = usePatientMap()
  const unitName = useUnitName()
  const region = useRegion()
  const now = useNow()
  const [stage, setStage] = useState<Stage>("todo")
  const [modality, setModality] = useState<ModalityFilter>("all")
  const [openId, setOpenId] = useState<string>()
  const lab = kind === "lab"

  const mine = useMemo(() => orders.filter((o) => o.kind === kind && STAGE_OF[o.status]), [orders, kind])
  const encById = useMemo(() => new Map(encounters.map((e) => [e.id, e])), [encounters])
  const inModality = (o: ServiceOrder) => lab || modality === "all" || orderModalities(o).includes(modality)
  const byStage = (s: Stage) => mine.filter((o) => STAGE_OF[o.status] === s && (s !== "done" || minutesSince(o.orderedAt, now) < 3 * 1440))
  const rows = byStage(stage)
    .filter(inModality)
    .sort((a, b) => (a.priority === b.priority ? a.orderedAt.localeCompare(b.orderedAt) : a.priority === "stat" ? -1 : 1))
  const open = orders.find((o) => o.id === openId)
  const uncalled = mine.filter((o) => o.results.some((r) => isCritical(r.flag)) && !o.criticalCall)
  const authPending = mine.filter((o) => o.auth === "pending")
  const Icon = lab ? FlaskConical : ScanLine

  // Collection list: specimens still to draw, grouped by panel (one tube type each).
  const collection = useMemo(() => {
    if (!lab) return []
    const todo = mine.filter((o) => o.status === "ordered")
    return LAB_PANELS.map((p) => ({ panel: p, orders: todo.filter((o) => orderPanels(o).some((x) => x.code === p.code)) })).filter((g) => g.orders.length)
  }, [mine, lab])

  const columns: Column<ServiceOrder>[] = [
    { id: "priority", header: "Priority", cell: (o) => <PriorityChip priority={o.priority} /> },
    {
      id: "patient",
      header: "Patient",
      isRowHeader: true,
      cell: (o) => {
        const p = patients.get(o.patientId)
        return (
          <div>
            <div className="font-medium">{p?.name ?? "Unknown patient"}</div>
            <div className="num text-xs text-muted">
              MRN {p?.mrn} · {unitName(encById.get(o.encounterId)?.unitId)}
            </div>
          </div>
        )
      },
    },
    lab
      ? {
          id: "tests",
          header: "Tests",
          cell: (o) => (
            <div className="space-y-0.5">
              {orderPanels(o).map((p) => (
                <div key={p.code} className="flex items-center gap-1.5 text-sm">
                  <TubeDot tube={p.tube} />
                  <span>{p.code}</span>
                  {p.loinc && <Code system="LOINC" code={p.loinc} />}
                </div>
              ))}
            </div>
          ),
        }
      : {
          id: "exams",
          header: "Exam",
          cell: (o) => (
            <div className="space-y-0.5">
              {orderExams(o).map((e) => (
                <div key={e.code} className="text-sm">
                  <span className="num mr-1.5 rounded bg-surface-secondary px-1 text-[11px] font-semibold">{e.modality}</span>
                  {e.name}
                  <div>
                    <Code system="CPT" code={`${e.cpt} · rev ${e.revCode}`} />
                  </div>
                </div>
              ))}
            </div>
          ),
        },
    ...(lab || region !== "us" ? [] : [{ id: "auth", header: "Prior auth", cell: (o: ServiceOrder) => <AuthChip auth={o.auth} /> }]),
    {
      id: "payer",
      header: "Payer",
      cell: (o) => {
        const payer = encById.get(o.encounterId)?.payer
        return payer ? <PayerChip payer={payer} /> : <span className="text-muted">—</span>
      },
    },
    {
      id: "time",
      header: "Ordered",
      cell: (o) => {
        const m = minutesSince(o.orderedAt, now)
        const slow = o.status !== "validated" && (o.priority === "stat" ? m > 60 : m > 180)
        return <span className={cn("num text-sm", slow ? "font-semibold text-danger" : "text-muted")}>{formatDuration(m)} ago</span>
      },
    },
    {
      id: "status",
      header: "Status",
      cell: (o) => (
        <div className="flex items-center gap-1.5">
          <OrderStatusChip status={o.status} />
          {o.results.some((r) => isCritical(r.flag)) && <AlertOctagon className={cn("size-4", o.criticalCall ? "text-muted" : "text-danger")} aria-label={o.criticalCall ? "Critical value (called)" : "Critical value — not yet called"} />}
        </div>
      ),
    },
  ]

  return (
    <Page>
      <PageHeader
        title={lab ? "Laboratory" : "Radiology"}
        description={
          lab
            ? "STAT first · critical values need call-back with read-back before verification"
            : region === "us"
              ? "Prior authorization for advanced imaging · ACR structured reporting"
              : "IR(ME)R justification recorded on every request"
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={lab ? "To collect" : "To scan"} value={byStage("todo").length} icon={Icon} tone="accent" onClick={() => setStage("todo")} />
        <Stat label={lab ? "In process" : "Awaiting report"} value={byStage("process").length} tone="warning" onClick={() => setStage("process")} />
        <Stat label="To verify" value={byStage("validate").length} tone={byStage("validate").length ? "warning" : "default"} onClick={() => setStage("validate")} />
        {lab ? (
          <Stat label="Critical values not called" value={uncalled.length} icon={AlertOctagon} tone={uncalled.length ? "danger" : "success"} />
        ) : region === "us" ? (
          <Stat label="Prior auth pending" value={authPending.length} icon={ShieldQuestion} tone={authPending.length ? "warning" : "success"} />
        ) : (
          <Stat label="STAT active" value={mine.filter((o) => o.priority === "stat" && o.status !== "validated").length} tone="danger" />
        )}
      </div>

      {lab && stage === "todo" && collection.length > 0 && (
        <Panel title="Collection list" description="Specimens to draw, grouped by panel and tube (order of draw per CLSI GP41)." className="mb-6" flush>
          <ul className="divide-y divide-separator">
            {collection.map(({ panel, orders: list }) => (
              <li key={panel.code} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
                <TubeDot tube={panel.tube} />
                <span className="w-56 font-medium">{panel.name}</span>
                <span className="w-44 text-muted">{panel.tube}</span>
                <span className="flex gap-3">
                  {panel.loinc && <Code system="LOINC" code={panel.loinc} />}
                  <Code system="CPT" code={panel.cpt} />
                </span>
                <span className="ml-auto flex flex-wrap items-center gap-1.5">
                  {list.map((o) => (
                    <Chip key={o.id} size="sm" variant="soft" color={o.priority === "stat" ? "danger" : "default"}>
                      <button type="button" onClick={() => setOpenId(o.id)} className="hover:underline">
                        {patients.get(o.patientId)?.name ?? o.patientId}
                      </button>
                    </Chip>
                  ))}
                  <span className="num text-xs text-muted">× {list.length}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel flush>
        <div className="flex flex-wrap items-center gap-3 border-b border-separator p-4">
          <Segmented
            label="Stage"
            value={stage}
            onChange={setStage}
            options={[
              { value: "todo", label: lab ? "Collect" : "Scheduled", count: byStage("todo").length },
              { value: "process", label: lab ? "In process" : "Reading", count: byStage("process").length },
              { value: "validate", label: "Verify", count: byStage("validate").length },
              { value: "done", label: "Done (3 days)", count: byStage("done").length },
            ]}
          />
          {!lab && (
            <Segmented
              label="Modality"
              value={modality}
              onChange={setModality}
              options={[{ value: "all" as ModalityFilter, label: "All" }, ...MODALITIES.map((m) => ({ value: m as ModalityFilter, label: m, count: byStage(stage).filter((o) => orderModalities(o).includes(m)).length }))]}
            />
          )}
        </div>
        <DataTable label={lab ? "Lab worklist" : "Modality worklist"} rows={rows} columns={columns} rowKey={(o) => o.id} onRowAction={(o) => setOpenId(o.id)} empty={<Empty icon={Icon} title={modality !== "all" && !lab ? `No ${MODALITY_LABEL[modality]} orders at this stage` : "No orders at this stage"} />} />
      </Panel>
      {open && <OrderPanel order={open} onClose={() => setOpenId(undefined)} />}
    </Page>
  )
}

function OrderPanel({ order, onClose }: { order: ServiceOrder; onClose: () => void }) {
  const patient = useStore((s) => s.patients.find((p) => p.id === order.patientId))
  const encounter = useStore((s) => s.encounters.find((e) => e.id === order.encounterId))
  const staff = useStaffMap()
  const region = useRegion()
  const { collectSample, startProcessing, enterResults, saveReport, validateOrder, cancelOrder } = useActions()
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(order.results.map((r) => [r.testCode, r.value])))
  const [report, setReport] = useState(order.report ?? "")
  const hasCritical = order.results.some((r) => isCritical(r.flag))
  const lab = order.kind === "lab"
  const authBlocked = order.auth === "pending" || order.auth === "denied"
  const staffName = (id: string) => staff.get(id)?.name ?? id
  const attending = staff.get(encounter?.practitionerId ?? "")?.name
  const pregnancyCheck =
    !lab && patient?.gender === "female" && orderExams(order).some((e) => e.pregnancyCheck) && ((age) => age >= 12 && age <= 55)(ageOf(patient.birthDate).years)

  const footer = (() => {
    switch (order.status) {
      case "ordered":
        return (
          <>
            <Button variant="ghost" onPress={() => { cancelOrder(order.id); toast("Order cancelled"); onClose() }}>
              Cancel order
            </Button>
            <Button variant="primary" isDisabled={authBlocked} onPress={() => { collectSample(order.id); toast.success(lab ? "Specimen collected" : "Exam performed") }}>
              {lab ? "Mark collected" : "Exam performed"}
            </Button>
          </>
        )
      case "collected":
        return (
          <Button variant="primary" onPress={() => startProcessing(order.id)}>
            {lab ? "Receive in lab" : "Start reading"}
          </Button>
        )
      case "in-progress":
        return lab ? (
          <Button variant="primary" isDisabled={!Object.values(values).some((v) => v.trim())} onPress={() => { enterResults(order.id, values); toast.success("Results saved") }}>
            Save results
          </Button>
        ) : (
          <Button variant="primary" isDisabled={!reportComplete(report)} onPress={() => { saveReport(order.id, report); toast.success("Report saved") }}>
            Save report
          </Button>
        )
      case "resulted":
        return (
          <Button
            variant="primary"
            isDisabled={hasCritical && !order.criticalCall}
            onPress={() => {
              validateOrder(order.id)
              toast.success(lab ? "Results verified" : "Report signed", { description: "Released to the chart and sent as HL7 ORU^R01." })
              onClose()
            }}
          >
            {lab ? "Verify results" : "Sign report"}
          </Button>
        )
      default:
        return null
    }
  })()

  return (
    <SidePanel
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={orderTitle(order)}
      description={`Ordered ${formatDateTime(order.orderedAt)} by ${staff.get(order.orderedBy)?.name ?? "—"}`}
      footer={footer ? <div className="flex w-full justify-end gap-2">{footer}</div> : undefined}
    >
      {patient && <PatientBanner patient={patient} encounter={encounter} compact />}
      <div className="flex flex-wrap gap-2">
        <PriorityChip priority={order.priority} />
        <OrderStatusChip status={order.status} />
      </div>
      <p className="text-sm">
        <span className="text-muted">{lab ? "Clinical indication:" : "Reason for exam:"}</span> {order.clinicalNote || "—"}
      </p>

      {lab ? <SpecimenList order={order} /> : <ExamList order={order} />}
      {!lab && <AuthPanel order={order} />}
      {pregnancyCheck && order.status === "ordered" && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
          Confirm and document pregnancy status before the exam ({region === "us" ? "ACR–SPR practice parameter" : "IR(ME)R 2017 — ask 12–55 year olds"}).
        </p>
      )}

      {order.status === "in-progress" && lab && <LabResultEntry order={order} region={region} values={values} onChange={(code, v) => setValues((x) => ({ ...x, [code]: v }))} />}
      {order.status === "in-progress" && !lab && <RadReportEditor value={report} onChange={setReport} region={region} />}

      {(order.status === "resulted" || order.status === "validated") && (
        <Panel title={lab ? "Results" : "Report"}>
          {lab ? <LabResultTable order={order} region={region} /> : order.report ? <p className="num whitespace-pre-line text-[13px] leading-relaxed">{order.report}</p> : <p className="text-sm text-muted">No report yet.</p>}
          {order.validatedBy && <p className="mt-3 text-xs text-muted">Verified by {staffName(order.validatedBy)}</p>}
        </Panel>
      )}

      {lab && hasCritical && <CriticalCallForm order={order} region={region} staffName={staffName} defaultTo={attending} />}
    </SidePanel>
  )
}
