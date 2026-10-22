/**
 * Register a visit (clinic or ED arrival). Built for the front desk: patient search first,
 * sensible defaults (payer class from the patient record, today's provider for the chosen
 * clinic with remaining slots), and referral details only when they matter. After
 * registration it shows the ticket plus the eligibility result (X12 271 / PDS trace) and,
 * for self-pay or chargeable patients, the cost estimate.
 */
import { Button } from "@heroui/react"
import { Printer } from "lucide-react"
import { useMemo, useState } from "react"
import { QueueTicket } from "@v2/components/clinical/queue-ticket"
import { Dialog } from "@v2/components/ui/dialog"
import { SelectInput, TextInput } from "@v2/components/ui/fields"
import { PAYER_LABEL, PAYERS_BY_REGION } from "@v2/domain/finance"
import type { Encounter, PayerType } from "@v2/domain/types"
import { PatientBanner } from "@v2/features/patients/patient-banner"
import { PatientForm } from "@v2/features/patients/patient-form"
import { PatientPicker } from "@v2/features/patients/patient-picker"
import { dayKey, formatTime } from "@v2/lib/format"
import { toast } from "@v2/lib/toast"
import { useActions, useStore } from "@v2/store"
import { useModuleEnabled, useRegion } from "@v2/store/selectors"
import { CostEstimate, EligibilityCard } from "./eligibility"

interface RegisterVisitDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  patientId?: string
  kind?: "outpatient" | "emergency"
  appointmentId?: string
  onRegistered?: (encounterId: string) => void
}

/** Clinics a patient can self-refer to; other specialty clinics need a referral. */
const PRIMARY_CARE = new Set(["clinic-fm", "clinic-im", "clinic-peds"])

