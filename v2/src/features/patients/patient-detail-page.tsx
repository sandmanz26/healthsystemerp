/**
 * Patient chart overview: identifiers, coverage, code status, what is active now, and history
 * across every enabled module (sections for disabled modules don't render). The FHIR and
 * HL7 v2 tabs show the exact payloads the integration engine sends for this patient.
 */
import { Button, Card, Chip, Tabs } from "@heroui/react"
import { ArrowRight, CalendarPlus, Pencil, Plus, X } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { Link, useParams } from "react-router-dom"
import { codeStatusLabel } from "@v2/components/clinical/labels"
import { EncounterStatusChip, InvoiceStatusChip, OrderStatusChip, PayerChip, RxStatusChip } from "@v2/components/status"
import { Dialog } from "@v2/components/ui/dialog"
import { Empty } from "@v2/components/ui/empty"
import { SelectInput, TextInput } from "@v2/components/ui/fields"
import { Page } from "@v2/components/ui/page"
import { Panel } from "@v2/components/ui/panel"
import { frequencyLabel, orderTitle } from "@v2/domain/catalog"
import { invoiceBalance, invoiceTotal } from "@v2/domain/finance"
import { formatNhsNumber, toFhirBundle, toFhirPatient, toHl7Adt } from "@v2/domain/interop"
import { REGIONS, type Region } from "@v2/domain/region"
import type { Allergy, CodeStatus } from "@v2/domain/types"
import { OrderResults, VitalsGrid } from "@v2/features/emr/clinical-widgets"
import { dispositionLabel } from "@v2/features/outpatient/dispositions"
import { RegisterVisitDialog } from "@v2/features/registration/register-visit-dialog"
import { formatDate, formatDateTime, formatMoney } from "@v2/lib/format"
import { toast } from "@v2/lib/toast"
import { useActions, useStore } from "@v2/store"
import { isActive, useInventoryMap, useModuleEnabled, useRegion, useStaffMap, useUnitName } from "@v2/store/selectors"
import { CodeBlock } from "./code-block"
import { PatientBanner } from "./patient-banner"
import { ALLERGY_TYPE_OPTIONS, codeStatusOptions, kindLabel, SEVERITY_OPTIONS } from "./patient-options"
import { PatientForm } from "./patient-form"

