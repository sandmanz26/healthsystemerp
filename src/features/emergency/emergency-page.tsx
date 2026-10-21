/**
 * ER track board. Sorted by acuity then arrival; time-to-doctor is compared with the
 * triage target so overdue patients stand out without anyone doing the maths.
 */
import { Button } from "@heroui/react"
import { AlertTriangle, BedDouble, Clock, Plus, Siren, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { EncounterStatusChip, PayerChip, TriageChip } from "@/components/status"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Empty } from "@/components/ui/empty"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Stat } from "@/components/ui/stat"
import { TRIAGE, ageLabel, minutesSince } from "@/domain/clinical"
import type { Encounter } from "@/domain/types"
import { News2Chip } from "@/features/emr/clinical-widgets"
import { RegisterVisitDialog } from "@/features/registration/register-visit-dialog"
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

  const columns: Column<Encounter>[] = [
    {
      id: "triage",
      header: "Triase",
      cell: (e) =>
        e.triage ? (
          <TriageChip level={e.triage} />
        ) : (
          <Button size="sm" variant="danger" onPress={() => setTriageFor(e)}>
            Triase
          </Button>
        ),
    },
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
              {e.queueNumber} · {p.gender === "female" ? "P" : "L"} {ageLabel(p.birthDate)} · RM {p.mrn}
            </div>
          </div>
        )
      },
    },
    { id: "complaint", header: "Keluhan", cell: (e) => <span className="line-clamp-2 text-sm">{e.chiefComplaint}</span> },
    { id: "ews", header: "NEWS2", cell: (e) => <News2Chip vitals={[...e.vitals].sort((a, b) => b.at.localeCompare(a.at))[0]} /> },
    {
      id: "time",
      header: "Datang / lama",
      cell: (e) => {
        const late = overdueBy(e, now)
        return (
          <div className="tabular text-sm">
            {formatTime(e.createdAt)} · {formatDuration(minutesSince(e.createdAt, now))}
            {late !== null && <div className="text-xs font-semibold text-danger">Lewat target {formatDuration(late)}</div>}
          </div>
        )
      },
    },
    { id: "doctor", header: "Dokter", cell: (e) => <span className="text-sm">{e.startedAt ? staff.get(e.practitionerId ?? "")?.name : <span className="text-muted">Belum ditangani</span>}</span> },
    { id: "payer", header: "Penjamin", cell: (e) => <PayerChip payer={e.payer} /> },
    { id: "status", header: "Status", cell: (e) => <EncounterStatusChip status={e.status} /> },
    {
      id: "action",
      header: "",
      align: "end",
      cell: (e) => (
        <div className="flex justify-end gap-1">
          {e.triage && role === "nurse" && (
            <Button size="sm" variant="ghost" onPress={() => setTriageFor(e)}>
              Ulang triase
            </Button>
          )}
          <Button
            size="sm"
            variant={e.startedAt ? "tertiary" : "primary"}
            onPress={() => {
              if (role === "doctor") startEncounter(e.id)
              navigate(`/encounters/${e.id}`)
            }}
          >
            {e.startedAt || role !== "doctor" ? "Buka" : "Tangani"}
          </Button>
        </div>
      ),
    },
  ]

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
      <Panel flush>
        <DataTable label="Track board IGD" rows={board} columns={columns} rowKey={(e) => e.id} empty={<Empty icon={Siren} title="IGD kosong" description="Tidak ada pasien aktif saat ini." />} />
      </Panel>
      {triageFor && <TriageDialog encounter={triageFor} patientName={patients.get(triageFor.patientId)?.name ?? ""} onClose={() => setTriageFor(undefined)} />}
      {registering && <RegisterVisitDialog isOpen onOpenChange={setRegistering} kind="emergency" />}
    </Page>
  )
}
