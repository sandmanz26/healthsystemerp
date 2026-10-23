/**
 * Interface monitor. One card per interface with delivery counts, a message log with the error
 * the receiving system returned and a retry, and a preview of the actual payload: HL7 v2.5.1
 * ADT for encounter events and FHIR R4 Encounter resources. Most failures are mapping problems
 * an analyst can fix and resend.
 */
import { Button, Card, Chip } from "@heroui/react"
import { CheckCircle2, CloudUpload, Eye, PlugZap, RotateCcw, XCircle } from "lucide-react"
import { useMemo, useState } from "react"
import { SyncChip } from "@v2/components/status"
import { DataTable, type Column } from "@v2/components/ui/data-table"
import { Empty } from "@v2/components/ui/empty"
import { Page, PageHeader } from "@v2/components/ui/page"
import { Panel } from "@v2/components/ui/panel"
import { Segmented } from "@v2/components/ui/segmented"
import { SidePanel } from "@v2/components/ui/side-panel"
import { toFhirEncounter, toHl7Adt } from "@v2/domain/interop"
import { moduleText, type ModuleId } from "@v2/domain/modules"
import { REGIONS, type Region } from "@v2/domain/region"
import type { IntegrationId, SyncJob } from "@v2/domain/types"
import { cn } from "@v2/lib/cn"
import { formatDateTime } from "@v2/lib/format"
import { toast } from "@v2/lib/toast"
import { useActions, useStore } from "@v2/store"
import { useEnabledModules, usePatientMap, useRegion } from "@v2/store/selectors"

interface Connector {
  id: IntegrationId
  name: string
  standard: string
  description: string
  module: ModuleId
  endpoint: string
}

const CONNECTORS: Record<Region, Connector[]> = {
  us: [
    { id: "hl7v2", name: "HL7 v2 interface engine", standard: "HL7 v2.5.1 · MLLP", description: "ADT^A01/A03/A04 to the HIE, ORM^O01 orders to LIS/RIS, ORU^R01 results back", module: "interop", endpoint: "mllp://iface.medisphere.local:6661" },
    { id: "fhir", name: "FHIR API", standard: "FHIR R4 · US Core 6.1.0", description: "Patient, Encounter, Condition, Observation — SMART on FHIR / ONC (g)(10)", module: "interop", endpoint: "https://fhir.medisphere.example/r4" },
    { id: "x12", name: "Clearinghouse", standard: "ASC X12 5010", description: "270/271 eligibility, 278 prior auth, 837I/837P claims, 277CA, 835 remittance", module: "payer", endpoint: "sftp://edi.clearinghouse.example/inbound" },
    { id: "surescripts", name: "Surescripts", standard: "NCPDP SCRIPT 2017071", description: "NewRx, CancelRx, RxRenewal and medication history", module: "payer", endpoint: "https://api.surescripts.example/v2" },
  ],
  uk: [
    { id: "hl7v2", name: "HL7 v2 interface engine", standard: "HL7 v2.5.1 · MLLP", description: "ADT to PAS consumers, ORM orders to LIMS/RIS, ORU results back", module: "interop", endpoint: "mllp://tie.northgate.nhs.local:6661" },
    { id: "fhir", name: "FHIR API", standard: "FHIR R4 · UK Core STU3", description: "Patient, Encounter, Condition, Observation for ShCR and the federated data platform", module: "interop", endpoint: "https://fhir.northgate.nhs.uk/R4" },
    { id: "pds", name: "Spine PDS", standard: "PDS FHIR API", description: "NHS number trace and demographics on registration", module: "payer", endpoint: "https://api.service.nhs.uk/personal-demographics/FHIR/R4" },
    { id: "eps", name: "Electronic Prescription Service", standard: "EPS FHIR R4", description: "Outpatient & discharge prescriptions to community pharmacy", module: "payer", endpoint: "https://api.service.nhs.uk/electronic-prescriptions" },
    { id: "gp-connect", name: "GP Connect", standard: "GP Connect Access Record", description: "Structured GP record and appointment booking", module: "payer", endpoint: "https://gpconnect.spine.nhs.uk" },
    { id: "sus", name: "SUS+ via MESH", standard: "CDS 6.3 · MESH", description: "Admitted patient care, outpatient and ECDS submissions", module: "interop", endpoint: "mesh://X26OT123 (MESH mailbox)" },
  ],
}

type Filter = "all" | "failed" | "pending" | "synced"
const ADT_EVENTS = ["A01", "A03", "A04"] as const

