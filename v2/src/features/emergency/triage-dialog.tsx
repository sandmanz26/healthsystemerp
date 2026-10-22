/**
 * ED triage with vital signs and a sepsis screen.
 *
 * - US: Emergency Severity Index v5 (ENA). The nurse answers the four decision points
 *   (A: life-saving intervention? B: high-risk / new confusion / severe pain? C: how many
 *   resources? D: danger-zone vitals) and the dialog suggests the level.
 * - UK: Manchester Triage System — the nurse picks the presentation flowchart and the
 *   category, each with its maximum time to clinician.
 *
 * Vitals are typed in the facility's temperature unit (°F in the US) and stored in °C. The
 * sepsis screen (CMS SEP-1 / NICE NG51 red flags) runs as the nurse types.
 */
import { Button } from "@heroui/react"
import { AlertOctagon } from "lucide-react"
import { useMemo, useState } from "react"
import { TRIAGE_BG } from "@v2/components/clinical/labels"
import { Dialog } from "@v2/components/ui/dialog"
import { SelectInput, TextInput } from "@v2/components/ui/fields"
import { ageOf, news2, sepsisBundle, sepsisScreen, TRIAGE_SCALES, triageInfo } from "@v2/domain/clinical"
import type { Region } from "@v2/domain/region"
import type { Encounter, TriageLevel, Vitals } from "@v2/domain/types"
import { CheckField } from "@v2/features/patients/patient-fields"
import { cn } from "@v2/lib/cn"
import { formatTime, fromDisplayTemp, tempUnit } from "@v2/lib/format"
import { toast } from "@v2/lib/toast"
import { useActions, useStore } from "@v2/store"
import { useEncounter, useRegion } from "@v2/store/selectors"

const LEVELS: TriageLevel[] = [1, 2, 3, 4, 5]

/** Common MTS presentational flowcharts (the full system has 50+). */
const MTS_FLOWCHARTS = [
  "Chest pain",
  "Shortness of breath in adults",
  "Abdominal pain in adults",
  "Unwell adult",
  "Collapsed adult",
  "Head injury",
  "Limb problems",
  "Falls",
  "Headache",
  "Fits",
  "Major trauma",
  "Overdose and poisoning",
  "Mental illness",
  "Wounds",
  "Unwell child",
]

type Draft = Record<"systolic" | "diastolic" | "heartRate" | "respRate" | "temperature" | "spo2" | "painScore", string>
const EMPTY: Draft = { systolic: "", diastolic: "", heartRate: "", respRate: "", temperature: "", spo2: "", painScore: "" }
const num = (v: string) => {
  const n = Number(v.replace(",", "."))
  return v.trim() === "" || Number.isNaN(n) ? undefined : n
}

/** ESI v5 danger-zone vitals by age (decision point D). */
function dangerZone(v: Omit<Vitals, "id" | "at" | "by">, birthDate: string): string[] {
  const { years, months } = ageOf(birthDate)
  const ageMonths = years * 12 + months
  const [hr, rr] = ageMonths < 3 ? [180, 50] : ageMonths < 36 ? [160, 40] : years <= 8 ? [140, 30] : [100, 20]
  return [
    v.heartRate !== undefined && v.heartRate > hr && `HR > ${hr}`,
    v.respRate !== undefined && v.respRate > rr && `RR > ${rr}`,
    v.spo2 !== undefined && v.spo2 < 92 && "SpO₂ < 92%",
  ].filter(Boolean) as string[]
}

type Answer = boolean | null
type Resources = "0" | "1" | "2+"

