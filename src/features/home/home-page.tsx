/**
 * Home = the current role's worklist. Hospital staff work from queues ("who's next?"),
 * so each role lands on what needs them now, built only from the modules that are on.
 */
import { Button, Chip } from "@heroui/react"
import {
  AlertOctagon, BedDouble, CalendarCheck, CircleAlert, Clock, FileHeart, FlaskConical, HeartPulse, MonitorPlay, Pill, Plus, Puzzle,
  Receipt, ScanLine, ShieldAlert, Siren, Stethoscope, Ticket, UserPlus, Users, Wallet,
} from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ClaimStatusChip, OrderStatusChip, PriorityChip, RxStatusChip, TriageChip } from "@/components/status"
import { Page } from "@/components/ui/page"
import { Stat } from "@/components/ui/stat"
import { orderTitle } from "@/domain/catalog"
import { isCritical, minutesSince, news2 } from "@/domain/clinical"
import { invoiceBalance, invoiceTotal } from "@/domain/finance"
import { MODULES, type ModuleId } from "@/domain/modules"
import { INM, indicatorRate, meetsTarget } from "@/domain/quality"
import { ROLES } from "@/domain/roles"
import type { RoleId } from "@/domain/types"
import { QueueTicket } from "@/components/clinical/queue-ticket"
import { News2Chip } from "@/features/emr/clinical-widgets"
import { PatientForm } from "@/features/patients/patient-form"
import { RegisterVisitDialog } from "@/features/registration/register-visit-dialog"
import { dayKey, formatDateLong, formatDuration, formatPercent, formatRupiah, formatTime } from "@/lib/format"
import { shiftAt } from "@/lib/shift"
import { useNow } from "@/lib/use-now"
import { useStore } from "@/store"
import { isActive, stockOf, useEnabledModules, usePatientMap, useSession, useUnitName } from "@/store/selectors"
import { WorkList, WorkRow } from "./widgets"

function greeting() {
  const h = new Date().getHours()
  return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam"
}

export default function HomePage() {
  const { role, user } = useSession()
  const facility = useStore((s) => s.facility.name)
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
      <ShiftBoard greeting={`${greeting()}, ${user?.name.split(",")[0]}`} role={ROLES[role].label} description={ROLES[role].description} facility={facility} />
      <Home />
    </Page>
  )
}