export default function IntegrationsPage() {
  const jobs = useStore((s) => s.syncJobs)
  const encounters = useStore((s) => s.encounters)
  const orders = useStore((s) => s.orders)
  const facility = useStore((s) => s.facility)
  const patients = usePatientMap()
  const enabled = useEnabledModules()
  const region = useRegion()
  const { retrySync, processPendingSync } = useActions()
  const [filter, setFilter] = useState<Filter>("failed")
  const [iface, setIface] = useState<IntegrationId | null>(null)
  const [previewId, setPreviewId] = useState<string>()
  const active = useMemo(() => CONNECTORS[region].filter((c) => enabled.has(c.module) && (c.id !== "gp-connect" || jobs.some((j) => j.integration === "gp-connect"))), [region, enabled, jobs])
  const visible = useMemo(() => jobs.filter((j) => active.some((c) => c.id === j.integration)), [jobs, active])
  const scoped = iface ? visible.filter((j) => j.integration === iface) : visible
  const rows = filter === "all" ? scoped : scoped.filter((j) => j.status === filter)
  const encById = useMemo(() => new Map(encounters.map((e) => [e.id, e])), [encounters])
  const orderById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders])
  const preview = jobs.find((j) => j.id === previewId)
  const connectorName = (id: IntegrationId) => CONNECTORS[region].find((c) => c.id === id)?.name ?? id

  const refLabel = (j: SyncJob) => {
    const enc = encById.get(j.ref)
    if (enc) return { name: patients.get(enc.patientId)?.name, ref: enc.accountNumber }
    const order = orderById.get(j.ref)
    if (order) return { name: patients.get(order.patientId)?.name, ref: order.id }
    return { name: undefined, ref: j.ref }
  }

  const columns: Column<SyncJob>[] = [
    { id: "at", header: "Time", sortValue: (j) => j.at, cell: (j) => <span className="num text-sm">{formatDateTime(j.at)}</span> },
    { id: "integration", header: "Interface", sortValue: (j) => j.integration, cell: (j) => <span className="text-sm">{connectorName(j.integration)}</span> },
    { id: "resource", header: "Message", cell: (j) => <span className="num text-sm font-medium">{j.resource}</span> },
    {
      id: "ref",
      header: "Ref",
      isRowHeader: true,
      cell: (j) => {
        const r = refLabel(j)
        return (
          <div>
            <div className="text-sm">{r.name ?? "—"}</div>
            <div className="num text-xs text-muted">{r.ref}</div>
          </div>
        )
      },
    },
    { id: "status", header: "Status", cell: (j) => <SyncChip status={j.status} /> },
    { id: "attempts", header: "Attempts", align: "end", sortValue: (j) => j.attempts, cell: (j) => <span className={cn("num text-sm", j.attempts > 1 && "font-semibold text-warning")}>{j.attempts}</span> },
    { id: "error", header: "Error", cell: (j) => <span className="num line-clamp-2 text-xs text-danger">{j.error}</span> },
    {
      id: "actions",
      header: "",
      align: "end",
      cell: (j) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" isIconOnly aria-label="Preview message" onPress={() => setPreviewId(j.id)}>
            <Eye className="size-3.5" />
          </Button>
          {j.status !== "synced" && (
            <Button size="sm" variant="ghost" onPress={() => { retrySync(j.id); toast("Message resent") }}>
              <RotateCcw className="size-3.5" aria-hidden /> Retry
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Interface Monitor"
        description={`Connection status and message log for every interface (simulated). Organization ${region === "us" ? "NPI" : "ODS"} ${region === "us" ? facility.orgId : facility.code} · ${REGIONS[region].fhirProfile}.`}
        actions={
          <Button variant="primary" onPress={() => { processPendingSync(); toast.success("Queue processed") }} isDisabled={!visible.some((j) => j.status === "pending")}>
            <CloudUpload className="size-4" aria-hidden /> Process queue now
          </Button>
        }
      />
      {active.length === 0 ? (
        <Panel>
          <Empty icon={PlugZap} title="No interfaces enabled" description={`Enable ${moduleText("interop", region).name} or ${moduleText("payer", region).name} to see interface traffic.`} />
        </Panel>
      ) : (
        <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {active.map((c) => {
            const mine = jobs.filter((j) => j.integration === c.id)
            const failed = mine.filter((j) => j.status === "failed").length
            const selected = iface === c.id
            return (
              <button key={c.id} type="button" onClick={() => setIface(selected ? null : c.id)} className="rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" aria-pressed={selected}>
                <Card className={cn("h-full gap-2 p-4 transition hover:border-foreground/25", selected && "ring-2 ring-accent")}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <PlugZap className="size-4 text-accent" aria-hidden /> {c.name}
                    </div>
                    <Chip size="sm" color={failed ? "warning" : "success"} variant="soft">
                      {failed ? <XCircle className="size-3.5" aria-hidden /> : <CheckCircle2 className="size-3.5" aria-hidden />} {failed ? "Errors" : "Connected"}
                    </Chip>
                  </div>
                  <div className="label-caps text-muted">{c.standard}</div>
                  <p className="text-sm text-muted">{c.description}</p>
                  <p className="num truncate text-xs text-muted">{c.endpoint}</p>
                  <div className="num mt-1 flex gap-3 text-sm">
                    <span className="text-success">{mine.filter((j) => j.status === "synced").length} delivered</span>
                    <span className="text-muted">{mine.filter((j) => j.status === "pending").length} queued</span>
                    <span className={failed ? "font-semibold text-danger" : "text-muted"}>{failed} errors</span>
                  </div>
                </Card>
              </button>
            )
          })}
        </div>
      )}
      <Panel flush>
        <div className="flex flex-wrap items-center gap-3 border-b border-separator p-4">
          <Segmented
            label="Delivery status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "failed", label: "Errors", count: scoped.filter((j) => j.status === "failed").length },
              { value: "pending", label: "Queued", count: scoped.filter((j) => j.status === "pending").length },
              { value: "synced", label: "Delivered", count: scoped.filter((j) => j.status === "synced").length },
              { value: "all", label: "All", count: scoped.length },
            ]}
          />
          {iface && (
            <Button size="sm" variant="tertiary" onPress={() => setIface(null)}>
              {connectorName(iface)} ✕
            </Button>
          )}
        </div>
        <DataTable
          label="Message log"
          rows={rows}
          columns={columns}
          rowKey={(j) => j.id}
          minWidth={1040}
          onRowAction={(j) => setPreviewId(j.id)}
          defaultSort={{ column: "at", direction: "descending" }}
          empty={<Empty icon={CheckCircle2} title={filter === "failed" ? "No interface errors" : "No messages"} />}
        />
      </Panel>
      {preview && <MessagePreview job={preview} connector={connectorName(preview.integration)} onClose={() => setPreviewId(undefined)} />}
    </Page>
  )
}

