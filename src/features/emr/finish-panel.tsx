/**
 * Close the encounter with a disposition. The checklist mirrors what RME rules and claim
 * verification will ask later, so problems are fixed now instead of bouncing back.
 */
import { Button } from "@heroui/react"
import { CheckCircle2, Circle, CircleAlert, Printer } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { SelectInput, TextAreaInput } from "@/components/ui/fields"
import { Panel } from "@/components/ui/panel"
import type { Disposition, Encounter } from "@/domain/types"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"
import { useModuleEnabled } from "@/store/selectors"
import { DischargeSummary } from "./discharge-summary"

const DISPOSITION_LABEL: Record<Disposition, string> = {
  pulang: "Pulang",
  kontrol: "Pulang, kontrol ulang",
  rujuk: "Rujuk ke faskes lain",
  "rawat-inap": "Rawat inap",
  meninggal: "Meninggal",
  "pulang-aps": "Pulang atas permintaan sendiri (APS)",
}

const OPTIONS: Record<Encounter["kind"], Disposition[]> = {
  outpatient: ["pulang", "kontrol", "rujuk", "rawat-inap"],
  emergency: ["pulang", "rawat-inap", "rujuk", "pulang-aps", "meninggal"],
  inpatient: ["pulang", "kontrol", "rujuk", "pulang-aps", "meninggal"],
}

export function FinishPanel({ encounter }: { encounter: Encounter }) {
  const { finishEncounter, discharge, callPatient, startEncounter } = useActions()
  const patient = useStore((s) => s.patients.find((p) => p.id === encounter.patientId))
  const navigate = useNavigate()
  // Select the stable collections, then filter: a selector returning a new array each call
  // would re-render forever.
  const allOrders = useStore((s) => s.orders)
  const allRx = useStore((s) => s.prescriptions)
  const orders = allOrders.filter((o) => o.encounterId === encounter.id)
  const rx = allRx.filter((p) => p.encounterId === encounter.id)
  const inpatientOn = useModuleEnabled("inpatient")
  const [disposition, setDisposition] = useState<Disposition | null>(null)
  const [note, setNote] = useState("")
  const options = OPTIONS[encounter.kind].filter((d) => d !== "rawat-inap" || inpatientOn)

  const checks = [
    { ok: encounter.diagnoses.some((d) => d.primary), label: "Diagnosis utama (ICD-10)", required: true },
    { ok: encounter.notes.some((n) => n.role === "doctor"), label: "CPPT / resume dokter", required: true },
    { ok: encounter.payer !== "bpjs" || !!encounter.sepNumber, label: "SEP BPJS", required: false },
    { ok: !orders.some((o) => o.status !== "validated" && o.status !== "cancelled"), label: "Semua hasil penunjang keluar", required: false },
    { ok: !rx.some((p) => p.status === "new"), label: "Resep sudah diproses farmasi", required: false },
  ]
  const blocked = checks.some((c) => c.required && !c.ok)

  if (encounter.status === "finished" || encounter.status === "cancelled") {
    return (
      <Panel title="Kunjungan selesai">
        <p className="text-sm">
          Disposisi: <b>{encounter.disposition ? DISPOSITION_LABEL[encounter.disposition] : "Dibatalkan"}</b>
        </p>
        {encounter.dispositionNote && <p className="mt-1 text-sm text-muted">{encounter.dispositionNote}</p>}
        {encounter.status === "finished" && patient && (
          <>
            <Button className="mt-3" variant="tertiary" fullWidth onPress={() => window.print()}>
              <Printer className="size-4" aria-hidden /> Cetak resume medis
            </Button>
            <DischargeSummary encounter={encounter} patient={patient} dispositionLabel={encounter.disposition ? DISPOSITION_LABEL[encounter.disposition] : "-"} />
          </>
        )}
      </Panel>
    )
  }
  if (encounter.status === "awaiting-admission") {
    return (
      <Panel title="Menunggu tempat tidur">
        <p className="text-sm text-muted">Permintaan rawat inap sudah dikirim. Admisi dilakukan dari halaman Rawat Inap.</p>
        {inpatientOn && (
          <Button className="mt-3" variant="secondary" fullWidth onPress={() => navigate("/inpatient")}>
            Buka bed board
          </Button>
        )}
      </Panel>
    )
  }

  const submit = () => {
    if (!disposition) return
    if (encounter.kind === "inpatient") discharge(encounter.id, disposition, note || undefined)
    else finishEncounter(encounter.id, disposition, note || undefined)
    // Poli rhythm: finish → call the next patient in one tap, without going back to the list.
    const next =
      encounter.kind === "outpatient"
        ? useStore
            .getState()
            .encounters.filter((e) => e.kind === "outpatient" && e.unitId === encounter.unitId && e.practitionerId === encounter.practitionerId && e.status === "registered")
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
        : undefined
    toast.success(disposition === "rawat-inap" ? "Permintaan rawat inap dikirim" : "Kunjungan selesai", {
      description: DISPOSITION_LABEL[disposition],
      actionProps: next
        ? {
            children: `Panggil ${next.queueNumber}`,
            onPress: () => {
              callPatient(next.id)
              startEncounter(next.id)
              navigate(`/encounters/${next.id}`)
            },
          }
        : undefined,
      timeout: next ? 8000 : undefined,
    })
    navigate(encounter.kind === "outpatient" ? "/outpatient" : encounter.kind === "emergency" ? "/emergency" : "/inpatient")
  }

  return (
    <Panel title={encounter.kind === "inpatient" ? "Pulangkan pasien" : "Selesaikan kunjungan"}>
      <ul className="mb-4 space-y-1.5 text-sm">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2">
            {c.ok ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : c.required ? <CircleAlert className="size-4 text-danger" aria-hidden /> : <Circle className="size-4 text-muted" aria-hidden />}
            <span className={!c.ok && c.required ? "font-medium text-danger" : undefined}>
              {c.label}
              {!c.ok && !c.required && <span className="text-muted"> (opsional)</span>}
            </span>
          </li>
        ))}
      </ul>
      <div className="space-y-3">
        <SelectInput label="Disposisi" value={disposition} onChange={setDisposition} options={options.map((d) => ({ value: d, label: DISPOSITION_LABEL[d] }))} isRequired />
        <TextAreaInput label="Catatan" value={note} onChange={setNote} rows={2} placeholder={disposition === "rujuk" ? "Faskes tujuan & alasan rujuk" : disposition === "rawat-inap" ? "Ruangan / kelas yang diminta" : "Opsional"} />
        <Button variant="primary" fullWidth isDisabled={!disposition || blocked} onPress={submit}>
          {blocked ? "Lengkapi yang wajib dulu" : encounter.kind === "inpatient" ? "Pulangkan" : "Selesaikan"}
        </Button>
      </div>
    </Panel>
  )
}
