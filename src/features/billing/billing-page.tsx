/**
 * Patient accounting. Charges post automatically from every module (registration, E/M visits,
 * lab, imaging, pharmacy, room & board, OR); this page shows the itemised account and takes
 * patient payments.
 *
 * US: every account is itemised with CPT/HCPCS and UB-04 revenue codes. Insured accounts go to
 * the payer as a claim (837); the patient pays the self-pay balance or their responsibility.
 * UK: NHS-funded care is never billed — only private patients and chargeable overseas visitors
 * (NHS Charging Regulations 2015) have an account here.
 */
import { Button } from "@heroui/react"
import { Banknote, HandCoins, Printer, Receipt, ShieldCheck, Trash2, Wallet } from "lucide-react"
import { Fragment, useMemo, useState } from "react"
import { InvoiceStatusChip, PayerChip } from "@/components/status"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Empty } from "@/components/ui/empty"
import { SelectInput, TextInput } from "@/components/ui/fields"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Segmented } from "@/components/ui/segmented"
import { SidePanel } from "@/components/ui/side-panel"
import { Stat } from "@/components/ui/stat"
import { PAYER_LABEL, invoiceBalance, invoiceTotal, isNhsFunded, isSelfPay } from "@/domain/finance"
import type { ChargeCategory, Invoice, PaymentMethod } from "@/domain/types"
import { PatientBanner } from "@/features/patients/patient-banner"
import { dayKey, formatDate, formatDateTime, formatMoney } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"
import { usePatientMap, useRegion, useSession, useStaffMap, useUnitName } from "@/store/selectors"

type Filter = "open" | "paid" | "claim"

const CATEGORY_LABEL: Record<ChargeCategory, string> = {
  registration: "Registration",
  professional: "Professional services (E/M)",
  procedure: "Procedures",
  laboratory: "Laboratory",
  radiology: "Radiology",
  pharmacy: "Pharmacy",
  room: "Room & board",
  surgery: "Operating room & anesthesia",
  emergency: "Emergency department",
}

const METHOD_LABEL: Record<PaymentMethod, string> = { card: "Card", cash: "Cash", check: "Check", "bank-transfer": "Bank transfer", payer: "Adjustment" }
const PATIENT_METHODS: PaymentMethod[] = ["card", "cash", "check", "bank-transfer"]

/** Self-pay discount under the hospital's financial assistance policy (illustrative rate). */
const SELF_PAY_DISCOUNT = 0.35