function MessagePreview({ job, connector, onClose }: { job: SyncJob; connector: string; onClose: () => void }) {
  const encounter = useStore((s) => s.encounters.find((e) => e.id === job.ref))
  const patient = useStore((s) => s.patients.find((p) => p.id === encounter?.patientId))
  const units = useStore((s) => s.units)
  const beds = useStore((s) => s.beds)
  const facility = useStore((s) => s.facility)
  const region = useRegion()
  const { retrySync } = useActions()

  const payload = useMemo(() => {
    if (!encounter || !patient) return null
    const unit = units.find((u) => u.id === encounter.unitId)
    if (job.integration === "hl7v2" && job.resource.startsWith("ADT^")) {
      const event = job.resource.slice(4)
      const bed = beds.find((b) => b.id === encounter.bedId)
      const base = (ADT_EVENTS as readonly string[]).includes(event) ? (event as (typeof ADT_EVENTS)[number]) : "A01"
      const msg = toHl7Adt(base, patient, encounter, region, facility.code, unit?.code ?? unit?.id.toUpperCase() ?? "", bed?.code ?? "")
      // Other trigger events (e.g. A02 transfer) share the segment layout; only MSH-9 and EVN-1 differ.
      return { kind: "HL7 v2.5.1", text: base === event ? msg : msg.replace(`ADT^${base}`, `ADT^${event}`).replace(`EVN|${base}`, `EVN|${event}`) }
    }
    if (job.integration === "fhir" && job.resource === "Encounter") return { kind: `FHIR R4 · ${REGIONS[region].fhirProfile}`, text: JSON.stringify(toFhirEncounter(encounter, region, unit), null, 2) }
    return null
  }, [job, encounter, patient, units, beds, facility.code, region])

  return (
    <SidePanel
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={
        <span>
          <span className="num">{job.resource}</span> · {connector}
        </span>
      }
      description={`${formatDateTime(job.at)} · attempt ${job.attempts}`}
      footer={
        job.status !== "synced" ? (
          <div className="flex w-full justify-end">
            <Button variant="primary" onPress={() => { retrySync(job.id); toast("Message resent") }}>
              <RotateCcw className="size-4" aria-hidden /> Retry
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <SyncChip status={job.status} />
        <span className="num text-xs text-muted">ref {encounter?.accountNumber ?? job.ref}</span>
        {patient && <span className="text-sm">{patient.name}</span>}
      </div>
      {job.error && <p className="num rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger-soft-foreground">{job.error}</p>}
      {payload ? (
        <div>
          <div className="label-caps mb-1.5 text-muted">{payload.kind}</div>
          <pre className="num max-h-[60vh] overflow-auto whitespace-pre rounded-lg border border-border bg-surface-secondary p-3 text-xs leading-relaxed">{payload.text}</pre>
        </div>
      ) : (
        <p className="text-sm text-muted">Payload preview is available for HL7 ADT and FHIR Encounter messages. This {job.resource} message is shown by its metadata only.</p>
      )}
    </SidePanel>
  )
}
