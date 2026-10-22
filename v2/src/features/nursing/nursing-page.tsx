/**
 * Nursing station: patients ranked by early-warning score (NEWS2) with fall and pressure
 * injury risk, the medication pass (eMAR with barcode scanning) and shift handover (SBAR)
 * — the things a nurse checks every shift.
 */
import { Button, Chip, Tabs } from "@heroui/react"
import { AlertTriangle, ClipboardPen, HeartPulse, Pill, ScanBarcode, Timer } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { VitalsStrip } from "@v2/components/clinical/vitals-monitor"
import { MarkerDots } from "@v2/components/clinical/wristband"
import { Dialog } from "@v2/components/ui/dialog"
import { Empty } from "@v2/components/ui/empty"
import { SelectInput, TextAreaInput } from "@v2/components/ui/fields"
import { Page, PageHeader } from "@v2/components/ui/page"
import { Panel } from "@v2/components/ui/panel"
import { Stat } from "@v2/components/ui/stat"
import { ageLabel, minutesSince, news2 } from "@v2/domain/clinical"
import type { AssessmentKind, Encounter, MarEntry } from "@v2/domain/types"
import { News2Chip } from "@v2/features/emr/clinical-widgets"
import { VitalsDialog } from "@v2/features/emr/vitals-dialog"
import { cn } from "@v2/lib/cn"
import { formatDateTime, formatDuration, formatRelative, formatTime } from "@v2/lib/format"
import { usePrefs } from "@v2/lib/prefs"
import { toast } from "@v2/lib/toast"
import { useNow } from "@v2/lib/use-now"
import { useActions, useStore } from "@v2/store"
import { useInventoryMap, usePatientMap, useRegion, useSession, useStaffMap } from "@v2/store/selectors"
import { BcmaDialog, HoldDialog } from "./bcma-dialog"
import { AssessmentChip, AssessmentDialog } from "./risk-assessment"

/** Observation interval (minutes) required by the NEWS2 response protocol. */
function observationInterval(e: Encounter): number {
  const latest = [...e.vitals].sort((a, b) => b.at.localeCompare(a.at))[0]
  const s = latest ? news2(latest) : null
  if (!s) return 240
  if (s.risk === "high") return 15
  if (s.risk === "medium") return 60
  return s.score === 0 ? 720 : 240
}

