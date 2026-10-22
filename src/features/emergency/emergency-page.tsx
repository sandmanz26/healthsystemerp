/**
 * ER track board. Sorted by acuity then arrival; time-to-doctor is compared with the
 * triage target so overdue patients stand out without anyone doing the maths.
 */
import { Button } from "@heroui/react"
import { BedDouble, Clock, Plus, Siren, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { MarkerDots } from "@/components/clinical/wristband"
import { TriageTag } from "@/components/clinical/triage-tag"
import { EncounterStatusChip, PayerChip } from "@/components/status"
import { Empty } from "@/components/ui/empty"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Stat } from "@/components/ui/stat"
import { TRIAGE, ageLabel, minutesSince } from "@/domain/clinical"
import type { Encounter } from "@/domain/types"
import { News2Chip } from "@/features/emr/clinical-widgets"
import { RegisterVisitDialog } from "@/features/registration/register-visit-dialog"
import { cn } from "@/lib/cn"
import { formatDuration, formatTime } from "@/lib/format"
import { useNow } from "@/lib/use-now"
import { useActions, useStore } from "@/store"
import { isActive, useModuleEnabled, usePatientMap, useSession, useStaffMap } from "@/store/selectors"
import { TriageDialog } from "./triage-dialog"

/** Minutes past the triage response target, or null when seen / not triaged. */
function overdueBy(e: Encounter, now: number): number | null {
  if (!e.triage || e.startedAt) return null
  const late = minutesSince(e.createdAt, now) - TRIAGE[e.triage].targetMin
  return late > 0 ? late : null
}

/** 0 = waiting for triage, shown first: these patients have not been assessed at all. */
const LANES = [0, 1, 2, 3, 4, 5] as const

const LANE_RAIL: Record<(typeof LANES)[number], string> = {
  0: "bg-foreground/70",
  1: "bg-ats-1",
  2: "bg-ats-2",
  3: "bg-ats-3",
  4: "bg-ats-4",
  5: "bg-ats-5 ring-1 ring-inset ring-border",
}

function Lane({ level, count, children }: { level: (typeof LANES)[number]; count: number; children: React.ReactNode }) {
  return (
    <section className={cn("flex gap-3", count === 0 && "opacity-60")} aria-label={level ? `Triase ${level}` : "Menunggu triase"}>
      <div className={cn("w-1.5 shrink-0 rounded-full", LANE_RAIL[level])} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-3">
          {level ? <TriageTag level={level} /> : <span className="label-caps flex items-center gap-2 text-foreground"><span className="pulse-dot size-2 rounded-full bg-danger" />Menunggu triase</span>}
          <span className="num text-xs text-muted">
            {count} pasien{level ? ` · target ${TRIAGE[level].targetMin === 0 ? "segera" : `≤ ${TRIAGE[level].targetMin} mnt`}` : ""}
          </span>
        </div>
        {count > 0 ? <div className="grid gap-2 xl:grid-cols-2">{children}</div> : <div className="h-px bg-separator" />}
      </div>
    </section>
  )
}

interface ErCardProps {
  encounter: Encounter
  now: number
  doctorName?: string
  canRetriage: boolean
  onTriage: () => void
  onOpen: () => void
  primaryLabel: string
}

