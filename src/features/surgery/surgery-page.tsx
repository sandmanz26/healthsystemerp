/**
 * Operating theatre: today's list per room and the WHO Surgical Safety Checklist.
 * A phase cannot be closed until its items are ticked — the checklist is the workflow,
 * not a form filled in afterwards.
 */
import { Button, Checkbox, Chip, Label } from "@heroui/react"
import { CalendarPlus, ChevronLeft, ChevronRight, Scissors } from "lucide-react"
import { useMemo, useState } from "react"
import { Dialog } from "@/components/ui/dialog"
import { Empty } from "@/components/ui/empty"
import { SelectInput, TextInput } from "@/components/ui/fields"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import { SidePanel } from "@/components/ui/side-panel"
import { Stat } from "@/components/ui/stat"
import { WHO_CHECKLIST } from "@/domain/surgery"
import type { Surgery, SurgeryStatus } from "@/domain/types"
import { PatientBanner } from "@/features/patients/patient-banner"
import { PatientPicker } from "@/features/patients/patient-picker"
import { cn } from "@/lib/cn"
import { dayKey, formatDateLong, formatTime } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"
import { usePatientMap, useStaffMap } from "@/store/selectors"

const ROOMS = ["OK 1", "OK 2", "OK 3"]

const STATUS_INFO: Record<SurgeryStatus, { label: string; color: "default" | "accent" | "warning" | "success" | "danger" }> = {
  scheduled: { label: "Terjadwal", color: "default" },
  "sign-in": { label: "Sign in", color: "accent" },
  "time-out": { label: "Time out / operasi", color: "warning" },
  "sign-out": { label: "Sign out", color: "accent" },
  done: { label: "Selesai", color: "success" },
  cancelled: { label: "Batal", color: "danger" },
}

/** The checklist phase that must be completed to leave `status`. */
const PHASE_FOR: Partial<Record<SurgeryStatus, "sign-in" | "time-out" | "sign-out">> = { "sign-in": "sign-in", "time-out": "time-out", "sign-out": "sign-out" }
const ADVANCE_LABEL: Partial<Record<SurgeryStatus, string>> = { scheduled: "Mulai sign in", "sign-in": "Sign in selesai → time out", "time-out": "Time out selesai → sign out", "sign-out": "Sign out selesai" }

