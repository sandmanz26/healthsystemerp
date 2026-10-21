/**
 * Integration monitor for SATUSEHAT and BPJS. Failures are listed with the error the
 * remote system returned and a retry — most failures are mapping problems an admin can fix.
 */
import { Button, Card, Chip } from "@heroui/react"
import { CheckCircle2, CloudUpload, PlugZap, RotateCcw, XCircle } from "lucide-react"
import { useState } from "react"
import { SyncChip } from "@/components/status"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Empty } from "@/components/ui/empty"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Segmented } from "@/components/ui/segmented"
import type { IntegrationId, SyncJob } from "@/domain/types"
import { formatDateTime } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"
import { useModuleEnabled, usePatientMap } from "@/store/selectors"

const CONNECTORS: { id: IntegrationId; name: string; description: string; module: "satusehat" | "bpjs"; endpoint: string }[] = [
  { id: "satusehat", name: "SATUSEHAT", description: "Encounter, Condition, Observation, DiagnosticReport (FHIR R4)", module: "satusehat", endpoint: "api-satusehat.kemkes.go.id/fhir-r4/v1" },
  { id: "bpjs-vclaim", name: "BPJS V-Claim", description: "Kepesertaan, rujukan, SEP", module: "bpjs", endpoint: "apijkn.bpjs-kesehatan.go.id/vclaim-rest" },
  { id: "bpjs-antrean", name: "BPJS Antrean Online", description: "Task ID 1–7 waktu layanan Mobile JKN", module: "bpjs", endpoint: "apijkn.bpjs-kesehatan.go.id/antreanrs" },
]

type Filter = "failed" | "pending" | "synced"

export default function IntegrationsPage() {
  const jobs = useStore((s) => s.syncJobs)
  const encounters = useStore((s) => s.encounters)
  const facility = useStore((s) => s.facility)
  const patients = usePatientMap()
  const satusehatOn = useModuleEnabled("satusehat")
  const bpjsOn = useModuleEnabled("bpjs")
  const { retrySync, processPendingSync } = useActions()
  const [filter, setFilter] = useState<Filter>("failed")
  const active = CONNECTORS.filter((c) => (c.module === "satusehat" ? satusehatOn : bpjsOn))
  const visible = jobs.filter((j) => active.some((c) => c.id === j.integration))
  const rows = visible.filter((j) => j.status === filter)
  const encById = new Map(encounters.map((e) => [e.id, e]))

  const columns: Column<SyncJob>[] = [
    { id: "at", header: "Waktu", sortValue: (j) => j.at, cell: (j) => <span className="tabular text-sm">{formatDateTime(j.at)}</span> },
    { id: "integration", header: "Tujuan", cell: (j) => <span className="text-sm">{CONNECTORS.find((c) => c.id === j.integration)?.name}</span> },
    { id: "resource", header: "Resource", cell: (j) => <span className="tabular text-sm">{j.resource}</span> },
    {
      id: "ref",
      header: "Pasien",
      isRowHeader: true,
      cell: (j) => {
        const enc = encById.get(j.ref)
        return <span className="text-sm">{enc ? patients.get(enc.patientId)?.name : j.ref}</span>
      },
    },
    { id: "status", header: "Status", cell: (j) => <SyncChip status={j.status} /> },
    { id: "error", header: "Pesan", cell: (j) => <span className="text-xs text-danger">{j.error}</span> },
    {
      id: "retry",
      header: "",
      align: "end",
      cell: (j) =>
        j.status !== "synced" ? (
          <Button size="sm" variant="ghost" onPress={() => { retrySync(j.id); toast("Dikirim ulang") }}>
            <RotateCcw className="size-3.5" aria-hidden /> Kirim ulang
          </Button>
        ) : null,
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Integrasi"
        description="Status koneksi dan antrean pengiriman data ke SATUSEHAT dan BPJS Kesehatan (simulasi)."
        actions={
          <Button variant="primary" onPress={() => { processPendingSync(); toast.success("Antrean dikirim") }} isDisabled={!visible.some((j) => j.status === "pending")}>
            <CloudUpload className="size-4" aria-hidden /> Kirim antrean sekarang
          </Button>
        }
      />
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {active.map((c) => {
          const mine = jobs.filter((j) => j.integration === c.id)
          const failed = mine.filter((j) => j.status === "failed").length
          return (
            <Card key={c.id} className="gap-2 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                  <PlugZap className="size-4 text-accent" aria-hidden /> {c.name}
                </div>
                <Chip size="sm" color="success" variant="soft">
                  <CheckCircle2 className="size-3.5" aria-hidden /> Terhubung
                </Chip>
              </div>
              <p className="text-sm text-muted">{c.description}</p>
              <p className="tabular truncate text-xs text-muted">{c.endpoint}</p>
              {c.id === "satusehat" && <p className="tabular text-xs text-muted">Organization ID {facility.orgId}</p>}
              <div className="tabular mt-1 flex gap-3 text-sm">
                <span className="text-success">{mine.filter((j) => j.status === "synced").length} terkirim</span>
                <span className="text-muted">{mine.filter((j) => j.status === "pending").length} antre</span>
                <span className={failed ? "font-semibold text-danger" : "text-muted"}>
                  {failed ? <XCircle className="mr-1 inline size-3.5" aria-hidden /> : null}
                  {failed} gagal
                </span>
              </div>
            </Card>
          )
        })}
      </div>
      <Panel flush>
        <div className="border-b border-separator p-4">
          <Segmented
            label="Status pengiriman"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "failed", label: "Gagal", count: visible.filter((j) => j.status === "failed").length },
              { value: "pending", label: "Antre", count: visible.filter((j) => j.status === "pending").length },
              { value: "synced", label: "Terkirim", count: visible.filter((j) => j.status === "synced").length },
            ]}
          />
        </div>
        <DataTable label="Antrean integrasi" rows={rows} columns={columns} rowKey={(j) => j.id} defaultSort={{ column: "at", direction: "descending" }} empty={<Empty icon={CheckCircle2} title={filter === "failed" ? "Tidak ada pengiriman gagal" : "Kosong"} />} />
      </Panel>
    </Page>
  )
}
