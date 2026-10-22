/**
 * ED tracking board. Lanes by acuity (ESI v5 in the US, Manchester Triage in the UK), then
 * arrival time. Each card carries the clock that market is measured on:
 *
 * - US: door-to-provider time against the local ESI goal; boarding time for admitted
 *   patients (CMS ED-2: admit decision → departure).
 * - UK: the four-hour clock (arrival → admission, transfer or discharge) with breach
 *   highlighting, and the 12-hour flag (12 hours from arrival).
 *
 * Patients on a sepsis pathway show bundle progress (CMS SEP-1 / Sepsis Six) and the next
 * element due, so the timer is visible from across the department.
 */
import { Button } from "@heroui/react"
import { BedDouble, Clock, Plus, Siren, Timer, Users } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { TriageTag } from "@v2/components/clinical/triage-tag"
import { MarkerDots } from "@v2/components/clinical/wristband"
import { EncounterStatusChip, PayerChip } from "@v2/components/status"
import { Empty } from "@v2/components/ui/empty"
import { Page, PageHeader } from "@v2/components/ui/page"
import { Panel } from "@v2/components/ui/panel"
import { Stat } from "@v2/components/ui/stat"
import { ageLabel, ED_FOUR_HOUR_MIN, minutesSince, sepsisBundle, TRIAGE_SCALES, triageInfo } from "@v2/domain/clinical"
import type { Region } from "@v2/domain/region"
import type { Encounter } from "@v2/domain/types"
import { News2Chip } from "@v2/features/emr/clinical-widgets"
import { RegisterVisitDialog } from "@v2/features/registration/register-visit-dialog"
import { cn } from "@v2/lib/cn"
import { dayKey, formatDuration, formatTime } from "@v2/lib/format"
import { useNow } from "@v2/lib/use-now"
import { useActions, useStore } from "@v2/store"
import { isActive, useModuleEnabled, usePatientMap, useRegion, useSession, useStaffMap } from "@v2/store/selectors"
import { TriageDialog } from "./triage-dialog"

const TWELVE_HOURS_MIN = 12 * 60
const SCALE_SHORT: Record<Region, string> = { us: "ESI v5", uk: "Manchester Triage System" }

/** Minutes past the triage target for first clinician contact, or null when seen / not triaged. */
function overdueBy(e: Encounter, now: number, region: Region): number | null {
  if (!e.triage || e.startedAt) return null
  const late = minutesSince(e.createdAt, now) - triageInfo(region, e.triage).targetMin
  return late > 0 ? late : null
}

/** Boarding starts at the decision to admit — approximated by the last ED provider note. */
function boardingSince(e: Encounter): string | undefined {
  if (e.status !== "awaiting-admission") return undefined
  return [...e.notes].sort((a, b) => b.at.localeCompare(a.at))[0]?.at ?? e.startedAt ?? e.createdAt
}

/** 0 = waiting for triage, shown first: these patients have not been assessed at all. */
const LANES = [0, 1, 2, 3, 4, 5] as const

const LANE_RAIL: Record<(typeof LANES)[number], string> = {
  0: "bg-foreground/70",
  1: "bg-triage-1",
  2: "bg-triage-2",
  3: "bg-triage-3",
  4: "bg-triage-4",
  5: "bg-triage-5",
}

function Lane({ level, count, region, children }: { level: (typeof LANES)[number]; count: number; region: Region; children: ReactNode }) {
  const info = level ? triageInfo(region, level) : undefined
  const target = info ? (info.targetMin === 0 ? "immediate" : region === "us" ? `goal ≤ ${info.targetMin} min` : `see within ${info.targetMin} min`) : ""
  return (
    <section className="flex gap-3" aria-label={level ? `${region === "us" ? "ESI" : "MTS"} ${level}` : "Waiting for triage"}>
      <div className={cn("w-1.5 shrink-0 rounded-full", LANE_RAIL[level])} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-3">
          {level ? (
            <TriageTag level={level} />
          ) : (
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span className="pulse-dot size-2 rounded-full bg-danger" />
              Waiting for triage
            </span>
          )}
          <span className="num text-[13px] text-muted">
            {count} {count === 1 ? "patient" : "patients"}
            {target && ` · ${target}`}
          </span>
        </div>
        {count > 0 ? <div className="grid gap-2 xl:grid-cols-2">{children}</div> : <div className="h-px bg-separator" />}
      </div>
    </section>
  )
}

