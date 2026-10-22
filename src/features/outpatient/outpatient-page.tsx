/**
 * Poli worklist. The doctor's day is this queue, so the next patient is the hero of the
 * screen with one big "call" action; everyone else waits on the ticket rail below.
 * Nurses use the same screen to take vital signs before the doctor sees the patient.
 */
import { Button, Chip, Switch } from "@heroui/react"
import { HeartPulse, Megaphone, Stethoscope } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { QueueList, QueueRow } from "@/components/clinical/queue-row"
import { QueueTicket } from "@/components/clinical/queue-ticket"
import { MarkerDots } from "@/components/clinical/wristband"
import { EncounterStatusChip, PayerChip } from "@/components/status"
import { Empty } from "@/components/ui/empty"
import { SelectInput } from "@/components/ui/fields"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Segmented } from "@/components/ui/segmented"
import { Stat } from "@/components/ui/stat"
import { ageLabel, minutesSince } from "@/domain/clinical"
import type { Encounter } from "@/domain/types"
import { VitalsDialog } from "@/features/emr/vitals-dialog"
import { dayKey, formatDuration, formatTime } from "@/lib/format"
import { usePrefs } from "@/lib/prefs"
import { toast } from "@/lib/toast"
import { useNow } from "@/lib/use-now"
import { useActions, useStore } from "@/store"
import { usePatientMap, useSession } from "@/store/selectors"

type Filter = "waiting" | "active" | "done"

