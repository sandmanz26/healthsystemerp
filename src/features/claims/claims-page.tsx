/**
 * Coding & claims (US) / Clinical coding & SUS+ (UK).
 *
 * US revenue cycle: code (ICD-10-CM / CPT) → group (MS-DRG for inpatient stays, line-item
 * pricing otherwise) → pre-bill edits → 837I/837P to the clearinghouse → 277CA acceptance →
 * 835 remittance (paid, or denied with CARC/RARC) → appeal.
 * UK: spells are clinically coded (ICD-10 + OPCS-4), grouped to HRG4+ and submitted to SUS+
 * as CDS; private patients' episodes are invoiced to their insurer.
 */
import { Button } from "@heroui/react"
import { CheckCircle2, CircleAlert, Clock, ExternalLink, FileHeart, Gavel, Percent, Send, ShieldCheck, ShieldX, Sigma } from "lucide-react"
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
import { DENIAL_REASONS, DRG_BASE_RATE, PAYER_LABEL, claimChecklist, invoiceTotal } from "@/domain/finance"
import { REGIONS, type Region } from "@/domain/region"
import type { Claim, ClaimStatus, Denial, Encounter } from "@/domain/types"
import { DiagnosisSection } from "@/features/emr/diagnosis-section"
import { PatientBanner } from "@/features/patients/patient-banner"
import { cn } from "@/lib/cn"
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useNow } from "@/lib/use-now"
import { useActions, useStore } from "@/store"
import { usePatientMap, useRegion } from "@/store/selectors"

type Queue = "draft" | "coded" | "submitted" | "denied" | "appealed" | "paid"
const QUEUE_OF: Record<ClaimStatus, Queue> = { draft: "draft", coded: "coded", submitted: "submitted", accepted: "submitted", denied: "denied", appealed: "appealed", paid: "paid" }
const UK_QUEUE_OF: Record<ClaimStatus, Queue> = { ...QUEUE_OF, accepted: "paid" }

const QUEUE_LABEL: Record<Region, Record<Queue, string>> = {
  us: { draft: "Not coded", coded: "Ready to bill", submitted: "Submitted (837)", denied: "Denied", appealed: "Appealed", paid: "Paid (835)" },
  uk: { draft: "Not coded", coded: "Coded", submitted: "Submitted", denied: "Rejected / declined", appealed: "Challenged", paid: "Accepted / settled" },
}

const KIND_LABEL: Record<Region, Record<Encounter["kind"], string>> = {
  us: { outpatient: "OP", emergency: "ED", inpatient: "IP" },
  uk: { outpatient: "OP", emergency: "A&E", inpatient: "APC" },
}

/** UK rejection reasons: SUS+ CDS validation and private medical insurer declines. */
const UK_REJECTIONS: Denial[] = [
  { carc: "CDS-NHSNO", text: "NHS number missing or not verified against PDS" },
  { carc: "CDS-DIAG", text: "Primary diagnosis missing or not a valid ICD-10 code" },
  { carc: "CDS-OPCS", text: "Invalid or missing OPCS-4 procedure code" },
  { carc: "INS-PA", text: "Insurer pre-authorisation not obtained" },
  { carc: "INS-EXCL", text: "Treatment excluded under policy terms" },
]

const DAY = 86400000
const claimForm = (enc: Encounter | undefined) => (enc?.kind === "inpatient" ? "837I" : "837P")

