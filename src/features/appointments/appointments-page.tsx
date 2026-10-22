/**
 * Provider session templates (with slot capacity) and appointments per day. Capacity
 * matters: open slots are published to the patient portal (US) or NHS App / e-RS (UK), so
 * overbooking shows up as long waits and complaints.
 */
import { Button, Card, Chip, Tabs } from "@heroui/react"
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"
import { Dialog } from "@/components/ui/dialog"
import { Empty } from "@/components/ui/empty"
import { SelectInput, TextInput } from "@/components/ui/fields"
import { Page, PageHeader } from "@/components/ui/page"
import { Panel } from "@/components/ui/panel"
import type { Appointment, AppointmentSource } from "@/domain/types"
import { PatientBanner } from "@/features/patients/patient-banner"
import { PatientPicker } from "@/features/patients/patient-picker"
import { RegisterVisitDialog } from "@/features/registration/register-visit-dialog"
import { dayKey, formatDateLong } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"
import { usePatientMap, useRegion, useStaffMap, useUnitName } from "@/store/selectors"
import { APPOINTMENT_SOURCES, sourceLabel } from "./sources"

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const STATUS: Record<Appointment["status"], { label: string; color: "default" | "success" | "danger" | "warning" }> = {
  booked: { label: "Booked", color: "default" },
  "checked-in": { label: "Arrived", color: "success" },
  "no-show": { label: "No-show", color: "danger" },
  cancelled: { label: "Cancelled", color: "warning" },
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export default function AppointmentsPage() {
  const schedules = useStore((s) => s.schedules)
  const appointments = useStore((s) => s.appointments)
  const staff = useStaffMap()
  const patients = usePatientMap()
  const unitName = useUnitName()
  const region = useRegion()
  const { setAppointmentStatus } = useActions()
  const [date, setDate] = useState(() => new Date())
  const [booking, setBooking] = useState(false)
  const [checkIn, setCheckIn] = useState<string>()
  const isToday = dayKey(date) === dayKey()

  const daySchedules = schedules.filter((s) => s.weekday === date.getDay())
  const dayAppointments = useMemo(() => appointments.filter((a) => dayKey(a.date) === dayKey(date)).sort((a, b) => a.time.localeCompare(b.time)), [appointments, date])

  return (
    <Page>
      <PageHeader
        title="Scheduling"
        description={
          region === "us"
            ? "Provider session templates, slot capacity and bookings from the patient portal, phone, referrals and walk-ins."
            : "Clinic sessions, slot capacity and bookings from the NHS App, phone, e-RS referrals and walk-ins. Consultant-led referrals start the 18-week RTT clock."
        }
        actions={
          <Button variant="primary" onPress={() => setBooking(true)}>
            <CalendarPlus className="size-4" aria-hidden /> Book appointment
          </Button>
        }
      />

      <Tabs>
        <Tabs.ListContainer>
          <Tabs.List aria-label="View">
            <Tabs.Tab id="day">Day<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="week">Weekly session templates<Tabs.Indicator /></Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="day" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button isIconOnly variant="tertiary" aria-label="Previous day" onPress={() => setDate((d) => addDays(d, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button isIconOnly variant="tertiary" aria-label="Next day" onPress={() => setDate((d) => addDays(d, 1))}>
              <ChevronRight className="size-4" />
            </Button>
            <div className="px-2 font-semibold">{formatDateLong(date)}</div>
            {!isToday && (
              <Button size="sm" variant="ghost" onPress={() => setDate(new Date())}>
                Today
              </Button>
            )}
          </div>

          {daySchedules.length === 0 ? (
            <Panel>
              <Empty title={`No clinic sessions on ${WEEKDAYS[date.getDay()]}`} />
            </Panel>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {daySchedules.map((s) => {
                const list = dayAppointments.filter((a) => a.practitionerId === s.practitionerId && a.unitId === s.unitId)
                const used = list.filter((a) => a.status !== "cancelled").length
                return (
                  <Panel
                    key={s.id}
                    title={staff.get(s.practitionerId)?.name}
                    description={`${unitName(s.unitId)} · ${s.start}–${s.end}`}
                    actions={
                      <Chip size="sm" variant="soft" color={used >= s.quota ? "danger" : used >= s.quota * 0.8 ? "warning" : "success"}>
                        <span className="num">
                          {used}/{s.quota}
                        </span>
                      </Chip>
                    }
                    flush
                  >
                    {list.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-muted">No bookings yet.</p>
                    ) : (
                      <ul className="divide-y divide-separator">
                        {list.map((a) => (
                          <li key={a.id} className="flex items-center gap-3 px-5 py-2.5">
                            <span className="num w-11 text-sm font-semibold">{a.time}</span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{patients.get(a.patientId)?.name}</div>
                              <div className="text-xs text-muted">{sourceLabel(a.source, region)}</div>
                            </div>
                            {a.status === "booked" ? (
                              <div className="flex gap-1">
                                {isToday && (
                                  <Button size="sm" variant="secondary" onPress={() => setCheckIn(a.id)}>
                                    Check-in
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" onPress={() => { setAppointmentStatus(a.id, isToday ? "no-show" : "cancelled"); toast(isToday ? "Marked as no-show" : "Appointment cancelled") }}>
                                  {isToday ? (region === "us" ? "No-show" : "DNA") : "Cancel"}
                                </Button>
                              </div>
                            ) : (
                              <Chip size="sm" variant="soft" color={STATUS[a.status].color}>
                                {STATUS[a.status].label}
                              </Chip>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                )
              })}
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel id="week" className="pt-4">
          <Panel flush>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-separator text-left text-xs text-muted">
                    <th className="px-4 py-3 font-medium">Provider</th>
                    {[1, 2, 3, 4, 5, 6].map((d) => (
                      <th key={d} className="px-3 py-3 font-medium">
                        {WEEKDAYS[d]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator">
                  {[...new Set(schedules.map((s) => s.practitionerId))].map((docId) => (
                    <tr key={docId}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{staff.get(docId)?.name}</div>
                        <div className="text-xs text-muted">{unitName(staff.get(docId)?.unitId)}</div>
                      </td>
                      {[1, 2, 3, 4, 5, 6].map((d) => {
                        const s = schedules.find((x) => x.practitionerId === docId && x.weekday === d)
                        return (
                          <td key={d} className="px-3 py-3">
                            {s ? (
                              <div className="rounded-lg bg-accent-soft px-2 py-1 text-xs text-accent-soft-foreground">
                                <div className="num font-semibold">
                                  {s.start}–{s.end}
                                </div>
                                <div>{s.quota} slots</div>
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </Tabs.Panel>
      </Tabs>

      {booking && <BookDialog initialDate={date} onClose={() => setBooking(false)} />}
      {checkIn && <RegisterVisitDialog isOpen onOpenChange={(o) => !o && setCheckIn(undefined)} appointmentId={checkIn} />}
    </Page>
  )
}

function BookDialog({ initialDate, onClose }: { initialDate: Date; onClose: () => void }) {
  const schedules = useStore((s) => s.schedules)
  const appointments = useStore((s) => s.appointments)
  const patients = usePatientMap()
  const staff = useStaffMap()
  const unitName = useUnitName()
  const { bookAppointment } = useActions()
  const [patientId, setPatientId] = useState<string>()
  const [dateStr, setDateStr] = useState(dayKey(initialDate))
  const [scheduleId, setScheduleId] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const region = useRegion()
  const [source, setSource] = useState<AppointmentSource>("phone")
  const date = new Date(`${dateStr}T00:00:00`)
  const options = schedules.filter((s) => s.weekday === date.getDay())
  const schedule = options.find((s) => s.id === scheduleId)

  const slots = (() => {
    if (!schedule) return []
    const taken = new Set(appointments.filter((a) => a.practitionerId === schedule.practitionerId && dayKey(a.date) === dateStr && a.status !== "cancelled").map((a) => a.time))
    const [sh, sm] = schedule.start.split(":").map(Number)
    const [eh, em] = schedule.end.split(":").map(Number)
    const out: string[] = []
    for (let m = sh * 60 + sm; m < eh * 60 + em; m += 15) {
      const t = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
      if (!taken.has(t)) out.push(t)
    }
    return out
  })()

  const patient = patientId ? patients.get(patientId) : undefined
  const valid = patient && schedule && time

  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      isDismissable={false}
      title="Book appointment"
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={!valid}
            onPress={() => {
              const [h, m] = time!.split(":").map(Number)
              const at = new Date(date)
              at.setHours(h, m)
              bookAppointment({ patientId: patient!.id, practitionerId: schedule!.practitionerId, unitId: schedule!.unitId, date: at.toISOString(), time: time!, source })
              toast.success("Appointment booked", { description: `${patient!.name} · ${time}` })
              onClose()
            }}
          >
            Book
          </Button>
        </>
      }
    >
      {patient ? (
        <div className="space-y-2">
          <PatientBanner patient={patient} compact />
          <Button size="sm" variant="ghost" onPress={() => setPatientId(undefined)}>
            Change patient
          </Button>
        </div>
      ) : (
        <PatientPicker autoFocus onPick={(p) => setPatientId(p.id)} />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Date" type="date" value={dateStr} onChange={(v) => { setDateStr(v); setScheduleId(null); setTime(null) }} />
        <SelectInput
          label="Provider & clinic"
          value={scheduleId}
          onChange={(v) => { setScheduleId(v); setTime(null) }}
          options={options.map((s) => ({ value: s.id, label: staff.get(s.practitionerId)?.name ?? "", description: `${unitName(s.unitId)} · ${s.start}–${s.end}` }))}
          placeholder={options.length ? "Select session" : "No sessions on this date"}
          isDisabled={!options.length}
        />
        <SelectInput label="Time" value={time} onChange={setTime} options={slots.map((t) => ({ value: t, label: t }))} isDisabled={!schedule} placeholder={schedule && !slots.length ? "Session full" : "Select time"} />
        <SelectInput label="Booked via" value={source} onChange={setSource} options={APPOINTMENT_SOURCES.map((s) => ({ value: s, label: sourceLabel(s, region) }))} />
      </div>
      {schedule && (
        <Card variant="secondary" className="p-3 text-sm">
          Open 15-minute slots: <b className="num">{slots.length}</b> · session capacity {schedule.quota}.
        </Card>
      )}
    </Dialog>
  )
}
