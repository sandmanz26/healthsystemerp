/**
 * Cashier. Charges arrive automatically from every module (registration, consultations,
 * lab, radiology, pharmacy, room, theatre); the cashier reviews and takes payment.
 */
import { Button } from "@heroui/react"
import { Banknote, Printer, Receipt, ShieldCheck, Trash2, Wallet } from "lucide-react"
import { useMemo, useState } from "react"
import { InvoiceStatusChip, PayerChip } from "@/components/status"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Empty } from "@/components/ui/empty"
import { SelectInput, TextInput } from "@/components/ui/fields"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Segmented } from "@/components/ui/segmented"
import { SidePanel } from "@/components/ui/side-panel"
import { Stat } from "@/components/ui/stat"
import { invoiceBalance, invoiceTotal } from "@/domain/finance"
import type { ChargeCategory, Invoice, PaymentMethod } from "@/domain/types"
import { PatientBanner } from "@/features/patients/patient-banner"
import { dayKey, formatDateTime, formatRupiah } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"
import { usePatientMap, useSession, useStaffMap, useUnitName } from "@/store/selectors"

type Filter = "open" | "paid" | "claim"

const CATEGORY_LABEL: Record<ChargeCategory, string> = {
  administrasi: "Administrasi",
  konsultasi: "Jasa dokter",
  tindakan: "Tindakan",
  laboratorium: "Laboratorium",
  radiologi: "Radiologi",
  obat: "Obat & BMHP",
  kamar: "Kamar",
  operasi: "Operasi",
}

const METHOD_LABEL: Record<PaymentMethod, string> = { tunai: "Tunai", debit: "Kartu debit", qris: "QRIS", transfer: "Transfer bank", penjamin: "Penjamin" }

export default function BillingPage() {
  const invoices = useStore((s) => s.invoices)
  const encounters = useStore((s) => s.encounters)
  const patients = usePatientMap()
  const unitName = useUnitName()
  const [filter, setFilter] = useState<Filter>("open")
  const [openId, setOpenId] = useState<string>()
  const encById = useMemo(() => new Map(encounters.map((e) => [e.id, e])), [encounters])
  const today = dayKey()

  // Patients reach the cashier when their visit is finished; bills of patients still in care
  // keep growing and would only be noise here (inpatients pay at discharge).
  const open = invoices.filter((i) => i.status === "open" && i.payer === "umum" && invoiceTotal(i) > 0 && encById.get(i.encounterId)?.status === "finished")
  const inCare = invoices.filter((i) => i.status === "open" && i.payer === "umum" && encById.get(i.encounterId)?.status !== "finished" && encById.get(i.encounterId)?.status !== "cancelled")
  const paidToday = invoices.filter((i) => i.status === "paid" && i.closedAt && dayKey(i.closedAt) === today)
  const claimToday = invoices.filter((i) => i.status === "claim" && i.closedAt && dayKey(i.closedAt) === today)
  const rows = filter === "open" ? open : filter === "paid" ? paidToday : claimToday
  const collected = invoices.flatMap((i) => i.payments).filter((p) => dayKey(p.at) === today).reduce((s, p) => s + p.amount, 0)
  const selected = invoices.find((i) => i.id === openId)

  const columns: Column<Invoice>[] = [
    { id: "number", header: "No. tagihan", cell: (i) => <span className="tabular text-sm font-medium">{i.number}</span> },
    {
      id: "patient",
      header: "Pasien",
      isRowHeader: true,
      sortValue: (i) => patients.get(i.patientId)?.name ?? "",
      cell: (i) => {
        const p = patients.get(i.patientId)
        const e = encById.get(i.encounterId)
        return (
          <div>
            <div className="font-medium">{p?.name}</div>
            <div className="text-xs text-muted">
              {unitName(e?.unitId)} · {e && (e.status === "finished" ? "kunjungan selesai" : "masih dilayani")}
            </div>
          </div>
        )
      },
    },
    { id: "payer", header: "Penjamin", cell: (i) => <PayerChip payer={i.payer} /> },
    { id: "total", header: "Total", align: "end", sortValue: invoiceTotal, cell: (i) => <span className="tabular">{formatRupiah(invoiceTotal(i))}</span> },
    { id: "balance", header: "Sisa", align: "end", sortValue: invoiceBalance, cell: (i) => <span className={i.status === "open" ? "tabular font-semibold" : "tabular text-muted"}>{formatRupiah(i.status === "open" ? invoiceBalance(i) : 0)}</span> },
    { id: "status", header: "Status", cell: (i) => <InvoiceStatusChip status={i.status} /> },
  ]

  return (
    <Page>
      <PageHeader title="Kasir" description="Tagihan terbentuk otomatis dari setiap layanan. Pasien BPJS/asuransi tidak membayar di kasir; tagihannya diteruskan ke klaim." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Belum dibayar" value={open.length} hint={formatRupiah(open.reduce((s, i) => s + invoiceBalance(i), 0))} icon={Receipt} tone="warning" onClick={() => setFilter("open")} />
        <Stat label="Diterima hari ini" value={formatRupiah(collected)} icon={Banknote} tone="success" onClick={() => setFilter("paid")} />
        <Stat label="Pasien umum masih dilayani" value={inCare.length} hint={`Berjalan ${formatRupiah(inCare.reduce((s, i) => s + invoiceTotal(i), 0))}`} icon={Wallet} />
        <Stat label="Ke penjamin hari ini" value={claimToday.length} hint={formatRupiah(claimToday.reduce((s, i) => s + invoiceTotal(i), 0))} icon={ShieldCheck} tone="accent" onClick={() => setFilter("claim")} />
      </div>
      <Panel flush>
        <div className="border-b border-separator p-4">
          <Segmented
            label="Filter tagihan"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "open", label: "Belum bayar", count: open.length },
              { value: "paid", label: "Lunas hari ini", count: paidToday.length },
              { value: "claim", label: "Penjamin hari ini", count: claimToday.length },
            ]}
          />
        </div>
        <DataTable label="Tagihan" rows={rows} columns={columns} rowKey={(i) => i.id} onRowAction={(i) => setOpenId(i.id)} defaultSort={{ column: "balance", direction: "descending" }} empty={<Empty icon={Receipt} title="Tidak ada tagihan" />} />
      </Panel>
      {selected && <InvoicePanel invoice={selected} onClose={() => setOpenId(undefined)} />}
    </Page>
  )
}