export function TriageDialog({ encounter, patientName, onClose }: { encounter: Encounter; patientName: string; onClose: () => void }) {
  const region = useRegion()
  const us = region === "us"
  const scale = TRIAGE_SCALES[region]
  const patient = useStore((s) => s.patients.find((p) => p.id === encounter.patientId))
  const live = useEncounter(encounter.id) ?? encounter
  const { triage, startSepsis } = useActions()

  const [level, setLevel] = useState<TriageLevel | undefined>(encounter.triage)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [onOxygen, setOnOxygen] = useState(false)
  const [consciousness, setConsciousness] = useState<NonNullable<Vitals["consciousness"]>>("A")
  const [lsi, setLsi] = useState<Answer>(null)
  const [highRisk, setHighRisk] = useState<Answer>(null)
  const [resources, setResources] = useState<Resources | null>(null)
  const [flowchart, setFlowchart] = useState<string | null>(null)

  const vitals = useMemo<Omit<Vitals, "id" | "at" | "by">>(() => {
    const temp = num(draft.temperature)
    return {
      systolic: num(draft.systolic),
      diastolic: num(draft.diastolic),
      heartRate: num(draft.heartRate),
      respRate: num(draft.respRate),
      temperature: temp === undefined ? undefined : fromDisplayTemp(temp),
      spo2: num(draft.spo2),
      painScore: num(draft.painScore),
      onOxygen,
      consciousness,
    }
  }, [draft, onOxygen, consciousness])
  const full: Vitals = { ...vitals, id: "", at: "", by: "" }
  const hasVitals = Object.values(draft).some((v) => v !== "")
  const score = news2(full)
  const screen = hasVitals ? sepsisScreen(region, full) : null
  const danger = patient ? dangerZone(vitals, patient.birthDate) : []

  // ESI v5 algorithm: A → 1, B → 2, C (resources) → 3/4/5, D (danger zone) → consider 2.
  const suggested: TriageLevel | undefined = !us
    ? undefined
    : lsi
      ? 1
      : lsi === false && highRisk
        ? 2
        : lsi === false && highRisk === false && resources
          ? resources === "0"
            ? 5
            : resources === "1"
              ? 4
              : danger.length
                ? 2
                : 3
          : undefined

  const set = (k: keyof Draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v.replace(/[^\d.,]/g, "") }))

  const save = () => {
    if (!level) return
    triage(encounter.id, level, hasVitals ? vitals : undefined)
    const info = triageInfo(region, level)
    toast.success(`${us ? "ESI" : "MTS"} ${level} — ${info.label}${flowchart ? ` · ${flowchart}` : ""}`, {
      description: us ? (info.targetMin === 0 ? "Immediate physician at bedside" : `Local door-to-provider goal ≤ ${info.targetMin} min`) : info.targetMin === 0 ? "See immediately" : `See clinician within ${info.targetMin} min`,
    })
    onClose()
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      isDismissable={false}
      size="lg"
      title={us ? "ED triage" : "A&E triage"}
      description={`${patientName} — chief complaint: ${encounter.chiefComplaint}`}
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isDisabled={!level} onPress={save}>
            Save triage
          </Button>
        </>
      }
    >
      <p className="label-caps text-muted">
        {scale.name} {us ? "· ENA 2023" : "· 3rd edition"}
      </p>

      {us ? (
        <EsiDecisionPoints lsi={lsi} setLsi={setLsi} highRisk={highRisk} setHighRisk={setHighRisk} resources={resources} setResources={setResources} danger={danger} suggested={suggested} onApply={setLevel} />
      ) : (
        <SelectInput label="Presentation (MTS flowchart)" value={flowchart} onChange={setFlowchart} options={MTS_FLOWCHARTS.map((f) => ({ value: f, label: f }))} placeholder="Select flowchart…" />
      )}

      <div className="grid gap-2 sm:grid-cols-5" role="radiogroup" aria-label={`${scale.name} level`}>
        {LEVELS.map((l) => {
          const info = triageInfo(region, l)
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={level === l}
              onClick={() => setLevel(l)}
              title={info.criteria}
              className={cn("rounded-lg p-3 text-left transition", TRIAGE_BG[l], level === l ? "ring-2 ring-focus ring-offset-2" : "opacity-75 hover:opacity-100", suggested === l && level !== l && "outline-2 outline-dashed outline-foreground/40")}
            >
              <div className="num text-2xl font-extrabold leading-none">{l}</div>
              <div className="mt-1 text-sm font-semibold leading-tight">{info.label}</div>
              <div className="label-caps mt-1 opacity-80">
                {us ? (l === 1 ? "Immediate" : `Goal ≤ ${info.targetMin} min`) : `${info.colour} · ${info.targetMin === 0 ? "0 min" : `${info.targetMin} min`}`}
              </div>
            </button>
          )
        })}
      </div>
      {level && (
        <p className="text-sm text-muted">
          <b className="text-foreground">{us ? `ESI ${level}` : `MTS ${level}`}:</b> {triageInfo(region, level).criteria}.
        </p>
      )}

      <fieldset className="space-y-3 border-t border-separator pt-3">
        <legend className="label-caps text-muted">Triage vital signs</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TextInput label="Systolic BP" value={draft.systolic} onChange={set("systolic")} inputMode="numeric" suffix="mmHg" />
          <TextInput label="Diastolic BP" value={draft.diastolic} onChange={set("diastolic")} inputMode="numeric" suffix="mmHg" />
          <TextInput label="Heart rate" value={draft.heartRate} onChange={set("heartRate")} inputMode="numeric" suffix="bpm" />
          <TextInput label="Resp. rate" value={draft.respRate} onChange={set("respRate")} inputMode="numeric" suffix="/min" />
          <TextInput label="Temperature" value={draft.temperature} onChange={set("temperature")} inputMode="decimal" suffix={tempUnit()} />
          <TextInput label="SpO₂" value={draft.spo2} onChange={set("spo2")} inputMode="numeric" suffix="%" />
          <TextInput label="Pain score" value={draft.painScore} onChange={set("painScore")} inputMode="numeric" suffix="/10" />
          <div className="flex items-end pb-2">
            <CheckField isSelected={onOxygen} onChange={setOnOxygen}>
              On O₂
            </CheckField>
          </div>
        </div>
        <SelectInput
          label="Level of consciousness (ACVPU)"
          value={consciousness}
          onChange={setConsciousness}
          options={[
            { value: "A", label: "A — Alert" },
            { value: "C", label: "C — New confusion" },
            { value: "V", label: "V — Responds to voice" },
            { value: "P", label: "P — Responds to pain" },
            { value: "U", label: "U — Unresponsive" },
          ]}
        />
      </fieldset>

      {score && (
        <p className={cn("rounded-lg px-3 py-2 text-sm", score.risk === "high" ? "bg-danger-soft text-danger-soft-foreground" : score.risk === "medium" ? "bg-warning-soft text-warning-soft-foreground" : "bg-surface-secondary")}>
          <b className="num">NEWS2 {score.score}</b> — {score.risk} clinical risk. {score.response}.
          {level && level >= 4 && score.risk !== "low" ? ` Consider up-triaging.` : ""}
        </p>
      )}

      {screen && <SepsisBanner region={region} screen={screen} encounter={live} systolic={vitals.systolic} onStart={(shock) => startSepsis(encounter.id, shock)} />}
    </Dialog>
  )
}

