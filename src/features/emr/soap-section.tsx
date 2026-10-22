/**
 * Clinical notes in SOAP form (FHIR DocumentReference). Drafts autosave per encounter; notes
 * written by nurses, residents or APPs show a co-signature action for the attending /
 * responsible consultant.
 */
import { Button, Chip } from "@heroui/react"
import { BadgeCheck, FileText } from "lucide-react"
import { useState } from "react"
import { TextAreaInput, SelectInput } from "@/components/ui/fields"
import { Panel } from "@/components/ui/panel"
import { ROLES } from "@/domain/roles"
import { SOAP_TEMPLATES } from "@/domain/templates"
import type { Encounter, NoteType } from "@/domain/types"
import { formatDateTime } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useDraft } from "@/lib/use-draft"
import { useActions } from "@/store"
import { useRegion, useSession, useStaffMap } from "@/store/selectors"

const EMPTY = { subjective: "", objective: "", assessment: "", plan: "" }

const NOTE_TYPE: Record<NoteType, string> = {
  "h&p": "History & physical",
  progress: "Progress note",
  nursing: "Nursing note",
  ed: "ED provider note",
  consult: "Consult note",
}

export function SoapSection({ encounter, readOnly }: { encounter: Encounter; readOnly: boolean }) {
  const { addNote, verifyNote } = useActions()
  const { role } = useSession()
  const staff = useStaffMap()
  const region = useRegion()
  const signer = region === "us" ? "attending" : "consultant"
  const [type, setType] = useState<NoteType>(role === "nurse" ? "nursing" : encounter.kind === "emergency" ? "ed" : encounter.notes.length === 0 && encounter.kind === "inpatient" ? "h&p" : "progress")
  const [draft, setDraft, clearDraft] = useDraft(`soap:${encounter.id}`, EMPTY)
  const hasDraft = Object.values(draft).some((v) => v.trim())
  const set = (k: keyof typeof EMPTY) => (v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const notes = [...encounter.notes].sort((a, b) => b.at.localeCompare(a.at))

  const save = () => {
    addNote(encounter.id, { ...draft, type })
    clearDraft()
    toast.success(`${NOTE_TYPE[type]} signed`)
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Panel
          title="New note"
          description={hasDraft ? "Draft autosaved on this device" : "SOAP format"}
          actions={
            <>
            <SelectInput label="Note type" className="w-48" value={type} onChange={setType} options={(Object.keys(NOTE_TYPE) as NoteType[]).map((t) => ({ value: t, label: NOTE_TYPE[t] }))} />
            <SelectInput
              label="Template"
              className="w-52"
              value={null}
              placeholder="Insert template…"
              onChange={(id) => {
                const t = SOAP_TEMPLATES.find((x) => x.id === id)!
                setDraft({ subjective: t.subjective, objective: t.objective, assessment: t.assessment, plan: t.plan })
              }}
              options={SOAP_TEMPLATES.map((t) => ({ value: t.id, label: t.name }))}
            />
            </>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <TextAreaInput label="S — Subjective" value={draft.subjective} onChange={set("subjective")} rows={4} placeholder="HPI, ROS, history" />
            <TextAreaInput label="O — Objective" value={draft.objective} onChange={set("objective")} rows={4} placeholder="Exam, vitals, labs, imaging" />
            <TextAreaInput label="A — Assessment" value={draft.assessment} onChange={set("assessment")} rows={3} placeholder="Working diagnosis / problem list" />
            <TextAreaInput label="P — Plan" value={draft.plan} onChange={set("plan")} rows={3} placeholder="Treatment, orders, education, disposition" />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            {hasDraft && (
              <Button variant="ghost" onPress={clearDraft}>
                Discard draft
              </Button>
            )}
            <Button variant="primary" onPress={save} isDisabled={!draft.subjective.trim() && !draft.assessment.trim()}>
              Sign note
            </Button>
          </div>
        </Panel>
      )}

      <Panel title={`Notes (${notes.length})`} flush>
        {notes.length === 0 ? (
          <div className="flex items-center gap-2 px-5 py-6 text-sm text-muted">
            <FileText className="size-4" aria-hidden /> No notes yet.
          </div>
        ) : (
          <ol className="divide-y divide-separator">
            {notes.map((n) => (
              <li key={n.id} className="px-5 py-4">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="font-semibold text-foreground">{staff.get(n.authorId)?.name ?? n.authorId}</span>
                  <Chip size="sm" variant="soft">
                    {ROLES[n.role].label}
                  </Chip>
                  {n.type && <span className="label-caps">{NOTE_TYPE[n.type]}</span>}
                  <span>{formatDateTime(n.at)}</span>
                  {n.role !== "doctor" &&
                    (n.verifiedBy ? (
                      <Chip size="sm" color="success" variant="soft">
                        <BadgeCheck className="size-3.5" aria-hidden /> Co-signed by {staff.get(n.verifiedBy)?.name}
                      </Chip>
                    ) : role === "doctor" && !readOnly ? (
                      <Button size="sm" variant="ghost" onPress={() => verifyNote(encounter.id, n.id)}>
                        Co-sign as {signer}
                      </Button>
                    ) : (
                      <Chip size="sm" color="warning" variant="soft">
                        Awaiting {signer} co-signature
                      </Chip>
                    ))}
                </div>
                <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                  {(["subjective", "objective", "assessment", "plan"] as const).map((k) =>
                    n[k] ? (
                      <div key={k} className="contents">
                        <dt className="font-semibold text-muted">{k[0].toUpperCase()}</dt>
                        <dd className="whitespace-pre-line">{n[k]}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  )
}
