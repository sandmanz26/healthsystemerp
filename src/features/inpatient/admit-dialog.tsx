/**
 * Admit a patient to a bed — either from an ED/clinic decision to admit or as a planned
 * (elective) admission. US admissions choose inpatient vs outpatient observation status
 * (CMS Two-Midnight Rule) and record the payer's authorization number.
 */
import { Button } from "@heroui/react"
import { useMemo, useState } from "react"
import { Dialog } from "@/components/ui/dialog"
import { SelectInput, TextInput } from "@/components/ui/fields"
import { Segmented } from "@/components/ui/segmented"
import type { AdmissionClass, BedType, Encounter } from "@/domain/types"
import { PatientBanner } from "@/features/patients/patient-banner"
import { PatientPicker } from "@/features/patients/patient-picker"
import { dayKey } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"
import { useRegion, useUnitName } from "@/store/selectors"

export const BED_TYPE_LABEL: Record<BedType, string> = {
  "med-surg": "Med/Surg",
  telemetry: "Telemetry",
  icu: "ICU",
  isolation: "Isolation",
  private: "Private",
}

/** Specialties that do not admit patients under their own name. */
const NON_ADMITTING = ["Radiology", "Pathology", "Anesthesiology"]

interface AdmitDialogProps {
  /** The ED/clinic encounter that requested admission. */
  request?: Encounter
  /** Pre-selected bed (when admitting from an empty bed card). */
  bedId?: string
  onClose: () => void
  onAdmitted?: (encounterId: string) => void
}

export function AdmitDialog({ request, bedId: initialBed, onClose, onAdmitted }: AdmitDialogProps) {
  const beds = useStore((s) => s.beds)
  const staff = useStore((s) => s.staff)
  const patients = useStore((s) => s.patients)
  const region = useRegion()
  const us = region === "us"
  const unitName = useUnitName()
  const { admit } = useActions()
  const [patientId, setPatientId] = useState(request?.patientId)
  const [bedId, setBedId] = useState<string | null>(initialBed ?? null)
  const [doctorId, setDoctorId] = useState<string | null>(request?.practitionerId && staff.find((s) => s.id === request.practitionerId)?.specialty ? request.practitionerId : null)
  const [reason, setReason] = useState(request?.diagnoses.find((d) => d.primary)?.display ?? request?.chiefComplaint ?? "")
  const [admissionClass, setAdmissionClass] = useState<AdmissionClass>("inpatient")
  const [authNumber, setAuthNumber] = useState(request?.authNumber ?? "")
  const [edd, setEdd] = useState(() => dayKey(Date.now() + 3 * 86400000))
  const patient = patients.find((p) => p.id === patientId)
  const payer = request?.payer ?? patient?.payer

  const bedOptions = useMemo(
    () =>
      beds
        .filter((b) => b.status === "available" || b.status === "reserved" || b.id === initialBed)
        .map((b) => ({ value: b.id, label: `${b.code} · ${BED_TYPE_LABEL[b.bedType]}`, description: unitName(b.unitId) + (b.status === "reserved" ? " · assigned" : "") })),
    [beds, unitName, initialBed],
  )
  const doctors = staff.filter((s) => s.role === "doctor" && s.specialty && !NON_ADMITTING.includes(s.specialty))
  const needsAuth = us && admissionClass === "inpatient" && payer === "commercial" && !authNumber.trim()

  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      isDismissable={false}
      size="lg"
      title={request ? (us ? "Admit from admission request" : "Admit — decision to admit") : us ? "Direct / elective admission" : "Elective admission"}
      description={request?.dispositionNote}
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={!patientId || !bedId || !doctorId || !reason.trim()}
            onPress={() => {
              const id = admit({
                patientId: patientId!,
                bedId: bedId!,
                practitionerId: doctorId!,
                reason: reason.trim(),
                fromEncounterId: request?.id,
                admissionClass: us ? admissionClass : undefined,
                authNumber: authNumber.trim() || undefined,
                edd: edd ? new Date(`${edd}T12:00`).toISOString() : undefined,
              })
              toast.success(us && admissionClass === "observation" ? "Placed in observation" : "Patient admitted", { description: `${patient?.name} → ${beds.find((b) => b.id === bedId)?.code} · HL7 ADT^A01 queued` })
              onAdmitted?.(id)
              onClose()
            }}
          >
            {us && admissionClass === "observation" ? "Place in observation" : "Admit"}
          </Button>
        </>
      }
    >
      {patient ? <PatientBanner patient={patient} compact /> : <PatientPicker autoFocus onPick={(p) => setPatientId(p.id)} />}
      {us && (
        <div className="space-y-1.5">
          <Segmented
            label="Status"
            value={admissionClass}
            onChange={setAdmissionClass}
            options={[
              { value: "inpatient", label: "Inpatient" },
              { value: "observation", label: "Observation" },
            ]}
          />
          <p className="text-xs text-muted">
            <b>Two-Midnight Rule:</b> order inpatient status when the attending expects medically necessary hospital care to span at least two midnights; otherwise place in outpatient
            observation and reassess within 24–48 h.
          </p>
          <p className="label-caps text-muted">CMS 42 CFR §412.3 · Medicare Outpatient Observation Notice (MOON) required after 24 h in observation</p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label="Bed" value={bedId} onChange={setBedId} options={bedOptions} isRequired placeholder={bedOptions.length ? "Select a bed" : "No clean beds available"} />
        <SelectInput label={us ? "Attending physician" : "Responsible consultant"} value={doctorId} onChange={setDoctorId} options={doctors.map((d) => ({ value: d.id, label: d.name, description: d.specialty }))} isRequired placeholder="Select…" />
        <TextInput label="Admitting diagnosis / reason" value={reason} onChange={setReason} isRequired className="sm:col-span-2" />
        <TextInput label="Expected date of discharge (EDD)" type="date" value={edd} onChange={setEdd} />
        {us && <TextInput label="Prior authorization / pre-cert number" value={authNumber} onChange={setAuthNumber} placeholder="e.g. AUTH-24-118842" />}
      </div>
      {needsAuth && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground">
          Commercial payer without an authorization number. Most plans require notification within 24 h of an inpatient admission (X12 278) or the stay may be denied (CARC CO-197).
        </p>
      )}
      {!us && payer === "overseas" && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground">
          Chargeable overseas visitor — notify the Overseas Visitors Manager (NHS charging regulations 2015) before non-urgent treatment.
        </p>
      )}
    </Dialog>
  )
}

export function TransferDialog({ encounter, onClose }: { encounter: Encounter; onClose: () => void }) {
  const beds = useStore((s) => s.beds)
  const unitName = useUnitName()
  const { transferBed } = useActions()
  const [bedId, setBedId] = useState<string | null>(null)
  const options = beds.filter((b) => b.status === "available").map((b) => ({ value: b.id, label: `${b.code} · ${BED_TYPE_LABEL[b.bedType]}`, description: unitName(b.unitId) }))
  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title="Transfer bed"
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={!bedId}
            onPress={() => {
              transferBed(encounter.id, bedId!)
              toast.success("Patient transferred", { description: "The previous bed is marked dirty for EVS · HL7 ADT^A02 queued." })
              onClose()
            }}
          >
            Transfer
          </Button>
        </>
      }
    >
      <SelectInput label="Destination bed" value={bedId} onChange={setBedId} options={options} isRequired placeholder="Select a bed" />
    </Dialog>
  )
}
