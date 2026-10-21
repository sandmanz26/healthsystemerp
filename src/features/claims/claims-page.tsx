/**
 * Casemix: code, group, check completeness, submit, and track the payer's response.
 * During the INA-CBG → iDRG transition coders work with both groupers, so the grouper is a
 * per-claim choice and both results can be compared.
 */
import { Button, Chip } from "@heroui/react"
import { CheckCircle2, CircleAlert, ExternalLink, FileHeart, Send, TrendingDown, TrendingUp } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ClaimStatusChip, PayerChip } from "@/components/status"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Empty } from "@/components/ui/empty"
import { SelectInput, TextAreaInput } from "@/components/ui/fields"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Segmented } from "@/components/ui/segmented"
import { SidePanel } from "@/components/ui/side-panel"
import { Stat } from "@/components/ui/stat"
import { claimChecklist, estimateGroup, invoiceTotal } from "@/domain/finance"
import type { Claim, ClaimStatus, Grouper } from "@/domain/types"
import { DiagnosisSection } from "@/features/emr/diagnosis-section"
import { PatientBanner } from "@/features/patients/patient-banner"
import { cn } from "@/lib/cn"
import { formatDate, formatRupiah } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"
import { usePatientMap } from "@/store/selectors"

type Filter = "todo" | "sent" | "pending" | "done"
const FILTER_OF: Record<ClaimStatus, Filter> = { draft: "todo", coded: "todo", submitted: "sent", pending: "pending", rejected: "pending", approved: "done", paid: "done" }
const KIND_LABEL = { outpatient: "RJ", emergency: "IGD", inpatient: "RI" }

export default function ClaimsPage() {
  const claims = useStore((s) => s.claims)
  const encounters = useStore((s) => s.encounters)
  const invoices = useStore((s) => s.invoices)
  const patients = usePatientMap()
  const [filter, setFilter] = useState<Filter>("todo")
  const [openId, setOpenId] = useState<string>()
  const encById = useMemo(() => new Map(encounters.map((e) => [e.id, e])), [encounters])
  const invById = useMemo(() => new Map(invoices.map((i) => [i.id, i])), [invoices])
  const rows = claims.filter((c) => FILTER_OF[c.status] === filter).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const count = (f: Filter) => claims.filter((c) => FILTER_OF[c.status] === f).length
  const coded = claims.filter((c) => c.tariff)
  const tariffSum = coded.reduce((s, c) => s + (c.tariff ?? 0), 0)
  const costSum = coded.reduce((s, c) => s + invoiceTotal(invById.get(c.invoiceId)!), 0)
  const open = claims.find((c) => c.id === openId)

  const columns: Column<Claim>[] = [
    {
      id: "patient",
      header: "Pasien",
      isRowHeader: true,
      cell: (c) => {
        const e = encById.get(c.encounterId)!
        const p = patients.get(e.patientId)!
        return (
          <div>
            <div className="font-medium">{p.name}</div>
            <div className="tabular text-xs text-muted">
              {KIND_LABEL[e.kind]} · {formatDate(e.createdAt)}
              {e.sepNumber && ` · SEP ${e.sepNumber}`}
            </div>
          </div>
        )
      },
    },
    { id: "payer", header: "Penjamin", cell: (c) => <PayerChip payer={c.payer} /> },
    {
      id: "dx",
      header: "Diagnosis utama",
      cell: (c) => {
        const d = encById.get(c.encounterId)?.diagnoses.find((x) => x.primary)
        return d ? <span className="text-sm"><b className="tabular">{d.code}</b> {d.display}</span> : <span className="text-sm font-medium text-danger">Belum ada</span>
      },
    },
    { id: "group", header: "Grup", cell: (c) => (c.grouper === "FFS" ? <span className="text-sm text-muted">Tagihan rinci</span> : c.groupCode ? <span className="tabular text-sm">{c.grouper} {c.groupCode}</span> : <span className="text-muted">—</span>) },
    {
      id: "margin",
      header: "Tarif vs biaya RS",
      align: "end",
      sortValue: (c) => (c.tariff ?? 0) - invoiceTotal(invById.get(c.invoiceId)!),
      cell: (c) => {
        if (!c.tariff) return <span className="text-muted">—</span>
        const diff = c.tariff - invoiceTotal(invById.get(c.invoiceId)!)
        return (
          <div className="tabular text-sm">
            {formatRupiah(c.tariff)}
            <div className={cn("text-xs", diff < 0 ? "text-danger" : "text-success")}>
              {diff < 0 ? "−" : "+"}
              {formatRupiah(Math.abs(diff))}
            </div>
          </div>
        )
      },
    },
    { id: "status", header: "Status", cell: (c) => <ClaimStatusChip status={c.status} /> },
  ]

  return (
    <Page>
      <PageHeader title="Klaim & Casemix" description="Koding, grouping iDRG / INA-CBG, kelengkapan berkas, dan status klaim penjamin." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Perlu dikoding / dikirim" value={count("todo")} icon={FileHeart} tone="warning" onClick={() => setFilter("todo")} />
        <Stat label="Pending / ditolak" value={count("pending")} icon={CircleAlert} tone={count("pending") ? "danger" : "success"} onClick={() => setFilter("pending")} />
        <Stat label="Total tarif klaim terkoding" value={formatRupiah(tariffSum)} icon={TrendingUp} tone="accent" />
        <Stat label="Selisih tarif − biaya RS" value={formatRupiah(tariffSum - costSum)} icon={tariffSum >= costSum ? TrendingUp : TrendingDown} tone={tariffSum >= costSum ? "success" : "danger"} hint="Negatif = biaya RS di atas tarif" />
      </div>
      <Panel flush>
        <div className="border-b border-separator p-4">
          <Segmented
            label="Status klaim"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "todo", label: "Perlu dikerjakan", count: count("todo") },
              { value: "sent", label: "Terkirim", count: count("sent") },
              { value: "pending", label: "Pending / ditolak", count: count("pending") },
              { value: "done", label: "Disetujui / dibayar", count: count("done") },
            ]}
          />
        </div>
        <DataTable label="Klaim" rows={rows} columns={columns} rowKey={(c) => c.id} onRowAction={(c) => setOpenId(c.id)} empty={<Empty icon={FileHeart} title="Tidak ada klaim di status ini" />} />
      </Panel>
      {open && <ClaimPanel claim={open} onClose={() => setOpenId(undefined)} />}
    </Page>
  )
}

