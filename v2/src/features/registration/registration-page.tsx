/**
 * Registration desk: today's queue across all clinics and the ED, check-in of booked
 * patients, and new registrations. Optimised for a keyboard-heavy desk serving a line of
 * people. Each row shows the eligibility result (X12 271 / PDS trace) captured at check-in.
 */
import { Button } from "@heroui/react"
import { CalendarCheck, Clock, MonitorPlay, Plus, Siren, Ticket, UserRoundCheck, Users, X } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { EncounterStatusChip, PayerChip } from "@v2/components/status"
import { QueueList, QueueRow } from "@v2/components/clinical/queue-row"
import { Dialog } from "@v2/components/ui/dialog"
import { Empty } from "@v2/components/ui/empty"
import { SelectInput, TextInput } from "@v2/components/ui/fields"
import { Page, PageHeader } from "@v2/components/ui/page"
import { Panel } from "@v2/components/ui/panel"
import { Segmented } from "@v2/components/ui/segmented"
import { Stat } from "@v2/components/ui/stat"
import { minutesSince } from "@v2/domain/clinical"
import type { Encounter } from "@v2/domain/types"
import { dayKey, formatDuration } from "@v2/lib/format"
import { toast } from "@v2/lib/toast"
import { useNow } from "@v2/lib/use-now"
import { useActions, useStore } from "@v2/store"
import { useModuleEnabled, usePatientMap, useRegion, useStaffMap, useUnitName } from "@v2/store/selectors"
import { sourceLabel } from "@v2/features/appointments/sources"
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
  const payerOn = useModuleEnabled("payer")
  const region = useRegion()
  const us = region === "us"
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
        title="Registration & queue"
        description="Today's queue for every clinic and the ED. Patients waiting more than 60 minutes are flagged red (outpatient wait-time measure)."
        actions={
          <>
            <Link to="/registration/display" target="_blank">
              <Button variant="tertiary">
                <MonitorPlay className="size-4" aria-hidden /> Waiting-room display
              </Button>
            </Link>
            {erOn && (
              <Button variant="danger-soft" onPress={() => setDialog({ kind: "emergency" })}>
                <Siren className="size-4" aria-hidden /> {us ? "ED arrival" : "A&E arrival"}
              </Button>
            )}
            <Button variant="primary" onPress={() => setDialog({ kind: "outpatient" })}>
              <Plus className="size-4" aria-hidden /> Register visit
            </Button>
          </>
        }
      />

      <div className="stat-strip mb-6 grid grid-cols-2 lg:grid-cols-4">
        <Stat label="Registered today" value={today.filter((e) => e.status !== "cancelled").length} icon={Users} tone="accent" />
        <Stat label="Waiting to be called" value={today.filter((e) => e.status === "registered" || e.status === "triaged").length} icon={Ticket} tone="warning" />
        <Stat label="Being seen" value={today.filter((e) => e.status === "in-progress" || e.status === "called").length} icon={UserRoundCheck} tone="success" />
        <Stat label="Average wait" value={formatDuration(avgWait)} hint="Registered → called" icon={Clock} tone={avgWait > 60 ? "danger" : "default"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <Panel flush>
          <div className="flex flex-col gap-3 border-b border-separator p-4 md:flex-row md:items-center md:justify-between">
            <Segmented
              label="Queue status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "waiting", label: "Waiting", count: waiting.length },
                { value: "active", label: "In progress", count: activeNow.length },
                { value: "done", label: "Completed", count: done.length },
                { value: "all", label: "All", count: inUnit.length },
              ]}
            />
            <SelectInput label="Location" className="md:w-64" value={unit} onChange={setUnit} options={[{ value: "all", label: us ? "All clinics & ED" : "All clinics & A&E" }, ...units.filter((u) => u.kind === "clinic" || u.kind === "ed").map((u) => ({ value: u.id, label: u.name }))]} />
          </div>
          {rows.length === 0 ? (
            <Empty icon={Ticket} title="No patients in this list" description="Change the filter or register a new visit." />
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
                        <div className="truncate text-xs text-muted">{staff.get(e.practitionerId ?? "")?.name ?? (e.kind === "emergency" ? "ED provider" : "Unassigned")}</div>
                      </div>
                    }
                    badges={
                      <>
                        <PayerChip payer={e.payer} />
                        {payerOn && <EligibilityBadge encounter={e} us={us} />}
                        <EncounterStatusChip status={e.status} />
                      </>
                    }
                    waited={e.status === "registered" || e.status === "triaged" ? minutesSince(e.createdAt, now) : undefined}
                    actions={
                      e.status === "registered" ? (
                        <Button size="sm" variant="ghost" isIconOnly aria-label={`Cancel ${e.queueNumber}`} onPress={() => setCancelling(e)}>
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
          <Panel title="Today's appointments" description="Not yet checked in" actions={<CalendarCheck className="size-4 text-muted" aria-hidden />} flush>
            {pendingAppointments.length === 0 ? (
              <Empty title="All appointments checked in" />
            ) : (
              <ul className="divide-y divide-separator">
                {pendingAppointments.map((a) => {
                  const p = patients.get(a.patientId)
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="num w-12 text-sm font-semibold">{a.time}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{p?.name}</div>
                        <div className="truncate text-xs text-muted">
                          {unitName(a.unitId)} · {sourceLabel(a.source, region)}
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
      title={`Cancel ${encounter.queueNumber}?`}
      description={`${patient?.name} — the registration charge is voided if nothing has been paid.`}
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Back
          </Button>
          <Button
            variant="danger"
            isDisabled={reason.trim().length < 3}
            onPress={() => {
              cancelEncounter(encounter.id, reason.trim())
              toast(`Visit ${encounter.queueNumber} cancelled`)
              onClose()
            }}
          >
            Cancel visit
          </Button>
        </>
      }
    >
      <TextInput label="Reason" value={reason} onChange={setReason} isRequired autoFocus placeholder="e.g. left without being seen (LWBS)" />
    </Dialog>
  )
}

/** Compact eligibility result for queue rows: "271 active", "PDS verified", or a warning. */
function EligibilityBadge({ encounter: e, us }: { encounter: Encounter; us: boolean }) {
  if (e.payer === "self-pay" || e.payer === "overseas" || (!us && e.payer !== "nhs")) return null
  if (!e.eligibility) return <span className="label-caps text-danger">{us ? "Not verified" : "Not traced"}</span>
  const ok = e.eligibility.status === "active"
  return (
    <span className={ok ? "label-caps text-success" : "label-caps text-danger"} title={`${e.eligibility.summary} · ${e.eligibility.reference}`}>
      {us ? (ok ? "271 active" : `271 ${e.eligibility.status}`) : ok ? "PDS verified" : "PDS no match"}
    </span>
  )
}
