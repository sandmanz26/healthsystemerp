/**
 * Discharge planning board — the daily bed huddle. Length of stay against the expected date
 * of discharge (and the MS-DRG geometric mean LOS in the US), open barriers, and the
 * "ready to go" flag: US "medically ready for discharge", UK "no criteria to reside" (NCTR,
 * reported daily to NHS England). US Medicare patients also need the Important Message
 * from Medicare delivered within 2 days of admission (42 CFR §405.1205).
 */
import { Button, Checkbox, Chip, Label, Switch } from "@heroui/react"
import { ClipboardList } from "lucide-react"
import { useMemo, useState } from "react"
import { Dialog } from "@v2/components/ui/dialog"
import { Empty } from "@v2/components/ui/empty"
import { TextInput } from "@v2/components/ui/fields"
import { Panel } from "@v2/components/ui/panel"
import { groupEncounter } from "@v2/domain/finance"
import type { Bed, Encounter } from "@v2/domain/types"
import { cn } from "@v2/lib/cn"
import { dayKey, formatDate } from "@v2/lib/format"
import { toast } from "@v2/lib/toast"
import { useNow } from "@v2/lib/use-now"
import { useActions } from "@v2/store"
import { usePatientMap, useRegion } from "@v2/store/selectors"
import { BARRIERS, imOverdue, losDays, obsHours, plannedLos, readyLabel } from "./inpatient-helpers"

