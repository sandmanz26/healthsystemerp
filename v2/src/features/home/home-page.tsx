/**
 * Home = the current role's worklist. Hospital staff work from queues ("who's next?"),
 * so each role lands on what needs them now, built only from the modules that are on.
 * KPIs follow the market pack: US homes track ED throughput (door-to-provider, LWBS),
 * observation status and denials; UK homes track the 4-hour standard, 12-hour breaches,
 * patients with no criteria to reside (NCTR) and NEWS2 escalations.
 */
import { Button, Chip } from "@heroui/react"
import {
  AlertOctagon, BedDouble, CalendarCheck, CircleAlert, Clock, FileHeart, FlaskConical, HeartPulse, Hourglass, MonitorPlay, Pill, Plus, Puzzle,
  Receipt, ScanLine, ShieldAlert, ShieldCheck, Siren, Stethoscope, Ticket, Timer, UserPlus, Users, Wallet,
} from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { Link, useNavigate } from "react-router-dom"
import { QueueTicket } from "@v2/components/clinical/queue-ticket"
import { ClaimStatusChip, OrderStatusChip, PriorityChip, RxStatusChip, TriageChip } from "@v2/components/status"
import { Page } from "@v2/components/ui/page"
import { Panel } from "@v2/components/ui/panel"
import { Stat } from "@v2/components/ui/stat"
import { LAB_MAP, orderTitle } from "@v2/domain/catalog"
import { ED_FOUR_HOUR_MIN, isCritical, minutesSince, news2 } from "@v2/domain/clinical"
import { invoiceBalance, invoiceTotal, isNhsFunded } from "@v2/domain/finance"
import { MODULES, moduleText, type ModuleId } from "@v2/domain/modules"
import { MEASURES, indicatorRate, meetsTarget } from "@v2/domain/quality"
import { REGIONS, type Region } from "@v2/domain/region"
import { ROLES } from "@v2/domain/roles"
import type { AppointmentSource, Encounter, RoleId } from "@v2/domain/types"
import { News2Chip } from "@v2/features/emr/clinical-widgets"
import { PatientForm } from "@v2/features/patients/patient-form"
import { RegisterVisitDialog } from "@v2/features/registration/register-visit-dialog"
import { cn } from "@v2/lib/cn"
import { dayKey, formatDate, formatDateLong, formatDuration, formatMoney, formatNumber, formatPercent, formatTime } from "@v2/lib/format"
import { shiftAt } from "@v2/lib/shift"
import { useNow } from "@v2/lib/use-now"
import { useStore } from "@v2/store"
import { isActive, stockOf, useEnabledModules, usePatientMap, useRegion, useSession, useUnitName } from "@v2/store/selectors"
import { WorkList, WorkRow } from "./widgets"

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
}

const SOURCE_LABEL: Record<Region, Record<AppointmentSource, string>> = {
  us: { portal: "Patient portal", phone: "Phone", referral: "Referral", "walk-in": "Walk-in" },
  uk: { portal: "NHS App", phone: "Phone", referral: "e-RS referral", "walk-in": "Walk-in" },
}

/** "Dr. Robert Kim, MD" → "Dr. Robert Kim"; "Sarah Miller, RN" → "Sarah". */
function salutation(name: string | undefined): string {
  if (!name) return ""
  const base = name.split(",")[0]
  return /^(Dr\.?|Mr|Mrs|Miss|Ms)\s/.test(base) ? base : base.split(" ")[0]
}

export default function HomePage() {
  const { role, user } = useSession()
  const facility = useStore((s) => s.facility.name)
  const region = useRegion()
  const HOMES: Record<RoleId, () => ReactNode> = {
    frontdesk: FrontdeskHome,
    doctor: DoctorHome,
    nurse: NurseHome,
    pharmacist: PharmacistHome,
    labtech: () => <OrdersHome kind="lab" />,
    radiographer: () => <OrdersHome kind="rad" />,
    cashier: CashierHome,
    coder: CoderHome,
    manager: ManagerHome,
    admin: AdminHome,
  }
  const Home = HOMES[role]
  return (
    <Page>
      <ShiftBoard greeting={`${greeting()}, ${salutation(user?.name)}`} role={ROLES[role].label} description={ROLES[role].description} facility={`${facility} · ${REGIONS[region].short}`} />
      <Home />
    </Page>
  )
}

/** Header of the home page: who is working, which shift, and when it hands over. */
function ShiftBoard({ greeting, role, facility }: { greeting: string; role: string; description: string; facility: string }) {
  const now = useNow(30_000)
  const shift = shiftAt(now)
  const left = shift.remainingMin
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold leading-tight">{greeting}</h1>
      <p className="num mt-1 text-sm text-muted">
        {role} · {shift.label} shift {shift.start}–{shift.end}, handover in {Math.floor(left / 60)} h {left % 60} min · {formatDateLong(new Date(now))} · {facility}
      </p>
    </header>
  )
}

/** Renders children only when the module is on — homes never show dead widgets. */
function When({ module, children }: { module: ModuleId; children: ReactNode }) {
  const enabled = useEnabledModules()
  return enabled.has(module) ? <>{children}</> : null
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="gap-4 lg:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">{children}</div>
}

