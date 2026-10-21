/**
 * Patient chart overview: who they are, what is active now, and their history across
 * every enabled module. Sections for disabled modules simply don't render.
 */
import { Button, Card, Chip, Tabs } from "@heroui/react"
import { ArrowRight, CalendarPlus, Pencil, Plus, X } from "lucide-react"
import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { EncounterStatusChip, InvoiceStatusChip, OrderStatusChip, RxStatusChip } from "@/components/status"
import { Dialog } from "@/components/ui/dialog"
import { Empty } from "@/components/ui/empty"
import { SelectInput, TextInput } from "@/components/ui/fields"
import { Page } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import type { Allergy, EncounterKind } from "@/domain/types"
import { orderTitle } from "@/domain/catalog"
import { invoiceBalance, invoiceTotal } from "@/domain/finance"
import { OrderResults, VitalsGrid } from "@/features/emr/clinical-widgets"
import { RegisterVisitDialog } from "@/features/registration/register-visit-dialog"
import { formatDate, formatDateTime, formatRupiah } from "@/lib/format"
import { useActions, useStore } from "@/store"
import { isActive, useInventoryMap, useModuleEnabled, useStaffMap, useUnitName } from "@/store/selectors"
import { PatientBanner } from "./patient-banner"
import { PatientForm } from "./patient-form"

const KIND_LABEL: Record<EncounterKind, string> = { outpatient: "Rawat jalan", emergency: "IGD", inpatient: "Rawat inap" }

