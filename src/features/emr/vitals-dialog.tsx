/**
 * Vital signs entry with live NEWS2. Numeric keypad on tablets; the score updates as the
 * nurse types so escalation happens at the bedside, not after charting.
 */
import { Button, Switch } from "@heroui/react"
import { useState } from "react"
import { Dialog } from "@/components/ui/dialog"
import { SelectInput, TextInput } from "@/components/ui/fields"
import { news2 } from "@/domain/clinical"
import type { Vitals } from "@/domain/types"
import { cn } from "@/lib/cn"
import { toast } from "@/lib/toast"
import { useActions } from "@/store"
import { EMPTY_VITALS, toVitals, type VitalsDraft as Draft } from "./vitals-form"

export function VitalsFields({ value, onChange }: { value: Draft; onChange: (d: Draft) => void }) {
  const set = (k: keyof Draft) => (v: string) => onChange({ ...value, [k]: v.replace(/[^\d.,]/g, "") })
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <TextInput label="Sistolik" value={value.systolic} onChange={set("systolic")} inputMode="numeric" suffix="mmHg" />
      <TextInput label="Diastolik" value={value.diastolic} onChange={set("diastolic")} inputMode="numeric" suffix="mmHg" />
      <TextInput label="Nadi" value={value.heartRate} onChange={set("heartRate")} inputMode="numeric" suffix="x/mnt" />
      <TextInput label="Napas" value={value.respRate} onChange={set("respRate")} inputMode="numeric" suffix="x/mnt" />
      <TextInput label="Suhu" value={value.temperature} onChange={set("temperature")} inputMode="decimal" suffix="°C" />
      <TextInput label="SpO₂" value={value.spo2} onChange={set("spo2")} inputMode="numeric" suffix="%" />
      <TextInput label="Skala nyeri" value={value.painScore} onChange={set("painScore")} inputMode="numeric" suffix="/10" />
      <TextInput label="Berat badan" value={value.weight} onChange={set("weight")} inputMode="decimal" suffix="kg" />
    </div>
  )
}


interface VitalsDialogProps {
  encounterId: string
  patientName: string
  onClose: () => void
}

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
      title="Tanda vital"
      description={patientName}
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            isDisabled={empty}
            onPress={() => {
              addVitals(encounterId, vitals)
              if (score && score.risk !== "rendah") toast.warning(`NEWS2 ${score.score} — ${score.response}`)
              else toast.success("Tanda vital tersimpan")
              onClose()
            }}
          >
            Simpan
          </Button>
        </>
      }
    >
      <VitalsFields value={draft} onChange={setDraft} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectInput
          label="Kesadaran (ACVPU)"
          value={consciousness}
          onChange={setConsciousness}
          options={[
            { value: "A", label: "A — Alert (sadar penuh)" },
            { value: "C", label: "C — Confusion baru" },
            { value: "V", label: "V — Respons suara" },
            { value: "P", label: "P — Respons nyeri" },
            { value: "U", label: "U — Tidak respons" },
          ]}
        />
        <Switch isSelected={onOxygen} onChange={setOnOxygen} className="self-end pb-2">
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <span className="text-sm">Mendapat oksigen tambahan</span>
          </Switch.Content>
        </Switch>
      </div>
      <div className={cn("rounded-xl p-3 text-sm", !score ? "bg-surface-secondary text-muted" : score.risk === "tinggi" ? "bg-danger-soft text-danger-soft-foreground" : score.risk === "sedang" ? "bg-warning-soft text-warning-soft-foreground" : "bg-success-soft text-success-soft-foreground")} role="status">
        {score ? (
          <>
            <b>NEWS2 {score.score}</b> — risiko {score.risk}
            {score.redFlag && " (ada parameter skor 3)"}. {score.response}.
          </>
        ) : (
          "Isi minimal 3 parameter untuk menghitung NEWS2."
        )}
      </div>
    </Dialog>
  )
}