function Stats({ children }: { children: ReactNode }) {
  return <div className="stat-strip mb-6 grid grid-cols-2 lg:grid-cols-4">{children}</div>
}

function useToday() {
  const encounters = useStore((s) => s.encounters)
  const now = useNow()
  return useMemo(() => encounters.filter((e) => dayKey(e.createdAt) === dayKey(now)), [encounters, now])
}

const latestVitals = (e: Encounter) => [...e.vitals].sort((a, b) => b.at.localeCompare(a.at))[0]

// ---------------------------------------------------------------------------------------

function FrontdeskHome() {
  const today = useToday()
  const appointments = useStore((s) => s.appointments)
  const patients = usePatientMap()
  const unitName = useUnitName()
  const region = useRegion()
  const navigate = useNavigate()
  const now = useNow()
  const [dialog, setDialog] = useState<"visit" | "patient" | null>(null)
  const waiting = today.filter((e) => e.kind === "outpatient" && e.status === "registered")
  const longWait = waiting.filter((e) => minutesSince(e.createdAt, now) > 60)
  const booked = appointments.filter((a) => a.status === "booked" && dayKey(a.date) === dayKey())
  const unverified = today.filter((e) => e.kind !== "inpatient" && e.status !== "cancelled" && !e.eligibility && !(region === "us" && e.payer === "self-pay"))

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        <When module="registration">
          <Button variant="primary" size="lg" onPress={() => setDialog("visit")}>
            <Plus className="size-4" aria-hidden /> Register visit
          </Button>
        </When>
        <Button variant="secondary" size="lg" onPress={() => setDialog("patient")}>
          <UserPlus className="size-4" aria-hidden /> New patient
        </Button>
        <When module="registration">
          <Link to="/registration/display" target="_blank">
            <Button variant="tertiary" size="lg">
              <MonitorPlay className="size-4" aria-hidden /> Waiting-room display
            </Button>
          </Link>
        </When>
      </div>
      <Stats>
        <Stat label="Registered today" value={today.filter((e) => e.kind !== "inpatient" && e.status !== "cancelled").length} icon={Ticket} tone="accent" onClick={() => navigate("/registration")} />
        <Stat label="Waiting in clinics" value={waiting.length} icon={Users} tone="warning" />
        <Stat label="Waiting > 60 min" value={longWait.length} icon={Clock} tone={longWait.length ? "danger" : "success"} />
        {region === "us" ? (
          <Stat label="Eligibility not verified" value={unverified.length} hint="X12 270/271" icon={ShieldCheck} tone={unverified.length ? "warning" : "success"} />
        ) : (
          <Stat label="PDS trace pending" value={unverified.length} hint="NHS number not verified on Spine" icon={ShieldCheck} tone={unverified.length ? "warning" : "success"} />
        )}
      </Stats>
      <Grid>
        <When module="registration">
          <WorkList title="Longest waits" description="Consider checking in with the clinic" to="/registration" empty="Nobody is waiting.">
            {[...waiting].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 6).map((e) => (
              <WorkRow key={e.id} to={`/patients/${e.patientId}`} lead={<QueueTicket number={e.queueNumber} />} title={patients.get(e.patientId)?.name} sub={unitName(e.unitId)} aside={<span className={minutesSince(e.createdAt, now) > 60 ? "tabular text-sm font-semibold text-danger" : "tabular text-sm text-muted"}>{formatDuration(minutesSince(e.createdAt, now))}</span>} />
            ))}
          </WorkList>
        </When>
        <When module="appointments">
          <WorkList title="Today's appointments" description={`Not yet checked in · ${booked.length} remaining`} to="/registration" linkLabel="Check in" empty="Every booked patient has arrived.">
            {booked.slice(0, 6).map((a) => (
              <WorkRow key={a.id} to="/registration" lead={<span className="num w-14 text-sm font-semibold">{a.time}</span>} title={patients.get(a.patientId)?.name} sub={`${unitName(a.unitId)} · ${SOURCE_LABEL[region][a.source]}`} aside={<CalendarCheck className="size-4 text-muted" aria-hidden />} />
            ))}
          </WorkList>
        </When>
      </Grid>
      {dialog === "visit" && <RegisterVisitDialog isOpen onOpenChange={(o) => !o && setDialog(null)} />}
      {dialog === "patient" && <PatientForm isOpen onOpenChange={(o) => !o && setDialog(null)} onSaved={(id) => navigate(`/patients/${id}`)} />}
    </>
  )
}