export default function ClaimsPage() {
  const claims = useStore((s) => s.claims)
  const encounters = useStore((s) => s.encounters)
  const invoices = useStore((s) => s.invoices)
  const patients = usePatientMap()
  const region = useRegion()
  const now = useNow(60_000)
  const [queue, setQueue] = useState<Queue>("draft")
  const [openId, setOpenId] = useState<string>()
  const encById = useMemo(() => new Map(encounters.map((e) => [e.id, e])), [encounters])
  const invById = useMemo(() => new Map(invoices.map((i) => [i.id, i])), [invoices])
  const us = region === "us"
  const queueOf = us ? QUEUE_OF : UK_QUEUE_OF
  const rows = claims.filter((c) => queueOf[c.status] === queue).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const count = (q: Queue) => claims.filter((c) => queueOf[c.status] === q).length
  const open = claims.find((c) => c.id === openId)

  const kpi = useMemo(() => {
    const adjudicated = claims.filter((c) => c.status === "paid" || c.status === "denied" || c.status === "appealed")
    const denied = adjudicated.filter((c) => c.status !== "paid" || c.denial)
    const sent = claims.filter((c) => c.status !== "draft" && c.status !== "coded")
    const clean = sent.filter((c) => !c.denial)
    const unpaid = claims.filter((c) => c.status === "submitted" || c.status === "accepted" || c.status === "denied" || c.status === "appealed")
    const ages = unpaid.map((c) => {
      const e = encById.get(c.encounterId)
      return (now - new Date(e?.endedAt ?? e?.createdAt ?? c.updatedAt).getTime()) / DAY
    })
    const finished = encounters.filter((e) => e.status === "finished")
    const coded = finished.filter((e) => e.diagnoses.some((d) => d.primary))
    const uncodedOld = claims.filter((c) => c.status === "draft" && now - new Date(encById.get(c.encounterId)?.endedAt ?? c.updatedAt).getTime() > 5 * DAY)
    return {
      denialRate: adjudicated.length ? (denied.length / adjudicated.length) * 100 : 0,
      cleanRate: sent.length ? (clean.length / sent.length) * 100 : 0,
      arDays: ages.length ? ages.reduce((s, a) => s + a, 0) / ages.length : 0,
      dnfb: claims.filter((c) => c.status === "draft" || c.status === "coded").reduce((s, c) => s + (c.billed ?? invoiceTotal(invById.get(c.invoiceId)!)), 0),
      completeness: finished.length ? (coded.length / finished.length) * 100 : 0,
      uncodedOld: uncodedOld.length,
      insurerOutstanding: claims.filter((c) => c.grouper === "FFS" && (c.status === "submitted" || c.status === "accepted")).reduce((s, c) => s + (c.tariff ?? 0), 0),
    }
  }, [claims, encounters, encById, invById, now])

  const columns: Column<Claim>[] = [
    {
      id: "patient",
      header: "Patient · claim",
      isRowHeader: true,
      cell: (c) => {
        const e = encById.get(c.encounterId)
        const p = e ? patients.get(e.patientId) : undefined
        return (
          <div>
            <div className="font-medium">{p?.name}</div>
            <div className="num text-xs text-muted">
              {e ? KIND_LABEL[region][e.kind] : ""} · {c.number}
              {e && ` · ${formatDate(e.endedAt ?? e.createdAt)}`}
            </div>
          </div>
        )
      },
    },
    {
      id: "payer",
      header: "Payer",
      cell: (c) => (
        <div className="space-y-0.5">
          <PayerChip payer={c.payer} />
          <div className="max-w-40 truncate text-xs text-muted">{c.payerName}</div>
        </div>
      ),
    },
    {
      id: "dx",
      header: us ? "Principal dx" : "Primary dx",
      cell: (c) => {
        const d = encById.get(c.encounterId)?.diagnoses.find((x) => x.primary)
        return d ? (
          <div className="max-w-56 text-sm">
            <span className="num text-[11px] text-muted">{REGIONS[region].dxSystem.split(" ")[0]} </span>
            <b className="num">{d.code}</b> <span className="line-clamp-1">{d.display}</span>
          </div>
        ) : (
          <span className="text-sm font-medium text-danger">Not coded</span>
        )
      },
    },
    {
      id: "group",
      header: us ? "DRG / pricing" : "HRG / tariff",
      cell: (c) =>
        c.grouper === "FFS" ? (
          <span className="text-sm text-muted">{us ? "Line-item (FFS)" : "Insurer invoice"}</span>
        ) : c.groupCode ? (
          <div className="num text-sm">
            {c.grouper} {c.groupCode}
            {c.weight !== undefined && <div className="text-[11px] text-muted">RW {c.weight.toFixed(2)}</div>}
          </div>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    { id: "billed", header: "Billed", align: "end", sortValue: (c) => c.billed ?? 0, cell: (c) => <span className="num text-sm">{c.billed !== undefined ? formatMoney(c.billed) : "—"}</span> },
    { id: "expected", header: "Expected", align: "end", sortValue: (c) => c.tariff ?? 0, cell: (c) => <span className="num text-sm">{c.tariff !== undefined ? formatMoney(c.tariff) : "—"}</span> },
    ...(us ? [{ id: "paid", header: "Paid", align: "end" as const, sortValue: (c: Claim) => c.paid ?? 0, cell: (c: Claim) => <span className="num text-sm">{c.paid !== undefined ? formatMoney(c.paid) : "—"}</span> }] : []),
    {
      id: "status",
      header: "Status",
      cell: (c) => (
        <div className="space-y-0.5">
          <ClaimStatusChip status={c.status} />
          {c.denial && (c.status === "denied" || c.status === "appealed") && <div className="num text-[11px] text-danger">{us ? "CARC " : ""}{c.denial.carc}</div>}
        </div>
      ),
    },
  ]

  return (
    <Page>
      <PageHeader
        title={us ? "Coding & Claims" : "Clinical Coding & SUS+"}
        description={
          us
            ? "MS-DRG · 837I/837P · 835 remittance & CARC denials"
            : "ICD-10 · OPCS-4 · HRG4+ · SUS+ · private insurer invoices"
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {us ? (
          <>
            <Stat label="DNFB (not final billed)" value={count("draft") + count("coded")} hint={formatMoney(kpi.dnfb)} icon={FileHeart} tone="warning" onClick={() => setQueue("draft")} />
            <Stat label="Denial rate" value={formatPercent(kpi.denialRate)} hint="Denied ÷ adjudicated (835)" icon={ShieldX} tone={kpi.denialRate > 10 ? "danger" : "success"} onClick={() => setQueue("denied")} />
            <Stat label="Clean-claim rate" value={formatPercent(kpi.cleanRate)} hint="Paid / accepted without denial · target ≥ 95%" icon={ShieldCheck} tone={kpi.cleanRate >= 95 ? "success" : "warning"} />
            <Stat label="A/R days (proxy)" value={formatNumber(kpi.arDays)} hint="Mean age of unpaid claims since discharge" icon={Clock} tone={kpi.arDays > 45 ? "danger" : "accent"} onClick={() => setQueue("submitted")} />
          </>
        ) : (
          <>
            <Stat label="Coding completeness" value={formatPercent(kpi.completeness)} hint="Finished spells with a primary diagnosis" icon={Percent} tone={kpi.completeness >= 95 ? "success" : "warning"} />
            <Stat label="Uncoded > 5 days" value={kpi.uncodedOld} hint="At risk for the SUS+ flex deadline" icon={Clock} tone={kpi.uncodedOld ? "danger" : "success"} onClick={() => setQueue("draft")} />
            <Stat label="Rejected / declined" value={count("denied")} icon={CircleAlert} tone={count("denied") ? "danger" : "success"} onClick={() => setQueue("denied")} />
            <Stat label="Insurer invoices outstanding" value={formatMoney(kpi.insurerOutstanding)} icon={Sigma} tone="accent" onClick={() => setQueue("submitted")} />
          </>
        )}
      </div>
      <Panel flush>
        <div className="border-b border-separator p-4">
          <Segmented
            label="Work queue"
            value={queue}
            onChange={setQueue}
            options={(["draft", "coded", "submitted", "denied", "appealed", "paid"] as Queue[]).filter((q) => us || q !== "appealed" || count(q) > 0).map((q) => ({ value: q, label: QUEUE_LABEL[region][q], count: count(q) }))}
          />
        </div>
        <DataTable label="Claims" rows={rows} columns={columns} rowKey={(c) => c.id} onRowAction={(c) => setOpenId(c.id)} empty={<Empty icon={FileHeart} title="No claims in this queue" />} />
      </Panel>
      {open && <ClaimPanel claim={open} onClose={() => setOpenId(undefined)} />}
    </Page>
  )
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("num flex justify-between text-sm", muted && "text-muted")}>
      <span className={cn(!muted && "text-muted")}>{label}</span>
      {strong ? <b>{value}</b> : <span>{value}</span>}
    </div>
  )
}

function ClaimPanel({ claim, onClose }: { claim: Claim; onClose: () => void }) {
  const encounter = useStore((s) => s.encounters.find((e) => e.id === claim.encounterId))
  const patient = useStore((s) => s.patients.find((p) => p.id === encounter?.patientId))
  const invoice = useStore((s) => s.invoices.find((i) => i.id === claim.invoiceId))
  const region = useRegion()
  const { groupClaim, setClaimStatus } = useActions()
  const [note, setNote] = useState(claim.note ?? "")
  const [denialCode, setDenialCode] = useState<string | null>(null)
  if (!encounter || !patient) return null

  const us = region === "us"
  const checks = claimChecklist(encounter, patient, region)
  const ready = checks.every((c) => c.ok)
  const ffs = claim.grouper === "FFS"
  const nhs = claim.grouper === "HRG"
  const priced = ffs ? claim.tariff !== undefined : !!claim.groupCode
  const codable = claim.status === "draft" || claim.status === "coded" || claim.status === "denied"
  const billed = claim.billed ?? (invoice ? invoiceTotal(invoice) : 0)
  const los = encounter.endedAt ? Math.max(1, Math.round((new Date(encounter.endedAt).getTime() - new Date(encounter.startedAt ?? encounter.createdAt).getTime()) / DAY)) : undefined
  const reasons = us ? DENIAL_REASONS : UK_REJECTIONS
  const form = claimForm(encounter)
  const submitLabel = us ? `Submit ${form}` : nhs ? "Submit to SUS+ (CDS 6.3)" : "Send invoice to insurer"
  const denial = reasons.find((r) => r.carc === denialCode)

  const act = (status: ClaimStatus, msg: string, opts: { note?: string; denial?: Denial } = {}) => {
    setClaimStatus(claim.id, status, { note: opts.note ?? (note.trim() || undefined), denial: opts.denial })
    toast.success(msg)
  }

  return (
    <SidePanel
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={us ? `Claim ${claim.number}` : nhs ? `SUS+ submission ${claim.number}` : `Insurer invoice ${claim.number}`}
      description={`${claim.payerName} · ${PAYER_LABEL[claim.payer]} · updated ${formatDate(claim.updatedAt)}`}
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          {codable && (
            <Button variant="secondary" isDisabled={!encounter.diagnoses.some((d) => d.primary)} onPress={() => { groupClaim(claim.id); toast.success(ffs ? "Claim priced" : `${nhs ? "HRG" : "MS-DRG"} grouped`) }}>
              <Sigma className="size-4" aria-hidden /> {ffs ? "Price claim" : priced ? "Regroup" : "Group"}
            </Button>
          )}
          {(claim.status === "coded" || (claim.status === "denied" && priced)) && (
            <Button variant="primary" isDisabled={!ready || !priced} onPress={() => act("submitted", us ? `${form} sent to clearinghouse` : nhs ? "Submitted to SUS+" : "Invoice sent")}>
              <Send className="size-4" aria-hidden /> {claim.status === "denied" ? (us ? `Resubmit corrected ${form}` : "Resubmit") : submitLabel}
            </Button>
          )}
          {(claim.status === "submitted" || claim.status === "accepted" || claim.status === "appealed") && (nhs ? claim.status === "submitted" : true) && (
            <Button variant="primary" onPress={() => act(nhs ? "accepted" : "paid", us ? "835 posted — claim paid" : nhs ? "SUS+ accepted" : "Remittance posted")}>
              <CheckCircle2 className="size-4" aria-hidden /> {us ? "Post 835 (paid)" : nhs ? "Mark accepted (SUS+ ack)" : "Post remittance (settled)"}
            </Button>
          )}
          {claim.status === "denied" && (
            <Button variant="secondary" isDisabled={!note.trim()} onPress={() => act("appealed", us ? "Appeal filed" : "Challenge submitted", { note: note.trim() })}>
              <Gavel className="size-4" aria-hidden /> {us ? "Appeal" : "Challenge"}
            </Button>
          )}
        </div>
      }
    >
      <PatientBanner patient={patient} encounter={encounter} compact />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClaimStatusChip status={claim.status} />
          <span className="num text-xs text-muted">{us ? `${form} · ${encounter.kind === "inpatient" ? "UB-04" : "CMS-1500 equivalent"}` : nhs ? "CDS 6.3 · Admitted Patient Care / ECDS" : "Private patient episode"}</span>
        </div>
        <Link to={`/encounters/${encounter.id}`} className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
          Open chart <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </div>

      {claim.denial && (claim.status === "denied" || claim.status === "appealed") && (
        <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
          <div className="num font-semibold">
            {us ? `CARC ${claim.denial.carc}` : claim.denial.carc}
            {claim.denial.rarc && ` · RARC ${claim.denial.rarc}`}
          </div>
          <div>{claim.denial.text}</div>
          {claim.note && <div className="mt-1 text-xs opacity-80">Note: {claim.note}</div>}
        </div>
      )}

      <Panel title={us ? "Pre-bill edits (claim scrubber)" : nhs ? "SUS+ validation" : "Invoice checks"}>
        <ul className="space-y-1.5 text-sm">
          {checks.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              {c.ok ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden /> : <CircleAlert className="size-4 shrink-0 text-danger" aria-hidden />}
              <span className={c.ok ? undefined : "font-medium text-danger"}>{c.label}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <DiagnosisSection encounter={encounter} readOnly={!codable} />

      {!ffs ? (
        <Panel title={us ? "MS-DRG grouping" : "HRG4+ grouping"} description={us ? `${REGIONS.us.grouper} v42 · principal dx, CC/MCC and procedures` : "HRG4+ 2025/26 Payment Grouper · core HRG family"}>
          {claim.groupCode ? (
            <div className="space-y-1.5">
              <div className="text-sm">
                <span className="num font-semibold">
                  {claim.grouper} {claim.groupCode}
                </span>{" "}
                — {claim.groupName}
              </div>
              {us && claim.weight !== undefined && (
                <>
                  <Row label="Relative weight" value={claim.weight.toFixed(4)} />
                  <Row label="GMLOS / actual LOS" value={`${claim.gmlos?.toFixed(1) ?? "—"} / ${los ?? "—"} days`} />
                  <Row label={`RW × base rate (${formatMoney(DRG_BASE_RATE)})`} value={formatMoney(Math.round(claim.weight * DRG_BASE_RATE))} />
                </>
              )}
              <Row label={us ? "Expected payment (payer contract)" : "Indicative tariff"} value={formatMoney(claim.tariff ?? 0)} strong />
              <p className="label-caps pt-1 text-muted">{us ? "Illustrative — load CMS FY Table 5" : "Indicative — NHS Payment Scheme prices, before MFF"}</p>
            </div>
          ) : (
            <p className="text-sm text-muted">Not grouped yet — code the {us ? "principal" : "primary"} diagnosis, then group.</p>
          )}
        </Panel>
      ) : (
        <Panel title={us ? "Line-item pricing (FFS)" : "Insurer invoice"} description={us ? "Outpatient / ED claims pay per CPT/HCPCS line (APC for Medicare OPPS)." : "Private medical insurers pay the agreed private tariff per episode."}>
          <p className="text-sm text-muted">{priced ? "Priced from the itemised account." : "Not priced yet."}</p>
        </Panel>
      )}

      <Panel title="Reimbursement">
        <div className="space-y-1.5">
          <Row label="Billed charges" value={formatMoney(billed)} />
          <Row label={us ? "Expected (allowed)" : nhs ? "Indicative tariff" : "Expected"} value={claim.tariff !== undefined ? formatMoney(claim.tariff) : "—"} />
          {us && claim.tariff !== undefined && <Row label="Contractual adjustment" value={formatMoney(Math.max(0, billed - claim.tariff))} muted />}
          {!nhs && <Row label="Paid" value={claim.paid !== undefined ? formatMoney(claim.paid) : "—"} strong />}
          {us && <Row label="Patient responsibility" value={formatMoney(claim.patientResponsibility ?? 0)} />}
        </div>
      </Panel>

      {(claim.status === "submitted" || claim.status === "accepted" || claim.status === "appealed") && !nhs && (
        <Panel title={us ? "Post denial from 835" : "Record insurer decline"}>
          <div className="flex flex-wrap items-end gap-2">
            <SelectInput
              className="min-w-0 flex-1"
              label={us ? "Reason (CARC)" : "Reason"}
              value={denialCode}
              onChange={setDenialCode}
              placeholder="Select reason…"
              options={reasons.map((r) => ({ value: r.carc, label: `${r.carc}${r.rarc ? ` / ${r.rarc}` : ""} — ${r.text}` }))}
            />
            <Button variant="danger-soft" isDisabled={!denial} onPress={() => denial && act("denied", "Denial posted", { denial })}>
              <ShieldX className="size-4" aria-hidden /> Deny
            </Button>
          </div>
        </Panel>
      )}
      {claim.status === "submitted" && nhs && (
        <Panel title="SUS+ rejection">
          <div className="flex flex-wrap items-end gap-2">
            <SelectInput className="min-w-0 flex-1" label="Validation error" value={denialCode} onChange={setDenialCode} placeholder="Select error…" options={UK_REJECTIONS.slice(0, 3).map((r) => ({ value: r.carc, label: `${r.carc} — ${r.text}` }))} />
            <Button variant="danger-soft" isDisabled={!denial} onPress={() => denial && act("denied", "Marked rejected", { denial })}>
              <ShieldX className="size-4" aria-hidden /> Reject
            </Button>
          </div>
        </Panel>
      )}

      <TextAreaInput label={claim.status === "denied" ? (us ? "Appeal rationale" : "Challenge rationale") : "Note"} value={note} onChange={setNote} rows={2} description={claim.status === "denied" ? "Required to appeal — cite documentation (H&P, auth, medical necessity)." : undefined} />
      {!ready && codable && <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">Resolve the failed edits before {us ? "submitting the claim" : "submission"}.</p>}
    </SidePanel>
  )
}
