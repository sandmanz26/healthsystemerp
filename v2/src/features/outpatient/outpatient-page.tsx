/**
 * Clinic worklist. The provider's day is this queue, so the next patient is the hero of the
 * screen with one big "call" action; everyone else waits on the ticket rail below.
 * Medical assistants / HCAs use the same screen to room the patient and take vitals first.
 */
import { Button, Chip, Switch } from "@heroui/react"
import { HeartPulse, Megaphone, Stethoscope } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { QueueList, QueueRow } from "@v2/components/clinical/queue-row"
import { QueueTicket } from "@v2/components/clinical/queue-ticket"
import { MarkerDots } from "@v2/components/clinical/wristband"
import { EncounterStatusChip, PayerChip } from "@v2/components/status"
import { Empty } from "@v2/components/ui/empty"
import { SelectInput } from "@v2/components/ui/fields"
import { Page, PageHeader } from "@v2/components/ui/page"
import { Panel } from "@v2/components/ui/panel"
import { Segmented } from "@v2/components/ui/segmented"
import { Stat } from "@v2/components/ui/stat"
import { ageLabel, minutesSince } from "@v2/domain/clinical"
import type { Encounter } from "@v2/domain/types"
import { VitalsDialog } from "@v2/features/emr/vitals-dialog"
import { dayKey, formatDuration, formatTime } from "@v2/lib/format"
import { usePrefs } from "@v2/lib/prefs"
import { toast } from "@v2/lib/toast"
import { useNow } from "@v2/lib/use-now"
import { useActions, useStore } from "@v2/store"
import { usePatientMap, useRegion, useSession } from "@v2/store/selectors"
import { dispositionLabel, UB04_STATUS } from "./dispositions"

type Filter = "waiting" | "active" | "done"