function DoctorHome() {
  const { user } = useSession()
  const encounters = useStore((s) => s.encounters)
  const orders = useStore((s) => s.orders)
  const beds = useStore((s) => s.beds)
  const patients = usePatientMap()
  const region = useRegion()
  const today = useToday()
  const now = useNow()
  const myOp = today.filter((e) => e.kind === "outpatient" && e.practitionerId === user?.id)
  const myWaiting = myOp.filter((e) => e.status === "registered" || e.status === "called")
  const myInpatients = encounters
    .filter((e) => e.kind === "inpatient" && e.status === "in-progress" && e.practitionerId === user?.id)
    .map((e) => {
      const latest = latestVitals(e)
      return { e, latest, score: latest ? news2(latest)?.score ?? 0 : 0 }
    })
    .sort((a, b) => b.score - a.score)
  const myEncounterIds = new Set(encounters.filter((e) => e.practitionerId === user?.id && isActive(e)).map((e) => e.id))
  const critical = orders.filter((o) => myEncounterIds.has(o.encounterId) && o.results.some((r) => isCritical(r.flag)))
  const unsigned = encounters.filter((e) => myEncounterIds.has(e.id)).flatMap((e) => e.notes.filter((n) => n.role !== "doctor" && !n.verifiedBy).map((n) => ({ e, n })))

  return (
    <>
      <Stats>
        <Stat label="Clinic patients waiting" value={myWaiting.length} hint={`${myOp.filter((e) => e.status === "finished").length} seen today`} icon={Stethoscope} tone="accent" />
        <Stat label={region === "uk" ? "Inpatients (named consultant)" : "Inpatients (attending)"} value={myInpatients.length} icon={BedDouble} />
        <Stat label="Critical results" value={critical.length} icon={AlertOctagon} tone={critical.length ? "danger" : "success"} />
        <Stat label="Notes awaiting co-signature" value={unsigned.length} icon={CircleAlert} tone={unsigned.length ? "warning" : "default"} />
      </Stats>
      <Grid>
        <When module="outpatient">
          <WorkList title="My clinic queue" to="/outpatient" linkLabel="Worklist" empty="No patients waiting.">
            {myWaiting.slice(0, 6).map((e) => (
              <WorkRow key={e.id} to="/outpatient" lead={<QueueTicket number={e.queueNumber} />} title={patients.get(e.patientId)?.name} sub={e.chiefComplaint} aside={<span className="tabular text-sm text-muted">{formatDuration(minutesSince(e.createdAt, now))}</span>} />
            ))}
          </WorkList>
        </When>
        <When module="inpatient">
          <WorkList title={region === "uk" ? "My ward patients" : "My inpatients"} description="Sorted by NEWS2, highest first — see the sickest patients first on rounds" to="/inpatient" empty="No inpatients under your care.">
            {myInpatients.slice(0, 8).map(({ e, latest }) => (
              <WorkRow
                key={e.id}
                to={`/encounters/${e.id}`}
                lead={<span className="num w-16 text-xs font-bold text-muted">{beds.find((b) => b.id === e.bedId)?.code}</span>}
                title={patients.get(e.patientId)?.name}
                sub={(() => {
                  const dx = e.diagnoses.find((d) => d.primary)
                  return dx ? `${REGIONS[region].dxSystem.split(" ")[0]} ${dx.code} · ${dx.display}` : e.chiefComplaint
                })()}
                aside={
                  <span className="flex items-center gap-1">
                    {region === "us" && e.admissionClass === "observation" && (
                      <Chip size="sm" variant="soft" color="warning">
                        OBS
                      </Chip>
                    )}
                    <News2Chip vitals={latest} />
                  </span>
                }
              />
            ))}
          </WorkList>
        </When>
        <When module="laboratory">
          <WorkList title="Critical results — my patients" description="Acknowledge and document read-back" to="/laboratory" empty="No critical values.">
            {critical.slice(0, 6).map((o) => (
              <WorkRow
                key={o.id}
                to={`/encounters/${o.encounterId}`}
                title={patients.get(o.patientId)?.name}
                sub={o.results
                  .filter((r) => isCritical(r.flag))
                  .map((r) => `${LAB_MAP[r.testCode]?.name ?? r.testCode} ${r.value}${r.unit ? ` ${r.unit}` : ""}`)
                  .join(", ")}
                aside={
                  <Chip size="sm" color="danger" variant="primary">
                    Critical
                  </Chip>
                }
              />
            ))}
          </WorkList>
        </When>
        {unsigned.length > 0 && (
          <WorkList title="Notes awaiting your co-signature" description="Written by nurses, residents or APPs on your patients" to="/inpatient" empty="">
            {unsigned.slice(0, 6).map(({ e, n }) => (
              <WorkRow key={n.id} to={`/encounters/${e.id}`} title={patients.get(e.patientId)?.name} sub={n.assessment || n.subjective} aside={<Chip size="sm" variant="soft">{ROLES[n.role].label}</Chip>} />
            ))}
          </WorkList>
        )}
      </Grid>
    </>
  )
}