export function DischargePlanningBoard({ encounters, bedOf }: { encounters: Encounter[]; bedOf: (e: Encounter) => Bed | undefined }) {
  const region = useRegion()
  const us = region === "us"
  const patients = usePatientMap()
  const now = useNow()
  const { setDischargePlan } = useActions()
  const [editing, setEditing] = useState<Encounter>()
  const rows = useMemo(() => [...encounters].sort((a, b) => (a.dischargePlan?.edd ?? "").localeCompare(b.dischargePlan?.edd ?? "")), [encounters])
  const today = dayKey(now)

  if (!rows.length)
    return (
      <Panel>
        <Empty title="No inpatients" />
      </Panel>
    )

  return (
    <Panel
      flush
      title="Discharge planning"
      description={us ? "LOS vs EDD and MS-DRG GMLOS · barriers · medically ready · Important Message from Medicare" : "LOS vs EDD · barriers · no criteria to reside (NCTR) · SAFER bundle"}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-separator text-left">
              {["Bed", "Patient", "LOS / EDD", ...(us ? ["GMLOS"] : []), "Barriers", readyLabel(region), ...(us ? ["IM notice"] : []), ""].map((h) => (
                <th key={h} className="label-caps px-4 py-2 font-medium text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-separator">
            {rows.map((e) => {
              const p = patients.get(e.patientId)
              const plan = e.dischargePlan
              const los = losDays(e, now)
              const group = us ? groupEncounter(e, region) : null
              const pastEdd = plan && dayKey(plan.edd) < today
              const eddToday = plan && dayKey(plan.edd) === today
              const overGmlos = group?.gmlos !== undefined && los > group.gmlos
              return (
                <tr key={e.id} className="align-top">
                  <td className="num px-4 py-2.5 font-bold">{bedOf(e)?.code ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{p?.name}</div>
                    <div className="text-xs text-muted">{e.diagnoses.find((d) => d.primary)?.display ?? e.chiefComplaint}</div>
                    {e.admissionClass === "observation" && (
                      <Chip size="sm" color="warning" variant="soft" className="num mt-1">
                        Obs {obsHours(e, now)} h
                      </Chip>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className={cn("num", pastEdd && "font-semibold text-danger")}>
                      Day {los}
                      {plannedLos(e) !== undefined && <span className="text-muted"> / {plannedLos(e)}</span>}
                    </div>
                    {plan && <div className={cn("text-xs", pastEdd ? "text-danger" : eddToday ? "font-semibold text-warning" : "text-muted")}>EDD {formatDate(plan.edd)}{eddToday ? " · today" : pastEdd ? " · passed" : ""}</div>}
                  </td>
                  {us && (
                    <td className="px-4 py-2.5">
                      {group?.gmlos !== undefined ? (
                        <>
                          <div className={cn("num", overGmlos && "font-semibold text-danger")}>{group.gmlos.toFixed(1)} d</div>
                          <div className="num text-xs text-muted">MS-DRG {group.code}</div>
                        </>
                      ) : (
                        <span className="text-xs text-muted">Not grouped</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-2.5">
                    {plan?.barriers.length ? (
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {plan.barriers.map((b) => (
                          <Chip key={b} size="sm" variant="soft" color="warning">
                            {b}
                          </Chip>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted">None recorded</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Switch
                      aria-label={`${readyLabel(region)}: ${p?.name}`}
                      isSelected={!!plan?.medicallyReady}
                      onChange={(v) => {
                        setDischargePlan(e.id, { medicallyReady: v })
                        if (v && !us) toast("NCTR recorded", { description: "Included in today's discharge-ready return." })
                      }}
                    >
                      <Switch.Content>
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                        <span className="text-xs">{plan?.medicallyReady ? (us ? "Ready" : "NCTR") : us ? "Not yet" : "Meets criteria"}</span>
                      </Switch.Content>
                    </Switch>
                  </td>
                  {us && (
                    <td className="px-4 py-2.5">
                      {plan?.imNotice === undefined ? (
                        <span className="text-xs text-muted">N/A</span>
                      ) : (
                        <Checkbox isSelected={plan.imNotice} onChange={(v) => setDischargePlan(e.id, { imNotice: v })}>
                          <Checkbox.Content>
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                            <Label className={cn("text-xs", imOverdue(e, now) && "font-semibold text-danger")}>{plan.imNotice ? "Delivered" : imOverdue(e, now) ? "Overdue (> 2 days)" : "Due within 2 days"}</Label>
                          </Checkbox.Content>
                        </Checkbox>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="tertiary" onPress={() => setEditing(e)}>
                      <ClipboardList className="size-4" aria-hidden /> Plan
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="label-caps px-4 py-2 text-muted">{us ? "Source: CMS MS-DRG v42 GMLOS · 42 CFR §405.1205 (IM notice)" : "Source: NHS England discharge sitrep (NCTR) · SAFER patient flow bundle"}</p>
      {editing && <DischargePlanDialog encounter={editing} onClose={() => setEditing(undefined)} />}
    </Panel>
  )
}

function DischargePlanDialog({ encounter, onClose }: { encounter: Encounter; onClose: () => void }) {
  const region = useRegion()
  const patients = usePatientMap()
  const { setDischargePlan } = useActions()
  const plan = encounter.dischargePlan
  const [edd, setEdd] = useState(plan ? dayKey(plan.edd) : dayKey())
  const [barriers, setBarriers] = useState<string[]>(plan?.barriers ?? [])
  const [custom, setCustom] = useState("")
  const options = [...new Set([...BARRIERS[region], ...barriers])]
  const toggle = (b: string) => setBarriers((xs) => (xs.includes(b) ? xs.filter((x) => x !== b) : [...xs, b]))

  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title="Discharge plan"
      description={patients.get(encounter.patientId)?.name}
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onPress={() => {
              setDischargePlan(encounter.id, { edd: new Date(`${edd}T12:00`).toISOString(), barriers })
              toast.success("Discharge plan updated")
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <TextInput label="Expected date of discharge (EDD)" type="date" value={edd} onChange={setEdd} />
      <fieldset className="space-y-2">
        <legend className="label-caps mb-1 text-muted">Barriers to discharge</legend>
        {options.map((b) => (
          <Checkbox key={b} isSelected={barriers.includes(b)} onChange={() => toggle(b)}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Label className="text-sm">{b}</Label>
            </Checkbox.Content>
          </Checkbox>
        ))}
      </fieldset>
      <div className="flex items-end gap-2">
        <TextInput label="Other barrier" value={custom} onChange={setCustom} className="flex-1" />
        <Button
          variant="secondary"
          isDisabled={!custom.trim()}
          onPress={() => {
            setBarriers((xs) => [...new Set([...xs, custom.trim()])])
            setCustom("")
          }}
        >
          Add
        </Button>
      </div>
    </Dialog>
  )
}