function YesNo({ value, onChange, label }: { value: Answer; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={label}>
      {[true, false].map((v) => (
        <Button key={String(v)} size="sm" variant={value === v ? "primary" : "tertiary"} onPress={() => onChange(v)} aria-pressed={value === v}>
          {v ? "Yes" : "No"}
        </Button>
      ))}
    </div>
  )
}

interface EsiProps {
  lsi: Answer
  setLsi: (v: boolean) => void
  highRisk: Answer
  setHighRisk: (v: boolean) => void
  resources: Resources | null
  setResources: (v: Resources) => void
  danger: string[]
  suggested?: TriageLevel
  onApply: (l: TriageLevel) => void
}

function EsiDecisionPoints({ lsi, setLsi, highRisk, setHighRisk, resources, setResources, danger, suggested, onApply }: EsiProps) {
  const row = "flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
  return (
    <div className="divide-y divide-separator rounded-lg border border-border px-4">
      <div className={row}>
        <div>
          <span className="label-caps mr-2 text-muted">A</span>
          <span className="text-sm font-medium">Requires immediate life-saving intervention?</span>
          <div className="text-xs text-muted">Airway, emergency meds, defibrillation, hemodynamic intervention</div>
        </div>
        <YesNo label="Decision point A" value={lsi} onChange={setLsi} />
      </div>
      {lsi === false && (
        <div className={row}>
          <div>
            <span className="label-caps mr-2 text-muted">B</span>
            <span className="text-sm font-medium">High-risk situation, new confusion / lethargy, or severe pain / distress?</span>
            <div className="text-xs text-muted">Would you give your last open bed to this patient?</div>
          </div>
          <YesNo label="Decision point B" value={highRisk} onChange={setHighRisk} />
        </div>
      )}
      {lsi === false && highRisk === false && (
        <div className={row}>
          <div>
            <span className="label-caps mr-2 text-muted">C</span>
            <span className="text-sm font-medium">How many different resources are expected?</span>
            <div className="text-xs text-muted">Labs, imaging, IV fluids/meds, specialty consult, simple / complex procedure</div>
          </div>
          <div className="flex gap-1" role="radiogroup" aria-label="Decision point C">
            {(["0", "1", "2+"] as Resources[]).map((r) => (
              <Button key={r} size="sm" variant={resources === r ? "primary" : "tertiary"} onPress={() => setResources(r)}>
                {r === "0" ? "None" : r === "1" ? "One" : "Many"}
              </Button>
            ))}
          </div>
        </div>
      )}
      {resources === "2+" && lsi === false && highRisk === false && (
        <div className="py-2.5 text-sm">
          <span className="label-caps mr-2 text-muted">D</span>
          Danger-zone vitals:{" "}
          {danger.length ? <b className="text-danger">{danger.join(", ")} — consider ESI 2</b> : <span className="text-muted">none (enter vitals below)</span>}
        </div>
      )}
      {suggested && (
        <div className="flex items-center justify-between gap-2 py-2.5">
          <span className="text-sm">
            Suggested: <b className="num">ESI {suggested}</b>
          </span>
          <Button size="sm" variant="secondary" onPress={() => onApply(suggested)}>
            Apply
          </Button>
        </div>
      )}
    </div>
  )
}

