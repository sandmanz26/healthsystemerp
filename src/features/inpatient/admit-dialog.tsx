/**
 * Admit a patient to a bed — either from an ER/outpatient admission request or as a
 * planned (elective) admission.
 */
import { Button } from "@heroui/react"
import { useMemo, useState } from "react"
import { Dialog } from "@/components/ui/dialog"
import { SelectInput, TextInput } from "@/components/ui/fields"
import type { Encounter } from "@/domain/types"
import { PatientBanner } from "@/features/patients/patient-banner"
import { PatientPicker } from "@/features/patients/patient-picker"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"
import { useUnitName } from "@/store/selectors"

interface AdmitDialogProps {
  /** The ER/outpatient encounter that requested admission. */
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
  const unitName = useUnitName()
  const { admit } = useActions()
  const [patientId, setPatientId] = useState(request?.patientId)
  const [bedId, setBedId] = useState<string | null>(initialBed ?? null)
  const [doctorId, setDoctorId] = useState<string | null>(request?.practitionerId && staff.find((s) => s.id === request.practitionerId)?.specialty ? request.practitionerId : null)
  const [reason, setReason] = useState(request?.diagnoses.find((d) => d.primary)?.display ?? request?.chiefComplaint ?? "")
  const patient = patients.find((p) => p.id === patientId)

  const bedOptions = useMemo(
    () =>
      beds
        .filter((b) => b.status === "available" || b.status === "reserved" || b.id === initialBed)
        .map((b) => ({ value: b.id, label: `${b.code} · ${b.bedClass}`, description: unitName(b.unitId) + (b.status === "reserved" ? " · dipesan" : "") })),
    [beds, unitName, initialBed],
  )
  const doctors = staff.filter((s) => s.role === "doctor" && s.specialty && !["Radiologi", "Patologi Klinik", "Anestesi"].includes(s.specialty))

  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      isDismissable={false}
      size="lg"
      title={request ? "Admisi dari permintaan rawat inap" : "Admisi rawat inap"}
      description={request?.dispositionNote}
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            isDisabled={!patientId || !bedId || !doctorId || !reason.trim()}
            onPress={() => {
              const id = admit({ patientId: patientId!, bedId: bedId!, practitionerId: doctorId!, reason: reason.trim(), fromEncounterId: request?.id })
              toast.success("Pasien diadmisi", { description: `${patient?.name} → ${beds.find((b) => b.id === bedId)?.code}` })
              onAdmitted?.(id)
              onClose()
            }}
          >
            Admisi
          </Button>
        </>
      }
    >
      {patient ? <PatientBanner patient={patient} compact /> : <PatientPicker autoFocus onPick={(p) => setPatientId(p.id)} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label="Tempat tidur" value={bedId} onChange={setBedId} options={bedOptions} isRequired placeholder={bedOptions.length ? "Pilih tempat tidur" : "Tidak ada tempat tidur kosong"} />
        <SelectInput label="DPJP" value={doctorId} onChange={setDoctorId} options={doctors.map((d) => ({ value: d.id, label: d.name, description: d.specialty }))} isRequired />
        <TextInput label="Diagnosis / alasan rawat" value={reason} onChange={setReason} isRequired className="sm:col-span-2" />
      </div>
      {patient?.payer === "bpjs" && <p className="text-xs text-muted">Peserta JKN kelas {patient.bpjsClass ?? "-"}. Ruang KRIS sesuai hak; naik kelas ke VIP memerlukan persetujuan selisih biaya.</p>}
    </Dialog>
  )
}

export function TransferDialog({ encounter, onClose }: { encounter: Encounter; onClose: () => void }) {
  const beds = useStore((s) => s.beds)
  const unitName = useUnitName()
  const { transferBed } = useActions()
  const [bedId, setBedId] = useState<string | null>(null)
  const options = beds.filter((b) => b.status === "available").map((b) => ({ value: b.id, label: `${b.code} · ${b.bedClass}`, description: unitName(b.unitId) }))
  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title="Pindah ruang"
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            isDisabled={!bedId}
            onPress={() => {
              transferBed(encounter.id, bedId!)
              toast.success("Pasien dipindahkan", { description: "Tempat tidur lama ditandai perlu dibersihkan." })
              onClose()
            }}
          >
            Pindahkan
          </Button>
        </>
      }
    >
      <SelectInput label="Tempat tidur tujuan" value={bedId} onChange={setBedId} options={options} isRequired />
    </Dialog>
  )
}
