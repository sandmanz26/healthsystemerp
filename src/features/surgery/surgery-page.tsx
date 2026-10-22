/**
 * Surgical services: the day's case list per OR / theatre and the WHO Surgical Safety
 * Checklist (US: Joint Commission Universal Protocol). A phase cannot be closed until its
 * items are ticked — the checklist is the workflow, not a form filled in afterwards.
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
import { pxCodes } from "@/domain/catalog"
import { WHO_CHECKLIST } from "@/domain/surgery"
import type { AuthStatus, Surgery, SurgeryStatus } from "@/domain/types"
import { PatientBanner } from "@/features/patients/patient-banner"
import { PatientPicker } from "@/features/patients/patient-picker"
import { cn } from "@/lib/cn"
import { dayKey, formatDateLong, formatTime } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"
import { usePatientMap, useRegion, useStaffMap } from "@/store/selectors"
import type { Region } from "@/domain/region"

const ROOMS: Record<Region, string[]> = { us: ["OR 1", "OR 2", "OR 3"], uk: ["Theatre 1", "Theatre 2", "Theatre 3"] }
const TOTAL_ITEMS = WHO_CHECKLIST.reduce((n, p) => n + p.items.length, 0)

const STATUS_INFO: Record<SurgeryStatus, { label: string; color: "default" | "accent" | "warning" | "success" | "danger" }> = {
  scheduled: { label: "Scheduled", color: "default" },
  "sign-in": { label: "Sign in", color: "accent" },
  "time-out": { label: "Time out / in procedure", color: "warning" },
  "sign-out": { label: "Sign out", color: "accent" },
  done: { label: "Complete", color: "success" },
  cancelled: { label: "Cancelled", color: "danger" },
}

const AUTH_INFO: Record<AuthStatus, { label: string; color: "default" | "warning" | "success" | "danger" }> = {
  "not-required": { label: "No auth required", color: "default" },
  pending: { label: "Auth pending", color: "warning" },
  approved: { label: "Auth approved", color: "success" },
  denied: { label: "Auth denied", color: "danger" },
}

/** "CPT 47562" / "OPCS-4 J18.9" */
const codeLabel = (region: Region, code?: string) => (code ? `${region === "us" ? "CPT" : "OPCS-4"} ${code}` : undefined)

function AuthChip({ auth }: { auth?: AuthStatus }) {
  if (!auth) return null
  return (
    <Chip size="sm" variant="soft" color={AUTH_INFO[auth].color}>
      {AUTH_INFO[auth].label}
    </Chip>
  )
}

/** The checklist phase that must be completed to leave `status`. */
const PHASE_FOR: Partial<Record<SurgeryStatus, "sign-in" | "time-out" | "sign-out">> = { "sign-in": "sign-in", "time-out": "time-out", "sign-out": "sign-out" }
const ADVANCE_LABEL: Partial<Record<SurgeryStatus, string>> = { scheduled: "Start sign in", "sign-in": "Sign in complete → time out", "time-out": "Time out complete → sign out", "sign-out": "Sign out complete" }