export default function OutpatientPage() {
  const encounters = useStore((s) => s.encounters)
  const units = useStore((s) => s.units)
  const patients = usePatientMap()
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
  const isClinician = role === "doctor" || role === "admin"

  const list = encounters
    .filter((e) => e.kind === "outpatient" && e.unitId === unit && dayKey(e.createdAt) === dayKey(now))
    .filter((e) => !mineOnly || role !== "doctor" || e.practitionerId === user?.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const waiting = list.filter((e) => e.status === "registered" || e.status === "called")
  const active = list.filter((e) => e.status === "in-progress" || e.status === "awaiting-admission")
  const done = list.filter((e) => e.status === "finished" || e.status === "cancelled")
  const called = waiting.find((e) => e.status === "called")
  const nextUp = waiting.find((e) => e.status === "registered")
  const hero = called ?? nextUp
  const rows = (filter === "waiting" ? waiting : filter === "active" ? active : done).filter((e) => filter !== "waiting" || e.id !== hero?.id)
  const unitName = units.find((u) => u.id === unit)?.name

  const open = (e: Encounter) => {
    startEncounter(e.id)
    navigate(`/encounters/${e.id}`)
  }

  const call = (e: Encounter) => {
    callPatient(e.id)
    toast(`Memanggil ${e.queueNumber}`, { description: `${patients.get(e.patientId)?.name} ke ${unitName}` })
  }

  const rowActions = (e: Encounter) => {
    const vitals = !e.vitals.length && (e.status === "registered" || e.status === "called") && (
      <Button size="sm" variant="ghost" onPress={() => setVitalsFor(e)}>
        <HeartPulse className="size-4" aria-hidden /> TTV
      </Button>
    )
    if (!isClinician) return vitals
    if (e.status === "registered")
      return (
        <>
          {vitals}
          <Button size="sm" variant="tertiary" onPress={() => call(e)}>
            Panggil
          </Button>
        </>
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
  }

  return (
    <Page>
      <PageHeader
        title="Rawat Jalan"
        description={`${unitName} · ${role === "doctor" && mineOnly ? `pasien ${user?.name}` : "semua dokter"}`}
        actions={
          <div className="flex flex-wrap items-end gap-4">
            {role === "doctor" && (
              <Switch isSelected={mineOnly} onChange={setMineOnly}>
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <span className="text-sm">Pasien saya</span>
                </Switch.Content>
              </Switch>
            )}
            <SelectInput label="Poli" className="w-60" value={unit} onChange={(v) => setUnitFilter("outpatient", v)} options={polis.map((u) => ({ value: u.id, label: u.name }))} />
          </div>
        }
      />

      <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {hero ? (
          <NextUp
            encounter={hero}
            now={now}
            isClinician={isClinician}
            onCall={() => call(hero)}
            onOpen={() => open(hero)}
            onVitals={() => setVitalsFor(hero)}
            queueAfter={waiting.filter((e) => e.id !== hero.id).length}
          />
        ) : (
          <Panel>
            <Empty icon={Stethoscope} title="Tidak ada pasien menunggu" description="Antrean poli ini sudah habis untuk saat ini." />
          </Panel>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Menunggu" value={waiting.length} tone="warning" onClick={() => setFilter("waiting")} />
          <Stat label="Diperiksa" value={active.length} tone="accent" onClick={() => setFilter("active")} />
          <Stat label="Selesai" value={done.filter((e) => e.status === "finished").length} tone="success" onClick={() => setFilter("done")} />
          <Stat label="Belum TTV" value={waiting.filter((e) => !e.vitals.length).length} hint="Perlu diisi perawat" tone={waiting.some((e) => !e.vitals.length) ? "danger" : "default"} />
        </div>
      </div>

      <Panel flush>
        <div className="flex items-center justify-between gap-3 border-b border-separator px-5 py-3">
          <Segmented
            label="Status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "waiting", label: "Antrean", count: waiting.length },
              { value: "active", label: "Diperiksa", count: active.length },
              { value: "done", label: "Selesai", count: done.length },
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <Empty icon={Stethoscope} title={filter === "waiting" ? "Tidak ada antrean lain" : "Kosong"} />
        ) : (
          <QueueList>
            {rows.map((e) => (
              <QueueRow
                key={e.id}
                ticket={e.queueNumber}
                patient={patients.get(e.patientId)!}
                detail={<span className="line-clamp-2">{e.chiefComplaint}</span>}
                badges={
                  <>
                    <PayerChip payer={e.payer} />
                    {e.vitals.length > 0 && filter === "waiting" && (
                      <Chip size="sm" variant="soft" color="success">
                        TTV ✓
                      </Chip>
                    )}
                    <EncounterStatusChip status={e.status} />
                  </>
                }
                waited={e.status === "registered" || e.status === "called" ? minutesSince(e.createdAt, now) : undefined}
                actions={rowActions(e)}
                muted={e.status === "cancelled"}
              />
            ))}
          </QueueList>
        )}
      </Panel>
      {vitalsFor && <VitalsDialog encounterId={vitalsFor.id} patientName={patients.get(vitalsFor.patientId)?.name ?? ""} onClose={() => setVitalsFor(undefined)} />}
    </Page>
  )
}

interface NextUpProps {
  encounter: Encounter
  now: number
  isClinician: boolean
  queueAfter: number
  onCall: () => void
  onOpen: () => void
  onVitals: () => void
}

/** The patient the doctor should see now, as large as the ticket in the patient's hand. */
function NextUp({ encounter: e, now, isClinician, queueAfter, onCall, onOpen, onVitals }: NextUpProps) {
  const patient = useStore((s) => s.patients.find((p) => p.id === e.patientId))!
  const waited = minutesSince(e.createdAt, now)
  const called = e.status === "called"
  return (
    <section className="bg-grid relative flex flex-col gap-5 overflow-hidden rounded-[14px] border border-border bg-surface p-5 sm:flex-row sm:items-center">
      <div className="flex flex-col items-center gap-2">
        <span className="label-caps text-muted">{called ? "Sedang dipanggil" : "Berikutnya"}</span>
        <QueueTicket number={e.queueNumber} tone="accent" size="lg" />
        <span className="num text-[11px] text-muted">{queueAfter} lagi di belakang</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-2xl font-semibold">{patient.name}</h2>
          <MarkerDots patient={patient} />
        </div>
        <div className="num text-xs text-muted">
          {patient.gender === "female" ? "P" : "L"} · {ageLabel(patient.birthDate)} · RM {patient.mrn} · daftar {formatTime(e.createdAt)}
        </div>
        <p className="mt-2 text-sm">
          <span className="text-muted">Keluhan:</span> {e.chiefComplaint}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PayerChip payer={e.payer} />
          {e.vitals.length ? (
            <Chip size="sm" variant="soft" color="success">
              TTV sudah diisi
            </Chip>
          ) : (
            <Button size="sm" variant="ghost" onPress={onVitals}>
              <HeartPulse className="size-4" aria-hidden /> Isi TTV
            </Button>
          )}
          <span className={waited > 60 ? "num text-sm font-semibold text-danger" : "num text-sm text-muted"}>menunggu {formatDuration(waited)}</span>
        </div>
      </div>
      {isClinician && (
        <div className="flex shrink-0 flex-col gap-2 sm:w-48">
          {called ? (
            <Button size="lg" variant="primary" onPress={onOpen} fullWidth>
              <Stethoscope className="size-4" aria-hidden /> Mulai periksa
            </Button>
          ) : (
            <Button size="lg" variant="primary" onPress={onCall} fullWidth>
              <Megaphone className="size-4" aria-hidden /> Panggil
            </Button>
          )}
          {called && (
            <Button size="sm" variant="ghost" onPress={onCall}>
              Panggil ulang
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