/** Sepsis bundle progress: "SEP-1 3/5 · next 14:20". */
function SepsisBadge({ encounter: e, now, region }: { encounter: Encounter; now: number; region: Region }) {
  if (!e.sepsis) return null
  const bundle = sepsisBundle(region)
  const items = bundle.items.filter((i) => !i.shockOnly || e.sepsis!.septicShock)
  const done = items.filter((i) => e.sepsis!.done[i.id]).length
  const t0 = new Date(e.sepsis.identifiedAt).getTime()
  const next = items.filter((i) => !e.sepsis!.done[i.id]).sort((a, b) => a.dueMin - b.dueMin)[0]
  const dueAt = next ? t0 + next.dueMin * 60000 : undefined
  const late = dueAt !== undefined && now > dueAt
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium", done === items.length ? "bg-success-soft text-success-soft-foreground" : late ? "bg-danger text-danger-foreground" : "bg-danger-soft text-danger-soft-foreground")}
      title={`${bundle.name} — time zero ${formatTime(e.sepsis.identifiedAt)}${next ? ` · next: ${next.label}` : ""}`}
    >
      <Timer className="size-3" aria-hidden />
      <span>Sepsis</span>
      <span className="num">
        {done}/{items.length}
      </span>
      {dueAt !== undefined ? <span className="num">· {late ? "overdue" : "next"} {formatTime(new Date(dueAt).toISOString())}</span> : <span>· bundle complete</span>}
    </span>
  )
}

interface ErCardProps {
  encounter: Encounter
  now: number
  region: Region
  doctorName?: string
  canRetriage: boolean
  onTriage: () => void
  onOpen: () => void
  primaryLabel: string
}