function InvoicePanel({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const patient = useStore((s) => s.patients.find((p) => p.id === invoice.patientId))!
  const encounter = useStore((s) => s.encounters.find((e) => e.id === invoice.encounterId))
  const facility = useStore((s) => s.facility.name)
  const staff = useStaffMap()
  const { role } = useSession()
  const { addPayment, removeCharge } = useActions()
  const total = invoiceTotal(invoice)
  const balance = invoiceBalance(invoice)
  const [method, setMethod] = useState<PaymentMethod>("tunai")
  const [amount, setAmount] = useState(String(balance))
  const [tendered, setTendered] = useState("")
  const groups = [...new Set(invoice.charges.map((c) => c.category))].map((cat) => [cat, invoice.charges.filter((c) => c.category === cat)] as const)
  const change = method === "tunai" && Number(tendered) > Number(amount) ? Number(tendered) - Number(amount) : 0
  const stillInCare = encounter && encounter.status !== "finished" && encounter.status !== "cancelled"

  return (
    <SidePanel
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={invoice.number}
      description={formatDateTime(invoice.createdAt)}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="tertiary" onPress={() => window.print()}>
            <Printer className="size-4" aria-hidden /> Cetak
          </Button>
        </div>
      }
    >
      <PatientBanner patient={patient} encounter={encounter} compact />
      {stillInCare && <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">Pasien masih dalam pelayanan — tagihan bisa bertambah. Pembayaran sekarang dicatat sebagai uang muka.</p>}

      <div className="print-area space-y-3">
        <div className="hidden print:block">
          <div className="text-lg font-bold">{facility}</div>
          <div>
            Kuitansi {invoice.number} · {patient.name} (RM {patient.mrn})
          </div>
        </div>
        {groups.map(([cat, charges]) => (
          <div key={cat}>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{CATEGORY_LABEL[cat]}</div>
            <ul className="space-y-1">
              {charges.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">
                    {c.description}
                    {c.qty > 1 && <span className="text-muted"> × {c.qty}</span>}
                  </span>
                  <span className="tabular">{formatRupiah(c.qty * c.price)}</span>
                  {invoice.status === "open" && (role === "cashier" || role === "admin") && (
                    <Button isIconOnly size="sm" variant="ghost" aria-label={`Hapus ${c.description}`} className="no-print" onPress={() => removeCharge(invoice.id, c.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="tabular space-y-1 border-t border-separator pt-3 text-sm">
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatRupiah(total)}</span>
          </div>
          {invoice.payments.map((p) => (
            <div key={p.id} className="flex justify-between text-muted">
              <span>
                {METHOD_LABEL[p.method]} · {formatDateTime(p.at)} · {staff.get(p.by)?.name}
              </span>
              <span>−{formatRupiah(p.amount)}</span>
            </div>
          ))}
          {invoice.status === "open" && (
            <div className="flex justify-between text-base font-bold">
              <span>Sisa</span>
              <span>{formatRupiah(balance)}</span>
            </div>
          )}
        </div>
      </div>

      {invoice.status === "claim" && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-soft-foreground">Ditanggung {invoice.payer === "bpjs" ? "BPJS Kesehatan" : "asuransi"}. Pasien tidak membayar; tagihan diteruskan ke modul klaim.</p>}

      {invoice.status === "open" && balance > 0 && (
        <Panel title="Terima pembayaran">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectInput label="Metode" value={method} onChange={setMethod} options={(["tunai", "debit", "qris", "transfer"] as PaymentMethod[]).map((m) => ({ value: m, label: METHOD_LABEL[m] }))} />
            <TextInput label="Jumlah dibayar" value={amount} onChange={(v) => setAmount(v.replace(/\D/g, ""))} inputMode="numeric" description={formatRupiah(Number(amount) || 0)} />
            {method === "tunai" && <TextInput label="Uang diterima" value={tendered} onChange={(v) => setTendered(v.replace(/\D/g, ""))} inputMode="numeric" description={change ? `Kembalian ${formatRupiah(change)}` : undefined} />}
          </div>
          <Button
            className="mt-3"
            variant="primary"
            fullWidth
            isDisabled={!(Number(amount) > 0) || Number(amount) > balance || (method === "tunai" && tendered !== "" && Number(tendered) < Number(amount))}
            onPress={() => {
              addPayment(invoice.id, method, Number(amount))
              toast.success("Pembayaran diterima", { description: change ? `Kembalian ${formatRupiah(change)}` : formatRupiah(Number(amount)) })
              setAmount(String(Math.max(0, balance - Number(amount))))
              setTendered("")
            }}
          >
            Terima {formatRupiah(Number(amount) || 0)}
          </Button>
        </Panel>
      )}
    </SidePanel>
  )
}
