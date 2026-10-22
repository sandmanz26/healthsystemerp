/**
 * Register a visit (rawat jalan or IGD). Built for the registration desk: patient search
 * first, sensible defaults (payer from the patient record, today's doctor for the chosen
 * poli with remaining quota), and BPJS details only when they matter.
 */
import { Button, Chip } from "@heroui/react"
import { Printer, ShieldCheck } from "lucide-react"
import { useMemo, useState } from "react"
import { QueueTicket } from "@/components/clinical/queue-ticket"
import { Dialog } from "@/components/ui/dialog"
import { SelectInput, TextInput } from "@/components/ui/fields"
import { PatientBanner } from "@/features/patients/patient-banner"
import { PatientForm } from "@/features/patients/patient-form"
import { PatientPicker } from "@/features/patients/patient-picker"
import type { Encounter, PayerType } from "@/domain/types"
import { dayKey, formatTime } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"
import { useModuleEnabled } from "@/store/selectors"

interface RegisterVisitDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  patientId?: string
  kind?: "outpatient" | "emergency"
  appointmentId?: string
  onRegistered?: (encounterId: string) => void
}

export function RegisterVisitDialog({ isOpen, onOpenChange, patientId: initialPatient, kind: initialKind = "outpatient", appointmentId, onRegistered }: RegisterVisitDialogProps) {
  const patients = useStore((s) => s.patients)
  const units = useStore((s) => s.units)
  const staff = useStore((s) => s.staff)
  const schedules = useStore((s) => s.schedules)
  const encounters = useStore((s) => s.encounters)
  const appointment = useStore((s) => s.appointments.find((a) => a.id === appointmentId))
  const bpjsOn = useModuleEnabled("bpjs")
  const erOn = useModuleEnabled("emergency")
  const { registerVisit } = useActions()

  const [patientId, setPatientId] = useState(initialPatient ?? appointment?.patientId)
  const [kind, setKind] = useState<"outpatient" | "emergency">(initialKind)
  const [unitId, setUnitId] = useState<string | null>(appointment?.unitId ?? null)
  const [doctorId, setDoctorId] = useState<string | null>(appointment?.practitionerId ?? null)
  const patient = patients.find((p) => p.id === patientId)
  const [payer, setPayer] = useState<PayerType>(patient?.payer ?? "umum")
  const [complaint, setComplaint] = useState("")
  const [referral, setReferral] = useState("")
  const [creating, setCreating] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [done, setDone] = useState<Encounter>()
  const registered = useStore((s) => s.encounters.find((e) => e.id === done?.id))

  const today = new Date().getDay()
  const polis = units.filter((u) => u.kind === "poli")
  const doctorOptions = useMemo(() => {
    if (!unitId) return []
    const todays = schedules.filter((s) => s.unitId === unitId && s.weekday === today)
    return todays.map((s) => {
      const used = encounters.filter((e) => e.practitionerId === s.practitionerId && e.unitId === unitId && dayKey(e.createdAt) === dayKey() && e.status !== "cancelled").length
      const doc = staff.find((x) => x.id === s.practitionerId)!
      return { value: doc.id, label: doc.name, description: `${s.start}–${s.end} · kuota ${used}/${s.quota}${used >= s.quota ? " (penuh)" : ""}` }
    })
  }, [unitId, schedules, encounters, staff, today])

  const pickPatient = (id: string) => {
    setPatientId(id)
    // Read from the store directly: a patient created a moment ago is not in this render's list yet.
    const p = useStore.getState().patients.find((x) => x.id === id)
    if (p) setPayer(p.payer)
  }

  const needsReferral = payer === "bpjs" && kind === "outpatient" && unitId !== null && unitId !== "poli-umum" && unitId !== "poli-gigi"
  const errors = {
    patient: !patientId ? "Pilih pasien" : undefined,
    unit: kind === "outpatient" && !unitId ? "Pilih poli tujuan" : undefined,
    complaint: complaint.trim().length < 3 ? "Isi keluhan utama" : undefined,
  }
  const valid = !Object.values(errors).some(Boolean)

  const submit = () => {
    setSubmitted(true)
    if (!valid || !patientId) return
    const id = registerVisit({
      patientId,
      kind,
      unitId: kind === "emergency" ? "igd" : unitId!,
      practitionerId: kind === "outpatient" ? doctorId ?? doctorOptions[0]?.value : undefined,
      payer,
      complaint: complaint.trim(),
      referralNumber: referral || undefined,
      appointmentId,
    })
    setDone({ id } as Encounter)
    onRegistered?.(id)
    toast.success("Kunjungan terdaftar")
  }

  if (registered && patient) {
    return (
      <Dialog
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        title="Kunjungan terdaftar"
        size="sm"
        footer={
          <>
            <Button variant="tertiary" onPress={() => onOpenChange(false)}>
              Selesai
            </Button>
            <Button variant="primary" onPress={() => window.print()}>
              <Printer className="size-4" aria-hidden />
              Cetak tiket
            </Button>
          </>
        }
      >
        <div className="print-area rounded-2xl border border-dashed border-border p-5 text-center">
          <div className="text-xs uppercase tracking-wide text-muted">{units.find((u) => u.id === registered.unitId)?.name}</div>
          <div className="my-3">
            <QueueTicket number={registered.queueNumber} tone="accent" size="lg" />
          </div>
          <div className="font-semibold">{patient.name}</div>
          <div className="tabular text-sm text-muted">RM {patient.mrn}</div>
          <div className="mt-2 text-xs text-muted">Terdaftar {formatTime(registered.createdAt)}</div>
          {registered.sepNumber && (
            <Chip size="sm" color="success" variant="soft" className="mt-3">
              <ShieldCheck className="size-3.5" aria-hidden /> SEP {registered.sepNumber}
            </Chip>
          )}
        </div>
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
        title={kind === "emergency" ? "Daftar pasien IGD" : "Daftar kunjungan rawat jalan"}
        description={kind === "emergency" ? "Triase dilakukan perawat IGD setelah pendaftaran. Identitas lengkap bisa menyusul." : undefined}
        footer={
          <>
            <Button variant="tertiary" onPress={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button variant="primary" onPress={submit}>
              Daftarkan
            </Button>
          </>
        }
      >
        {erOn && !appointmentId && (
          <SelectInput
            label="Jenis kunjungan"
            value={kind}
            onChange={setKind}
            options={[
              { value: "outpatient", label: "Rawat jalan (poli)" },
              { value: "emergency", label: "IGD" },
            ]}
          />
        )}

        {patient ? (
          <div className="space-y-2">
            <PatientBanner patient={patient} compact />
            {!initialPatient && !appointmentId && (
              <Button size="sm" variant="ghost" onPress={() => setPatientId(undefined)}>
                Ganti pasien
              </Button>
            )}
          </div>
        ) : (
          <div>
            <div className="mb-1.5 text-sm font-medium">Pasien</div>
            <PatientPicker autoFocus onPick={(p) => pickPatient(p.id)} onCreateNew={(q) => setCreating(q)} />
            {submitted && errors.patient && <p className="mt-1 text-xs text-danger">{errors.patient}</p>}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {kind === "outpatient" && (
            <>
              <SelectInput label="Poli tujuan" value={unitId} onChange={(v) => { setUnitId(v); setDoctorId(null) }} options={polis.map((u) => ({ value: u.id, label: u.name }))} isRequired error={submitted ? errors.unit : undefined} />
              <SelectInput
                label="Dokter"
                value={doctorId ?? doctorOptions[0]?.value ?? null}
                onChange={setDoctorId}
                options={doctorOptions}
                isDisabled={!unitId || doctorOptions.length === 0}
                placeholder={unitId && doctorOptions.length === 0 ? "Tidak ada jadwal hari ini" : "Pilih dokter"}
                description={unitId && doctorOptions.length === 0 ? "Poli ini tidak praktik hari ini." : undefined}
              />
            </>
          )}
          <SelectInput
            label="Penjamin kunjungan ini"
            value={payer}
            onChange={setPayer}
            options={[
              { value: "bpjs", label: "BPJS Kesehatan", description: patient?.bpjsNumber ? `No. ${patient.bpjsNumber}` : "No. kartu belum tercatat" },
              { value: "umum", label: "Umum" },
              { value: "asuransi", label: "Asuransi", description: patient?.insurer },
            ]}
          />
          {needsReferral && <TextInput label="No. rujukan FKTP" value={referral} onChange={setReferral} description="Wajib untuk poli spesialis peserta JKN" />}
          <TextInput label="Keluhan utama" value={complaint} onChange={setComplaint} isRequired error={submitted ? errors.complaint : undefined} className="sm:col-span-2" placeholder="mis. demam 3 hari" />
        </div>

        {payer === "bpjs" && (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="size-3.5" aria-hidden />
            {bpjsOn ? "SEP diterbitkan otomatis lewat V-Claim saat pendaftaran." : "Modul Bridging BPJS belum aktif — SEP diterbitkan manual di aplikasi BPJS."}
          </p>
        )}
      </Dialog>
      {creating !== null && (
        <PatientForm
          isOpen
          initialName={/^\d+$/.test(creating) ? "" : creating}
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