export default function NursingPage() {
  const units = useStore((s) => s.units)
  const encounters = useStore((s) => s.encounters)
  const beds = useStore((s) => s.beds)
  const mar = useStore((s) => s.mar)
  const patients = usePatientMap()
  const items = useInventoryMap()
  const { user } = useSession()
  const now = useNow()
  const wards = units.filter((u) => u.kind === "ward" || u.kind === "icu")
  const saved = usePrefs((s) => s.unitFilter.nursing)
  const setUnitFilter = usePrefs((s) => s.setUnitFilter)
  const ward = saved ?? wards.find((w) => w.id === user?.unitId)?.id ?? wards[0].id
  const [vitalsFor, setVitalsFor] = useState<Encounter>()
  const [handoverFor, setHandoverFor] = useState<Encounter>()
  const [marAction, setMarAction] = useState<{ entry: MarEntry; mode: "give" | "hold" }>()
  const [assessing, setAssessing] = useState<{ encounter: Encounter; kind: AssessmentKind }>()
  const staff = useStaffMap()
  const region = useRegion()
  const us = region === "us"

  const inWard = encounters
    .filter((e) => e.kind === "inpatient" && e.status === "in-progress" && e.unitId === ward)
    .map((e) => {
      const latest = [...e.vitals].sort((a, b) => b.at.localeCompare(a.at))[0]
      return { e, latest, score: latest ? news2(latest)?.score ?? -1 : -1, overdue: latest ? minutesSince(latest.at, now) > observationInterval(e) : true }
    })
    .sort((a, b) => b.score - a.score)
  const encIds = new Set(inWard.map((x) => x.e.id))
  const wardMar = mar.filter((m) => encIds.has(m.encounterId) && new Date(m.scheduledAt).toDateString() === new Date(now).toDateString()).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const dueSoon = wardMar.filter((m) => m.status === "due" && new Date(m.scheduledAt).getTime() < now + 2 * 3600000)
  const late = wardMar.filter((m) => m.status === "due" && new Date(m.scheduledAt).getTime() < now - 30 * 60000)
  const encById = new Map(inWard.map((x) => [x.e.id, x.e]))
  const given = wardMar.filter((m) => m.status === "given")
  const compliance = given.length ? Math.round((given.filter((m) => m.scanned).length / given.length) * 100) : null

  return (
    <Page>
      <PageHeader
        title="Nursing"
        description="Patients sorted by NEWS2, highest first. Overdue observations are flagged red per the NEWS2 escalation protocol."
        actions={<SelectInput label={us ? "Unit" : "Ward"} className="w-64" value={ward} onChange={(v) => setUnitFilter("nursing", v)} options={wards.map((w) => ({ value: w.id, label: w.name }))} />}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Patients" value={inWard.length} icon={HeartPulse} tone="accent" />
        <Stat label="NEWS2 ≥ 5" value={inWard.filter((x) => x.score >= 5).length} icon={AlertTriangle} tone={inWard.some((x) => x.score >= 5) ? "danger" : "success"} />
        <Stat label="Obs overdue" value={inWard.filter((x) => x.overdue).length} icon={Timer} tone={inWard.some((x) => x.overdue) ? "warning" : "success"} />
        <Stat label="Meds due in 2 h" value={dueSoon.length} hint={late.length ? `${late.length} late` : "None late"} icon={Pill} tone={late.length ? "danger" : "default"} />
        <Stat label="BCMA scan compliance" value={compliance === null ? "—" : `${compliance}%`} hint={`${given.filter((m) => m.scanned).length}/${given.length} doses scanned today · target ≥ 95%`} icon={ScanBarcode} tone={compliance === null ? "default" : compliance >= 95 ? "success" : compliance >= 85 ? "warning" : "danger"} />
      </div>

      <Tabs>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Nursing">
            <Tabs.Tab className="whitespace-nowrap" id="patients">Patients<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab className="whitespace-nowrap" id="mar">Medication pass (eMAR)<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab className="whitespace-nowrap" id="handover">Handover (SBAR)<Tabs.Indicator /></Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="patients" className="pt-4">
          {inWard.length === 0 ? (
            <Panel><Empty title={us ? "No patients on this unit" : "No patients on this ward"} /></Panel>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {inWard.map(({ e, latest, overdue }) => {
                const p = patients.get(e.patientId)!
                const s = latest ? news2(latest) : null
                return (
                  <Panel key={e.id} className={cn(s?.risk === "high" && "ring-2 ring-danger", s?.risk === "medium" && "ring-1 ring-warning")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="tabular rounded-md bg-surface-secondary px-1.5 py-0.5 text-xs font-bold">{beds.find((b) => b.id === e.bedId)?.code}</span>
                          <Link to={`/encounters/${e.id}`} className="truncate font-semibold hover:underline">
                            {p.name}
                          </Link>
                          <MarkerDots patient={p} />
                        </div>
                        <div className="text-xs text-muted">
                          {p.gender === "female" ? "F" : "M"} · {ageLabel(p.birthDate)} · {e.diagnoses.find((d) => d.primary)?.display}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <News2Chip vitals={latest} />
                        <div className="flex gap-1">
                          <AssessmentChip encounter={e} kind="morse" />
                          <AssessmentChip encounter={e} kind="braden" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <VitalsStrip vitals={latest} />
                    </div>
                    {s && s.risk !== "low" && <p className={cn("mt-2 rounded-lg px-3 py-1.5 text-xs", s.risk === "high" ? "bg-danger-soft text-danger-soft-foreground" : "bg-warning-soft text-warning-soft-foreground")}>{s.response}</p>}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className={cn("text-xs", overdue ? "font-semibold text-danger" : "text-muted")}>
                        Last obs {latest ? formatRelative(latest.at, now) : "none"}
                        {overdue && " · overdue"}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" onPress={() => setAssessing({ encounter: e, kind: "morse" })}>
                          Morse
                        </Button>
                        <Button size="sm" variant="ghost" onPress={() => setAssessing({ encounter: e, kind: "braden" })}>
                          Braden
                        </Button>
                        <Button size="sm" variant="tertiary" onPress={() => setHandoverFor(e)}>
                          SBAR
                        </Button>
                        <Button size="sm" variant="primary" onPress={() => setVitalsFor(e)}>
                          Record vitals
                        </Button>
                      </div>
                    </div>
                  </Panel>
                )
              })}
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel id="mar" className="pt-4">
          <Panel flush>
            {wardMar.length === 0 ? (
              <Empty icon={Pill} title="No scheduled doses today" />
            ) : (
              <ul className="divide-y divide-separator">
                {wardMar.map((m) => {
                  const enc = encById.get(m.encounterId)!
                  const p = patients.get(enc.patientId)!
                  const item = items.get(m.itemId)
                  const isLate = m.status === "due" && new Date(m.scheduledAt).getTime() < now - 30 * 60000
                  return (
                    <li key={m.id} className={cn("flex flex-wrap items-center gap-3 px-5 py-3", isLate && "bg-danger-soft/40")}>
                      <div className="tabular w-14 text-sm font-bold">{formatTime(m.scheduledAt)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {item?.name}
                          {item?.highAlert && (
                            <Chip size="sm" color="danger" variant="primary">
                              High alert — double check
                            </Chip>
                          )}
                          {item?.controlled && (
                            <Chip size="sm" color="warning" variant="soft" className="num">
                              {us ? `C-${item.controlled}` : `CD${item.controlled}`}
                            </Chip>
                          )}
                        </div>
                        <div className="text-xs text-muted">
                          {m.dose} · {m.route} · {beds.find((b) => b.id === enc.bedId)?.code} {p.name}
                          {p.allergies.length > 0 && <span className="font-semibold text-danger"> · allergies: {p.allergies.map((a) => a.substance).join(", ")}</span>}
                        </div>
                      </div>
                      {m.status === "due" ? (
                        <div className="flex gap-1">
                          {isLate && <span className="self-center text-xs font-semibold text-danger">{formatDuration(minutesSince(m.scheduledAt, now))} late</span>}
                          <Button size="sm" variant="ghost" onPress={() => setMarAction({ entry: m, mode: "hold" })}>
                            Not given
                          </Button>
                          <Button size="sm" variant="primary" onPress={() => setMarAction({ entry: m, mode: "give" })}>
                            <ScanBarcode className="size-4" aria-hidden /> Administer
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-0.5">
                          <Chip size="sm" variant="soft" color={m.status === "given" ? "success" : "warning"}>
                            {m.status === "given" ? "Given" : m.status === "held" ? "Held" : "Refused"} {m.at && formatTime(m.at)}
                          </Chip>
                          {m.status === "given" && (
                            <span className={cn("label-caps", m.scanned ? "text-muted" : "text-warning")}>
                              {m.scanned ? "Scanned" : "Scan override"}
                              {m.witnessId && ` · witness ${staff.get(m.witnessId)?.name.replace(/,.*$/, "") ?? ""}`}
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </Tabs.Panel>

        <Tabs.Panel id="handover" className="space-y-3 pt-4">
          {inWard.map(({ e }) => {
            const p = patients.get(e.patientId)!
            const last = [...e.handovers].sort((a, b) => b.at.localeCompare(a.at))[0]
            return (
              <Panel
                key={e.id}
                title={`${beds.find((b) => b.id === e.bedId)?.code} · ${p.name}`}
                description={last ? `Last handover ${formatDateTime(last.at)} · ${staff.get(last.authorId)?.name ?? ""}` : "No handover recorded"}
                actions={
                  <Button size="sm" variant="tertiary" onPress={() => setHandoverFor(e)}>
                    <ClipboardPen className="size-4" aria-hidden /> Write SBAR
                  </Button>
                }
              >
                {last ? (
                  <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                    <dt className="font-semibold text-muted">S</dt>
                    <dd>{last.situation}</dd>
                    <dt className="font-semibold text-muted">B</dt>
                    <dd>{last.background}</dd>
                    <dt className="font-semibold text-muted">A</dt>
                    <dd>{last.assessment}</dd>
                    <dt className="font-semibold text-muted">R</dt>
                    <dd>{last.recommendation}</dd>
                  </dl>
                ) : (
                  <p className="text-sm text-muted">—</p>
                )}
              </Panel>
            )
          })}
        </Tabs.Panel>
      </Tabs>

      {vitalsFor && <VitalsDialog encounterId={vitalsFor.id} patientName={patients.get(vitalsFor.patientId)?.name ?? ""} onClose={() => setVitalsFor(undefined)} />}
      {handoverFor && <HandoverDialog encounter={handoverFor} onClose={() => setHandoverFor(undefined)} />}
      {marAction?.mode === "give" && <BcmaDialog entry={marAction.entry} onClose={() => setMarAction(undefined)} />}
      {marAction?.mode === "hold" && <HoldDialog entry={marAction.entry} onClose={() => setMarAction(undefined)} />}
      {assessing && <AssessmentDialog encounter={assessing.encounter} kind={assessing.kind} patientName={patients.get(assessing.encounter.patientId)?.name ?? ""} onClose={() => setAssessing(undefined)} />}
    </Page>
  )
}

function HandoverDialog({ encounter, onClose }: { encounter: Encounter; onClose: () => void }) {
  const { addHandover } = useActions()
  const patient = useStore((s) => s.patients.find((p) => p.id === encounter.patientId))
  const [f, setF] = useState({ situation: "", background: encounter.diagnoses.map((d) => d.display).join(", "), assessment: "", recommendation: "" })
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }))
  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      isDismissable={false}
      size="lg"
      title="Shift handover (SBAR)"
      description={patient?.name}
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={!f.situation.trim() || !f.recommendation.trim()}
            onPress={() => {
              addHandover(encounter.id, f)
              toast.success("Handover saved")
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <TextAreaInput label="S — Situation" value={f.situation} onChange={set("situation")} rows={2} placeholder="Current condition and concerns" isRequired />
      <TextAreaInput label="B — Background" value={f.background} onChange={set("background")} rows={2} placeholder="Diagnosis, history, treatment so far, code status" />
      <TextAreaInput label="A — Assessment" value={f.assessment} onChange={set("assessment")} rows={2} placeholder="Nursing assessment, NEWS2, fall / pressure injury risk" />
      <TextAreaInput label="R — Recommendation" value={f.recommendation} onChange={set("recommendation")} rows={2} placeholder="What the next shift needs to do or watch for" isRequired />
    </Dialog>
  )
}
