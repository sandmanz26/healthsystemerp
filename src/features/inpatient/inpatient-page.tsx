/**
 * Bed board. The single most-watched screen in an inpatient unit: who is where, which beds
 * are clean or waiting for EVS, who is boarding in the ED for a bed — and, on the discharge
 * planning view, who can go home today.
 */
import { Button, Chip, Dropdown, Label } from "@heroui/react"
import { BedDouble, BedSingle, Clock, MoreVertical, Plus, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { MarkerDots } from "@/components/clinical/wristband"
import { BedStatusChip, PayerChip } from "@/components/status"
import { Empty } from "@/components/ui/empty"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Segmented } from "@/components/ui/segmented"
import { Stat } from "@/components/ui/stat"
import { ageLabel, minutesSince, news2 } from "@/domain/clinical"
import type { Bed, BedStatus, Encounter } from "@/domain/types"
import { News2Chip } from "@/features/emr/clinical-widgets"
import { cn } from "@/lib/cn"
import { formatDate, formatDuration, formatPercent } from "@/lib/format"
import { usePrefs } from "@/lib/prefs"
import { useNow } from "@/lib/use-now"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"
import { usePatientMap, useRegion, useStaffMap, useUnitName } from "@/store/selectors"
import { AdmitDialog, TransferDialog } from "./admit-dialog"
import { DischargePlanningBoard } from "./discharge-planning"
import { BED_TYPE_LABEL, imOverdue, losDays, obsHours } from "./inpatient-helpers"

export default function InpatientPage() {
  const beds = useStore((s) => s.beds)
  const units = useStore((s) => s.units)
  const encounters = useStore((s) => s.encounters)
  const unitName = useUnitName()
  const navigate = useNavigate()
  const savedWard = usePrefs((s) => s.unitFilter.inpatient) ?? "all"
  const setUnitFilter = usePrefs((s) => s.setUnitFilter)
  const [admitting, setAdmitting] = useState<{ request?: Encounter; bedId?: string } | null>(null)
  const [transferring, setTransferring] = useState<Encounter>()
  const [view, setView] = useState<"beds" | "discharge">("beds")
  const region = useRegion()
  const us = region === "us"

  const wards = units.filter((u) => u.kind === "ward" || u.kind === "icu")
  const encById = useMemo(() => new Map(encounters.map((e) => [e.id, e])), [encounters])
  const requests = encounters.filter((e) => e.status === "awaiting-admission")
  const visible = beds.filter((b) => savedWard === "all" || b.unitId === savedWard)
  const occupied = beds.filter((b) => b.status === "occupied").length
  const count = (s: BedStatus) => beds.filter((b) => b.status === s).length
  const bedById = useMemo(() => new Map(beds.map((b) => [b.id, b])), [beds])
  const inpatients = useMemo(
    () => encounters.filter((e) => e.kind === "inpatient" && e.status === "in-progress" && (savedWard === "all" || e.unitId === savedWard)),
    [encounters, savedWard],
  )
  const ready = inpatients.filter((e) => e.dischargePlan?.medicallyReady).length

  return (
    <Page>
      <PageHeader
        title={us ? "Inpatient — bed board" : "Wards — bed state"}
        description={us ? "Bed status across all units. Click an occupied bed to open the patient's chart." : "Bed state across all wards. Click an occupied bed to open the patient's record."}
        actions={
          <Button variant="primary" onPress={() => setAdmitting({})}>
            <Plus className="size-4" aria-hidden /> {us ? "Direct admission" : "Elective admission"}
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={us ? "Occupancy" : "Bed occupancy"} value={formatPercent((occupied / beds.length) * 100)} hint={`${occupied} of ${beds.length} staffed beds`} icon={BedDouble} tone="accent" />
        <Stat label="Clean / ready" value={count("available")} icon={BedSingle} tone="success" />
        <Stat label="Dirty (EVS)" value={count("cleaning")} icon={Sparkles} tone={count("cleaning") ? "warning" : "default"} />
        <Stat label={us ? "ED boarders" : "Awaiting a bed"} value={requests.length} icon={Clock} tone={requests.length ? "danger" : "default"} />
        <Stat label={us ? "Medically ready" : "NCTR"} value={ready} hint={`${count("maintenance")} blocked · ${count("reserved")} assigned`} />
      </div>

      {requests.length > 0 && (
        <Panel title={us ? "Pending admissions" : "Decisions to admit"} description={us ? "ED and clinic patients with an admit order, waiting for a bed" : "Patients in A&E or clinic awaiting a ward bed (12-hour standard from arrival)"} className="mb-6" flush>
          <ul className="divide-y divide-separator">
            {requests.map((r) => (
              <RequestRow key={r.id} encounter={r} onAdmit={() => setAdmitting({ request: r })} />
            ))}
          </ul>
        </Panel>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: "beds", label: "Bed board" },
            { value: "discharge", label: "Discharge planning", count: inpatients.length },
          ]}
        />
        <Segmented
          label={us ? "Unit" : "Ward"}
          value={savedWard}
          onChange={(v) => setUnitFilter("inpatient", v)}
          options={[{ value: "all", label: "All", count: beds.length }, ...wards.map((w) => ({ value: w.id, label: w.name.replace(/ \(.*\)/, ""), count: beds.filter((b) => b.unitId === w.id && b.status === "occupied").length }))]}
        />
      </div>

      {view === "discharge" && <DischargePlanningBoard encounters={inpatients} bedOf={(e) => (e.bedId ? bedById.get(e.bedId) : undefined)} />}

      {view === "beds" && wards
        .filter((w) => savedWard === "all" || w.id === savedWard)
        .map((w) => {
          const wardBeds = visible.filter((b) => b.unitId === w.id)
          return (
            <section key={w.id} className="mb-8">
              <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold">
                {unitName(w.id)}
                <span className="tabular text-xs font-normal text-muted">
                  {wardBeds.filter((b) => b.status === "occupied").length}/{wardBeds.length} occupied
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {wardBeds.map((b) => (
                  <BedCard
                    key={b.id}
                    bed={b}
                    encounter={b.encounterId ? encById.get(b.encounterId) : undefined}
                    onOpen={(e) => navigate(`/encounters/${e.id}`)}
                    onTransfer={setTransferring}
                    onAdmit={() => setAdmitting({ bedId: b.id, request: requests[0] })}
                  />
                ))}
              </div>
            </section>
          )
        })}
      {view === "beds" && visible.length === 0 && <Empty title="No beds" />}

      {admitting && <AdmitDialog request={admitting.request} bedId={admitting.bedId} onClose={() => setAdmitting(null)} />}
      {transferring && <TransferDialog encounter={transferring} onClose={() => setTransferring(undefined)} />}
    </Page>
  )
}