function ErCard({ encounter: e, now, region, doctorName, canRetriage, onTriage, onOpen, primaryLabel }: ErCardProps) {
  const patient = useStore((s) => s.patients.find((p) => p.id === e.patientId))!
  const us = region === "us"
  const inDept = minutesSince(e.createdAt, now)
  const seen = !!e.startedAt
  const late = overdueBy(e, now, region)
  const latest = [...e.vitals].sort((a, b) => b.at.localeCompare(a.at))[0]
  const boarding = boardingSince(e)
  const boardingMin = boarding ? minutesSince(boarding, now) : undefined
  const d2p = seen ? minutesSince(e.createdAt, new Date(e.startedAt!).getTime()) : undefined

  // The headline clock: door-to-provider (US) or the four-hour clock (UK).
  const target = e.triage ? triageInfo(region, e.triage).targetMin : 0
  const breach = !us && inDept > ED_FOUR_HOUR_MIN
  const twelve = !us && inDept > TWELVE_HOURS_MIN
  const fill = us ? (seen ? 100 : !e.triage ? 0 : target === 0 ? 100 : Math.min(100, (inDept / target) * 100)) : Math.min(100, (inDept / ED_FOUR_HOUR_MIN) * 100)
  const alarm = us ? late !== null : breach

  return (
    <article className={cn("relative flex flex-col gap-3 overflow-hidden rounded-lg border border-border bg-surface p-4 sm:flex-row", alarm && "pl-5")}>
      {alarm && <span className="absolute inset-y-0 left-0 w-1 bg-danger" aria-hidden />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="num rounded bg-surface-tertiary px-1.5 py-0.5 text-xs font-semibold">{e.queueNumber}</span>
          <h3 className="truncate text-base font-semibold">{patient.name}</h3>
          <MarkerDots patient={patient} />
        </div>
        <div className="num mt-0.5 text-[13px] text-muted">
          {patient.gender === "female" ? "F" : "M"} · {ageLabel(patient.birthDate)} · MRN {patient.mrn} · arrived {formatTime(e.createdAt)}
        </div>
        <p className="mt-2 text-sm">{e.chiefComplaint}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <News2Chip vitals={latest} />
          <SepsisBadge encounter={e} now={now} region={region} />
          <PayerChip payer={e.payer} />
          <EncounterStatusChip status={e.status} />
          {twelve && <span className="rounded bg-danger px-1.5 py-0.5 text-xs font-medium text-danger-foreground">12-hour wait</span>}
          <span className="text-xs text-muted">{seen ? doctorName : us ? "Not yet seen by provider" : "Not yet seen by clinician"}</span>
        </div>
        {boardingMin !== undefined && (
          <div className={cn("num mt-2 flex items-center gap-1.5 text-xs", boardingMin > 240 ? "font-semibold text-danger" : "text-warning")}>
            <BedDouble className="size-3.5" aria-hidden />
            {us ? "Boarding" : "DTA, awaiting bed"} {formatDuration(boardingMin)}
            <span className="text-muted">{us ? "· CMS ED-2" : "· decision to admit"}</span>
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-row items-end justify-between gap-3 sm:w-44 sm:flex-col sm:items-stretch">
        <div>
          <div className="text-xs text-muted">{us ? (seen ? "Door-to-provider" : "Waiting for provider") : "4-hour clock"}</div>
          <div className={cn("num whitespace-nowrap font-semibold leading-tight", "text-2xl", (late !== null || breach) && "text-danger")}>
            {us ? formatDuration(seen ? d2p! : inDept) : formatDuration(inDept)}
          </div>
          <GoalBar fill={fill} state={us ? (seen ? "done" : late !== null ? "late" : "running") : breach ? "late" : "running"} />
          <div className="num mt-1 text-xs text-muted">
            {us
              ? seen
                ? `seen ${formatTime(e.startedAt!)} · LOS ${formatDuration(inDept)}`
                : late !== null
                  ? `${formatDuration(late)} past ESI goal`
                  : e.triage
                    ? `goal ${target === 0 ? "immediate" : `≤ ${target} min`}`
                    : "needs triage"
              : breach
                ? `breached by ${formatDuration(inDept - ED_FOUR_HOUR_MIN)}`
                : `${formatDuration(ED_FOUR_HOUR_MIN - inDept)} to breach${late !== null ? " · MTS wait exceeded" : ""}`}
          </div>
        </div>
        <div className="flex gap-1.5 sm:justify-end">
          {(!e.triage || canRetriage) && (
            <Button size="sm" variant={e.triage ? "ghost" : "danger"} onPress={onTriage}>
              {e.triage ? "Re-triage" : "Triage"}
            </Button>
          )}
          <Button size="sm" variant={seen ? "tertiary" : "primary"} onPress={onOpen}>
            {primaryLabel}
          </Button>
        </div>
      </div>
    </article>
  )
}

/**
 * Time against the acuity goal, the board's one reading in the data hue: the bar fills
 * toward the goal and turns red only once it is passed; a patient already seen goes grey.
 */
function GoalBar({ fill, state }: { fill: number; state: "running" | "late" | "done" }) {
  return (
    <div className="mt-1.5 h-2 overflow-hidden rounded-sm bg-surface-tertiary" aria-hidden>
      <div className={cn("h-full", state === "late" ? "bg-danger" : state === "done" ? "bg-muted/50" : "bg-data")} style={{ width: `${fill}%` }} />
    </div>
  )
}

const median = (xs: number[]) => {
  if (!xs.length) return undefined
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

export default function EmergencyPage() {
  const encounters = useStore((s) => s.encounters)
  const patients = usePatientMap()
  const staff = useStaffMap()
  const region = useRegion()
  const us = region === "us"
  const { role } = useSession()
  const { startEncounter } = useActions()
  const registrationOn = useModuleEnabled("registration")
  const navigate = useNavigate()
  const now = useNow(15_000)
  const [triageFor, setTriageFor] = useState<Encounter>()
  const [registering, setRegistering] = useState(false)

  const board = useMemo(
    // Untriaged (0) sort first: they have not been assessed at all.
    () => encounters.filter((e) => e.kind === "emergency" && isActive(e)).sort((a, b) => (a.triage ?? 0) - (b.triage ?? 0) || a.createdAt.localeCompare(b.createdAt)),
    [encounters],
  )
  const todays = useMemo(() => encounters.filter((e) => e.kind === "emergency" && e.status !== "cancelled" && dayKey(e.createdAt) === dayKey(now)), [encounters, now])

  const untriaged = board.filter((e) => !e.triage)
  const overdue = board.filter((e) => overdueBy(e, now, region) !== null)
  const boarding = board.filter((e) => e.status === "awaiting-admission")
  const d2p = median(todays.filter((e) => e.startedAt).map((e) => minutesSince(e.createdAt, new Date(e.startedAt!).getTime())))
  const departed = todays.filter((e) => e.endedAt)
  const within4h = departed.filter((e) => minutesSince(e.createdAt, new Date(e.endedAt!).getTime()) <= ED_FOUR_HOUR_MIN).length
  const fourHourPct = departed.length ? Math.round((within4h / departed.length) * 100) : undefined
  const breached = board.filter((e) => minutesSince(e.createdAt, now) > ED_FOUR_HOUR_MIN)
  const twelve = board.filter((e) => minutesSince(e.createdAt, now) > TWELVE_HOURS_MIN)

  return (
    <Page>
      <PageHeader
        title={us ? "Emergency department" : "Emergency department (A&E)"}
        description={
          us
            ? "Tracking board sorted by ESI level, then arrival. Red = past the door-to-provider goal for that acuity."
            : "Tracking board sorted by MTS category, then arrival. Red = four-hour standard breached or MTS wait exceeded."
        }
        actions={
          registrationOn && (
            <Button variant="danger" onPress={() => setRegistering(true)}>
              <Plus className="size-4" aria-hidden /> New arrival
            </Button>
          )
        }
      />
      <div className="stat-strip mb-6 grid grid-cols-2 lg:grid-cols-4">
        <Stat label="In department" value={board.length} hint={`${untriaged.length} waiting for triage`} icon={Users} tone={untriaged.length ? "danger" : "accent"} />
        {us ? (
          <>
            <Stat label="Median door-to-provider" value={d2p === undefined ? "—" : formatDuration(d2p)} hint="Today · arrival → provider" icon={Clock} tone={d2p !== undefined && d2p > 30 ? "warning" : "success"} />
            <Stat label="Past ESI goal" value={overdue.length} hint="Not yet seen" icon={Siren} tone={overdue.length ? "danger" : "success"} />
            <Stat label="Boarding" value={boarding.length} hint="Admitted, awaiting bed (ED-2)" icon={BedDouble} tone={boarding.length ? "warning" : "default"} onClick={boarding.length ? () => navigate("/inpatient") : undefined} />
          </>
        ) : (
          <>
            <Stat label="4-hour performance" value={fourHourPct === undefined ? "—" : `${fourHourPct}%`} hint="Today's departures · target 78%" icon={Clock} tone={fourHourPct === undefined ? "default" : fourHourPct >= 78 ? "success" : "danger"} />
            <Stat label="Over 4 hours" value={breached.length} hint={`${boarding.length} DTA awaiting bed`} icon={Siren} tone={breached.length ? "danger" : "success"} onClick={boarding.length ? () => navigate("/inpatient") : undefined} />
            <Stat label="12-hour waits" value={twelve.length} hint="From arrival" icon={BedDouble} tone={twelve.length ? "danger" : "success"} />
          </>
        )}
      </div>
      <p className="mb-3 text-[13px] text-muted">
        Triage: {SCALE_SHORT[region]}
        {us ? ` (${TRIAGE_SCALES.us.name}, ENA)` : " (3rd ed.) · Four-hour standard: NHS England UEC operational standard"}
      </p>
      {board.length === 0 ? (
        <Panel flush>
          <Empty icon={Siren} title="Department empty" description="No active patients right now." />
        </Panel>
      ) : (
        <div className="space-y-4">
          {LANES.map((level) => {
            const items = board.filter((e) => (e.triage ?? 0) === level)
            return (
              <Lane key={level} level={level} count={items.length} region={region}>
                {items.map((e) => (
                  <ErCard
                    key={e.id}
                    encounter={e}
                    now={now}
                    region={region}
                    doctorName={staff.get(e.practitionerId ?? "")?.name}
                    canRetriage={role === "nurse"}
                    onTriage={() => setTriageFor(e)}
                    onOpen={() => {
                      if (role === "doctor") startEncounter(e.id)
                      navigate(`/encounters/${e.id}`)
                    }}
                    primaryLabel={e.startedAt || role !== "doctor" ? "Open" : "Assign to me"}
                  />
                ))}
              </Lane>
            )
          })}
        </div>
      )}
      {triageFor && <TriageDialog encounter={triageFor} patientName={patients.get(triageFor.patientId)?.name ?? ""} onClose={() => setTriageFor(undefined)} />}
      {registering && <RegisterVisitDialog isOpen onOpenChange={setRegistering} kind="emergency" />}
    </Page>
  )
}
