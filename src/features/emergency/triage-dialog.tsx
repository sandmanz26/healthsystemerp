/**
 * Triage (ATS 1–5) with vital signs. Level cards show the examples and response target so
 * new nurses triage consistently.
 */
import { Button } from "@heroui/react"
import { useState } from "react"
import { Dialog } from "@/components/ui/dialog"
import { SelectInput } from "@/components/ui/fields"
import { TRIAGE, news2 } from "@/domain/clinical"
import type { Encounter, TriageLevel, Vitals } from "@/domain/types"
import { VitalsFields } from "@/features/emr/vitals-dialog"
import { EMPTY_VITALS, toVitals } from "@/features/emr/vitals-form"
import { cn } from "@/lib/cn"
import { toast } from "@/lib/toast"
import { useActions } from "@/store"

const RING: Record<TriageLevel, string> = {
  1: "border-danger bg-danger-soft",
  2: "border-danger/60 bg-danger-soft/60",
  3: "border-warning bg-warning-soft",
  4: "border-success bg-success-soft",
  5: "border-border bg-surface-secondary",
}

export function TriageDialog({ encounter, patientName, onClose }: { encounter: Encounter; patientName: string; onClose: () => void }) {
  const { triage } = useActions()
  const [level, setLevel] = useState<TriageLevel | undefined>(encounter.triage)
  const [draft, setDraft] = useState(EMPTY_VITALS)
  const [consciousness, setConsciousness] = useState<NonNullable<Vitals["consciousness"]>>("A")
  const vitals = toVitals(draft, false, consciousness)
  const score = news2({ ...vitals, id: "", at: "", by: "" })
  const hasVitals = Object.values(draft).some((v) => v !== "")

  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      isDismissable={false}
      size="lg"
      title="Triase IGD"
      description={`${patientName} — keluhan: ${encounter.chiefComplaint}`}
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            isDisabled={!level}
            onPress={() => {
              triage(encounter.id, level!, hasVitals ? vitals : undefined)
              toast.success(`Triase level ${level} — ${TRIAGE[level!].label}`, { description: `Target tanggap ${TRIAGE[level!].targetMin === 0 ? "segera" : `≤ ${TRIAGE[level!].targetMin} menit`}` })
              onClose()
            }}
          >
            Simpan triase
          </Button>
        </>
      }
    >
      <div className="grid gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Level triase">
        {([1, 2, 3, 4, 5] as TriageLevel[]).map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={level === l}
            onClick={() => setLevel(l)}
            className={cn("rounded-xl border-2 p-3 text-left transition", RING[l], level === l ? "ring-2 ring-focus ring-offset-2" : "opacity-80 hover:opacity-100")}
          >
            <div className="text-2xl font-extrabold">{l}</div>
            <div className="text-sm font-semibold">{TRIAGE[l].label}</div>
            <div className="text-[11px] text-muted">{TRIAGE[l].targetMin === 0 ? "Segera" : `≤ ${TRIAGE[l].targetMin} mnt`}</div>
          </button>
        ))}
      </div>
      {level && <p className="text-sm text-muted">Contoh level {level}: {TRIAGE[level].examples}.</p>}
      <VitalsFields value={draft} onChange={setDraft} />
      <SelectInput
        label="Kesadaran (ACVPU)"
        value={consciousness}
        onChange={setConsciousness}
        options={[
          { value: "A", label: "A — Alert" },
          { value: "C", label: "C — Confusion baru" },
          { value: "V", label: "V — Respons suara" },
          { value: "P", label: "P — Respons nyeri" },
          { value: "U", label: "U — Tidak respons" },
        ]}
      />
      {score && (
        <p className={cn("rounded-lg px-3 py-2 text-sm", score.risk === "tinggi" ? "bg-danger-soft text-danger-soft-foreground" : score.risk === "sedang" ? "bg-warning-soft text-warning-soft-foreground" : "bg-surface-secondary")}>
          NEWS2 {score.score} (risiko {score.risk}).{level && level >= 4 && score.risk !== "rendah" ? " Pertimbangkan menaikkan level triase." : ""}
        </p>
      )}
    </Dialog>
  )
}