function RequestRow({ encounter, onAdmit }: { encounter: Encounter; onAdmit: () => void }) {
  const patient = useStore((s) => s.patients.find((p) => p.id === encounter.patientId))!
  const unitName = useUnitName()
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          {patient.name} <span className="text-sm font-normal text-muted">· {ageLabel(patient.birthDate)} · from {unitName(encounter.unitId)}</span>
        </div>
        <div className="text-sm text-muted">
          {encounter.diagnoses.find((d) => d.primary)?.display ?? encounter.chiefComplaint}
          {encounter.dispositionNote && ` — ${encounter.dispositionNote}`}
        </div>
      </div>
      <span className="tabular text-sm font-semibold text-danger">waiting {formatDuration(minutesSince(encounter.startedAt ?? encounter.createdAt))}</span>
      <PayerChip payer={encounter.payer} />
      <Button size="sm" variant="primary" onPress={onAdmit}>
        Assign bed
      </Button>
    </li>
  )
}

interface BedCardProps {
  bed: Bed
  encounter?: Encounter
  onOpen: (e: Encounter) => void
  onTransfer: (e: Encounter) => void
  onAdmit: () => void
}

const BLANKET: Record<BedStatus, string> = {
  occupied: "bg-accent-soft text-foreground",
  available: "border-2 border-dashed border-success/50 text-success",
  cleaning: "bg-hatch text-warning/40",
  maintenance: "bg-hatch text-danger/35",
  reserved: "border-2 border-dotted border-border text-muted",
}

/**
 * One bed drawn from above: headboard, pillow, blanket. The blanket carries the patient;
 * its fill is the bed status (hatching = not usable right now).
 */