export default function OutpatientPage() {
  const encounters = useStore((s) => s.encounters)
  const units = useStore((s) => s.units)
  const patients = usePatientMap()
  const { role, user } = useSession()
  const { callPatient, startEncounter } = useActions()
  const navigate = useNavigate()
  const now = useNow()
  const region = useRegion()
  const clinics = units.filter((u) => u.kind === "clinic")
  const savedUnit = usePrefs((s) => s.unitFilter.outpatient)
  const setUnitFilter = usePrefs((s) => s.setUnitFilter)
  const unit = (savedUnit && clinics.some((c) => c.id === savedUnit) ? savedUnit : undefined) ?? (user?.unitId && clinics.some((p) => p.id === user.unitId) ? user.unitId : clinics[0]?.id)
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
    toast(`Calling ${e.queueNumber}`, { description: `${patients.get(e.patientId)?.name} to ${unitName}` })
  }

  const rowActions = (e: Encounter) => {
    const vitals = !e.vitals.length && (e.status === "registered" || e.status === "called") && (
      <Button size="sm" variant="ghost" onPress={() => setVitalsFor(e)}>
        <HeartPulse className="size-4" aria-hidden /> Vitals
      </Button>
    )
    if (!isClinician) return vitals
    if (e.status === "registered")
      return (
        <>
          {vitals}
          <Button size="sm" variant="tertiary" onPress={() => call(e)}>
            Call
          </Button>
        </>
      )
    if (e.status === "called" || e.status === "in-progress")
      return (
        <Button size="sm" variant="primary" onPress={() => open(e)}>
          {e.status === "called" ? "Start visit" : "Resume"}
        </Button>
      )
    return (
      <Button size="sm" variant="ghost" onPress={() => navigate(`/encounters/${e.id}`)}>
        View
      </Button>
    )
  }

  return (
    <Page>
      <PageHeader
        title="Clinic worklist"
        description={`${unitName ?? ""} · ${role === "doctor" && mineOnly ? `${user?.name}'s patients` : "all providers"}`}
        actions={
          <div className="flex flex-wrap items-end gap-4">
            {role === "doctor" && (
              <Switch isSelected={mineOnly} onChange={setMineOnly}>
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <span className="text-sm">My patients</span>
                </Switch.Content>
              </Switch>
            )}
            <SelectInput label="Clinic" className="w-60" value={unit} onChange={(v) => setUnitFilter("outpatient", v)} options={clinics.map((u) => ({ value: u.id, label: u.name }))} />
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
            <Empty icon={Stethoscope} title="No patients waiting" description="This clinic's queue is clear for now." />
          </Panel>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Waiting" value={waiting.length} tone="warning" onClick={() => setFilter("waiting")} />
          <Stat label="With provider" value={active.length} tone="accent" onClick={() => setFilter("active")} />
          <Stat label="Completed" value={done.filter((e) => e.status === "finished").length} tone="success" onClick={() => setFilter("done")} />
          <Stat label="Vitals pending" value={waiting.filter((e) => !e.vitals.length).length} hint={region === "us" ? "Rooming by MA / nurse" : "Observations by HCA / nurse"} tone={waiting.some((e) => !e.vitals.length) ? "danger" : "default"} />
        </div>
      </div>

      <Panel flush>
        <div className="flex items-center justify-between gap-3 border-b border-separator px-5 py-3">
          <Segmented
            label="Status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "waiting", label: "Queue", count: waiting.length },
              { value: "active", label: "With provider", count: active.length },
              { value: "done", label: "Completed", count: done.length },
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <Empty icon={Stethoscope} title={filter === "waiting" ? "No one else in the queue" : "Nothing here"} />
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
                        Vitals ✓
                      </Chip>
                    )}
                    {e.disposition && (
                      <span className="text-xs text-muted" title={region === "us" ? `UB-04 patient status ${UB04_STATUS[e.disposition]}` : undefined}>
                        {dispositionLabel(e.disposition, region)}
                      </span>
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
  const region = useRegion()
  const waited = minutesSince(e.createdAt, now)
  const called = e.status === "called"
  return (
    <section className="bg-grid relative flex flex-col gap-5 overflow-hidden rounded-[14px] border border-border bg-surface p-5 sm:flex-row sm:items-center">
      <div className="flex flex-col items-center gap-2">
        <span className="label-caps text-muted">{called ? "Now calling" : "Next up"}</span>
        <QueueTicket number={e.queueNumber} tone="accent" size="lg" />
        <span className="num text-xs text-muted">{queueAfter} more waiting</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-2xl font-semibold">{patient.name}</h2>
          <MarkerDots patient={patient} />
        </div>
        <div className="num text-xs text-muted">
          {patient.gender === "female" ? "F" : "M"} · {ageLabel(patient.birthDate)} · MRN {patient.mrn} · arrived {formatTime(e.createdAt)}
          {e.referralNumber && ` · ${region === "us" ? "Referral" : "UBRN"} ${e.referralNumber}`}
        </div>
        <p className="mt-2 text-sm">
          <span className="text-muted">Reason for visit:</span> {e.chiefComplaint}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PayerChip payer={e.payer} />
          {e.vitals.length ? (
            <Chip size="sm" variant="soft" color="success">
              Vitals taken
            </Chip>
          ) : (
            <Button size="sm" variant="ghost" onPress={onVitals}>
              <HeartPulse className="size-4" aria-hidden /> Take vitals
            </Button>
          )}
          <span className={waited > 60 ? "num text-sm font-semibold text-danger" : "num text-sm text-muted"}>waiting {formatDuration(waited)}</span>
        </div>
      </div>
      {isClinician && (
        <div className="flex shrink-0 flex-col gap-2 sm:w-48">
          {called ? (
            <Button size="lg" variant="primary" onPress={onOpen} fullWidth>
              <Stethoscope className="size-4" aria-hidden /> Start visit
            </Button>
          ) : (
            <Button size="lg" variant="primary" onPress={onCall} fullWidth>
              <Megaphone className="size-4" aria-hidden /> Call patient
            </Button>
          )}
          {called && (
            <Button size="sm" variant="ghost" onPress={onCall}>
              Call again
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