interface SepsisBannerProps {
  region: Region
  screen: ReturnType<typeof sepsisScreen>
  encounter: Encounter
  systolic?: number
  onStart: (septicShock: boolean) => void
}

function SepsisBanner({ region, screen, encounter, systolic, onStart }: SepsisBannerProps) {
  const source = region === "us" ? "Source: CMS SEP-1 (SIRS + organ dysfunction)" : "Source: NICE NG51 · UK Sepsis Trust red flags"
  if (encounter.sepsis)
    return (
      <div className="rounded-lg border border-danger/50 bg-danger-soft p-3 text-sm text-danger-soft-foreground" role="status">
        <b>{sepsisBundle(region).name} started</b> at <span className="num">{formatTime(encounter.sepsis.identifiedAt)}</span> (time zero){encounter.sepsis.septicShock ? " · septic shock" : ""}.
      </div>
    )
  if (!screen.positive)
    return screen.criteria.length ? (
      <div className="rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">
        <b>{screen.label}</b>: {screen.criteria.join(" · ")}
        <span className="label-caps mt-1 block opacity-70">{source}</span>
      </div>
    ) : null
  return (
    <div className="rounded-lg border border-danger bg-danger p-3 text-sm text-danger-foreground" role="alert">
      <div className="flex items-start gap-2">
        <AlertOctagon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Sepsis screen positive — {screen.label}</div>
          <ul className="mt-1 list-inside list-disc">
            {screen.criteria.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <span className="label-caps mt-1 block opacity-80">{source}</span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => {
            onStart(systolic !== undefined && systolic < 90)
            toast.warning(region === "us" ? "Sepsis alert — SEP-1 clock started" : "Red flag sepsis — Sepsis Six started")
          }}
        >
          Start sepsis pathway
        </Button>
      </div>
    </div>
  )
}
