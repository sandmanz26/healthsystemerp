/**
 * Resume medis (discharge summary) — printable. Required in the medical record and attached
 * to every JKN claim, so it is generated from what was charted rather than retyped.
 */
import type { Encounter, Patient } from "@/domain/types"
import { formatDate, formatDateTime } from "@/lib/format"
import { useStore } from "@/store"
import { useInventoryMap, useStaffMap, useUnitName } from "@/store/selectors"

const KIND = { outpatient: "Rawat jalan", emergency: "Gawat darurat", inpatient: "Rawat inap" }

export function DischargeSummary({ encounter, patient, dispositionLabel }: { encounter: Encounter; patient: Patient; dispositionLabel: string }) {
  const facility = useStore((s) => s.facility)
  const allRx = useStore((s) => s.prescriptions)
  const staff = useStaffMap()
  const items = useInventoryMap()
  const unitName = useUnitName()
  const lastDoctorNote = [...encounter.notes].filter((n) => n.role === "doctor").sort((a, b) => b.at.localeCompare(a.at))[0]
  const meds = allRx.filter((r) => r.encounterId === encounter.id && r.status !== "cancelled").flatMap((r) => r.items)

  return (
    <div className="print-area hidden space-y-3 p-8 text-sm text-black print:block">
      <div className="border-b border-black pb-2">
        <div className="text-lg font-bold">{facility.name}</div>
        <div>RESUME MEDIS — {KIND[encounter.kind]}</div>
      </div>
      <table className="w-full">
        <tbody>
          <tr><td className="w-40">Nama / No. RM</td><td>{patient.name} / {patient.mrn}</td></tr>
          <tr><td>Tanggal lahir</td><td>{formatDate(patient.birthDate)} ({patient.gender === "female" ? "P" : "L"})</td></tr>
          <tr><td>Masuk / keluar</td><td>{formatDateTime(encounter.startedAt ?? encounter.createdAt)} — {encounter.endedAt ? formatDateTime(encounter.endedAt) : "-"}</td></tr>
          <tr><td>Unit / DPJP</td><td>{unitName(encounter.unitId)} / {staff.get(encounter.practitionerId ?? "")?.name ?? "-"}</td></tr>
          {encounter.sepNumber && <tr><td>No. SEP</td><td>{encounter.sepNumber}</td></tr>}
        </tbody>
      </table>
      <div><b>Keluhan utama:</b> {encounter.chiefComplaint}</div>
      {lastDoctorNote && (
        <div>
          <b>Ringkasan:</b> {lastDoctorNote.subjective} {lastDoctorNote.objective}
        </div>
      )}
      <div>
        <b>Diagnosis:</b>
        <ul className="list-inside list-disc">
          {encounter.diagnoses.map((d) => (
            <li key={d.code}>{d.code} {d.display}{d.primary ? " (utama)" : ""}</li>
          ))}
        </ul>
      </div>
      {encounter.procedures.length > 0 && (
        <div><b>Tindakan:</b> {encounter.procedures.map((p) => `${p.code} ${p.display}`).join("; ")}</div>
      )}
      {meds.length > 0 && (
        <div><b>Terapi:</b> {meds.map((m) => `${items.get(m.itemId)?.name} ${m.dose} ${m.frequency}`).join("; ")}</div>
      )}
      <div><b>Kondisi / cara keluar:</b> {dispositionLabel}{encounter.dispositionNote ? ` — ${encounter.dispositionNote}` : ""}</div>
      {lastDoctorNote?.plan && <div><b>Instruksi tindak lanjut:</b> {lastDoctorNote.plan}</div>}
      <div className="pt-10 text-right">DPJP,<br /><br /><br />{staff.get(encounter.practitionerId ?? "")?.name}</div>
    </div>
  )
}