export default function BillingPage() {
  const invoices = useStore((s) => s.invoices)
  const encounters = useStore((s) => s.encounters)
  const claims = useStore((s) => s.claims)
  const patients = usePatientMap()
  const unitName = useUnitName()
  const region = useRegion()
  const [filter, setFilter] = useState<Filter>("open")
  const [openId, setOpenId] = useState<string>()
  const encById = useMemo(() => new Map(encounters.map((e) => [e.id, e])), [encounters])
  const claimByInvoice = useMemo(() => new Map(claims.map((c) => [c.invoiceId, c])), [claims])
  const today = dayKey()

  // UK: NHS-funded activity is costed, not billed — it never appears on this page.
  const billable = useMemo(() => invoices.filter((i) => !isNhsFunded(i.payer)), [invoices])
  const isFinished = (i: Invoice) => encById.get(i.encounterId)?.status === "finished"
  // Patients reach the business office once their visit is finished; accounts still in care keep growing.
  const open = billable.filter((i) => i.status === "open" && isSelfPay(i.payer) && invoiceTotal(i) > 0 && isFinished(i))
  const inCare = billable.filter((i) => i.status === "open" && isSelfPay(i.payer) && !isFinished(i) && encById.get(i.encounterId)?.status !== "cancelled")
  const paidToday = billable.filter((i) => i.status === "paid" && i.closedAt && dayKey(i.closedAt) === today)
  const toPayer = billable.filter((i) => i.status === "claim")
  const rows = filter === "open" ? open : filter === "paid" ? paidToday : toPayer
  const collected = billable
    .flatMap((i) => i.payments)
    .filter((p) => p.method !== "payer" && dayKey(p.at) === today)
    .reduce((s, p) => s + p.amount, 0)
  const selected = invoices.find((i) => i.id === openId)

  const columns: Column<Invoice>[] = [
    { id: "number", header: "Account", cell: (i) => <span className="num text-sm font-medium">{i.number}</span> },
    {
      id: "patient",
      header: "Patient",
      isRowHeader: true,
      sortValue: (i) => patients.get(i.patientId)?.name ?? "",
      cell: (i) => {
        const p = patients.get(i.patientId)
        const e = encById.get(i.encounterId)
        return (
          <div>
            <div className="font-medium">{p?.name}</div>
            <div className="text-xs text-muted">
              {unitName(e?.unitId)} · {e && (e.status === "finished" ? `discharged ${formatDate(e.endedAt ?? e.createdAt)}` : "in care")}
            </div>
          </div>
        )
      },
    },
    {
      id: "payer",
      header: "Payer",
      cell: (i) => (
        <div className="space-y-0.5">
          <PayerChip payer={i.payer} />
          {patients.get(i.patientId)?.coverage && <div className="text-xs text-muted">{patients.get(i.patientId)?.coverage?.payerName}</div>}
        </div>
      ),
    },
    { id: "total", header: "Charges", align: "end", sortValue: invoiceTotal, cell: (i) => <span className="num">{formatMoney(invoiceTotal(i))}</span> },
    {
      id: "balance",
      header: filter === "claim" ? "Patient resp." : "Balance",
      align: "end",
      sortValue: (i) => (i.status === "open" ? invoiceBalance(i) : claimByInvoice.get(i.id)?.patientResponsibility ?? 0),
      cell: (i) => {
        if (i.status === "open") return <span className="num font-semibold">{formatMoney(invoiceBalance(i))}</span>
        const resp = claimByInvoice.get(i.id)?.patientResponsibility
        return <span className="num text-muted">{resp ? formatMoney(resp) : formatMoney(0)}</span>
      },
    },
    { id: "status", header: "Status", cell: (i) => <InvoiceStatusChip status={i.status} /> },
  ]

  return (
    <Page>
      <PageHeader
        title={region === "us" ? "Patient Accounting" : "Private Patients & Overseas Visitors"}
        description={
          region === "us" ? (
            "Itemised accounts with CPT/HCPCS and UB-04 revenue codes. Insured accounts are billed to the payer; patients pay their self-pay balance or cost share."
          ) : (
            <>
              NHS-funded care is free at the point of use — activity is costed, not billed (PLICS). Only private patients and chargeable overseas visitors (NHS Charging Regulations) have an account here.
            </>
          )
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Self-pay balances" value={open.length} hint={formatMoney(open.reduce((s, i) => s + invoiceBalance(i), 0))} icon={Receipt} tone="warning" onClick={() => setFilter("open")} />
        <Stat label="Collected today" value={formatMoney(collected)} icon={Banknote} tone="success" onClick={() => setFilter("paid")} />
        <Stat label="Self-pay still in care" value={inCare.length} hint={`Running ${formatMoney(inCare.reduce((s, i) => s + invoiceTotal(i), 0))}`} icon={Wallet} />
        <Stat
          label={region === "us" ? "Billed to payers" : "Billed to insurers"}
          value={toPayer.length}
          hint={formatMoney(toPayer.reduce((s, i) => s + invoiceTotal(i), 0))}
          icon={ShieldCheck}
          tone="accent"
          onClick={() => setFilter("claim")}
        />
      </div>
      <Panel flush>
        <div className="border-b border-separator p-4">
          <Segmented
            label="Account filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "open", label: "Balance due", count: open.length },
              { value: "paid", label: "Paid today", count: paidToday.length },
              { value: "claim", label: region === "us" ? "Billed to payer" : "Billed to insurer", count: toPayer.length },
            ]}
          />
        </div>
        <DataTable label="Patient accounts" rows={rows} columns={columns} rowKey={(i) => i.id} onRowAction={(i) => setOpenId(i.id)} defaultSort={{ column: "balance", direction: "descending" }} empty={<Empty icon={Receipt} title="No accounts" />} />
      </Panel>
      {selected && <AccountPanel invoice={selected} onClose={() => setOpenId(undefined)} />}
    </Page>
  )
}

