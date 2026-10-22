/**
 * Registration desk: today's queue across all polis, check-in of booked patients, and
 * new registrations. Optimised for a keyboard-heavy desk that serves a line of people.
 */
import { Button } from "@heroui/react"
import { CalendarCheck, Clock, MonitorPlay, Plus, Siren, Ticket, UserRoundCheck, Users, X } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { EncounterStatusChip, PayerChip } from "@/components/status"
import { QueueList, QueueRow } from "@/components/clinical/queue-row"
import { Dialog } from "@/components/ui/dialog"
import { Empty } from "@/components/ui/empty"
import { SelectInput, TextInput } from "@/components/ui/fields"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { Segmented } from "@/components/ui/segmented"
import { Stat } from "@/components/ui/stat"
import { minutesSince } from "@/domain/clinical"
import type { Encounter } from "@/domain/types"
import { dayKey, formatDuration } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useNow } from "@/lib/use-now"
import { useActions, useStore } from "@/store"
import { useModuleEnabled, usePatientMap, useStaffMap, useUnitName } from "@/store/selectors"
import { RegisterVisitDialog } from "./register-visit-dialog"

type StatusFilter = "waiting" | "active" | "done" | "all"

export default function RegistrationPage() {
  const encounters = useStore((s) => s.encounters)
  const appointments = useStore((s) => s.appointments)
  const units = useStore((s) => s.units)
  const patients = usePatientMap()
  const staff = useStaffMap()
  const unitName = useUnitName()
  const apptOn = useModuleEnabled("appointments")
  const erOn = useModuleEnabled("emergency")
  const now = useNow()
  const [unit, setUnit] = useState<string>("all")
  const [status, setStatus] = useState<StatusFilter>("waiting")
  const [dialog, setDialog] = useState<{ kind: "outpatient" | "emergency"; appointmentId?: string } | null>(null)
  const [cancelling, setCancelling] = useState<Encounter>()

  const today = useMemo(() => encounters.filter((e) => e.kind !== "inpatient" && dayKey(e.createdAt) === dayKey(now)), [encounters, now])
  const inUnit = today.filter((e) => unit === "all" || e.unitId === unit)
  const waiting = inUnit.filter((e) => e.status === "registered" || e.status === "triaged" || e.status === "called")
  const activeNow = inUnit.filter((e) => e.status === "in-progress" || e.status === "awaiting-admission")
  const done = inUnit.filter((e) => e.status === "finished" || e.status === "cancelled")
  const rows = status === "waiting" ? waiting : status === "active" ? activeNow : status === "done" ? done : inUnit

  const waits = today.filter((e) => e.calledAt).map((e) => (new Date(e.calledAt!).getTime() - new Date(e.createdAt).getTime()) / 60000)
  const avgWait = waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0
  const pendingAppointments = appointments.filter((a) => a.status === "booked" && dayKey(a.date) === dayKey(now)).sort((a, b) => a.time.localeCompare(b.time))

  return (
    <Page>
      <PageHeader
        title="Pendaftaran & Antrean"
        description="Antrean semua poli hari ini. Pasien menunggu > 60 menit ditandai merah (indikator mutu waktu tunggu rawat jalan)."
        actions={
          <>
            <Link to="/registration/display" target="_blank">
              <Button variant="tertiary">
                <MonitorPlay className="size-4" aria-hidden /> Layar antrean
              </Button>
            </Link>
            {erOn && (
              <Button variant="danger-soft" onPress={() => setDialog({ kind: "emergency" })}>
                <Siren className="size-4" aria-hidden /> Pasien IGD
              </Button>
            )}
            <Button variant="primary" onPress={() => setDialog({ kind: "outpatient" })}>
              <Plus className="size-4" aria-hidden /> Daftar kunjungan
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Terdaftar hari ini" value={today.filter((e) => e.status !== "cancelled").length} icon={Users} tone="accent" />
        <Stat label="Menunggu dipanggil" value={today.filter((e) => e.status === "registered" || e.status === "triaged").length} icon={Ticket} tone="warning" />
        <Stat label="Sedang dilayani" value={today.filter((e) => e.status === "in-progress" || e.status === "called").length} icon={UserRoundCheck} tone="success" />
        <Stat label="Rata-rata waktu tunggu" value={formatDuration(avgWait)} hint="Daftar → dipanggil" icon={Clock} tone={avgWait > 60 ? "danger" : "default"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <Panel flush>
          <div className="flex flex-col gap-3 border-b border-separator p-4 md:flex-row md:items-center md:justify-between">
            <Segmented
              label="Status antrean"
              value={status}
              onChange={setStatus}
              options={[
                { value: "waiting", label: "Menunggu", count: waiting.length },
                { value: "active", label: "Dilayani", count: activeNow.length },
                { value: "done", label: "Selesai", count: done.length },
                { value: "all", label: "Semua", count: inUnit.length },
              ]}
            />
            <SelectInput label="Poli" className="md:w-64" value={unit} onChange={setUnit} options={[{ value: "all", label: "Semua poli & IGD" }, ...units.filter((u) => u.kind === "poli" || u.kind === "er").map((u) => ({ value: u.id, label: u.name }))]} />
          </div>
          {rows.length === 0 ? (
            <Empty icon={Ticket} title="Tidak ada pasien di daftar ini" description="Ubah filter atau daftarkan kunjungan baru." />
          ) : (
            <QueueList>
              {[...rows]
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .map((e) => (
                  <QueueRow
                    key={e.id}
                    ticket={e.queueNumber}
                    patient={patients.get(e.patientId)!}
                    detail={
                      <div className="min-w-0">
                        <div className="truncate font-medium">{unitName(e.unitId)}</div>
                        <div className="truncate text-xs text-muted">{staff.get(e.practitionerId ?? "")?.name ?? "Dokter jaga"}</div>
                      </div>
                    }
                    badges={
                      <>
                        <PayerChip payer={e.payer} />
                        {e.payer === "bpjs" &&
                          (e.sepNumber ? (
                            <span className="num text-[11px] text-muted" title={e.sepNumber}>
                              SEP …{e.sepNumber.slice(-6)}
                            </span>
                          ) : (
                            <span className="label-caps text-danger">SEP belum terbit</span>
                          ))}
                        <EncounterStatusChip status={e.status} />
                      </>
                    }
                    waited={e.status === "registered" || e.status === "triaged" ? minutesSince(e.createdAt, now) : undefined}
                    actions={
                      e.status === "registered" ? (
                        <Button size="sm" variant="ghost" isIconOnly aria-label={`Batalkan ${e.queueNumber}`} onPress={() => setCancelling(e)}>
                          <X className="size-4" />
                        </Button>
                      ) : undefined
                    }
                    muted={e.status === "cancelled"}
                  />
                ))}
            </QueueList>
          )}
        </Panel>

        {apptOn && (
          <Panel title="Booking hari ini" description="Belum check-in" actions={<CalendarCheck className="size-4 text-muted" aria-hidden />} flush>
            {pendingAppointments.length === 0 ? (
              <Empty title="Semua booking sudah check-in" />
            ) : (
              <ul className="divide-y divide-separator">
                {pendingAppointments.map((a) => {
                  const p = patients.get(a.patientId)
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="tabular w-12 text-sm font-semibold">{a.time}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{p?.name}</div>
                        <div className="truncate text-xs text-muted">
                          {unitName(a.unitId)} · {a.source === "mobile-jkn" ? "Mobile JKN" : a.source}
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" onPress={() => setDialog({ kind: "outpatient", appointmentId: a.id })}>
                        Check-in
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        )}
      </div>

      {dialog && <RegisterVisitDialog isOpen onOpenChange={(o) => !o && setDialog(null)} kind={dialog.kind} appointmentId={dialog.appointmentId} />}
      {cancelling && <CancelDialog encounter={cancelling} onClose={() => setCancelling(undefined)} />}
    </Page>
  )
}

function CancelDialog({ encounter, onClose }: { encounter: Encounter; onClose: () => void }) {
  const { cancelEncounter } = useActions()
  const patient = useStore((s) => s.patients.find((p) => p.id === encounter.patientId))
  const [reason, setReason] = useState("")
  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={`Batalkan ${encounter.queueNumber}?`}
      description={`${patient?.name} — tagihan administrasi ikut dibatalkan bila belum dibayar.`}
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Kembali
          </Button>
          <Button
            variant="danger"
            isDisabled={reason.trim().length < 3}
            onPress={() => {
              cancelEncounter(encounter.id, reason.trim())
              toast(`Kunjungan ${encounter.queueNumber} dibatalkan`)
              onClose()
            }}
          >
            Batalkan kunjungan
          </Button>
        </>
      }
    >
      <TextInput label="Alasan" value={reason} onChange={setReason} isRequired autoFocus placeholder="mis. pasien pulang sebelum dipanggil" />
    </Dialog>
  )
}