export function RegisterVisitDialog({ isOpen, onOpenChange, patientId: initialPatient, kind: initialKind = "outpatient", appointmentId, onRegistered }: RegisterVisitDialogProps) {
  const region = useRegion()
  const patients = useStore((s) => s.patients)
  const units = useStore((s) => s.units)
  const staff = useStore((s) => s.staff)
  const schedules = useStore((s) => s.schedules)
  const encounters = useStore((s) => s.encounters)
  const appointment = useStore((s) => s.appointments.find((a) => a.id === appointmentId))
  const payerOn = useModuleEnabled("payer")
  const edOn = useModuleEnabled("emergency")
  const { registerVisit } = useActions()
  const us = region === "us"

  const [patientId, setPatientId] = useState(initialPatient ?? appointment?.patientId)
  const [kind, setKind] = useState<"outpatient" | "emergency">(initialKind)
  const [unitId, setUnitId] = useState<string | null>(appointment?.unitId ?? null)
  const [doctorId, setDoctorId] = useState<string | null>(appointment?.practitionerId ?? null)
  const patient = patients.find((p) => p.id === patientId)
  const [payer, setPayer] = useState<PayerType>(patient?.payer ?? (us ? "self-pay" : "nhs"))
  const [complaint, setComplaint] = useState("")
  const [referral, setReferral] = useState("")
  const [creating, setCreating] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [done, setDone] = useState<Encounter>()
  const registered = useStore((s) => s.encounters.find((e) => e.id === done?.id))

  const today = new Date().getDay()
  const clinics = units.filter((u) => u.kind === "clinic")
  const doctorOptions = useMemo(() => {
    if (!unitId) return []
    const todays = schedules.filter((s) => s.unitId === unitId && s.weekday === today)
    return todays.map((s) => {
      const used = encounters.filter((e) => e.practitionerId === s.practitionerId && e.unitId === unitId && dayKey(e.createdAt) === dayKey() && e.status !== "cancelled").length
      const doc = staff.find((x) => x.id === s.practitionerId)!
      return { value: doc.id, label: doc.name, description: `${s.start}–${s.end} · ${used}/${s.quota} booked${used >= s.quota ? " (full)" : ""}` }
    })
  }, [unitId, schedules, encounters, staff, today])

  const established = useMemo(() => encounters.some((e) => e.patientId === patientId && e.kind === "outpatient" && e.status === "finished"), [encounters, patientId])

  const pickPatient = (id: string) => {
    setPatientId(id)
    // Read from the store directly: a patient created a moment ago is not in this render's list yet.
    const p = useStore.getState().patients.find((x) => x.id === id)
    if (p) setPayer(p.payer)
  }

  // US: HMO / managed-care plans require a PCP referral for specialty clinics.
  // UK: consultant-led outpatient clinics are booked from a GP referral via NHS e-RS (12-digit UBRN).
  const specialty = kind === "outpatient" && unitId !== null && !PRIMARY_CARE.has(unitId)
  const needsReferral = specialty && (us ? payer === "medicaid" || payer === "commercial" : payer === "nhs")
  const referralError = !us && needsReferral && referral && !/^\d{12}$/.test(referral.replace(/\s/g, "")) ? "UBRN is 12 digits" : undefined
  const errors = {
    patient: !patientId ? "Select a patient" : undefined,
    unit: kind === "outpatient" && !unitId ? "Select a clinic" : undefined,
    complaint: complaint.trim().length < 3 ? "Enter the reason for visit" : undefined,
    referral: referralError,
  }
  const valid = !Object.values(errors).some(Boolean)

  const submit = () => {
    setSubmitted(true)
    if (!valid || !patientId) return
    const id = registerVisit({
      patientId,
      kind,
      unitId: kind === "emergency" ? "ed" : unitId!,
      practitionerId: kind === "outpatient" ? doctorId ?? doctorOptions[0]?.value : undefined,
      payer,
      complaint: complaint.trim(),
      referralNumber: referral.replace(/\s/g, "") || undefined,
      appointmentId,
    })
    setDone({ id } as Encounter)
    onRegistered?.(id)
    toast.success(kind === "emergency" ? (us ? "ED arrival registered" : "A&E arrival registered") : "Visit registered")
  }

  if (registered && patient) {
    return (
      <Dialog
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        title="Visit registered"
        size="sm"
        footer={
          <>
            <Button variant="tertiary" onPress={() => onOpenChange(false)}>
              Done
            </Button>
            <Button variant="primary" onPress={() => window.print()}>
              <Printer className="size-4" aria-hidden />
              Print ticket
            </Button>
          </>
        }
      >
        <div className="print-area rounded-lg border border-dashed border-border p-5 text-center">
          <div className="label-caps text-muted">{units.find((u) => u.id === registered.unitId)?.name}</div>
          <div className="my-3">
            <QueueTicket number={registered.queueNumber} tone="accent" size="lg" />
          </div>
          <div className="font-semibold">{patient.name}</div>
          <div className="num text-sm text-muted">MRN {patient.mrn}</div>
          <div className="num mt-1 text-xs text-muted">
            {us ? "Acct" : "Spell"} {registered.accountNumber} · registered {formatTime(registered.createdAt)}
          </div>
          <div className="label-caps mt-2 text-muted">HL7 ADT^A04 sent</div>
        </div>
        <EligibilityCard encounter={registered} patient={patient} region={region} />
        <CostEstimate kind={registered.kind === "emergency" ? "emergency" : "outpatient"} payer={registered.payer} established={established} region={region} />
      </Dialog>
    )
  }

  return (
    <>
      <Dialog
        isOpen={isOpen && !creating}
        onOpenChange={onOpenChange}
        isDismissable={false}
        size="lg"
        title={kind === "emergency" ? (us ? "Register ED arrival" : "Register A&E arrival") : "Register clinic visit"}
        description={
          kind === "emergency"
            ? us
              ? "Quick registration — triage follows immediately. EMTALA: never delay the screening exam to collect insurance or payment."
              : "Quick registration — triage follows within 15 minutes. Full demographics can be completed later."
            : undefined
        }
        footer={
          <>
            <Button variant="tertiary" onPress={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" onPress={submit}>
              Register
            </Button>
          </>
        }
      >
        {edOn && !appointmentId && (
          <SelectInput
            label="Visit type"
            value={kind}
            onChange={setKind}
            options={[
              { value: "outpatient", label: "Outpatient clinic" },
              { value: "emergency", label: us ? "Emergency department" : "A&E (emergency department)" },
            ]}
          />
        )}

        {patient ? (
          <div className="space-y-2">
            <PatientBanner patient={patient} compact />
            {!initialPatient && !appointmentId && (
              <Button size="sm" variant="ghost" onPress={() => setPatientId(undefined)}>
                Change patient
              </Button>
            )}
          </div>
        ) : (
          <div>
            <div className="mb-1.5 text-sm font-medium">Patient</div>
            <PatientPicker autoFocus onPick={(p) => pickPatient(p.id)} onCreateNew={(q) => setCreating(q)} />
            {submitted && errors.patient && <p className="mt-1 text-xs text-danger">{errors.patient}</p>}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {kind === "outpatient" && (
            <>
              <SelectInput
                label="Clinic"
                value={unitId}
                onChange={(v) => {
                  setUnitId(v)
                  setDoctorId(null)
                }}
                options={clinics.map((u) => ({ value: u.id, label: u.name }))}
                placeholder="Select…"
                isRequired
                error={submitted ? errors.unit : undefined}
              />
              <SelectInput
                label="Provider"
                value={doctorId ?? doctorOptions[0]?.value ?? null}
                onChange={setDoctorId}
                options={doctorOptions}
                isDisabled={!unitId || doctorOptions.length === 0}
                placeholder={unitId && doctorOptions.length === 0 ? "No session today" : "Select provider"}
                description={unitId && doctorOptions.length === 0 ? "This clinic has no session today." : undefined}
              />
            </>
          )}
          <SelectInput
            label={us ? "Payer for this visit" : "Funding for this visit"}
            value={payer}
            onChange={setPayer}
            options={PAYERS_BY_REGION[region].map((p) => ({
              value: p,
              label: PAYER_LABEL[p],
              description: p === patient?.payer && patient.coverage && p !== "overseas" ? `${patient.coverage.payerName} · ${patient.coverage.memberId}` : p === "nhs" && patient?.nhsNumber ? "NHS number on file" : undefined,
            }))}
          />
          {needsReferral && (
            <TextInput
              label={us ? "Referral number" : "e-RS UBRN"}
              value={referral}
              onChange={setReferral}
              inputMode={us ? "text" : "numeric"}
              error={submitted ? errors.referral : undefined}
              description={us ? "PCP referral required by HMO / managed-care plans for specialty visits" : "Unique Booking Reference Number from the GP referral (NHS e-Referral Service)"}
            />
          )}
          <TextInput
            label={kind === "emergency" ? "Chief complaint" : "Reason for visit"}
            value={complaint}
            onChange={setComplaint}
            isRequired
            error={submitted ? errors.complaint : undefined}
            className="sm:col-span-2"
            placeholder={kind === "emergency" ? "e.g. chest pain, 2 hours" : "e.g. follow-up for hypertension"}
          />
        </div>

        <CostEstimate kind={kind} payer={payer} established={established} region={region} />
        {!(payer === "self-pay" || payer === "overseas") && (
          <p className="label-caps text-muted">
            {payerOn ? (us ? "Real-time eligibility (X12 270/271) runs on registration" : payer === "nhs" ? "PDS trace runs on registration" : "Insurer pre-authorisation is checked by the private patients office") : us ? "Payer connectivity off — verify eligibility manually" : "Spine connectivity off — trace NHS number manually"}
          </p>
        )}
      </Dialog>
      {creating !== null && (
        <PatientForm
          isOpen
          initialName={/^[\d\s-]+$/.test(creating) ? "" : creating}
          onOpenChange={(o) => !o && setCreating(null)}
          onSaved={(id) => {
            pickPatient(id)
            setCreating(null)
          }}
        />
      )}
    </>
  )
}