function NurseHome() {
  const { user } = useSession()
  const encounters = useStore((s) => s.encounters)
  const mar = useStore((s) => s.mar)
  const beds = useStore((s) => s.beds)
  const items = useStore((s) => s.inventory)
  const patients = usePatientMap()
  const unitName = useUnitName()
  const region = useRegion()
  const now = useNow()
  const isEd = user?.unitId === "ed"
  const ward = encounters.filter((e) => e.kind === "inpatient" && e.status === "in-progress" && (e.unitId === user?.unitId || !user?.unitId))
  const risky = ward.map((e) => ({ e, latest: latestVitals(e) })).filter((x) => x.latest && (news2(x.latest)?.score ?? 0) >= 5)
  const wardIds = new Set(ward.map((e) => e.id))
  const due = mar.filter((m) => wardIds.has(m.encounterId) && m.status === "due" && new Date(m.scheduledAt).getTime() < now + 2 * 3600000).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const ed = encounters.filter((e) => e.kind === "emergency" && isActive(e))
  const edLabel = region === "uk" ? "A&E" : "ED"

  return (
    <>
      <Stats>
        <Stat label={isEd ? `Patients in ${edLabel}` : `Patients on ${unitName(user?.unitId).replace(/ \(.*\)/, "")}`} value={isEd ? ed.length : ward.length} icon={HeartPulse} tone="accent" />
        <Stat label="NEWS2 ≥ 5" value={risky.length} hint="Urgent clinical review" icon={AlertOctagon} tone={risky.length ? "danger" : "success"} />
        <Stat label="Meds due in next 2 h" value={due.length} hint="Scan wristband + dose (BCMA)" icon={Pill} tone={due.some((m) => new Date(m.scheduledAt).getTime() < now - 1800000) ? "danger" : "default"} />
        <Stat label={`${edLabel} awaiting triage`} value={ed.filter((e) => !e.triage).length} hint={region === "uk" ? "Manchester Triage" : "ESI v5"} icon={Siren} tone={ed.some((e) => !e.triage) ? "danger" : "default"} />
      </Stats>
      <Grid>
        <When module="nursing">
          <WorkList title="Deteriorating patients (NEWS2 ≥ 5)" description={region === "uk" ? "Escalate to the medical team / critical care outreach" : "Call the provider or rapid response team; increase observations"} to="/nursing" empty="No high-risk patients.">
            {risky.map(({ e, latest }) => (
              <WorkRow key={e.id} to={`/encounters/${e.id}`} lead={<span className="num w-16 text-xs font-bold text-muted">{beds.find((b) => b.id === e.bedId)?.code}</span>} title={patients.get(e.patientId)?.name} sub={news2(latest!)?.response} aside={<News2Chip vitals={latest} />} />
            ))}
          </WorkList>
          <WorkList title="Medication schedule (eMAR)" to="/nursing" empty="No medications due.">
            {due.slice(0, 6).map((m) => {
              const e = ward.find((x) => x.id === m.encounterId)!
              const item = items.find((i) => i.id === m.itemId)
              return (
                <WorkRow
                  key={m.id}
                  to="/nursing"
                  title={`${formatTime(m.scheduledAt)} · ${item?.name ?? m.itemId}`}
                  sub={`${m.dose} ${m.route} · ${patients.get(e.patientId)?.name}`}
                  aside={
                    item?.highAlert ? (
                      <Chip size="sm" color="danger" variant="soft">
                        High-alert · 2-person check
                      </Chip>
                    ) : undefined
                  }
                />
              )
            })}
          </WorkList>
        </When>
        <When module="emergency">
          <WorkList title={`${edLabel} now`} to="/emergency" empty={`${edLabel} is empty.`}>
            {ed.slice(0, 6).map((e) => (
              <WorkRow key={e.id} to="/emergency" title={patients.get(e.patientId)?.name} sub={`${e.chiefComplaint} · ${formatDuration(minutesSince(e.createdAt, now))} since arrival`} aside={<TriageChip level={e.triage} />} />
            ))}
          </WorkList>
        </When>
      </Grid>
    </>
  )
}

function PharmacistHome() {
  const prescriptions = useStore((s) => s.prescriptions)
  const inventory = useStore((s) => s.inventory)
  const patients = usePatientMap()
  const now = useNow()
  const queue = prescriptions.filter((p) => p.status === "new" || p.status === "reviewed" || p.status === "prepared").sort((a, b) => a.prescribedAt.localeCompare(b.prescribedAt))
  const low = inventory.filter((i) => i.category === "drug" && stockOf(i) < i.minStock)
  const expiring = inventory.flatMap((i) => i.batches.map((b) => ({ i, b }))).filter(({ b }) => new Date(b.expiry).getTime() < now + 90 * 86400000)
  return (
    <>
      <Stats>
        <Stat label="Awaiting verification" value={queue.filter((p) => p.status === "new").length} icon={ShieldAlert} tone="warning" />
        <Stat label="Being prepared / ready" value={queue.filter((p) => p.status !== "new").length} icon={Pill} tone="accent" />
        <Stat label="Below par level" value={low.length} tone={low.length ? "danger" : "success"} />
        <Stat label="Lots expiring ≤ 90 days" value={expiring.length} hint="FEFO" tone={expiring.length ? "warning" : "default"} />
      </Stats>
      <Grid>
        <WorkList title="Verification queue" to="/pharmacy" empty="Queue is empty.">
          {queue.slice(0, 8).map((p) => (
            <WorkRow key={p.id} to="/pharmacy" title={patients.get(p.patientId)?.name} sub={`${p.items.length} item${p.items.length === 1 ? "" : "s"} · waiting ${formatDuration(minutesSince(p.prescribedAt, now))}`} aside={<RxStatusChip status={p.status} />} />
          ))}
        </WorkList>
        <When module="inventory">
          <WorkList title="Low stock" to="/inventory" empty="All stock above par.">
            {low.slice(0, 8).map((i) => (
              <WorkRow
                key={i.id}
                to="/inventory"
                title={i.name}
                sub={[i.atc && `ATC ${i.atc}`, i.controlled && `Schedule ${i.controlled}`].filter(Boolean).join(" · ") || undefined}
                aside={
                  <span className="tabular text-sm font-semibold text-danger">
                    {stockOf(i)} / {i.minStock}
                  </span>
                }
              />
            ))}
          </WorkList>
        </When>
      </Grid>
    </>
  )
}