function ErCard({ encounter: e, now, doctorName, canRetriage, onTriage, onOpen, primaryLabel }: ErCardProps) {
  const patient = useStore((s) => s.patients.find((p) => p.id === e.patientId))!
  const waited = minutesSince(e.createdAt, now)
  const target = e.triage ? TRIAGE[e.triage].targetMin : 0
  const late = overdueBy(e, now)
  const seen = !!e.startedAt
  const fill = seen ? 100 : target === 0 ? 100 : Math.min(100, (waited / target) * 100)
  const latest = [...e.vitals].sort((a, b) => b.at.localeCompare(a.at))[0]

  return (
    <article className={cn("flex flex-col gap-3 rounded-[14px] border bg-surface p-4 sm:flex-row", late !== null ? "border-danger/60" : "border-border")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="num rounded bg-surface-tertiary px-1.5 py-0.5 text-[11px] font-bold">{e.queueNumber}</span>
          <h3 className="truncate text-[17px] font-semibold">{patient.name}</h3>
          <MarkerDots patient={patient} />
        </div>
        <div className="num mt-0.5 text-[11.5px] text-muted">
          {patient.gender === "female" ? "P" : "L"} · {ageLabel(patient.birthDate)} · RM {patient.mrn}
        </div>
        <p className="mt-2 text-sm">{e.chiefComplaint}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <News2Chip vitals={latest} />
          <PayerChip payer={e.payer} />
          <EncounterStatusChip status={e.status} />
          <span className="text-xs text-muted">{seen ? doctorName : "Belum ditangani dokter"}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-row items-end justify-between gap-3 sm:w-40 sm:flex-col sm:items-stretch">
        <div>
          <div className="label-caps text-muted">{seen ? "Di IGD" : "Menunggu"}</div>
          <div className={cn("num whitespace-nowrap font-semibold leading-tight", waited >= 60 ? "text-xl" : "text-2xl", late !== null && "text-danger")}>{formatDuration(waited)}</div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-tertiary" aria-hidden>
            <div className={cn("h-full rounded-full", seen ? "bg-success" : late !== null ? "bg-danger" : "bg-warning")} style={{ width: `${fill}%` }} />
          </div>
          <div className="num mt-1 text-[11px] text-muted">{seen ? `ditangani ${formatTime(e.startedAt!)}` : late !== null ? `lewat target ${formatDuration(late)}` : e.triage ? `datang ${formatTime(e.createdAt)}` : "perlu triase"}</div>
        </div>
        <div className="flex gap-1.5 sm:justify-end">
          {(!e.triage || canRetriage) && (
            <Button size="sm" variant={e.triage ? "ghost" : "danger"} onPress={onTriage}>
              {e.triage ? "Triase ulang" : "Triase"}
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

export default function EmergencyPage() {
  const encounters = useStore((s) => s.encounters)
  const patients = usePatientMap()
  const staff = useStaffMap()
  const { role } = useSession()
  const { startEncounter } = useActions()
  const registrationOn = useModuleEnabled("registration")
  const navigate = useNavigate()
  const now = useNow(15_000)
  const [triageFor, setTriageFor] = useState<Encounter>()
  const [registering, setRegistering] = useState(false)

  const board = useMemo(
    () => encounters.filter((e) => e.kind === "emergency" && isActive(e)).sort((a, b) => (a.triage ?? 0) - (b.triage ?? 0) || a.createdAt.localeCompare(b.createdAt)),
    // Untriaged (0) sort first: they have not been assessed at all.
    [encounters],
  )
  const untriaged = board.filter((e) => !e.triage)
  const overdue = board.filter((e) => overdueBy(e, now) !== null)
  const awaitingBed = board.filter((e) => e.status === "awaiting-admission")

  return (
    <Page>
      <PageHeader
        title="Instalasi Gawat Darurat"
        description="Diurutkan menurut level triase lalu waktu datang. Merah = melewati target waktu tanggap."
        actions={
          registrationOn && (
            <Button variant="danger" onPress={() => setRegistering(true)}>
              <Plus className="size-4" aria-hidden /> Pasien datang
            </Button>
          )
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pasien di IGD" value={board.length} icon={Users} tone="accent" />
        <Stat label="Belum triase" value={untriaged.length} icon={Siren} tone={untriaged.length ? "danger" : "default"} />
        <Stat label="Lewat target tanggap" value={overdue.length} icon={Clock} tone={overdue.length ? "danger" : "success"} />
        <Stat label="Menunggu kamar" value={awaitingBed.length} icon={BedDouble} tone={awaitingBed.length ? "warning" : "default"} onClick={awaitingBed.length ? () => navigate("/inpatient") : undefined} />
      </div>
      {board.length === 0 ? (
        <Panel flush>
          <Empty icon={Siren} title="IGD kosong" description="Tidak ada pasien aktif saat ini." />
        </Panel>
      ) : (
        <div className="space-y-4">
          {LANES.map((level) => {
            const items = board.filter((e) => (e.triage ?? 0) === level)
            return (
              <Lane key={level} level={level} count={items.length}>
                {items.map((e) => (
                  <ErCard
                    key={e.id}
                    encounter={e}
                    now={now}
                    doctorName={staff.get(e.practitionerId ?? "")?.name}
                    canRetriage={role === "nurse"}
                    onTriage={() => setTriageFor(e)}
                    onOpen={() => {
                      if (role === "doctor") startEncounter(e.id)
                      navigate(`/encounters/${e.id}`)
                    }}
                    primaryLabel={e.startedAt || role !== "doctor" ? "Buka" : "Tangani"}
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