function AccountPanel({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const patient = useStore((s) => s.patients.find((p) => p.id === invoice.patientId))
  const encounter = useStore((s) => s.encounters.find((e) => e.id === invoice.encounterId))
  const claim = useStore((s) => s.claims.find((c) => c.invoiceId === invoice.id))
  const facility = useStore((s) => s.facility.name)
  const staff = useStaffMap()
  const region = useRegion()
  const { role } = useSession()
  const { addPayment, removeCharge } = useActions()
  const total = invoiceTotal(invoice)
  const balance = invoiceBalance(invoice)
  const [method, setMethod] = useState<PaymentMethod>("card")
  const [amount, setAmount] = useState(balance.toFixed(2))
  const [tendered, setTendered] = useState("")
  const groups = [...new Set(invoice.charges.map((c) => c.category))].map((cat) => [cat, invoice.charges.filter((c) => c.category === cat)] as const)
  const change = method === "cash" && Number(tendered) > Number(amount) ? Number(tendered) - Number(amount) : 0
  const stillInCare = encounter && encounter.status !== "finished" && encounter.status !== "cancelled"
  const us = region === "us"
  const discountable = us && invoice.payer === "self-pay" && invoice.status === "open" && !invoice.payments.some((p) => p.method === "payer")
  const canEdit = invoice.status === "open" && (role === "cashier" || role === "admin")
  const money = (v: string) => v.replace(/[^\d.]/g, "")

  return (
    <SidePanel
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={`Account ${invoice.number}`}
      description={`${PAYER_LABEL[invoice.payer]}${patient?.coverage ? ` · ${patient.coverage.payerName}` : ""} · opened ${formatDateTime(invoice.createdAt)}`}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="tertiary" onPress={() => window.print()}>
            <Printer className="size-4" aria-hidden /> Print itemized statement
          </Button>
        </div>
      }
    >
      {patient && <PatientBanner patient={patient} encounter={encounter} compact />}
      {stillInCare && <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">Patient is still in care — charges may still post. A payment now is recorded as a deposit.</p>}

      <div className="print-area space-y-3">
        <div className="hidden print:block">
          <div className="text-lg font-bold">{facility}</div>
          <div>
            Itemized statement {invoice.number} · {patient?.name} (MRN {patient?.mrn})
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="label-caps border-b border-separator text-left text-muted">
                <th className="py-1.5 pr-2 font-semibold">{us ? "CPT / HCPCS" : "Code"}</th>
                {us && <th className="py-1.5 pr-2 font-semibold">Rev</th>}
                <th className="py-1.5 pr-2 font-semibold">Description</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Qty</th>
                <th className="py-1.5 text-right font-semibold">Amount</th>
                {canEdit && <th className="no-print w-8" aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {groups.map(([cat, charges]) => (
                <Fragment key={cat}>
                  <tr>
                    <td colSpan={(us ? 5 : 4) + (canEdit ? 1 : 0)} className="label-caps pb-1 pt-3 text-muted">
                      {CATEGORY_LABEL[cat]}
                    </td>
                  </tr>
                  {charges.map((c) => (
                    <tr key={c.id} className="border-b border-separator/60">
                      <td className="num py-1.5 pr-2 text-xs">{c.code ?? "—"}</td>
                      {us && <td className="num py-1.5 pr-2 text-xs text-muted">{c.revCode ?? "—"}</td>}
                      <td className="py-1.5 pr-2">{c.description}</td>
                      <td className="num py-1.5 pr-2 text-right">{c.qty}</td>
                      <td className="num py-1.5 text-right">{formatMoney(c.qty * c.price)}</td>
                      {canEdit && (
                        <td className="no-print text-right">
                          <Button isIconOnly size="sm" variant="ghost" aria-label={`Reverse ${c.description}`} onPress={() => removeCharge(invoice.id, c.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="num space-y-1 border-t border-separator pt-3 text-sm">
          <div className="flex justify-between font-semibold">
            <span>Total charges</span>
            <span>{formatMoney(total)}</span>
          </div>
          {invoice.payments.map((p) => (
            <div key={p.id} className="flex justify-between text-muted">
              <span>
                {p.method === "payer" ? (invoice.payer === "self-pay" ? "Self-pay discount" : "Contractual adjustment") : METHOD_LABEL[p.method]} · {formatDateTime(p.at)} · {staff.get(p.by)?.name}
              </span>
              <span>−{formatMoney(p.amount)}</span>
            </div>
          ))}
          {invoice.status === "open" && (
            <div className="flex justify-between text-base font-bold">
              <span>Balance due</span>
              <span>{formatMoney(balance)}</span>
            </div>
          )}
        </div>
      </div>

      {invoice.status === "claim" && (
        <div className="space-y-1.5 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-soft-foreground">
          <p>
            Billed to {claim?.payerName ?? PAYER_LABEL[invoice.payer]}
            {claim ? ` on claim ${claim.number}` : ""}. The patient is not asked to pay until the payer adjudicates{us ? " (835 remittance)" : ""}.
          </p>
          {claim && (
            <div className="num flex flex-wrap gap-x-4 text-xs">
              {claim.tariff !== undefined && <span>Expected {formatMoney(claim.tariff)}</span>}
              {claim.paid !== undefined && <span>Paid {formatMoney(claim.paid)}</span>}
              <span>Patient responsibility {formatMoney(claim.patientResponsibility ?? 0)}</span>
            </div>
          )}
        </div>
      )}

      {invoice.status === "open" && balance > 0 && (
        <Panel title="Post payment">
          {discountable && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <div>
                <div className="text-sm">Uninsured self-pay discount — {SELF_PAY_DISCOUNT * 100}% of gross charges</div>
                <div className="label-caps text-muted">Financial assistance policy · IRS 501(r) · No Surprises Act good-faith estimate</div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => {
                  const discount = Math.round(total * SELF_PAY_DISCOUNT * 100) / 100
                  addPayment(invoice.id, "payer", discount)
                  setAmount(Math.max(0, balance - discount).toFixed(2))
                  toast.success("Self-pay discount applied", { description: formatMoney(discount) })
                }}
              >
                <HandCoins className="size-3.5" aria-hidden /> Apply discount
              </Button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectInput label="Method" value={method} onChange={setMethod} options={PATIENT_METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))} />
            <TextInput label="Amount" value={amount} onChange={(v) => setAmount(money(v))} inputMode="decimal" description={formatMoney(Number(amount) || 0)} />
            {method === "cash" && <TextInput label="Cash tendered" value={tendered} onChange={(v) => setTendered(money(v))} inputMode="decimal" description={change ? `Change due ${formatMoney(change)}` : undefined} />}
          </div>
          <Button
            className="mt-3"
            variant="primary"
            fullWidth
            isDisabled={!(Number(amount) > 0) || Number(amount) > balance + 0.005 || (method === "cash" && tendered !== "" && Number(tendered) < Number(amount))}
            onPress={() => {
              addPayment(invoice.id, method, Number(amount))
              toast.success("Payment posted", { description: change ? `Change due ${formatMoney(change)}` : formatMoney(Number(amount)) })
              setAmount(Math.max(0, balance - Number(amount)).toFixed(2))
              setTendered("")
            }}
          >
            Post {formatMoney(Number(amount) || 0)}
          </Button>
        </Panel>
      )}
    </SidePanel>
  )
}
