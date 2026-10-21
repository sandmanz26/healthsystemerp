/**
 * New / edit patient. Validates NIK & BPJS number formats and warns about likely
 * duplicates (same NIK, or same name + date of birth) before a second record is created —
 * duplicate medical records are one of the most common MPI problems in hospitals.
 */
import { Button } from "@heroui/react"
import { AlertTriangle } from "lucide-react"
import { useMemo, useState } from "react"
import { Dialog } from "@/components/ui/dialog"
import { SelectInput, TextInput } from "@/components/ui/fields"
import type { Gender, Patient, PayerType } from "@/domain/types"
import { formatDate } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"

interface PatientFormProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /** Edit mode when provided. */
  patient?: Patient
  initialName?: string
  onSaved?: (patientId: string) => void
}

interface FormState {
  name: string
  nik: string
  gender: Gender | null
  birthDate: string
  phone: string
  address: string
  payer: PayerType
  bpjsNumber: string
  bpjsClass: "1" | "2" | "3"
  insurer: string
}

function initial(patient?: Patient, name = ""): FormState {
  return {
    name: patient?.name ?? name,
    nik: patient?.nik ?? "",
    gender: patient?.gender ?? null,
    birthDate: patient ? patient.birthDate.slice(0, 10) : "",
    phone: patient?.phone ?? "",
    address: patient?.address ?? "",
    payer: patient?.payer ?? "umum",
    bpjsNumber: patient?.bpjsNumber ?? "",
    bpjsClass: String(patient?.bpjsClass ?? 3) as "1" | "2" | "3",
    insurer: patient?.insurer ?? "",
  }
}

function validate(f: FormState): Partial<Record<keyof FormState, string>> {
  const e: Partial<Record<keyof FormState, string>> = {}
  if (f.name.trim().length < 3) e.name = "Nama minimal 3 huruf sesuai KTP"
  if (!/^\d{16}$/.test(f.nik)) e.nik = "NIK harus 16 digit angka"
  if (!f.gender) e.gender = "Pilih jenis kelamin"
  if (!f.birthDate) e.birthDate = "Tanggal lahir wajib diisi"
  else if (new Date(f.birthDate) > new Date()) e.birthDate = "Tanggal lahir tidak boleh di masa depan"
  if (f.payer === "bpjs" && !/^\d{13}$/.test(f.bpjsNumber)) e.bpjsNumber = "No. kartu BPJS harus 13 digit"
  if (f.payer === "asuransi" && !f.insurer.trim()) e.insurer = "Nama asuransi wajib diisi"
  return e
}

export function PatientForm({ isOpen, onOpenChange, patient, initialName, onSaved }: PatientFormProps) {
  const patients = useStore((s) => s.patients)
  const { createPatient, updatePatient } = useActions()
  const [form, setForm] = useState<FormState>(() => initial(patient, initialName))
  const [submitted, setSubmitted] = useState(false)
  const errors = validate(form)
  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const duplicates = useMemo(() => {
    if (patient) return []
    return patients.filter((p) => (form.nik.length === 16 && p.nik === form.nik) || (form.birthDate && p.birthDate.slice(0, 10) === form.birthDate && p.name.toLowerCase() === form.name.trim().toLowerCase()))
  }, [patients, form.nik, form.birthDate, form.name, patient])

  const save = () => {
    setSubmitted(true)
    if (Object.keys(errors).length) return
    const data = {
      name: form.name.trim(),
      nik: form.nik,
      gender: form.gender!,
      birthDate: new Date(form.birthDate).toISOString(),
      phone: form.phone,
      address: form.address,
      payer: form.payer,
      bpjsNumber: form.payer === "bpjs" ? form.bpjsNumber : undefined,
      bpjsClass: form.payer === "bpjs" ? (Number(form.bpjsClass) as 1 | 2 | 3) : undefined,
      insurer: form.payer === "asuransi" ? form.insurer : undefined,
      allergies: patient?.allergies ?? [],
    }
    if (patient) {
      updatePatient(patient.id, data)
      toast.success("Data pasien diperbarui")
      onSaved?.(patient.id)
    } else {
      const id = createPatient(data)
      toast.success("Pasien baru terdaftar", { description: data.name })
      onSaved?.(id)
    }
    onOpenChange(false)
  }

  const err = (k: keyof FormState) => (submitted ? errors[k] : undefined)

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={false}
      size="lg"
      title={patient ? "Ubah data pasien" : "Pasien baru"}
      description="Isi sesuai KTP / KIA. Kolom bertanda * wajib."
      footer={
        <>
          <Button variant="tertiary" onPress={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button variant="primary" onPress={save}>
            {patient ? "Simpan perubahan" : "Daftarkan pasien"}
          </Button>
        </>
      }
    >
      {duplicates.length > 0 && (
        <div className="flex gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning-soft-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <b>Kemungkinan pasien ganda.</b> Sudah ada:{" "}
            {duplicates.map((d) => `${d.name} (RM ${d.mrn}, lahir ${formatDate(d.birthDate)})`).join("; ")}. Periksa sebelum membuat rekam medis baru.
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Nama lengkap" value={form.name} onChange={set("name")} isRequired error={err("name")} className="sm:col-span-2" autoFocus />
        <TextInput label="NIK" value={form.nik} onChange={(v) => set("nik")(v.replace(/\D/g, "").slice(0, 16))} isRequired inputMode="numeric" error={err("nik")} description={`${form.nik.length}/16 digit`} />
        <SelectInput
          label="Jenis kelamin"
          value={form.gender}
          onChange={set("gender")}
          isRequired
          error={err("gender")}
          options={[
            { value: "male", label: "Laki-laki" },
            { value: "female", label: "Perempuan" },
          ]}
        />
        <TextInput label="Tanggal lahir" type="date" value={form.birthDate} onChange={set("birthDate")} isRequired error={err("birthDate")} />
        <TextInput label="No. HP" type="tel" value={form.phone} onChange={set("phone")} inputMode="tel" />
        <TextInput label="Alamat" value={form.address} onChange={set("address")} className="sm:col-span-2" />
        <SelectInput
          label="Penjamin"
          value={form.payer}
          onChange={set("payer")}
          isRequired
          options={[
            { value: "bpjs", label: "BPJS Kesehatan (JKN)" },
            { value: "umum", label: "Umum / bayar sendiri" },
            { value: "asuransi", label: "Asuransi swasta" },
          ]}
        />
        {form.payer === "bpjs" && (
          <>
            <TextInput label="No. kartu BPJS" value={form.bpjsNumber} onChange={(v) => set("bpjsNumber")(v.replace(/\D/g, "").slice(0, 13))} inputMode="numeric" isRequired error={err("bpjsNumber")} />
            <SelectInput
              label="Hak kelas"
              value={form.bpjsClass}
              onChange={set("bpjsClass")}
              options={[
                { value: "1", label: "Kelas 1" },
                { value: "2", label: "Kelas 2" },
                { value: "3", label: "Kelas 3" },
              ]}
            />
          </>
        )}
        {form.payer === "asuransi" && <TextInput label="Nama asuransi" value={form.insurer} onChange={set("insurer")} isRequired error={err("insurer")} />}
      </div>
    </Dialog>
  )
}