function OrdersHome({ kind }: { kind: "lab" | "rad" }) {
  const orders = useStore((s) => s.orders)
  const patients = usePatientMap()
  const region = useRegion()
  const now = useNow()
  const mine = orders.filter((o) => o.kind === kind && o.status !== "validated" && o.status !== "cancelled").sort((a, b) => (a.priority === b.priority ? a.orderedAt.localeCompare(b.orderedAt) : a.priority === "stat" ? -1 : 1))
  const Icon = kind === "lab" ? FlaskConical : ScanLine
  const to = kind === "lab" ? "/laboratory" : "/radiology"
  const pendingAuth = kind === "rad" ? mine.filter((o) => o.auth === "pending").length : 0
  return (
    <>
      <Stats>
        <Stat label="STAT orders" value={mine.filter((o) => o.priority === "stat").length} icon={Siren} tone="danger" />
        <Stat label={kind === "lab" ? "To collect" : "To perform"} value={mine.filter((o) => o.status === "ordered").length} icon={Icon} tone="accent" />
        <Stat label="In progress" value={mine.filter((o) => o.status === "collected" || o.status === "in-progress").length} />
        {kind === "rad" && region === "us" ? (
          <Stat label="Prior auth pending" value={pendingAuth} hint="Advanced imaging (RBM)" tone={pendingAuth ? "warning" : "default"} />
        ) : (
          <Stat label={kind === "lab" ? "To verify" : "To report"} value={mine.filter((o) => o.status === "resulted").length} tone="warning" />
        )}
      </Stats>
      <WorkList title="Worklist" description="STAT first, then oldest" to={to} empty="No active orders.">
        {mine.slice(0, 10).map((o) => (
          <WorkRow
            key={o.id}
            to={to}
            title={`${patients.get(o.patientId)?.name} · ${orderTitle(o)}`}
            sub={`Ordered ${formatDuration(minutesSince(o.orderedAt, now))} ago`}
            aside={
              <div className="flex gap-1">
                <PriorityChip priority={o.priority} />
                <OrderStatusChip status={o.status} />
              </div>
            }
          />
        ))}
      </WorkList>
    </>
  )
}

function CashierHome() {
  const invoices = useStore((s) => s.invoices)
  const encounters = useStore((s) => s.encounters)
  const patients = usePatientMap()
  const region = useRegion()
  const finished = new Set(encounters.filter((e) => e.status === "finished").map((e) => e.id))
  const open = invoices.filter((i) => i.status === "open" && !isNhsFunded(i.payer) && invoiceBalance(i) > 0 && finished.has(i.encounterId))
  const paymentsToday = invoices.flatMap((i) => i.payments).filter((p) => dayKey(p.at) === dayKey())
  const collected = paymentsToday.reduce((s, p) => s + p.amount, 0)
  return (
    <>
      <Stats>
        <Stat label={region === "uk" ? "Unpaid invoices" : "Open patient balances"} value={open.length} hint={region === "uk" ? "Private & overseas patients" : "Self-pay, copays & deductibles"} icon={Receipt} tone="warning" />
        <Stat label="Outstanding" value={formatMoney(open.reduce((s, i) => s + invoiceBalance(i), 0))} icon={Wallet} />
        <Stat label="Collected today" value={formatMoney(collected)} tone="success" />
        <Stat label="Payments today" value={paymentsToday.length} />
      </Stats>
      <WorkList title="Awaiting payment" to="/billing" empty="No open balances.">
        {open.slice(0, 10).map((i) => (
          <WorkRow key={i.id} to="/billing" title={patients.get(i.patientId)?.name} sub={i.number} aside={<span className="tabular text-sm font-semibold">{formatMoney(invoiceBalance(i))}</span>} />
        ))}
      </WorkList>
    </>
  )
}