export default function PatientDetailPage() {
  const { id } = useParams()
  const patient = useStore((s) => s.patients.find((p) => p.id === id))
  const allEncounters = useStore((s) => s.encounters)
  const allOrders = useStore((s) => s.orders)
  const allRx = useStore((s) => s.prescriptions)
  const allInvoices = useStore((s) => s.invoices)
  const unitName = useUnitName()
  const staff = useStaffMap()
  const items = useInventoryMap()
  const registrationOn = useModuleEnabled("registration")
  const billingOn = useModuleEnabled("billing")
  const { removeAllergy } = useActions()
  const [editing, setEditing] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [addingAllergy, setAddingAllergy] = useState(false)

  const encounters = useMemo(() => allEncounters.filter((e) => e.patientId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [allEncounters, id])
  const orders = useMemo(() => allOrders.filter((o) => o.patientId === id).sort((a, b) => b.orderedAt.localeCompare(a.orderedAt)), [allOrders, id])
  const prescriptions = useMemo(() => allRx.filter((o) => o.patientId === id).sort((a, b) => b.prescribedAt.localeCompare(a.prescribedAt)), [allRx, id])
  const invoices = useMemo(() => allInvoices.filter((i) => i.patientId === id && i.status !== "void").sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [allInvoices, id])

  if (!patient) return <Page><Empty title="Pasien tidak ditemukan" /></Page>

  const active = encounters.filter(isActive)
  const latestVitals = encounters.flatMap((e) => e.vitals).sort((a, b) => b.at.localeCompare(a.at))[0]
  const problems = [...new Map(encounters.flatMap((e) => e.diagnoses).map((d) => [d.code, d])).values()]

  return (
    <Page>
      <div className="mb-6 space-y-3">
        <PatientBanner
          patient={patient}
          aside={
            <>
              <Button size="sm" variant="tertiary" onPress={() => setEditing(true)}>
                <Pencil className="size-3.5" aria-hidden /> Ubah
              </Button>
              {registrationOn && (
                <Button size="sm" variant="primary" onPress={() => setRegistering(true)}>
                  <CalendarPlus className="size-3.5" aria-hidden /> Daftarkan kunjungan
                </Button>
              )}
            </>
          }
        />
        <div className="tabular flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted">
          <span>NIK {patient.nik}</span>
          <span>{patient.phone}</span>
          <span>{patient.address}</span>
          {patient.bpjsNumber && <span>BPJS {patient.bpjsNumber} · kelas {patient.bpjsClass}</span>}
          {patient.insurer && <span>Asuransi {patient.insurer}</span>}
        </div>
      </div>

      {active.length > 0 && (
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          {active.map((e) => (
            <Card key={e.id} className="flex-row items-center justify-between gap-3 border border-accent/30 p-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  Kunjungan aktif · {KIND_LABEL[e.kind]} <EncounterStatusChip status={e.status} />
                </div>
                <div className="text-sm text-muted">
                  {unitName(e.unitId)} · {staff.get(e.practitionerId ?? "")?.name ?? "Belum ada dokter"} · sejak {formatDateTime(e.createdAt)}
                </div>
              </div>
              <Link to={`/encounters/${e.id}`}>
                <Button size="sm" variant="secondary">
                  Buka <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      )}

      <Tabs>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Rekam medis pasien">
            <Tabs.Tab className="whitespace-nowrap" id="summary">Ringkasan<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab className="whitespace-nowrap" id="visits">Kunjungan ({encounters.length})<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab className="whitespace-nowrap" id="results">Hasil penunjang ({orders.length})<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab className="whitespace-nowrap" id="meds">Obat ({prescriptions.length})<Tabs.Indicator /></Tabs.Tab>
            {billingOn && <Tabs.Tab className="whitespace-nowrap" id="bills">Tagihan ({invoices.length})<Tabs.Indicator /></Tabs.Tab>}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="summary" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Tanda vital terakhir" className="lg:col-span-2">
              <VitalsGrid vitals={latestVitals} />
            </Panel>
            <Panel
              title="Alergi"
              actions={
                <Button size="sm" variant="ghost" onPress={() => setAddingAllergy(true)}>
                  <Plus className="size-3.5" aria-hidden /> Tambah
                </Button>
              }
            >
              {patient.allergies.length === 0 ? (
                <p className="text-sm text-muted">Tidak ada alergi tercatat. Tetap tanyakan setiap kunjungan.</p>
              ) : (
                <ul className="space-y-2">
                  {patient.allergies.map((a) => (
                    <li key={a.substance} className="flex items-start justify-between gap-2 rounded-xl bg-danger-soft px-3 py-2">
                      <div>
                        <div className="text-sm font-semibold text-danger">{a.substance}</div>
                        <div className="text-xs text-muted">
                          {a.reaction} · {a.severity}
                        </div>
                      </div>
                      <Button isIconOnly size="sm" variant="ghost" aria-label={`Hapus alergi ${a.substance}`} onPress={() => removeAllergy(patient.id, a.substance)}>
                        <X className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Daftar masalah (diagnosis)" className="lg:col-span-3">
              {problems.length === 0 ? (
                <p className="text-sm text-muted">Belum ada diagnosis.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {problems.map((d) => (
                    <Chip key={d.code} variant="soft">
                      <b className="tabular">{d.code}</b> {d.display}
                    </Chip>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="visits" className="pt-4">
          <Panel flush>
            {encounters.length === 0 ? (
              <Empty title="Belum ada kunjungan" />
            ) : (
              <ol className="divide-y divide-separator">
                {encounters.map((e) => (
                  <li key={e.id}>
                    <Link to={`/encounters/${e.id}`} className="flex flex-col gap-1 px-5 py-3 hover:bg-surface-secondary sm:flex-row sm:items-center sm:gap-4">
                      <div className="tabular w-40 shrink-0 text-sm text-muted">{formatDateTime(e.createdAt)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">
                          {KIND_LABEL[e.kind]} · {unitName(e.unitId)}
                        </div>
                        <div className="truncate text-xs text-muted">
                          {e.diagnoses.length ? e.diagnoses.map((d) => `${d.code} ${d.display}`).join("; ") : e.chiefComplaint}
                        </div>
                      </div>
                      <EncounterStatusChip status={e.status} />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </Tabs.Panel>

        <Tabs.Panel id="results" className="space-y-3 pt-4">
          {orders.length === 0 && <Panel><Empty title="Belum ada pemeriksaan penunjang" /></Panel>}
          {orders.map((o) => (
            <Panel
              key={o.id}
              title={`${o.kind === "lab" ? "Lab" : "Radiologi"} · ${orderTitle(o)}`}
              description={`Diorder ${formatDateTime(o.orderedAt)} oleh ${staff.get(o.orderedBy)?.name ?? "-"}`}
              actions={<OrderStatusChip status={o.status} />}
            >
              <OrderResults order={o} />
            </Panel>
          ))}
        </Tabs.Panel>

        <Tabs.Panel id="meds" className="pt-4">
          <Panel flush>
            {prescriptions.length === 0 ? (
              <Empty title="Belum ada resep" />
            ) : (
              <ul className="divide-y divide-separator">
                {prescriptions.map((rx) => (
                  <li key={rx.id} className="px-5 py-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-sm text-muted">
                        {formatDateTime(rx.prescribedAt)} · {staff.get(rx.prescribedBy)?.name}
                      </span>
                      <RxStatusChip status={rx.status} />
                    </div>
                    <ul className="text-sm">
                      {rx.items.map((l) => (
                        <li key={l.itemId}>
                          <b>{items.get(l.itemId)?.name}</b> — {l.dose} {l.frequency} {l.route}, {l.days} hari ({l.qty})
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Tabs.Panel>

        {billingOn && (
          <Tabs.Panel id="bills" className="pt-4">
            <Panel flush>
              {invoices.length === 0 ? (
                <Empty title="Belum ada tagihan" />
              ) : (
                <ul className="divide-y divide-separator">
                  {invoices.map((inv) => (
                    <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                      <div>
                        <div className="tabular text-sm font-medium">{inv.number}</div>
                        <div className="text-xs text-muted">{formatDate(inv.createdAt)}</div>
                      </div>
                      <div className="tabular text-sm">
                        {formatRupiah(invoiceTotal(inv))}
                        {inv.status === "open" && <span className="ml-2 text-danger">sisa {formatRupiah(invoiceBalance(inv))}</span>}
                      </div>
                      <InvoiceStatusChip status={inv.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </Tabs.Panel>
        )}
      </Tabs>

      {editing && <PatientForm isOpen onOpenChange={setEditing} patient={patient} />}
      {registering && <RegisterVisitDialog isOpen onOpenChange={setRegistering} patientId={patient.id} />}
      {addingAllergy && <AllergyDialog patientId={patient.id} onClose={() => setAddingAllergy(false)} />}
    </Page>
  )
}

function AllergyDialog({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const { addAllergy } = useActions()
  const [substance, setSubstance] = useState("")
  const [reaction, setReaction] = useState("")
  const [severity, setSeverity] = useState<Allergy["severity"]>("sedang")
  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title="Tambah alergi"
      size="sm"
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            isDisabled={!substance.trim()}
            onPress={() => {
              addAllergy(patientId, { substance: substance.trim(), reaction: reaction.trim() || "-", severity })
              onClose()
            }}
          >
            Simpan
          </Button>
        </>
      }
    >
      <TextInput label="Zat / obat" value={substance} onChange={setSubstance} isRequired autoFocus description="mis. Penisilin, Sulfa, Ibuprofen, Seafood" />
      <TextInput label="Reaksi" value={reaction} onChange={setReaction} />
      <SelectInput
        label="Tingkat keparahan"
        value={severity}
        onChange={setSeverity}
        options={[
          { value: "ringan", label: "Ringan" },
          { value: "sedang", label: "Sedang" },
          { value: "berat", label: "Berat (anafilaksis)" },
        ]}
      />
    </Dialog>
  )
}
