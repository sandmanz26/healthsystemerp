/**
 * Poli worklist. The doctor's day is this list: call the next patient, examine, finish.
 * Nurses use the same list to take vital signs before the doctor sees the patient.
 */
import { Button, Chip, Switch } from "@heroui/react"
import { AlertTriangle, Megaphone, Stethoscope } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { EncounterStatusChip, PayerChip } from "@/components/status"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Empty } from "@/components/ui/empty"
import { SelectInput } from "@/components/ui/fields"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Segmented } from "@/components/ui/segmented"
import { Stat } from "@/components/ui/stat"
import { ageLabel, minutesSince } from "@/domain/clinical"
import type { Encounter } from "@/domain/types"
import { VitalsDialog } from "@/features/emr/vitals-dialog"
import { dayKey, formatDuration } from "@/lib/format"
import { usePrefs } from "@/lib/prefs"
import { toast } from "@/lib/toast"
import { useNow } from "@/lib/use-now"
import { useActions, useStore } from "@/store"
import { usePatientMap, useSession, useStaffMap } from "@/store/selectors"

type Filter = "waiting" | "active" | "done"

export default function OutpatientPage() {
  const encounters = useStore((s) => s.encounters)
  const units = useStore((s) => s.units)
  const patients = usePatientMap()
  const staff = useStaffMap()
  const { role, user } = useSession()
  const { callPatient, startEncounter } = useActions()
  const navigate = useNavigate()
  const now = useNow()
  const polis = units.filter((u) => u.kind === "poli")
  const savedUnit = usePrefs((s) => s.unitFilter.outpatient)
  const setUnitFilter = usePrefs((s) => s.setUnitFilter)
  const unit = savedUnit ?? (user?.unitId && polis.some((p) => p.id === user.unitId) ? user.unitId : polis[0].id)
  const [mineOnly, setMineOnly] = useState(role === "doctor")
  const [filter, setFilter] = useState<Filter>("waiting")
  const [vitalsFor, setVitalsFor] = useState<Encounter>()

  const list = encounters
    .filter((e) => e.kind === "outpatient" && e.unitId === unit && dayKey(e.createdAt) === dayKey(now))
    .filter((e) => !mineOnly || role !== "doctor" || e.practitionerId === user?.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const waiting = list.filter((e) => e.status === "registered" || e.status === "called")
  const active = list.filter((e) => e.status === "in-progress" || e.status === "awaiting-admission")
  const done = list.filter((e) => e.status === "finished" || e.status === "cancelled")
  const rows = filter === "waiting" ? waiting : filter === "active" ? active : done
  const nextUp = waiting.find((e) => e.status === "registered")

  const open = (e: Encounter) => {
    startEncounter(e.id)
    navigate(`/encounters/${e.id}`)
  }

  const call = (e: Encounter) => {
    callPatient(e.id)
    toast(`Memanggil ${e.queueNumber}`, { description: `${patients.get(e.patientId)?.name} ke ${units.find((u) => u.id === unit)?.name}` })
  }

  const columns: Column<Encounter>[] = [
    { id: "queue", header: "No.", cell: (e) => <span className="tabular text-base font-bold">{e.queueNumber}</span> },
    {
      id: "patient",
      header: "Pasien",
      isRowHeader: true,
      cell: (e) => {
        const p = patients.get(e.patientId)!
        return (
          <div>
            <div className="flex items-center gap-1.5 font-medium">
              {p.name}
              {p.allergies.length > 0 && <AlertTriangle className="size-3.5 text-danger" aria-label="Ada alergi" />}
            </div>
            <div className="tabular text-xs text-muted">
              RM {p.mrn} · {p.gender === "female" ? "P" : "L"} {ageLabel(p.birthDate)}
            </div>
          </div>
        )
      },
    },
    { id: "complaint", header: "Keluhan", cell: (e) => <span className="line-clamp-2 text-sm">{e.chiefComplaint}</span> },
    { id: "payer", header: "Penjamin", cell: (e) => <PayerChip payer={e.payer} /> },
    {
      id: "vitals",
      header: "TTV",
      cell: (e) =>
        e.vitals.length ? (
          <Chip size="sm" color="success" variant="soft">
            Sudah
          </Chip>
        ) : (
          <Button size="sm" variant="ghost" onPress={() => setVitalsFor(e)}>
            Isi TTV
          </Button>
        ),
    },
    { id: "status", header: "Status", cell: (e) => <EncounterStatusChip status={e.status} /> },
    {
      id: "wait",
      header: "Tunggu",
      cell: (e) => {
        const m = minutesSince(e.createdAt, now)
        return e.status === "registered" || e.status === "called" ? <span className={m > 60 ? "tabular font-semibold text-danger" : "tabular text-muted"}>{formatDuration(m)}</span> : <span className="text-muted">—</span>
      },
    },
    {
      id: "action",
      header: "",
      align: "end",
      cell: (e) => {
        if (role !== "doctor" && role !== "admin") return null
        if (e.status === "registered")
          return (
            <Button size="sm" variant="tertiary" onPress={() => call(e)}>
              Panggil
            </Button>
          )
        if (e.status === "called" || e.status === "in-progress")
          return (
            <Button size="sm" variant="primary" onPress={() => open(e)}>
              {e.status === "called" ? "Periksa" : "Lanjutkan"}
            </Button>
          )
        return (
          <Button size="sm" variant="ghost" onPress={() => navigate(`/encounters/${e.id}`)}>
            Lihat
          </Button>
        )
      },
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Rawat Jalan"
        description={`${units.find((u) => u.id === unit)?.name} · ${role === "doctor" && mineOnly ? `pasien ${user?.name}` : "semua dokter"}`}
        actions={
          nextUp &&
          (role === "doctor" || role === "admin") && (
            <Button variant="primary" onPress={() => call(nextUp)}>
              <Megaphone className="size-4" aria-hidden /> Panggil berikutnya ({nextUp.queueNumber})
            </Button>
          )
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Menunggu" value={waiting.length} icon={Stethoscope} tone="warning" onClick={() => setFilter("waiting")} />
        <Stat label="Sedang diperiksa" value={active.length} tone="accent" onClick={() => setFilter("active")} />
        <Stat label="Selesai" value={done.filter((e) => e.status === "finished").length} tone="success" onClick={() => setFilter("done")} />
        <Stat label="Belum TTV" value={waiting.filter((e) => !e.vitals.length).length} hint="Perlu diisi perawat" tone={waiting.some((e) => !e.vitals.length) ? "danger" : "default"} />
      </div>
      <Panel flush>
        <div className="flex flex-col gap-3 border-b border-separator p-4 lg:flex-row lg:items-end lg:justify-between">
          <Segmented
            label="Status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "waiting", label: "Menunggu", count: waiting.length },
              { value: "active", label: "Diperiksa", count: active.length },
              { value: "done", label: "Selesai", count: done.length },
            ]}
          />
          <div className="flex flex-wrap items-end gap-4">
            {role === "doctor" && (
              <Switch isSelected={mineOnly} onChange={setMineOnly}>
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <span className="text-sm">Pasien saya saja</span>
                </Switch.Content>
              </Switch>
            )}
            <SelectInput label="Poli" className="w-64" value={unit} onChange={(v) => setUnitFilter("outpatient", v)} options={polis.map((u) => ({ value: u.id, label: u.name }))} />
          </div>
        </div>
        <DataTable
          label="Worklist poli"
          rows={rows}
          columns={columns}
          rowKey={(e) => e.id}
          empty={<Empty icon={Stethoscope} title="Tidak ada pasien" description={filter === "waiting" ? "Belum ada pasien menunggu di poli ini." : undefined} />}
        />
        <div className="border-t border-separator px-4 py-2 text-xs text-muted">
          Dokter: {[...new Set(list.map((e) => e.practitionerId))].map((id) => staff.get(id ?? "")?.name).filter(Boolean).join(", ") || "—"}
        </div>
      </Panel>
      {vitalsFor && <VitalsDialog encounterId={vitalsFor.id} patientName={patients.get(vitalsFor.patientId)?.name ?? ""} onClose={() => setVitalsFor(undefined)} />}
    </Page>
  )
}
