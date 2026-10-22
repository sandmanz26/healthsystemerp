/**
 * Vital signs entry with live NEWS2. Numeric keypad on tablets; the score updates as the
 * nurse types so escalation happens at the bedside, not after charting.
 * Temperature and weight are entered in the facility's units (°F / lb in the US) and
 * stored in °C / kg.
 */
import { Button, Switch } from "@heroui/react"
import { useState } from "react"
import { Dialog } from "@/components/ui/dialog"
import { SelectInput, TextInput } from "@/components/ui/fields"
import { news2 } from "@/domain/clinical"
import type { Vitals } from "@/domain/types"
import { cn } from "@/lib/cn"
import { tempUnit } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useActions } from "@/store"
import { EMPTY_VITALS, toVitals, weightUnit, type VitalsDraft as Draft } from "./vitals-form"

export function VitalsFields({ value, onChange }: { value: Draft; onChange: (d: Draft) => void }) {
  const set = (k: keyof Draft) => (v: string) => onChange({ ...value, [k]: v.replace(/[^\d.,]/g, "") })
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <TextInput label="Systolic BP" value={value.systolic} onChange={set("systolic")} inputMode="numeric" suffix="mmHg" />
      <TextInput label="Diastolic BP" value={value.diastolic} onChange={set("diastolic")} inputMode="numeric" suffix="mmHg" />
      <TextInput label="Heart rate" value={value.heartRate} onChange={set("heartRate")} inputMode="numeric" suffix="bpm" />
      <TextInput label="Resp. rate" value={value.respRate} onChange={set("respRate")} inputMode="numeric" suffix="/min" />
      <TextInput label="Temperature" value={value.temperature} onChange={set("temperature")} inputMode="decimal" suffix={tempUnit()} />
      <TextInput label="SpO₂" value={value.spo2} onChange={set("spo2")} inputMode="numeric" suffix="%" />
      <TextInput label="Pain score" value={value.painScore} onChange={set("painScore")} inputMode="numeric" suffix="/10" />
      <TextInput label="Weight" value={value.weight} onChange={set("weight")} inputMode="decimal" suffix={weightUnit()} />
    </div>
  )
}

interface VitalsDialogProps {
  encounterId: string
  patientName: string
  onClose: () => void
}

const RISK_LABEL = { low: "low", medium: "medium", high: "high" } as const

export function VitalsDialog({ encounterId, patientName, onClose }: VitalsDialogProps) {
  const { addVitals } = useActions()
  const [draft, setDraft] = useState<Draft>(EMPTY_VITALS)
  const [onOxygen, setOnOxygen] = useState(false)
  const [consciousness, setConsciousness] = useState<NonNullable<Vitals["consciousness"]>>("A")
  const vitals = toVitals(draft, onOxygen, consciousness)
  const score = news2({ ...vitals, id: "", at: "", by: "" })
  const empty = Object.values(draft).every((v) => v === "")

  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      isDismissable={false}
      size="lg"
      title="Vital signs"
      description={patientName}
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={empty}
            onPress={() => {
              addVitals(encounterId, vitals)
              if (score && score.risk !== "low") toast.warning(`NEWS2 ${score.score} — ${score.response}`)
              else toast.success("Vital signs saved")
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <VitalsFields value={draft} onChange={setDraft} />
      <div className="grid gap-3 sm:grid-cols-2">
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
        <Switch isSelected={onOxygen} onChange={setOnOxygen} className="self-end pb-2">
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <span className="text-sm">On supplemental oxygen</span>
          </Switch.Content>
        </Switch>
      </div>
      <div className={cn("rounded-xl p-3 text-sm", !score ? "bg-surface-secondary text-muted" : score.risk === "high" ? "bg-danger-soft text-danger-soft-foreground" : score.risk === "medium" ? "bg-warning-soft text-warning-soft-foreground" : "bg-success-soft text-success-soft-foreground")} role="status">
        {score ? (
          <>
            <b>NEWS2 {score.score}</b> — {RISK_LABEL[score.risk]} clinical risk
            {score.redFlag && " (single parameter scored 3)"}. {score.response}.
          </>
        ) : (
          "Enter at least 3 parameters to calculate NEWS2."
        )}
        <span className="label-caps mt-1 block opacity-70">Source: Royal College of Physicians, NEWS2 (2017)</span>
      </div>
    </Dialog>
  )
}