/** Header of the home page: the shift board at the nurses' station, on chart paper. */
function ShiftBoard({ greeting, role, description, facility }: { greeting: string; role: string; description: string; facility: string }) {
  const now = useNow(30_000)
  const shift = shiftAt(now)
  const left = shift.remainingMin
  return (
    <section className="bg-grid mb-7 flex flex-col gap-6 overflow-hidden rounded-[18px] border border-border bg-surface p-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="label-caps text-muted">
          {formatDateLong(new Date(now))} · {facility}
        </div>
        <h1 className="mt-2 text-[34px] font-semibold leading-[1.1] sm:text-[40px]">{greeting}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="label-caps rounded-md bg-foreground px-2 py-0.5 text-background">{role}</span>
          {description}.
        </p>
      </div>
      <div className="w-full shrink-0 rounded-xl border border-border bg-background/70 p-4 backdrop-blur-sm lg:w-80">
        <div className="flex items-baseline justify-between">
          <span className="label-caps text-muted">Dinas {shift.label}</span>
          <span className="num text-xs text-muted">
            {shift.start}–{shift.end}
          </span>
        </div>
        <div className="num mt-1 text-3xl font-semibold">{formatTime(new Date(now).toISOString())}</div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-tertiary" aria-hidden>
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(shift.progress * 100)}%` }} />
        </div>
        <div className="num mt-1.5 text-[11px] text-muted">
          Serah terima dalam {Math.floor(left / 60)} j {left % 60} m
        </div>
      </div>
    </section>
  )
}

/** Renders children only when the module is on — homes never show dead widgets. */
function When({ module, children }: { module: ModuleId; children: ReactNode }) {
  const enabled = useEnabledModules()
  return enabled.has(module) ? <>{children}</> : null
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-2">{children}</div>
}

function Stats({ children }: { children: ReactNode }) {
  return <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
}

function useToday() {
  const encounters = useStore((s) => s.encounters)
  const now = useNow()
  return useMemo(() => encounters.filter((e) => dayKey(e.createdAt) === dayKey(now)), [encounters, now])
}

// ---------------------------------------------------------------------------------------

function FrontdeskHome() {
  const today = useToday()
  const appointments = useStore((s) => s.appointments)
  const patients = usePatientMap()
  const unitName = useUnitName()
  const navigate = useNavigate()
  const now = useNow()
  const [dialog, setDialog] = useState<"visit" | "patient" | null>(null)
  const waiting = today.filter((e) => e.kind === "outpatient" && e.status === "registered")
  const longWait = waiting.filter((e) => minutesSince(e.createdAt, now) > 60)
  const booked = appointments.filter((a) => a.status === "booked" && dayKey(a.date) === dayKey())

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        <When module="registration">
          <Button variant="primary" size="lg" onPress={() => setDialog("visit")}>
            <Plus className="size-4" aria-hidden /> Daftar kunjungan
          </Button>
        </When>
        <Button variant="secondary" size="lg" onPress={() => setDialog("patient")}>
          <UserPlus className="size-4" aria-hidden /> Pasien baru
        </Button>
        <When module="registration">
          <Link to="/registration/display" target="_blank">
            <Button variant="tertiary" size="lg">
              <MonitorPlay className="size-4" aria-hidden /> Layar antrean
            </Button>
          </Link>
        </When>
      </div>
      <Stats>
        <Stat label="Terdaftar hari ini" value={today.filter((e) => e.kind !== "inpatient" && e.status !== "cancelled").length} icon={Ticket} tone="accent" onClick={() => navigate("/registration")} />
        <Stat label="Menunggu di poli" value={waiting.length} icon={Users} tone="warning" />
        <Stat label="Tunggu > 60 menit" value={longWait.length} icon={Clock} tone={longWait.length ? "danger" : "success"} />
        <Stat label="Booking belum datang" value={booked.length} icon={CalendarCheck} />
      </Stats>
      <Grid>
        <When module="registration">
          <WorkList title="Menunggu paling lama" description="Pertimbangkan konfirmasi ke poli" to="/registration" empty="Tidak ada antrean.">
            {[...waiting].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 6).map((e) => (
              <WorkRow key={e.id} to={`/patients/${e.patientId}`} lead={<QueueTicket number={e.queueNumber} />} title={patients.get(e.patientId)?.name} sub={unitName(e.unitId)} aside={<span className={minutesSince(e.createdAt, now) > 60 ? "tabular text-sm font-semibold text-danger" : "tabular text-sm text-muted"}>{formatDuration(minutesSince(e.createdAt, now))}</span>} />
            ))}
          </WorkList>
        </When>
        <When module="appointments">
          <WorkList title="Booking hari ini" description="Belum check-in" to="/registration" linkLabel="Check-in" empty="Semua booking sudah datang.">
            {booked.slice(0, 6).map((a) => (
              <WorkRow key={a.id} to="/registration" lead={<span className="num w-12 text-sm font-semibold">{a.time}</span>} title={patients.get(a.patientId)?.name} sub={`${unitName(a.unitId)} · ${a.source === "mobile-jkn" ? "Mobile JKN" : a.source}`} />
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
  const today = useToday()
  const now = useNow()
  const myOp = today.filter((e) => e.kind === "outpatient" && e.practitionerId === user?.id)
  const myWaiting = myOp.filter((e) => e.status === "registered" || e.status === "called")
  const myInpatients = encounters
    .filter((e) => e.kind === "inpatient" && e.status === "in-progress" && e.practitionerId === user?.id)
    .map((e) => {
      const latest = [...e.vitals].sort((a, b) => b.at.localeCompare(a.at))[0]
      return { e, latest, score: latest ? news2(latest)?.score ?? 0 : 0 }
    })
    .sort((a, b) => b.score - a.score)
  const myEncounterIds = new Set(encounters.filter((e) => e.practitionerId === user?.id && isActive(e)).map((e) => e.id))
  const critical = orders.filter((o) => myEncounterIds.has(o.encounterId) && o.results.some((r) => isCritical(r.flag)))
  const unverified = encounters.filter((e) => myEncounterIds.has(e.id)).flatMap((e) => e.notes.filter((n) => n.role !== "doctor" && !n.verifiedBy).map((n) => ({ e, n })))

  return (
    <>
      <Stats>
        <Stat label="Pasien poli menunggu" value={myWaiting.length} hint={`${myOp.filter((e) => e.status === "finished").length} selesai hari ini`} icon={Stethoscope} tone="accent" />
        <Stat label="Pasien rawat inap (DPJP)" value={myInpatients.length} icon={BedDouble} />
        <Stat label="Hasil kritis" value={critical.length} icon={AlertOctagon} tone={critical.length ? "danger" : "success"} />
        <Stat label="CPPT perlu verifikasi" value={unverified.length} icon={CircleAlert} tone={unverified.length ? "warning" : "default"} />
      </Stats>
      <Grid>
        <When module="outpatient">
          <WorkList title="Antrean poli saya" to="/outpatient" linkLabel="Ke worklist" empty="Tidak ada pasien menunggu.">
            {myWaiting.slice(0, 6).map((e) => (
              <WorkRow key={e.id} to="/outpatient" lead={<QueueTicket number={e.queueNumber} />} title={patients.get(e.patientId)?.name} sub={e.chiefComplaint} aside={<span className="tabular text-sm text-muted">{formatDuration(minutesSince(e.createdAt, now))}</span>} />
            ))}
          </WorkList>
        </When>
        <When module="inpatient">
          <WorkList title="Pasien rawat inap saya" description="Diurutkan dari NEWS2 tertinggi — visite yang berisiko dulu" to="/inpatient" empty="Tidak ada pasien rawat inap.">
            {myInpatients.slice(0, 8).map(({ e, latest }) => (
              <WorkRow key={e.id} to={`/encounters/${e.id}`} lead={<span className="num w-16 text-xs font-bold text-muted">{beds.find((b) => b.id === e.bedId)?.code}</span>} title={patients.get(e.patientId)?.name} sub={e.diagnoses.find((d) => d.primary)?.display} aside={<News2Chip vitals={latest} />} />
            ))}
          </WorkList>
        </When>
        <When module="laboratory">
          <WorkList title="Hasil kritis pasien saya" to="/laboratory" empty="Tidak ada nilai kritis.">
            {critical.slice(0, 6).map((o) => (
              <WorkRow key={o.id} to={`/encounters/${o.encounterId}`} title={patients.get(o.patientId)?.name} sub={o.results.filter((r) => isCritical(r.flag)).map((r) => `${r.testCode} ${r.value}`).join(", ")} aside={<Chip size="sm" color="danger" variant="primary">Kritis</Chip>} />
            ))}
          </WorkList>
        </When>
        {unverified.length > 0 && (
          <WorkList title="CPPT profesi lain belum diverifikasi" to="/inpatient" empty="">
            {unverified.slice(0, 6).map(({ e, n }) => (
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
  const patients = usePatientMap()
  const unitName = useUnitName()
  const now = useNow()
  const isEr = user?.unitId === "igd"
  const ward = encounters.filter((e) => e.kind === "inpatient" && e.status === "in-progress" && (e.unitId === user?.unitId || !user?.unitId))
  const risky = ward.map((e) => ({ e, latest: [...e.vitals].sort((a, b) => b.at.localeCompare(a.at))[0] })).filter((x) => x.latest && (news2(x.latest)?.score ?? 0) >= 5)
  const wardIds = new Set(ward.map((e) => e.id))
  const due = mar.filter((m) => wardIds.has(m.encounterId) && m.status === "due" && new Date(m.scheduledAt).getTime() < now + 2 * 3600000).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const er = encounters.filter((e) => e.kind === "emergency" && isActive(e))
  const items = useStore((s) => s.inventory)

  return (
    <>
      <Stats>
        <Stat label={isEr ? "Pasien di IGD" : `Pasien ${unitName(user?.unitId).replace(/ \(.*\)/, "")}`} value={isEr ? er.length : ward.length} icon={HeartPulse} tone="accent" />
        <Stat label="NEWS2 ≥ 5" value={risky.length} icon={AlertOctagon} tone={risky.length ? "danger" : "success"} />
        <Stat label="Obat 2 jam ke depan" value={due.length} icon={Pill} tone={due.some((m) => new Date(m.scheduledAt).getTime() < now - 1800000) ? "danger" : "default"} />
        <Stat label="IGD belum triase" value={er.filter((e) => !e.triage).length} icon={Siren} tone={er.some((e) => !e.triage) ? "danger" : "default"} />
      </Stats>
      <Grid>
        <When module="nursing">
          <WorkList title="Pasien berisiko (NEWS2 ≥ 5)" description="Lapor DPJP & tingkatkan frekuensi observasi" to="/nursing" empty="Tidak ada pasien berisiko tinggi.">
            {risky.map(({ e, latest }) => (
              <WorkRow key={e.id} to={`/encounters/${e.id}`} lead={<span className="num w-16 text-xs font-bold text-muted">{beds.find((b) => b.id === e.bedId)?.code}</span>} title={patients.get(e.patientId)?.name} sub={news2(latest!)?.response} aside={<News2Chip vitals={latest} />} />
            ))}
          </WorkList>
          <WorkList title="Jadwal obat" to="/nursing" empty="Tidak ada obat jatuh tempo.">
            {due.slice(0, 6).map((m) => {
              const e = ward.find((x) => x.id === m.encounterId)!
              return <WorkRow key={m.id} to="/nursing" title={`${new Date(m.scheduledAt).toTimeString().slice(0, 5)} · ${items.find((i) => i.id === m.itemId)?.name}`} sub={`${m.dose} ${m.route} · ${patients.get(e.patientId)?.name}`} />
            })}
          </WorkList>
        </When>
        <When module="emergency">
          <WorkList title="IGD saat ini" to="/emergency" empty="IGD kosong.">
            {er.slice(0, 6).map((e) => (
              <WorkRow key={e.id} to="/emergency" title={patients.get(e.patientId)?.name} sub={e.chiefComplaint} aside={<TriageChip level={e.triage} />} />
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
  const low = inventory.filter((i) => i.category === "obat" && stockOf(i) < i.minStock)
  const expiring = inventory.flatMap((i) => i.batches.map((b) => ({ i, b }))).filter(({ b }) => new Date(b.expiry).getTime() < now + 90 * 86400000)
  return (
    <>
      <Stats>
        <Stat label="Perlu telaah" value={queue.filter((p) => p.status === "new").length} icon={ShieldAlert} tone="warning" />
        <Stat label="Disiapkan / siap serah" value={queue.filter((p) => p.status !== "new").length} icon={Pill} tone="accent" />
        <Stat label="Di bawah stok minimum" value={low.length} tone={low.length ? "danger" : "success"} />
        <Stat label="Batch ED ≤ 3 bulan" value={expiring.length} tone={expiring.length ? "warning" : "default"} />
      </Stats>
      <Grid>
        <WorkList title="Antrean resep" to="/pharmacy" empty="Antrean kosong.">
          {queue.slice(0, 8).map((p) => (
            <WorkRow key={p.id} to="/pharmacy" title={patients.get(p.patientId)?.name} sub={`${p.items.length} item · menunggu ${formatDuration(minutesSince(p.prescribedAt, now))}`} aside={<RxStatusChip status={p.status} />} />
          ))}
        </WorkList>
        <When module="inventory">
          <WorkList title="Stok kritis" to="/inventory" empty="Semua stok aman.">
            {low.slice(0, 8).map((i) => (
              <WorkRow key={i.id} to="/inventory" title={i.name} aside={<span className="tabular text-sm font-semibold text-danger">{stockOf(i)} / {i.minStock}</span>} />
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
  const now = useNow()
  const mine = orders.filter((o) => o.kind === kind && o.status !== "validated" && o.status !== "cancelled").sort((a, b) => (a.priority === b.priority ? a.orderedAt.localeCompare(b.orderedAt) : a.priority === "cito" ? -1 : 1))
  const Icon = kind === "lab" ? FlaskConical : ScanLine
  const to = kind === "lab" ? "/laboratory" : "/radiology"
  return (
    <>
      <Stats>
        <Stat label="CITO aktif" value={mine.filter((o) => o.priority === "cito").length} icon={Siren} tone="danger" />
        <Stat label={kind === "lab" ? "Perlu ambil sampel" : "Belum diperiksa"} value={mine.filter((o) => o.status === "ordered").length} icon={Icon} tone="accent" />
        <Stat label="Diproses" value={mine.filter((o) => o.status === "collected" || o.status === "in-progress").length} />
        <Stat label="Perlu validasi" value={mine.filter((o) => o.status === "resulted").length} tone="warning" />
      </Stats>
      <WorkList title="Worklist" description="CITO di atas" to={to} empty="Tidak ada order aktif.">
        {mine.slice(0, 10).map((o) => (
          <WorkRow
            key={o.id}
            to={to}
            title={`${patients.get(o.patientId)?.name} · ${orderTitle(o)}`}
            sub={`${formatDuration(minutesSince(o.orderedAt, now))} lalu`}
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
  const finished = new Set(encounters.filter((e) => e.status === "finished").map((e) => e.id))
  const open = invoices.filter((i) => i.status === "open" && i.payer === "umum" && invoiceTotal(i) > 0 && finished.has(i.encounterId))
  const collected = invoices.flatMap((i) => i.payments).filter((p) => dayKey(p.at) === dayKey()).reduce((s, p) => s + p.amount, 0)
  return (
    <>
      <Stats>
        <Stat label="Tagihan belum dibayar" value={open.length} icon={Receipt} tone="warning" />
        <Stat label="Nilai belum dibayar" value={formatRupiah(open.reduce((s, i) => s + invoiceBalance(i), 0))} icon={Wallet} />
        <Stat label="Diterima hari ini" value={formatRupiah(collected)} tone="success" />
        <Stat label="Transaksi hari ini" value={invoices.flatMap((i) => i.payments).filter((p) => dayKey(p.at) === dayKey()).length} />
      </Stats>
      <WorkList title="Menunggu pembayaran" to="/billing" empty="Tidak ada tagihan terbuka.">
        {open.slice(0, 10).map((i) => (
          <WorkRow key={i.id} to="/billing" title={patients.get(i.patientId)?.name} sub={i.number} aside={<span className="tabular text-sm font-semibold">{formatRupiah(invoiceBalance(i))}</span>} />
        ))}
      </WorkList>
    </>
  )
}

function CoderHome() {
  const claims = useStore((s) => s.claims)
  const encounters = useStore((s) => s.encounters)
  const patients = usePatientMap()
  const encById = new Map(encounters.map((e) => [e.id, e]))
  const todo = claims.filter((c) => c.status === "draft" || c.status === "coded")
  const pending = claims.filter((c) => c.status === "pending" || c.status === "rejected")
  return (
    <>
      <Stats>
        <Stat label="Belum dikoding" value={claims.filter((c) => c.status === "draft").length} icon={FileHeart} tone="warning" />
        <Stat label="Siap kirim" value={claims.filter((c) => c.status === "coded").length} tone="accent" />
        <Stat label="Pending / ditolak" value={pending.length} icon={CircleAlert} tone={pending.length ? "danger" : "success"} />
        <Stat label="Disetujui / dibayar" value={claims.filter((c) => c.status === "approved" || c.status === "paid").length} tone="success" />
      </Stats>
      <Grid>
        <WorkList title="Pending dari verifikator" description="Prioritas — ada batas waktu konfirmasi" to="/claims" empty="Tidak ada klaim pending.">
          {pending.slice(0, 6).map((c) => (
            <WorkRow key={c.id} to="/claims" title={patients.get(encById.get(c.encounterId)?.patientId ?? "")?.name} sub={c.note} aside={<ClaimStatusChip status={c.status} />} />
          ))}
        </WorkList>
        <WorkList title="Perlu dikoding" to="/claims" empty="Semua klaim sudah dikoding.">
          {todo.slice(0, 6).map((c) => {
            const e = encById.get(c.encounterId)
            return <WorkRow key={c.id} to="/claims" title={patients.get(e?.patientId ?? "")?.name} sub={e?.diagnoses.find((d) => d.primary)?.display ?? "Diagnosis belum ada"} aside={<ClaimStatusChip status={c.status} />} />
          })}
        </WorkList>
      </Grid>
    </>
  )
}

function ManagerHome() {
  const today = useToday()
  const beds = useStore((s) => s.beds)
  const invoices = useStore((s) => s.invoices)
  const claims = useStore((s) => s.claims)
  const incidents = useStore((s) => s.incidents)
  const indicators = useStore((s) => s.indicators)
  const navigate = useNavigate()
  const occupied = beds.filter((b) => b.status === "occupied").length
  const revenueToday = invoices.filter((i) => i.status !== "void" && dayKey(i.createdAt) === dayKey()).reduce((s, i) => s + invoiceTotal(i), 0)
  const latest = [...new Set(indicators.map((i) => i.period))].sort().pop()
  const inmOk = INM.filter((d) => {
    const v = indicators.find((i) => i.indicatorId === d.id && i.period === latest)
    return v && meetsTarget(d, indicatorRate(v))
  }).length
  return (
    <>
      <Stats>
        <Stat label="Kunjungan hari ini" value={today.filter((e) => e.status !== "cancelled").length} hint={`RJ ${today.filter((e) => e.kind === "outpatient").length} · IGD ${today.filter((e) => e.kind === "emergency").length}`} icon={Users} tone="accent" onClick={() => navigate("/reports")} />
        <Stat label="BOR saat ini" value={formatPercent((occupied / beds.length) * 100)} hint={`${occupied}/${beds.length} TT`} icon={BedDouble} onClick={() => navigate("/inpatient")} />
        <Stat label="Tagihan hari ini" value={formatRupiah(revenueToday)} icon={Wallet} tone="success" />
        <Stat label="Klaim pending/ditolak" value={claims.filter((c) => c.status === "pending" || c.status === "rejected").length} icon={FileHeart} tone="warning" onClick={() => navigate("/claims")} />
      </Stats>
      <Stats>
        <Stat label="INM tercapai" value={`${inmOk}/${INM.length}`} icon={ShieldAlert} onClick={() => navigate("/quality")} />
        <Stat label="Insiden grade kuning/merah terbuka" value={incidents.filter((i) => i.status !== "selesai" && (i.grade === "merah" || i.grade === "kuning")).length} tone="danger" onClick={() => navigate("/quality")} />
        <Stat label="IGD aktif" value={today.filter((e) => e.kind === "emergency" && isActive(e)).length} icon={Siren} />
        <Stat label="Menunggu kamar" value={today.filter((e) => e.status === "awaiting-admission").length} icon={Clock} />
      </Stats>
      <Link to="/modules" className="block">
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-accent/40 p-4 text-sm hover:bg-accent-soft/40">
          <Puzzle className="size-5 text-accent" aria-hidden />
          <span>Lihat modul yang aktif dan saran tahap berikutnya di <b>Pusat Modul</b>.</span>
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
  const now = useNow()
  const incomplete = MODULES.filter((m) => enabled.has(m.id) && m.setup.some((s) => !modules[m.id].setupDone.includes(s.id)))
  const failed = jobs.filter((j) => j.status === "failed")
  const licences = staff.filter((s) => s.sipExpires && new Date(s.sipExpires).getTime() < now + 60 * 86400000)
  const users = useStore((s) => s.staff)
  return (
    <>
      <Stats>
        <Stat label="Modul aktif" value={`${MODULES.filter((m) => !m.core && enabled.has(m.id)).length}/${MODULES.filter((m) => !m.core).length}`} hint="Di luar modul inti" icon={Puzzle} tone="accent" />
        <Stat label="Persiapan modul belum lengkap" value={incomplete.length} tone={incomplete.length ? "warning" : "success"} />
        <Stat label="Sinkron gagal" value={failed.length} tone={failed.length ? "danger" : "success"} />
        <Stat label="SIP ≤ 60 hari / habis" value={licences.length} tone={licences.length ? "danger" : "success"} />
      </Stats>
      <Grid>
        <WorkList title="Checklist persiapan modul" to="/modules" empty="Semua modul aktif sudah siap.">
          {incomplete.map((m) => (
            <WorkRow key={m.id} to={`/modules?focus=${m.id}`} title={m.name} sub={m.setup.filter((s) => !modules[m.id].setupDone.includes(s.id)).map((s) => s.label).join(" · ")} />
          ))}
        </WorkList>
        <When module="satusehat">
          <WorkList title="Sinkron gagal" to="/integrations" empty="Tidak ada kegagalan.">
            {failed.slice(0, 6).map((j) => (
              <WorkRow key={j.id} to="/integrations" title={`${j.resource} · ${j.integration}`} sub={j.error} />
            ))}
          </WorkList>
        </When>
        <WorkList title="Aktivitas terakhir" to="/settings" linkLabel="Audit log" empty="Belum ada aktivitas.">
          {audit.slice(0, 6).map((a) => (
            <WorkRow key={a.id} to="/settings" title={a.action} sub={`${users.find((u) => u.id === a.userId)?.name ?? a.userId} · ${a.target}`} />
          ))}
        </WorkList>
        <When module="hr">
          <WorkList title="Lisensi perlu diperpanjang" to="/hr" empty="Semua lisensi aman.">
            {licences.map((s) => (
              <WorkRow key={s.id} to="/hr" title={s.name} sub={`SIP s.d. ${new Date(s.sipExpires!).toLocaleDateString("id-ID")}`} aside={
                <Chip size="sm" variant="soft" color={new Date(s.sipExpires!).getTime() < now ? "danger" : "warning"}>
                  {new Date(s.sipExpires!).getTime() < now ? "Kedaluwarsa" : "Segera habis"}
                </Chip>
              } />
            ))}
          </WorkList>
        </When>
      </Grid>
    </>
  )
}

