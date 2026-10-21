/**
 * CPPT (integrated progress notes) in SOAP form. Drafts autosave per encounter; notes by
 * non-doctors show a "verify" action for the DPJP, as CPPT rules require.
 */
import { Button, Chip } from "@heroui/react"
import { BadgeCheck, FileText } from "lucide-react"
import { TextAreaInput, SelectInput } from "@/components/ui/fields"
import { Panel } from "@/components/ui/panel"
import { ROLES } from "@/domain/roles"
import { SOAP_TEMPLATES } from "@/domain/templates"
import type { Encounter } from "@/domain/types"
import { formatDateTime } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useDraft } from "@/lib/use-draft"
import { useActions } from "@/store"
import { useSession, useStaffMap } from "@/store/selectors"

const EMPTY = { subjective: "", objective: "", assessment: "", plan: "" }

export function SoapSection({ encounter, readOnly }: { encounter: Encounter; readOnly: boolean }) {
  const { addNote, verifyNote } = useActions()
  const { role } = useSession()
  const staff = useStaffMap()
  const [draft, setDraft, clearDraft] = useDraft(`soap:${encounter.id}`, EMPTY)
  const hasDraft = Object.values(draft).some((v) => v.trim())
  const set = (k: keyof typeof EMPTY) => (v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const notes = [...encounter.notes].sort((a, b) => b.at.localeCompare(a.at))

  const save = () => {
    addNote(encounter.id, draft)
    clearDraft()
    toast.success("CPPT tersimpan")
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Panel
          title="Tulis CPPT"
          description={hasDraft ? "Draf tersimpan otomatis di perangkat ini" : "Format SOAP"}
          actions={
            <SelectInput
              label="Template"
              className="w-52"
              value={null}
              placeholder="Pakai template…"
              onChange={(id) => {
                const t = SOAP_TEMPLATES.find((x) => x.id === id)!
                setDraft({ subjective: t.subjective, objective: t.objective, assessment: t.assessment, plan: t.plan })
              }}
              options={SOAP_TEMPLATES.map((t) => ({ value: t.id, label: t.name }))}
            />
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <TextAreaInput label="S — Subjektif" value={draft.subjective} onChange={set("subjective")} rows={4} placeholder="Keluhan, riwayat" />
            <TextAreaInput label="O — Objektif" value={draft.objective} onChange={set("objective")} rows={4} placeholder="Pemeriksaan fisik, penunjang" />
            <TextAreaInput label="A — Asesmen" value={draft.assessment} onChange={set("assessment")} rows={3} placeholder="Diagnosis kerja / masalah" />
            <TextAreaInput label="P — Plan" value={draft.plan} onChange={set("plan")} rows={3} placeholder="Terapi, edukasi, rencana" />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            {hasDraft && (
              <Button variant="ghost" onPress={clearDraft}>
                Kosongkan
              </Button>
            )}
            <Button variant="primary" onPress={save} isDisabled={!draft.subjective.trim() && !draft.assessment.trim()}>
              Simpan CPPT
            </Button>
          </div>
        </Panel>
      )}

      <Panel title={`Riwayat CPPT (${notes.length})`} flush>
        {notes.length === 0 ? (
          <div className="flex items-center gap-2 px-5 py-6 text-sm text-muted">
            <FileText className="size-4" aria-hidden /> Belum ada catatan.
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
                  <span>{formatDateTime(n.at)}</span>
                  {n.role !== "doctor" &&
                    (n.verifiedBy ? (
                      <Chip size="sm" color="success" variant="soft">
                        <BadgeCheck className="size-3.5" aria-hidden /> Diverifikasi {staff.get(n.verifiedBy)?.name}
                      </Chip>
                    ) : role === "doctor" && !readOnly ? (
                      <Button size="sm" variant="ghost" onPress={() => verifyNote(encounter.id, n.id)}>
                        Verifikasi DPJP
                      </Button>
                    ) : (
                      <Chip size="sm" color="warning" variant="soft">
                        Belum diverifikasi DPJP
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