export default function PatientDetailPage() {
  const { id } = useParams()
  const region = useRegion()
  const patient = useStore((s) => s.patients.find((p) => p.id === id))
  const allEncounters = useStore((s) => s.encounters)
  const allOrders = useStore((s) => s.orders)
  const allRx = useStore((s) => s.prescriptions)
  const allInvoices = useStore((s) => s.invoices)
  const units = useStore((s) => s.units)
  const beds = useStore((s) => s.beds)
  const facility = useStore((s) => s.facility)
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

  const latest = encounters[0]
  const payloads = useMemo(() => {
    if (!patient) return null
    const unit = latest ? units.find((u) => u.id === latest.unitId) : undefined
    const bed = latest?.bedId ? beds.find((b) => b.id === latest.bedId) : undefined
    const event = latest?.kind === "inpatient" ? ("A01" as const) : ("A04" as const)
    return {
      patient: JSON.stringify(toFhirPatient(patient, region), null, 2),
      bundle: latest ? JSON.stringify(toFhirBundle(patient, latest, region, unit), null, 2) : null,
      event,
      hl7: latest ? toHl7Adt(event, patient, latest, region, facility.code, unit?.code ?? unit?.id ?? "", bed?.code ?? "") : null,
    }
  }, [patient, latest, units, beds, facility.code, region])

  if (!patient || !payloads) return <Page><Empty title="Patient not found" /></Page>

  const us = region === "us"
  const info = REGIONS[region]
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
                <Pencil className="size-3.5" aria-hidden /> Edit
              </Button>
              {registrationOn && (
                <Button size="sm" variant="primary" onPress={() => setRegistering(true)}>
                  <CalendarPlus className="size-3.5" aria-hidden /> Register visit
                </Button>
              )}
            </>
          }
        />
        <div className="num flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted">
          <span>MRN {patient.mrn}</span>
          {patient.nhsNumber && <span>NHS {formatNhsNumber(patient.nhsNumber)}</span>}
          {patient.phone && <span>{patient.phone}</span>}
          {patient.address && <span>{patient.address}</span>}
          {patient.postcode && !patient.address.includes(patient.postcode) && <span>{patient.postcode}</span>}
          {patient.preferredLanguage && patient.preferredLanguage !== "English" && (
            <span>
              Language: {patient.preferredLanguage}
              {patient.flags?.includes("interpreter") && <b className="ml-1 font-semibold text-warning">· interpreter needed</b>}
            </span>
          )}
          {patient.nextOfKin && <span>NOK: {patient.nextOfKin}</span>}
        </div>
      </div>

      {active.length > 0 && (
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          {active.map((e) => (
            <Card key={e.id} className="flex-row items-center justify-between gap-3 border border-accent/30 p-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  Active · {kindLabel(e.kind, region)} <EncounterStatusChip status={e.status} />
                </div>
                <div className="text-sm text-muted">
                  {unitName(e.unitId)} · {staff.get(e.practitionerId ?? "")?.name ?? "No provider assigned"} · since {formatDateTime(e.createdAt)}
                </div>
                <div className="num text-xs text-muted">
                  {us ? "Acct" : "Spell"} {e.accountNumber}
                </div>
              </div>
              <Link to={`/encounters/${e.id}`}>
                <Button size="sm" variant="secondary">
                  Open chart <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      )}

      <Tabs>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Patient record">
            <Tabs.Tab className="whitespace-nowrap" id="summary">Summary<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab className="whitespace-nowrap" id="visits">Visits ({encounters.length})<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab className="whitespace-nowrap" id="results">Results ({orders.length})<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab className="whitespace-nowrap" id="meds">Medications ({prescriptions.length})<Tabs.Indicator /></Tabs.Tab>
            {billingOn && <Tabs.Tab className="whitespace-nowrap" id="bills">Billing ({invoices.length})<Tabs.Indicator /></Tabs.Tab>}
            <Tabs.Tab className="whitespace-nowrap" id="fhir">FHIR<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab className="whitespace-nowrap" id="hl7">HL7 v2<Tabs.Indicator /></Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="summary" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Latest vital signs" className="lg:col-span-2">
              <VitalsGrid vitals={latestVitals} />
            </Panel>
            <Panel
              title="Allergies & intolerances"
              actions={
                <Button size="sm" variant="ghost" onPress={() => setAddingAllergy(true)}>
                  <Plus className="size-3.5" aria-hidden /> Add
                </Button>
              }
            >
              {patient.allergies.length === 0 ? (
                <p className="text-sm text-muted">No known allergies (NKA). Confirm at every visit.</p>
              ) : (
                <ul className="space-y-2">
                  {patient.allergies.map((a) => (
                    <li key={a.substance} className="flex items-start justify-between gap-2 rounded-xl bg-danger-soft px-3 py-2">
                      <div>
                        <div className="text-sm font-semibold text-danger">{a.substance}</div>
                        <div className="text-xs text-muted">
                          {a.reaction} · {a.severity} · {a.type ?? "allergy"}
                        </div>
                      </div>
                      <Button isIconOnly size="sm" variant="ghost" aria-label={`Remove allergy ${a.substance}`} onPress={() => removeAllergy(patient.id, a.substance)}>
                        <X className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title={us ? "Coverage" : "Funding"} description={us ? "Verified by X12 270/271 at registration" : "Overseas visitor status per 2015 Charging Regulations"}>
              <dl className="space-y-2 text-sm">
                <Row label={us ? "Payer class" : "Status"}>
                  <PayerChip payer={patient.payer} />
                </Row>
                {patient.coverage && (
                  <>
                    <Row label={us ? "Payer" : "Insurer"}>{patient.coverage.payerName}</Row>
                    {patient.coverage.plan && <Row label={us ? "Plan" : "Scheme"}>{patient.coverage.plan}</Row>}
                    <Row label={us ? "Member ID" : "Reference"}>
                      <span className="num">{patient.coverage.memberId}</span>
                    </Row>
                    {patient.coverage.group && (
                      <Row label="Group #">
                        <span className="num">{patient.coverage.group}</span>
                      </Row>
                    )}
                  </>
                )}
                {latest?.eligibility && (
                  <Row label={us ? "Last 271" : "Last PDS trace"}>
                    <span className={latest.eligibility.status === "active" ? "text-success" : "text-danger"}>{latest.eligibility.status}</span>
                    <span className="num ml-1 text-xs text-muted">{formatDate(latest.eligibility.at)}</span>
                  </Row>
                )}
              </dl>
            </Panel>

            <CodeStatusPanel patientId={patient.id} status={patient.codeStatus} advanceDirective={!!patient.advanceDirective} region={region} />

            <Panel title={us ? "Primary care" : "Registered GP"} description={us ? undefined : "From the PDS record"}>
              <p className="text-sm">{patient.primaryCare ?? <span className="text-muted">{us ? "No PCP on file" : "Not registered with a GP"}</span>}</p>
              {patient.nextOfKin && (
                <p className="mt-3 text-sm">
                  <span className="label-caps block text-muted">Next of kin</span>
                  {patient.nextOfKin}
                </p>
              )}
            </Panel>

            <Panel title="Problem list" description={`Coded in ${info.dxSystem}`} className="lg:col-span-3">
              {problems.length === 0 ? (
                <p className="text-sm text-muted">No diagnoses recorded.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {problems.map((d) => (
                    <Chip key={d.code} variant="soft">
                      <b className="num">{d.code}</b> {d.display}
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
              <Empty title="No visits yet" />
            ) : (
              <ol className="divide-y divide-separator">
                {encounters.map((e) => (
                  <li key={e.id}>
                    <Link to={`/encounters/${e.id}`} className="flex flex-col gap-1 px-5 py-3 hover:bg-surface-secondary sm:flex-row sm:items-center sm:gap-4">
                      <div className="w-40 shrink-0">
                        <div className="num text-sm text-muted">{formatDateTime(e.createdAt)}</div>
                        <div className="num text-[11px] text-muted">
                          {us ? "Acct" : "Spell"} {e.accountNumber}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">
                          {kindLabel(e.kind, region)} · {unitName(e.unitId)}
                          {e.admissionClass === "observation" && <span className="ml-1 text-xs text-warning">(observation)</span>}
                        </div>
                        <div className="truncate text-xs text-muted">
                          {e.diagnoses.length ? e.diagnoses.map((d) => `${d.code} ${d.display}`).join("; ") : e.chiefComplaint}
                          {e.disposition && ` · ${dispositionLabel(e.disposition, region)}`}
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
          {orders.length === 0 && (
            <Panel>
              <Empty title="No lab or imaging orders" />
            </Panel>
          )}
          {orders.map((o) => (
            <Panel
              key={o.id}
              title={`${o.kind === "lab" ? "Lab" : "Imaging"} · ${orderTitle(o)}`}
              description={`Ordered ${formatDateTime(o.orderedAt)} by ${staff.get(o.orderedBy)?.name ?? "—"}`}
              actions={<OrderStatusChip status={o.status} />}
            >
              <OrderResults order={o} />
            </Panel>
          ))}
        </Tabs.Panel>

        <Tabs.Panel id="meds" className="pt-4">
          <Panel flush>
            {prescriptions.length === 0 ? (
              <Empty title="No prescriptions" />
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
                          <b>{items.get(l.itemId)?.name}</b> — {l.dose} {l.route} {frequencyLabel(l.frequency, region)} × {l.days} days (qty {l.qty})
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
                <Empty title="No statements" />
              ) : (
                <ul className="divide-y divide-separator">
                  {invoices.map((inv) => (
                    <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                      <div>
                        <div className="num text-sm font-medium">{inv.number}</div>
                        <div className="text-xs text-muted">{formatDate(inv.createdAt)}</div>
                      </div>
                      <div className="num text-sm">
                        {formatMoney(invoiceTotal(inv))}
                        {inv.status === "open" && <span className="ml-2 text-danger">balance {formatMoney(invoiceBalance(inv))}</span>}
                      </div>
                      <InvoiceStatusChip status={inv.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </Tabs.Panel>
        )}

        <Tabs.Panel id="fhir" className="space-y-4 pt-4">
          <p className="text-sm text-muted">
            HL7 FHIR R4 resources as exposed by the facility FHIR API{us ? " (ONC (g)(10) certified, SMART on FHIR)" : " and GP Connect"}. Profile: <b className="num">{info.fhirProfile}</b>.
          </p>
          <CodeBlock caption={`FHIR R4 · ${info.fhirProfile} · Patient`} code={payloads.patient} />
          {payloads.bundle && latest ? (
            <CodeBlock
              caption={`FHIR R4 · ${info.fhirProfile} · Bundle (collection)`}
              note={`Latest encounter ${latest.accountNumber} — Patient + Encounter + Condition (${info.dxSystem})`}
              code={payloads.bundle}
            />
          ) : (
            <Panel>
              <Empty title="No encounter yet" description="An Encounter bundle appears after the first visit is registered." />
            </Panel>
          )}
        </Tabs.Panel>

        <Tabs.Panel id="hl7" className="space-y-4 pt-4">
          <p className="text-sm text-muted">
            HL7 v2.5.1 ADT message sent to the interface engine{us ? " and the regional HIE" : ", Spine-connected systems and SUS+ feeds"}. Segments are separated by carriage returns on the wire; shown one per line here.
          </p>
          {payloads.hl7 && latest ? (
            <CodeBlock
              caption={`HL7 v2.5.1 · ADT^${payloads.event} · ${payloads.event === "A01" ? "Admit / visit notification" : "Register a patient"}`}
              note={`${kindLabel(latest.kind, region)} · ${latest.accountNumber} · MSH-4 ${facility.code}`}
              code={payloads.hl7}
            />
          ) : (
            <Panel>
              <Empty title="No encounter yet" description="ADT messages are generated from registrations and admissions." />
            </Panel>
          )}
        </Tabs.Panel>
      </Tabs>

      {editing && <PatientForm isOpen onOpenChange={setEditing} patient={patient} />}
      {registering && <RegisterVisitDialog isOpen onOpenChange={setRegistering} patientId={patient.id} />}
      {addingAllergy && <AllergyDialog patientId={patient.id} onClose={() => setAddingAllergy(false)} />}
    </Page>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="label-caps shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  )
}

function CodeStatusPanel({ patientId, status, advanceDirective, region }: { patientId: string; status: CodeStatus; advanceDirective: boolean; region: Region }) {
  const { setCodeStatus } = useActions()
  const [next, setNext] = useState<CodeStatus>(status)
  const us = region === "us"
  return (
    <Panel title="Code status" description={us ? "Physician order required to change" : "Senior clinician decision, documented on ReSPECT"}>
      <div className="space-y-3">
        <div className={status === "full" ? "text-lg font-semibold" : "text-lg font-semibold text-band-dnr"}>{codeStatusLabel(status, region)}</div>
        <div className="text-xs text-muted">{us ? "Advance directive / POLST on file" : "ReSPECT form on file"}: <b className="text-foreground">{advanceDirective ? "Yes" : "No"}</b></div>
        <div className="flex items-end gap-2">
          <SelectInput label="Change to" value={next} onChange={setNext} options={codeStatusOptions(region)} className="flex-1" />
          <Button
            variant="secondary"
            isDisabled={next === status}
            onPress={() => {
              setCodeStatus(patientId, next)
              toast.success(`Code status: ${codeStatusLabel(next, region)}`)
            }}
          >
            Update
          </Button>
        </div>
      </div>
    </Panel>
  )
}

function AllergyDialog({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const { addAllergy } = useActions()
  const [substance, setSubstance] = useState("")
  const [reaction, setReaction] = useState("")
  const [severity, setSeverity] = useState<Allergy["severity"]>("moderate")
  const [type, setType] = useState<NonNullable<Allergy["type"]>>("allergy")
  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title="Add allergy"
      size="sm"
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={!substance.trim()}
            onPress={() => {
              addAllergy(patientId, { substance: substance.trim(), reaction: reaction.trim() || "Not specified", severity, type })
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <TextInput label="Substance / drug" value={substance} onChange={setSubstance} isRequired autoFocus description="e.g. Penicillin, Sulfa, Ibuprofen, Shellfish, Latex" />
      <TextInput label="Reaction" value={reaction} onChange={setReaction} placeholder="e.g. Hives, anaphylaxis" />
      <SelectInput label="Severity" value={severity} onChange={setSeverity} options={SEVERITY_OPTIONS} />
      <SelectInput label="Type" value={type} onChange={setType} options={ALLERGY_TYPE_OPTIONS} />
    </Dialog>
  )
}