function BedCard({ bed, encounter, onOpen, onTransfer, onAdmit }: BedCardProps) {
  const patients = usePatientMap()
  const staff = useStaffMap()
  const { setBedStatus } = useActions()
  const region = useRegion()
  const us = region === "us"
  const patient = encounter ? patients.get(encounter.patientId) : undefined
  const latest = encounter ? [...encounter.vitals].sort((a, b) => b.at.localeCompare(a.at))[0] : undefined
  const now = useNow()
  const los = encounter ? losDays(encounter, now) : 0
  const score = latest ? news2(latest) : null
  const alarm = score && score.risk !== "low"
  const plan = encounter?.dischargePlan
  const pastEdd = plan && new Date(plan.edd).getTime() < now - 12 * 3600000

  return (
    <article className={cn("rounded-[14px] border bg-surface p-3", alarm ? (score.risk === "high" ? "border-danger" : "border-warning") : "border-border")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="num text-sm font-bold">{bed.code}</span>
          <span className="label-caps text-muted">{BED_TYPE_LABEL[bed.bedType]}</span>
        </div>
        <div className="flex items-center gap-1">
          <BedStatusChip status={bed.status} />
          <Dropdown>
            <Dropdown.Trigger aria-label={`Actions for ${bed.code}`} className="grid size-7 place-items-center rounded-lg hover:bg-surface-secondary">
              <MoreVertical className="size-4" />
            </Dropdown.Trigger>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu
                aria-label="Bed actions"
                onAction={(key) => {
                  if (key === "open" && encounter) onOpen(encounter)
                  else if (key === "transfer" && encounter) onTransfer(encounter)
                  else if (key === "admit") onAdmit()
                  else {
                    setBedStatus(bed.id, key as BedStatus)
                    toast(`${bed.code}: status updated`)
                  }
                }}
              >
                {encounter ? (
                  <>
                    <Dropdown.Item id="open" textValue="Open chart"><Label>Open chart</Label></Dropdown.Item>
                    <Dropdown.Item id="transfer" textValue="Transfer bed"><Label>Transfer bed</Label></Dropdown.Item>
                  </>
                ) : (
                  <>
                    {bed.status === "available" && <Dropdown.Item id="admit" textValue="Admit to this bed"><Label>Admit to this bed</Label></Dropdown.Item>}
                    {bed.status !== "available" && <Dropdown.Item id="available" textValue="Mark clean / ready"><Label>Mark clean / ready</Label></Dropdown.Item>}
                    {bed.status !== "cleaning" && <Dropdown.Item id="cleaning" textValue="Mark dirty (EVS)"><Label>Mark dirty (EVS request)</Label></Dropdown.Item>}
                    {bed.status !== "reserved" && <Dropdown.Item id="reserved" textValue="Mark assigned"><Label>Mark assigned</Label></Dropdown.Item>}
                    {bed.status !== "maintenance" && <Dropdown.Item id="maintenance" textValue="Mark blocked"><Label>Mark blocked</Label></Dropdown.Item>}
                  </>
                )}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      </div>

      {/* The bed, from above */}
      <div className="flex h-[104px] items-stretch gap-1.5 rounded-xl border border-border bg-surface-secondary p-1.5">
        <div className="w-1.5 shrink-0 rounded-full bg-surface-tertiary" aria-hidden />
        <div className="flex w-7 shrink-0 items-center" aria-hidden>
          <div className="h-3/5 w-full rounded-md border border-border bg-surface" />
        </div>
        {encounter && patient ? (
          <button type="button" onClick={() => onOpen(encounter)} className={cn("min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-left transition hover:brightness-[0.97]", BLANKET.occupied)}>
            <div className="flex items-center gap-1.5">
              <span className="truncate font-semibold">{patient.name}</span>
              <MarkerDots patient={patient} />
            </div>
            <div className="num truncate text-[11px] text-muted">
              {patient.gender === "female" ? "F" : "M"} · {ageLabel(patient.birthDate)} · <span className={cn(pastEdd && "font-semibold text-danger")}>LOS {los} d{plan && ` · EDD ${formatDate(plan.edd)}`}</span>
            </div>
            <div className="mt-0.5 line-clamp-1 text-xs">{encounter.diagnoses.find((d) => d.primary)?.display ?? encounter.chiefComplaint}</div>
            <div className="mt-1 flex items-center gap-1.5">
              <News2Chip vitals={latest} />
              {encounter.admissionClass === "observation" && (
                <Chip size="sm" color="warning" variant="soft" className="num whitespace-nowrap">
                  OBS {obsHours(encounter, now)} h
                </Chip>
              )}
              {plan?.medicallyReady && (
                <Chip size="sm" color="success" variant="soft" className="whitespace-nowrap">
                  {us ? "Ready" : "NCTR"}
                </Chip>
              )}
              {us && imOverdue(encounter, now) && (
                <Chip size="sm" color="danger" variant="soft" className="whitespace-nowrap">
                  IM due
                </Chip>
              )}
              <span className="truncate text-[11px] text-muted">{staff.get(encounter.practitionerId ?? "")?.name.replace(/,.*$/, "")}</span>
            </div>
          </button>
        ) : (
          <div className={cn("flex min-w-0 flex-1 items-center justify-center rounded-lg text-center", BLANKET[bed.status])}>
            {bed.status === "available" ? (
              <button type="button" onClick={onAdmit} className="label-caps h-full w-full rounded-lg hover:bg-success/10">
                Clean · admit
              </button>
            ) : (
              <span className="label-caps rounded bg-surface px-2 py-1 text-muted">{bed.status === "cleaning" ? "EVS cleaning" : bed.status === "reserved" ? "Assigned" : "Blocked"}</span>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