export default function SurgeryPage() {
  const surgeries = useStore((s) => s.surgeries)
  const patients = usePatientMap()
  const staff = useStaffMap()
  const [date, setDate] = useState(() => new Date())
  const [selectedId, setSelectedId] = useState<string>()
  const [scheduling, setScheduling] = useState(false)
  const selected = surgeries.find((s) => s.id === selectedId)
  const region = useRegion()
  const us = region === "us"
  const rooms = ROOMS[region]

  const today = useMemo(() => surgeries.filter((s) => dayKey(s.scheduledAt) === dayKey(date)).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)), [surgeries, date])

  return (
    <Page>
      <PageHeader
        title={us ? "Surgical services" : "Theatres"}
        description={us ? "WHO Surgical Safety Checklist · Joint Commission Universal Protocol" : "WHO Surgical Safety Checklist · NatSSIPs 2"}
        actions={
          <Button variant="primary" onPress={() => setScheduling(true)}>
            <CalendarPlus className="size-4" aria-hidden /> {us ? "Schedule case" : "Book theatre case"}
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={us ? "Cases today" : "Cases on list"} value={today.filter((s) => s.status !== "cancelled").length} icon={Scissors} tone="accent" />
        <Stat label="In progress" value={today.filter((s) => ["sign-in", "time-out", "sign-out"].includes(s.status)).length} tone="warning" />
        <Stat label="Complete" value={today.filter((s) => s.status === "done").length} tone="success" />
        {us ? (
          <Stat label="Auth pending" value={today.filter((s) => s.auth === "pending" || s.auth === "denied").length} hint={`Checklist complete ${today.filter((s) => s.status === "done" && WHO_CHECKLIST.every((p) => p.items.every((i) => s.checklist[i.id]))).length}/${today.filter((s) => s.status === "done").length}`} tone={today.some((s) => s.auth === "pending" || s.auth === "denied") ? "warning" : "default"} />
        ) : (
          <Stat label="Checklist complete" value={`${today.filter((s) => s.status === "done" && WHO_CHECKLIST.every((p) => p.items.every((i) => s.checklist[i.id]))).length}/${today.filter((s) => s.status === "done").length}`} hint={`Completed cases with ${TOTAL_ITEMS}/${TOTAL_ITEMS} items`} />
        )}
      </div>
      <div className="mb-4 flex items-center gap-2">
        <Button isIconOnly variant="tertiary" aria-label="Previous day" onPress={() => setDate((d) => new Date(d.getTime() - 86400000))}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button isIconOnly variant="tertiary" aria-label="Next day" onPress={() => setDate((d) => new Date(d.getTime() + 86400000))}>
          <ChevronRight className="size-4" />
        </Button>
        <span className="px-2 font-semibold">{formatDateLong(date)}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {rooms.map((room) => {
          const list = today.filter((s) => s.room === room)
          return (
            <Panel key={room} title={room} description={`${list.length} case(s)`} flush>
              {list.length === 0 ? (
                <Empty title="No cases" />
              ) : (
                <ul className="divide-y divide-separator">
                  {list.map((s) => {
                    const ticked = WHO_CHECKLIST.flatMap((p) => p.items).filter((i) => s.checklist[i.id]).length
                    return (
                      <li key={s.id}>
                        <button type="button" onClick={() => setSelectedId(s.id)} className="w-full px-5 py-3 text-left hover:bg-surface-secondary">
                          <div className="flex items-center justify-between gap-2">
                            <span className="tabular text-sm font-bold">
                              {formatTime(s.scheduledAt)} · {s.durationMin} min
                            </span>
                            <Chip size="sm" variant="soft" color={STATUS_INFO[s.status].color}>
                              {STATUS_INFO[s.status].label}
                            </Chip>
                          </div>
                          <div className="mt-1 font-medium">{s.procedure}</div>
                          {s.procedureCode && <div className="num text-[11px] text-muted">{codeLabel(region, s.procedureCode)}</div>}
                          <div className="text-sm text-muted">{patients.get(s.patientId)?.name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                            {staff.get(s.surgeonId)?.name} · checklist {ticked}/{TOTAL_ITEMS}
                            {us && <AuthChip auth={s.auth} />}
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
  const region = useRegion()
  const us = region === "us"

  return (
    <SidePanel
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={surgery.procedure}
      description={
        <div className="space-y-1">
          <div>{`${surgery.room} · ${formatTime(surgery.scheduledAt)} · ${staff.get(surgery.surgeonId)?.name} / ${staff.get(surgery.anesthetistId ?? "")?.name ?? "-"}`}</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {surgery.procedureCode && <span className="num text-xs">{codeLabel(region, surgery.procedureCode)}</span>}
            {us && <AuthChip auth={surgery.auth} />}
          </div>
        </div>
      }
      footer={
        surgery.status !== "done" && surgery.status !== "cancelled" ? (
          <div className="flex w-full justify-between gap-2">
            <Button variant="ghost" onPress={() => { cancelSurgery(surgery.id); onClose() }}>
              Cancel case
            </Button>
            <Button
              variant="primary"
              isDisabled={!phaseDone}
              onPress={() => {
                advanceSurgery(surgery.id)
                toast.success(ADVANCE_LABEL[surgery.status] ?? "Updated")
              }}
            >
              {phaseDone ? ADVANCE_LABEL[surgery.status] : `Complete ${phaseDef?.title}`}
            </Button>
          </div>
        ) : undefined
      }
    >
      <PatientBanner patient={patient} compact />
      {us && surgery.auth === "pending" && <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground">Prior authorization is still pending for this elective case. Confirm approval with the payer before incision to avoid a CO-197 denial.</p>}
      {us && surgery.auth === "denied" && <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger-soft-foreground">Prior authorization denied — reschedule or obtain a signed financial waiver (ABN / NEMB).</p>}
      <p className="label-caps text-muted">{us ? "WHO Surgical Safety Checklist · Joint Commission Universal Protocol (UP.01.01–UP.01.03)" : "WHO Surgical Safety Checklist · NHS England NatSSIPs 2 (2023)"}</p>
      {WHO_CHECKLIST.map((p) => (
        <section key={p.phase} className={cn("rounded-2xl border p-4", editable(p.phase) ? "border-accent" : "border-border opacity-90")}>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="font-semibold">{p.title}</h3>
            <span className="text-xs text-muted">{us ? p.when.replace("anaesthesia", "anesthesia") : p.when.replace("operating room", "theatre")}</span>
          </div>
          <div className="space-y-2">
            {p.items.map((i) => (
              <Checkbox key={i.id} isSelected={!!surgery.checklist[i.id]} isDisabled={!editable(p.phase)} onChange={() => toggleChecklist(surgery.id, i.id)}>
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Label className="text-sm">{us ? i.label.replace(/Anaesthesia/g, "Anesthesia") : i.label}</Label>
                </Checkbox.Content>
              </Checkbox>
            ))}
          </div>
        </section>
      ))}
      {surgery.status === "scheduled" && <p className="text-sm text-muted">Press “Start sign in” when the patient arrives in {us ? "pre-op holding" : "the anaesthetic room"}.</p>}
    </SidePanel>
  )
}

function ScheduleDialog({ initialDate, onClose }: { initialDate: Date; onClose: () => void }) {
  const staff = useStore((s) => s.staff)
  const encounters = useStore((s) => s.encounters)
  const patients = usePatientMap()
  const { scheduleSurgery } = useActions()
  const [patientId, setPatientId] = useState<string>()
  const region = useRegion()
  const us = region === "us"
  const rooms = ROOMS[region]
  const codes = useMemo(() => pxCodes(region), [region])
  const [procedure, setProcedure] = useState("")
  const [procedureCode, setProcedureCode] = useState<string | null>(null)
  const [surgeonId, setSurgeonId] = useState<string | null>("d6")
  const [anesthetistId, setAnesthetistId] = useState<string | null>("d9")
  const [room, setRoom] = useState<string>(rooms[0])
  const [date, setDate] = useState(dayKey(initialDate))
  const [time, setTime] = useState("09:00")
  const [duration, setDuration] = useState("90")
  const patient = patientId ? patients.get(patientId) : undefined
  const surgeons = staff.filter((s) => s.role === "doctor" && !!s.specialty && (/surg/i.test(s.specialty) || s.specialty === "Obstetrics & Gynecology"))
  const anesthetists = staff.filter((s) => s.specialty === "Anesthesiology")

  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      isDismissable={false}
      size="lg"
      title={us ? "Schedule surgical case" : "Book theatre case"}
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={!patientId || !procedure.trim() || !surgeonId}
            onPress={() => {
              const enc = encounters.find((e) => e.patientId === patientId && e.kind === "inpatient" && e.status === "in-progress")
              scheduleSurgery({ patientId: patientId!, encounterId: enc?.id, procedure: procedure.trim(), procedureCode: procedureCode ?? undefined, auth: us && (patient?.payer === "commercial" || !!patient?.coverage?.plan?.includes("Advantage")) ? "pending" : undefined, surgeonId: surgeonId!, anesthetistId: anesthetistId ?? undefined, room, scheduledAt: new Date(`${date}T${time}`).toISOString(), durationMin: Number(duration) || 60 })
              toast.success(us ? "Case scheduled" : "Case booked")
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      {patient ? <PatientBanner patient={patient} compact /> : <PatientPicker autoFocus onPick={(p) => setPatientId(p.id)} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput
          label={us ? "Procedure (CPT)" : "Procedure (OPCS-4)"}
          className="sm:col-span-2"
          value={procedureCode}
          placeholder="Select from the procedure catalog…"
          onChange={(c) => {
            setProcedureCode(c)
            setProcedure(codes.find((x) => x.code === c)?.display ?? "")
          }}
          options={codes.map((c) => ({ value: c.code, label: `${c.code} · ${c.display}` }))}
        />
        <TextInput label="Procedure description" value={procedure} onChange={setProcedure} isRequired className="sm:col-span-2" />
        <SelectInput label="Surgeon" value={surgeonId} onChange={setSurgeonId} options={surgeons.map((s) => ({ value: s.id, label: s.name }))} isRequired />
        <SelectInput label={us ? "Anesthesiologist" : "Anaesthetist"} value={anesthetistId} onChange={setAnesthetistId} options={anesthetists.map((s) => ({ value: s.id, label: s.name }))} />
        <SelectInput label={us ? "Room" : "Theatre"} value={room} onChange={setRoom} options={rooms.map((r) => ({ value: r, label: r }))} />
        <TextInput label="Duration (minutes)" value={duration} onChange={(v) => setDuration(v.replace(/\D/g, ""))} inputMode="numeric" />
        <TextInput label="Date" type="date" value={date} onChange={setDate} />
        <TextInput label="Start time" type="time" value={time} onChange={setTime} />
      </div>
    </Dialog>
  )
}