export default function SurgeryPage() {
  const surgeries = useStore((s) => s.surgeries)
  const patients = usePatientMap()
  const staff = useStaffMap()
  const [date, setDate] = useState(() => new Date())
  const [selectedId, setSelectedId] = useState<string>()
  const [scheduling, setScheduling] = useState(false)
  const selected = surgeries.find((s) => s.id === selectedId)

  const today = useMemo(() => surgeries.filter((s) => dayKey(s.scheduledAt) === dayKey(date)).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)), [surgeries, date])

  return (
    <Page>
      <PageHeader
        title="Kamar Operasi"
        description="Jadwal per kamar dan WHO Surgical Safety Checklist."
        actions={
          <Button variant="primary" onPress={() => setScheduling(true)}>
            <CalendarPlus className="size-4" aria-hidden /> Jadwalkan operasi
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Operasi hari ini" value={today.filter((s) => s.status !== "cancelled").length} icon={Scissors} tone="accent" />
        <Stat label="Sedang berjalan" value={today.filter((s) => ["sign-in", "time-out", "sign-out"].includes(s.status)).length} tone="warning" />
        <Stat label="Selesai" value={today.filter((s) => s.status === "done").length} tone="success" />
        <Stat label="Checklist lengkap" value={`${today.filter((s) => s.status === "done" && WHO_CHECKLIST.every((p) => p.items.every((i) => s.checklist[i.id]))).length}/${today.filter((s) => s.status === "done").length}`} hint="Operasi selesai dengan 15/15 item" />
      </div>
      <div className="mb-4 flex items-center gap-2">
        <Button isIconOnly variant="tertiary" aria-label="Hari sebelumnya" onPress={() => setDate((d) => new Date(d.getTime() - 86400000))}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button isIconOnly variant="tertiary" aria-label="Hari berikutnya" onPress={() => setDate((d) => new Date(d.getTime() + 86400000))}>
          <ChevronRight className="size-4" />
        </Button>
        <span className="px-2 font-semibold">{formatDateLong(date)}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {ROOMS.map((room) => {
          const list = today.filter((s) => s.room === room)
          return (
            <Panel key={room} title={room} description={`${list.length} operasi`} flush>
              {list.length === 0 ? (
                <Empty title="Kosong" />
              ) : (
                <ul className="divide-y divide-separator">
                  {list.map((s) => {
                    const ticked = WHO_CHECKLIST.flatMap((p) => p.items).filter((i) => s.checklist[i.id]).length
                    return (
                      <li key={s.id}>
                        <button type="button" onClick={() => setSelectedId(s.id)} className="w-full px-5 py-3 text-left hover:bg-surface-secondary">
                          <div className="flex items-center justify-between gap-2">
                            <span className="tabular text-sm font-bold">
                              {formatTime(s.scheduledAt)} · {s.durationMin} mnt
                            </span>
                            <Chip size="sm" variant="soft" color={STATUS_INFO[s.status].color}>
                              {STATUS_INFO[s.status].label}
                            </Chip>
                          </div>
                          <div className="mt-1 font-medium">{s.procedure}</div>
                          <div className="text-sm text-muted">{patients.get(s.patientId)?.name}</div>
                          <div className="mt-1 text-xs text-muted">
                            {staff.get(s.surgeonId)?.name} · checklist {ticked}/15
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>
          )
        })}
      </div>
      {selected && <ChecklistPanel surgery={selected} onClose={() => setSelectedId(undefined)} />}
      {scheduling && <ScheduleDialog initialDate={date} onClose={() => setScheduling(false)} />}
    </Page>
  )
}

function ChecklistPanel({ surgery, onClose }: { surgery: Surgery; onClose: () => void }) {
  const patient = useStore((s) => s.patients.find((p) => p.id === surgery.patientId))!
  const staff = useStaffMap()
  const { toggleChecklist, advanceSurgery, cancelSurgery } = useActions()
  const phase = PHASE_FOR[surgery.status]
  const phaseDef = WHO_CHECKLIST.find((p) => p.phase === phase)
  const phaseDone = !phaseDef || phaseDef.items.every((i) => surgery.checklist[i.id])
  const editable = (p: string) => p === phase

  return (
    <SidePanel
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={surgery.procedure}
      description={`${surgery.room} · ${formatTime(surgery.scheduledAt)} · ${staff.get(surgery.surgeonId)?.name} / ${staff.get(surgery.anesthetistId ?? "")?.name ?? "-"}`}
      footer={
        surgery.status !== "done" && surgery.status !== "cancelled" ? (
          <div className="flex w-full justify-between gap-2">
            <Button variant="ghost" onPress={() => { cancelSurgery(surgery.id); onClose() }}>
              Batalkan operasi
            </Button>
            <Button
              variant="primary"
              isDisabled={!phaseDone}
              onPress={() => {
                advanceSurgery(surgery.id)
                toast.success(ADVANCE_LABEL[surgery.status] ?? "Diperbarui")
              }}
            >
              {phaseDone ? ADVANCE_LABEL[surgery.status] : `Lengkapi ${phaseDef?.title}`}
            </Button>
          </div>
        ) : undefined
      }
    >
      <PatientBanner patient={patient} compact />
      {WHO_CHECKLIST.map((p) => (
        <section key={p.phase} className={cn("rounded-2xl border p-4", editable(p.phase) ? "border-accent" : "border-border opacity-90")}>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="font-semibold">{p.title}</h3>
            <span className="text-xs text-muted">{p.when}</span>
          </div>
          <div className="space-y-2">
            {p.items.map((i) => (
              <Checkbox key={i.id} isSelected={!!surgery.checklist[i.id]} isDisabled={!editable(p.phase)} onChange={() => toggleChecklist(surgery.id, i.id)}>
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Label className="text-sm">{i.label}</Label>
                </Checkbox.Content>
              </Checkbox>
            ))}
          </div>
        </section>
      ))}
      {surgery.status === "scheduled" && <p className="text-sm text-muted">Tekan "Mulai sign in" saat pasien tiba di ruang persiapan.</p>}
    </SidePanel>
  )
}

function ScheduleDialog({ initialDate, onClose }: { initialDate: Date; onClose: () => void }) {
  const staff = useStore((s) => s.staff)
  const encounters = useStore((s) => s.encounters)
  const patients = usePatientMap()
  const { scheduleSurgery } = useActions()
  const [patientId, setPatientId] = useState<string>()
  const [procedure, setProcedure] = useState("")
  const [surgeonId, setSurgeonId] = useState<string | null>("d6")
  const [anesthetistId, setAnesthetistId] = useState<string | null>("d9")
  const [room, setRoom] = useState<string>(ROOMS[0])
  const [date, setDate] = useState(dayKey(initialDate))
  const [time, setTime] = useState("09:00")
  const [duration, setDuration] = useState("90")
  const patient = patientId ? patients.get(patientId) : undefined
  const surgeons = staff.filter((s) => s.role === "doctor" && (s.specialty === "Bedah" || s.specialty === "Obstetri & Ginekologi"))
  const anesthetists = staff.filter((s) => s.specialty === "Anestesi")

  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      isDismissable={false}
      size="lg"
      title="Jadwalkan operasi"
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            isDisabled={!patientId || !procedure.trim() || !surgeonId}
            onPress={() => {
              const enc = encounters.find((e) => e.patientId === patientId && e.kind === "inpatient" && e.status === "in-progress")
              scheduleSurgery({ patientId: patientId!, encounterId: enc?.id, procedure: procedure.trim(), surgeonId: surgeonId!, anesthetistId: anesthetistId ?? undefined, room, scheduledAt: new Date(`${date}T${time}`).toISOString(), durationMin: Number(duration) || 60 })
              toast.success("Operasi dijadwalkan")
              onClose()
            }}
          >
            Simpan jadwal
          </Button>
        </>
      }
    >
      {patient ? <PatientBanner patient={patient} compact /> : <PatientPicker autoFocus onPick={(p) => setPatientId(p.id)} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Prosedur" value={procedure} onChange={setProcedure} isRequired className="sm:col-span-2" />
        <SelectInput label="Operator" value={surgeonId} onChange={setSurgeonId} options={surgeons.map((s) => ({ value: s.id, label: s.name }))} isRequired />
        <SelectInput label="Anestesi" value={anesthetistId} onChange={setAnesthetistId} options={anesthetists.map((s) => ({ value: s.id, label: s.name }))} />
        <SelectInput label="Kamar" value={room} onChange={setRoom} options={ROOMS.map((r) => ({ value: r, label: r }))} />
        <TextInput label="Durasi (menit)" value={duration} onChange={(v) => setDuration(v.replace(/\D/g, ""))} inputMode="numeric" />
        <TextInput label="Tanggal" type="date" value={date} onChange={setDate} />
        <TextInput label="Jam mulai" type="time" value={time} onChange={setTime} />
      </div>
    </Dialog>
  )
}