function ClaimPanel({ claim, onClose }: { claim: Claim; onClose: () => void }) {
  const encounter = useStore((s) => s.encounters.find((e) => e.id === claim.encounterId))!
  const patient = useStore((s) => s.patients.find((p) => p.id === encounter.patientId))!
  const invoice = useStore((s) => s.invoices.find((i) => i.id === claim.invoiceId))!
  const { groupClaim, setClaimGrouper, setClaimStatus } = useActions()
  const [note, setNote] = useState(claim.note ?? "")
  const checks = claimChecklist(encounter, patient)
  const ready = checks.every((c) => c.ok)
  const ffs = claim.grouper === "FFS"
  const other: Exclude<Grouper, "FFS"> = claim.grouper === "iDRG" ? "INA-CBG" : "iDRG"
  const compare = ffs ? null : estimateGroup(encounter, other)
  const editable = claim.status === "draft" || claim.status === "coded" || claim.status === "pending" || claim.status === "rejected"

  return (
    <SidePanel
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title="Berkas klaim"
      description={`${claim.payer === "bpjs" ? "BPJS Kesehatan" : "Asuransi"} · diperbarui ${formatDate(claim.updatedAt)}`}
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          {claim.status === "submitted" && (
            <>
              <Button variant="ghost" onPress={() => { setClaimStatus(claim.id, "pending", note || "Konfirmasi dari verifikator"); toast("Ditandai pending") }}>
                Pending
              </Button>
              <Button variant="primary" onPress={() => { setClaimStatus(claim.id, "approved"); toast.success("Klaim disetujui") }}>
                Hasil verifikasi: disetujui
              </Button>
            </>
          )}
          {claim.status === "approved" && (
            <Button variant="primary" onPress={() => { setClaimStatus(claim.id, "paid"); toast.success("Klaim dibayar") }}>
              Tandai dibayar
            </Button>
          )}
          {editable && (
            <Button
              variant="primary"
              isDisabled={!ready || !(claim.groupCode || (ffs && claim.tariff))}
              onPress={() => {
                setClaimStatus(claim.id, "submitted", note || undefined)
                toast.success("Klaim dikirim", { description: "Menunggu verifikasi penjamin." })
              }}
            >
              <Send className="size-4" aria-hidden /> {claim.status === "pending" || claim.status === "rejected" ? "Kirim ulang" : "Kirim klaim"}
            </Button>
          )}
        </div>
      }
    >
      <PatientBanner patient={patient} encounter={encounter} compact />
      <div className="flex items-center justify-between">
        <ClaimStatusChip status={claim.status} />
        <Link to={`/encounters/${encounter.id}`} className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
          Buka rekam medis <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </div>
      {claim.note && (claim.status === "pending" || claim.status === "rejected") && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">Catatan verifikator: {claim.note}</p>}

      <Panel title="Kelengkapan berkas">
        <ul className="space-y-1.5 text-sm">
          {checks.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              {c.ok ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <CircleAlert className="size-4 text-danger" aria-hidden />}
              <span className={c.ok ? undefined : "font-medium text-danger"}>{c.label}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <DiagnosisSection encounter={encounter} readOnly={!editable} />

      {ffs ? (
        <Panel title="Nilai klaim (fee-for-service)" description="Asuransi swasta membayar tagihan rinci, bukan tarif paket.">
          <div className="tabular flex justify-between text-sm">
            <span className="text-muted">Total tagihan</span>
            <b>{formatRupiah(invoiceTotal(invoice))}</b>
          </div>
          {editable && claim.status === "draft" && (
            <Button className="mt-3" variant="secondary" fullWidth onPress={() => { groupClaim(claim.id); toast.success("Klaim siap dikirim") }}>
              Siapkan klaim
            </Button>
          )}
        </Panel>
      ) : (
      <Panel
        title="Grouping"
        actions={
          editable && (
            <SelectInput
              label="Grouper"
              className="w-36"
              value={claim.grouper}
              onChange={(g) => setClaimGrouper(claim.id, g as Exclude<Grouper, "FFS">)}
              options={[
                { value: "iDRG", label: "iDRG" },
                { value: "INA-CBG", label: "INA-CBG (klaim lama)" },
              ]}
            />
          )
        }
      >
        {claim.groupCode ? (
          <div className="space-y-1 text-sm">
            <div>
              <span className="tabular font-semibold">{claim.groupCode}</span> — {claim.groupName}
            </div>
            <div className="tabular flex justify-between">
              <span className="text-muted">Tarif {claim.grouper}</span>
              <b>{formatRupiah(claim.tariff ?? 0)}</b>
            </div>
            <div className="tabular flex justify-between">
              <span className="text-muted">Biaya riil RS (tagihan)</span>
              <span>{formatRupiah(invoiceTotal(invoice))}</span>
            </div>
            {compare && (
              <div className="tabular flex justify-between text-muted">
                <span>Pembanding {other}</span>
                <span>
                  {compare.code} · {formatRupiah(compare.tariff)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Belum di-grouping.</p>
        )}
        {editable && (
          <Button className="mt-3" variant="secondary" fullWidth isDisabled={!encounter.diagnoses.some((d) => d.primary)} onPress={() => { groupClaim(claim.id); toast.success("Grouping selesai") }}>
            {claim.groupCode ? "Grouping ulang" : "Jalankan grouper"}
          </Button>
        )}
        <p className="mt-2 text-xs text-muted">Estimasi demo. Grouper resmi berjalan di aplikasi E-Klaim Kemenkes.</p>
      </Panel>
      )}
      <TextAreaInput label="Catatan" value={note} onChange={setNote} rows={2} />
      {!ready && editable && (
        <Chip color="warning" variant="soft">
          Lengkapi berkas sebelum klaim dikirim
        </Chip>
      )}
    </SidePanel>
  )
}