function CoderHome() {
  const claims = useStore((s) => s.claims)
  const encounters = useStore((s) => s.encounters)
  const patients = usePatientMap()
  const region = useRegion()
  const encById = new Map(encounters.map((e) => [e.id, e]))
  const todo = claims.filter((c) => c.status === "draft")
  const denied = claims.filter((c) => c.status === "denied" || c.status === "appealed")
  const dx = REGIONS[region].dxSystem.split(" ")[0]
  return (
    <>
      <Stats>
        <Stat label={region === "uk" ? "Spells awaiting coding" : "Unbilled — not coded (DNFB)"} value={todo.length} icon={FileHeart} tone="warning" />
        <Stat label={region === "uk" ? "Ready for SUS+ / insurer" : "Ready to submit (837)"} value={claims.filter((c) => c.status === "coded").length} tone="accent" />
        <Stat
          label={region === "uk" ? "Rejected / queried" : "Denials to work"}
          value={denied.length}
          hint={region === "us" && denied.length ? formatMoney(denied.reduce((s, c) => s + (c.billed ?? 0), 0)) + " billed" : undefined}
          icon={CircleAlert}
          tone={denied.length ? "danger" : "success"}
        />
        <Stat label={region === "uk" ? "Accepted / paid" : "Paid (835)"} value={claims.filter((c) => c.status === "accepted" || c.status === "paid").length} tone="success" />
      </Stats>
      <Grid>
        <WorkList title={region === "uk" ? "Rejections & insurer queries" : "Denial work queue"} description={region === "uk" ? "Correct and resubmit before the SUS+ reconciliation deadline" : "Appeal or correct within the payer's timely-filing window"} to="/claims" empty="No denials.">
          {denied.slice(0, 6).map((c) => (
            <WorkRow
              key={c.id}
              to="/claims"
              title={patients.get(encById.get(c.encounterId)?.patientId ?? "")?.name}
              sub={c.denial ? `${region === "us" ? "CARC " : ""}${c.denial.carc}${c.denial.rarc ? ` / RARC ${c.denial.rarc}` : ""} · ${c.denial.text}` : c.note}
              aside={<ClaimStatusChip status={c.status} />}
            />
          ))}
        </WorkList>
        <WorkList title="Coding work queue" to="/claims" empty="Everything is coded.">
          {todo.slice(0, 6).map((c) => {
            const e = encById.get(c.encounterId)
            const primary = e?.diagnoses.find((d) => d.primary)
            return <WorkRow key={c.id} to="/claims" title={patients.get(e?.patientId ?? "")?.name} sub={primary ? `${dx} ${primary.code} · ${primary.display}` : "No principal diagnosis yet"} aside={<ClaimStatusChip status={c.status} />} />
          })}
        </WorkList>
      </Grid>
    </>
  )
}

/** ED and flow KPIs, computed from today's encounters. */
function useFlowKpis(now: number) {
  const encounters = useStore((s) => s.encounters)
  return useMemo(() => {
    const today = encounters.filter((e) => dayKey(e.createdAt) === dayKey(now))
    const ed = today.filter((e) => e.kind === "emergency")
    const allEd = encounters.filter((e) => e.kind === "emergency")
    const seen = ed.filter((e) => e.startedAt)
    const d2p = seen.map((e) => (new Date(e.startedAt!).getTime() - new Date(e.createdAt).getTime()) / 60000).sort((a, b) => a - b)
    const median = d2p.length ? d2p[Math.floor(d2p.length / 2)] : undefined
    const lwbs = ed.filter((e) => e.status === "cancelled" && !e.startedAt).length
    const lengthOf = (e: Encounter) => ((e.endedAt ? new Date(e.endedAt).getTime() : now) - new Date(e.createdAt).getTime()) / 60000
    const departed = ed.filter((e) => e.endedAt)
    const within4h = departed.filter((e) => lengthOf(e) <= ED_FOUR_HOUR_MIN).length
    const breaching = allEd.filter((e) => isActive(e) && lengthOf(e) > ED_FOUR_HOUR_MIN).length
    const twelveHour = allEd.filter((e) => (isActive(e) || dayKey(e.endedAt ?? e.createdAt) === dayKey(now)) && lengthOf(e) > 720).length
    const inpatients = encounters.filter((e) => e.kind === "inpatient" && e.status === "in-progress")
    return {
      today,
      edCount: ed.length,
      doorToProvider: median,
      lwbsPct: ed.length ? (lwbs / ed.length) * 100 : 0,
      lwbs,
      fourHourPct: departed.length + breaching ? (within4h / (departed.length + breaching)) * 100 : undefined,
      breaching,
      twelveHour,
      observation: inpatients.filter((e) => e.admissionClass === "observation").length,
      nctr: inpatients.filter((e) => e.dischargePlan?.medicallyReady).length,
      news2High: inpatients.filter((e) => {
        const v = latestVitals(e)
        return v && (news2(v)?.score ?? 0) >= 5
      }).length,
      awaitingBed: encounters.filter((e) => e.status === "awaiting-admission").length,
    }
  }, [encounters, now])
}

