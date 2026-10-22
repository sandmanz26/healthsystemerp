/**
 * Validated nursing risk assessments: Morse Fall Scale (Morse 1989) and Braden Scale for
 * pressure injury risk (Bergstrom 1987). Required on admission and at least daily by
 * Joint Commission NPSG / CQC fundamental standards; the score and protocol action update
 * as each item is answered.
 */
import { Button, Chip, ToggleButton } from "@heroui/react"
import { useState } from "react"
import { Dialog } from "@/components/ui/dialog"
import type { AssessmentKind, Encounter } from "@/domain/types"
import { cn } from "@/lib/cn"
import { formatRelative } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useActions } from "@/store"
import { LEVEL_LABEL, SCALE, latestAssessment, riskTone } from "./assessment-helpers"

/** Compact "Morse 45 · High" chip for the patient card. */
export function AssessmentChip({ encounter, kind }: { encounter: Encounter; kind: AssessmentKind }) {
  const a = latestAssessment(encounter, kind)
  const label = kind === "morse" ? "Morse" : "Braden"
  if (!a)
    return (
      <Chip size="sm" variant="soft" className="num whitespace-nowrap">
        {label} —
      </Chip>
    )
  const level = SCALE[kind].risk(a.score).level
  return (
    <Chip size="sm" variant="soft" color={riskTone(kind, a.score)} className="num whitespace-nowrap" title={`${LEVEL_LABEL[level]} · ${formatRelative(a.at)}`}>
      {label} {a.score}
    </Chip>
  )
}

export function AssessmentDialog({ encounter, kind, patientName, onClose }: { encounter: Encounter; kind: AssessmentKind; patientName: string; onClose: () => void }) {
  const { addAssessment } = useActions()
  const scale = SCALE[kind]
  const previous = latestAssessment(encounter, kind)
  const [answers, setAnswers] = useState<Record<string, number>>(() => previous?.answers ?? {})
  const complete = scale.items.every((i) => answers[i.id] !== undefined)
  const score = scale.items.reduce((s, i) => s + (answers[i.id] ?? 0), 0)
  const risk = scale.risk(score)
  const tone = riskTone(kind, score)

  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      isDismissable={false}
      size="lg"
      title={scale.name}
      description={patientName}
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={!complete}
            onPress={() => {
              addAssessment(encounter.id, kind, answers)
              toast.success(`${scale.name}: ${score}`, { description: risk.action })
              onClose()
            }}
          >
            Save assessment
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {scale.items.map((item) => (
          <div key={item.id}>
            <div className="mb-1 text-sm font-medium">{item.label}</div>
            <div className="flex flex-wrap gap-1.5">
              {item.options.map((o) => (
                <ToggleButton key={o.label} size="sm" isSelected={answers[item.id] === o.points && answers[item.id] !== undefined} onChange={() => setAnswers((a) => ({ ...a, [item.id]: o.points }))}>
                  {o.label}
                  <span className="num text-[11px] opacity-70">{o.points}</span>
                </ToggleButton>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div
        role="status"
        className={cn(
          "rounded-xl p-3 text-sm",
          !complete ? "bg-surface-secondary text-muted" : tone === "danger" ? "bg-danger-soft text-danger-soft-foreground" : tone === "warning" ? "bg-warning-soft text-warning-soft-foreground" : "bg-success-soft text-success-soft-foreground",
        )}
      >
        <b className="num">Score {score}</b>
        {complete ? ` — ${LEVEL_LABEL[risk.level]}. ${risk.action}.` : ` — answer all ${scale.items.length} items.`}
        <span className="label-caps mt-1 block opacity-70">Source: {scale.source}</span>
      </div>
    </Dialog>
  )
}