function ManagerHome() {
  const beds = useStore((s) => s.beds)
  const invoices = useStore((s) => s.invoices)
  const claims = useStore((s) => s.claims)
  const incidents = useStore((s) => s.incidents)
  const indicators = useStore((s) => s.indicators)
  const region = useRegion()
  const navigate = useNavigate()
  const now = useNow()
  const k = useFlowKpis(now)
  const occupied = beds.filter((b) => b.status === "occupied").length
  const chargesToday = invoices.filter((i) => i.status !== "void" && dayKey(i.createdAt) === dayKey()).reduce((s, i) => s + invoiceTotal(i), 0)
  const denials = claims.filter((c) => c.status === "denied")
  const openHighRisk = incidents.filter((i) => i.status !== "closed" && (i.grade === "high" || i.grade === "extreme")).length
  const measures = MEASURES[region]
  const latest = [...new Set(indicators.map((i) => i.period))].sort().pop()
  const scored = measures.map((d) => {
    const v = indicators.find((i) => i.indicatorId === d.id && i.period === latest)
    const rate = v ? indicatorRate(v, d.unit) : undefined
    return { d, rate, ok: rate !== undefined && meetsTarget(d, rate) }
  })
  const met = scored.filter((x) => x.ok).length
  const ed = region === "uk" ? "A&E" : "ED"

  return (
    <>
      <Stats>
        <Stat
          label={region === "uk" ? "Attendances today" : "Visits today"}
          value={k.today.filter((e) => e.status !== "cancelled").length}
          hint={`${region === "uk" ? "OP" : "Clinic"} ${k.today.filter((e) => e.kind === "outpatient").length} · ${ed} ${k.edCount}`}
          icon={Users}
          tone="accent"
          onClick={() => navigate("/reports")}
        />
        <Stat label="Bed occupancy" value={formatPercent(beds.length ? (occupied / beds.length) * 100 : 0)} hint={`${occupied}/${beds.length} staffed beds`} icon={BedDouble} onClick={() => navigate("/inpatient")} />
        {region === "us" ? (
          <>
            <Stat label="Charges posted today" value={formatMoney(chargesToday)} icon={Wallet} tone="success" />
            <Stat
              label="Open denials"
              value={denials.length}
              hint={denials.length ? `${formatMoney(denials.reduce((s, c) => s + (c.billed ?? 0), 0))} at risk` : "None"}
              icon={FileHeart}
              tone={denials.length ? "warning" : "success"}
              onClick={() => navigate("/claims")}
            />
          </>
        ) : (
          <>
            <Stat
              label="4-hour performance"
              value={k.fourHourPct === undefined ? "—" : formatPercent(k.fourHourPct)}
              hint={`Standard 78% · ${k.breaching} breaching now`}
              icon={Timer}
              tone={k.fourHourPct === undefined ? "default" : k.fourHourPct >= 78 ? "success" : "danger"}
              onClick={() => navigate("/emergency")}
            />
            <Stat label="12-hour breaches" value={k.twelveHour} hint="Arrival to departure > 12 h" icon={Hourglass} tone={k.twelveHour ? "danger" : "success"} onClick={() => navigate("/emergency")} />
          </>
        )}
      </Stats>
      <Stats>
        {region === "us" ? (
          <>
            <Stat
              label="ED door-to-provider (median)"
              value={k.doorToProvider === undefined ? "—" : formatDuration(Math.round(k.doorToProvider))}
              hint="Goal ≤ 30 min"
              icon={Timer}
              tone={k.doorToProvider === undefined ? "default" : k.doorToProvider <= 30 ? "success" : "warning"}
              onClick={() => navigate("/emergency")}
            />
            <Stat label="Left without being seen" value={formatPercent(k.lwbsPct)} hint={`${k.lwbs} of ${k.edCount} · CMS OP-22 goal ≤ 2%`} icon={Siren} tone={k.lwbsPct > 2 ? "danger" : "success"} />
            <Stat label="Observation patients" value={k.observation} hint="Two-Midnight Rule review" icon={Clock} tone={k.observation ? "warning" : "default"} onClick={() => navigate("/inpatient")} />
          </>
        ) : (
          <>
            <Stat label="No criteria to reside" value={k.nctr} hint="Medically optimised, awaiting discharge" icon={Clock} tone={k.nctr ? "warning" : "success"} onClick={() => navigate("/inpatient")} />
            <Stat label="Inpatients NEWS2 ≥ 5" value={k.news2High} hint="Urgent clinical response (RCP)" icon={AlertOctagon} tone={k.news2High ? "danger" : "success"} onClick={() => navigate("/nursing")} />
            <Stat label="Decision to admit, no bed" value={k.awaitingBed} icon={BedDouble} tone={k.awaitingBed ? "warning" : "default"} />
          </>
        )}
        <Stat label="Open high / extreme incidents" value={openHighRisk} icon={ShieldAlert} tone={openHighRisk ? "danger" : "success"} onClick={() => navigate("/quality")} />
      </Stats>

      <When module="quality">
        <Panel
          className="mb-6"
          title={`Quality measures · ${met}/${measures.length} on target`}
          description={`${region === "uk" ? "NHS constitutional standards, NICE & safety measures" : "CMS, Joint Commission, NDNQI & NHSN measures"}${latest ? ` · period ${latest}` : ""}`}
          actions={
            <Link to="/quality" className="label-caps text-accent hover:underline">
              All measures
            </Link>
          }
          flush
        >
          <ul className="grid divide-y divide-separator sm:grid-cols-2 sm:divide-y-0">
            {scored.slice(0, 8).map(({ d, rate, ok }) => (
              <li key={d.id} className="flex items-center gap-3 border-separator px-5 py-2.5 sm:border-b">
                <span className={cn("size-2 shrink-0 rounded-full", rate === undefined ? "bg-border" : ok ? "bg-success" : "bg-danger")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{d.name}</span>
                  <span className="label-caps block truncate text-muted">Source: {d.source}</span>
                </span>
                <span className="num shrink-0 text-right text-sm">
                  <b className={ok ? "text-foreground" : "text-danger"}>{rate === undefined ? "—" : d.unit === "%" ? formatPercent(rate) : formatNumber(rate)}</b>
                  <span className="block text-xs text-muted">
                    {d.direction === "min" ? "≥" : "≤"} {d.target}
                    {d.unit === "%" ? "%" : ` ${d.unit}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </When>

      <Link to="/modules" className="block">
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-accent/40 p-4 text-sm hover:bg-accent-soft/40">
          <Puzzle className="size-5 text-accent" aria-hidden />
          <span>
            See which modules are on and what to add next in the <b>{region === "uk" ? "Module Centre" : "Module Center"}</b>.
          </span>
        </div>
      </Link>
    </>
  )
}

function AdminHome() {
  const modules = useStore((s) => s.modules)
  const jobs = useStore((s) => s.syncJobs)
  const staff = useStore((s) => s.staff)
  const audit = useStore((s) => s.audit)
  const enabled = useEnabledModules()
  const region = useRegion()
  const now = useNow()
  const soon = now + 60 * 86400000
  const incomplete = MODULES.filter((m) => enabled.has(m.id) && moduleText(m.id, region).setup.some((s) => !modules[m.id].setupDone.includes(s.id)))
  const failed = jobs.filter((j) => j.status === "failed")
  const expiring = staff.flatMap((s) => {
    const out: { id: string; staffId: string; name: string; what: string; expires: string }[] = []
    if (s.license && new Date(s.license.expires).getTime() < soon) out.push({ id: `${s.id}-lic`, staffId: s.id, name: s.name, what: `${s.license.body} ${s.license.number}`, expires: s.license.expires })
    if (s.deaExpires && new Date(s.deaExpires).getTime() < soon) out.push({ id: `${s.id}-dea`, staffId: s.id, name: s.name, what: "DEA registration", expires: s.deaExpires })
    if (s.resusCertExpires && new Date(s.resusCertExpires).getTime() < soon) out.push({ id: `${s.id}-resus`, staffId: s.id, name: s.name, what: region === "uk" ? "Resus Council ILS/ALS" : "BLS / ACLS", expires: s.resusCertExpires })
    return out
  })
  const breakGlass = audit.filter((a) => a.breakGlass).length
  const staffName = (id: string) => staff.find((u) => u.id === id)?.name ?? id

  return (
    <>
      <Stats>
        <Stat label="Modules on" value={`${MODULES.filter((m) => !m.core && enabled.has(m.id)).length}/${MODULES.filter((m) => !m.core).length}`} hint="Excluding core modules" icon={Puzzle} tone="accent" />
        <Stat label="Go-live checklists open" value={incomplete.length} tone={incomplete.length ? "warning" : "success"} />
        <Stat label="Interface errors" value={failed.length} hint={region === "uk" ? "HL7 v2 · FHIR · Spine · MESH" : "HL7 v2 · FHIR · X12 · Surescripts"} tone={failed.length ? "danger" : "success"} />
        <Stat label="Credentials expiring ≤ 60 days" value={expiring.length} hint={region === "uk" ? "GMC / NMC / HCPC, resus" : "State license, DEA, BLS/ACLS"} tone={expiring.length ? "danger" : "success"} />
      </Stats>
      <Grid>
        <WorkList title="Module go-live checklists" to="/modules" empty="Every enabled module is ready.">
          {incomplete.map((m) => {
            const t = moduleText(m.id, region)
            return <WorkRow key={m.id} to={`/modules?focus=${m.id}`} title={t.name} sub={t.setup.filter((s) => !modules[m.id].setupDone.includes(s.id)).map((s) => s.label).join(" · ")} />
          })}
        </WorkList>
        <When module="interop">
          <WorkList title="Failed interface messages" to="/integrations" empty="No failures.">
            {failed.slice(0, 6).map((j) => (
              <WorkRow key={j.id} to="/integrations" title={`${j.resource} · ${j.integration.toUpperCase()}`} sub={j.error} aside={<span className="num text-xs text-muted">{j.attempts}×</span>} />
            ))}
          </WorkList>
        </When>
        <WorkList title="Recent activity" description={breakGlass ? `${breakGlass} break-the-glass access event${breakGlass === 1 ? "" : "s"} to review` : undefined} to="/settings" linkLabel="Access audit" empty="No activity yet.">
          {audit.slice(0, 6).map((a) => (
            <WorkRow
              key={a.id}
              to="/settings"
              title={a.action}
              sub={`${staffName(a.userId)} · ${a.target}`}
              aside={
                a.breakGlass ? (
                  <Chip size="sm" color="danger" variant="soft">
                    Break the glass
                  </Chip>
                ) : undefined
              }
            />
          ))}
        </WorkList>
        <When module="hr">
          <WorkList title="Licenses & certifications to renew" to="/hr" empty="All credentials are current.">
            {expiring.map((x) => {
              const lapsed = new Date(x.expires).getTime() < now
              return (
                <WorkRow
                  key={x.id}
                  to="/hr"
                  title={x.name}
                  sub={`${x.what} · ${lapsed ? "expired" : "expires"} ${formatDate(x.expires)}`}
                  aside={
                    <Chip size="sm" variant="soft" color={lapsed ? "danger" : "warning"}>
                      {lapsed ? "Expired" : "Expiring soon"}
                    </Chip>
                  }
                />
              )
            })}
          </WorkList>
        </When>
      </Grid>
    </>
  )
}
