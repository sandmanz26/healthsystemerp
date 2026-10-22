/**
 * Barcode medication administration (BCMA). The nurse scans the patient's wristband, then the
 * unit-dose barcode (NDC in the US, GTIN in the UK); the system confirms the rights of
 * medication administration before the dose can be charted. High-alert drugs need an
 * independent double check by a second nurse (ISMP). A scan can be overridden — with a
 * reason — and overrides are reported as BCMA non-compliance (Leapfrog / CQC audit).
 */
import { Button, Checkbox, Chip, Label, Switch } from "@heroui/react"
import { CheckCircle2, CircleAlert, ScanBarcode } from "lucide-react"
import { useState } from "react"
import { Barcode } from "@/components/clinical/barcode"
import { Dialog } from "@/components/ui/dialog"
import { SelectInput, TextAreaInput, TextInput } from "@/components/ui/fields"
import type { MarEntry, MarStatus } from "@/domain/types"
import { cn } from "@/lib/cn"
import { formatTime } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useActions, useStore } from "@/store"
import { useRegion, useSession, useStaffMap } from "@/store/selectors"

const norm = (v: string) => v.replace(/\s|-/g, "").toUpperCase()

const OVERRIDE_REASONS = ["Wristband unreadable / damaged", "Medication barcode missing or damaged", "Scanner unavailable / downtime", "Emergency administration", "Item not in system (pharmacy notified)"]

/** Administration window: ±60 min of the scheduled time (CMS / ISMP timely administration). */
const WINDOW_MIN = 60

export function BcmaDialog({ entry, onClose }: { entry: MarEntry; onClose: () => void }) {
  const { recordMar } = useActions()
  const region = useRegion()
  const enc = useStore((s) => s.encounters.find((e) => e.id === entry.encounterId))
  const patient = useStore((s) => s.patients.find((p) => p.id === enc?.patientId))
  const item = useStore((s) => s.inventory.find((i) => i.id === entry.itemId))
  const staff = useStaffMap()
  const { user } = useSession()
  const [band, setBand] = useState("")
  const [dose, setDose] = useState("")
  const [override, setOverride] = useState(false)
  const [overrideReason, setOverrideReason] = useState<string | null>(null)
  const [confirmDose, setConfirmDose] = useState(false)
  const [confirmRoute, setConfirmRoute] = useState(false)
  const [witness, setWitness] = useState<string | null>(null)
  const [note, setNote] = useState("")

  const bandOk = !!patient && norm(band) === norm(patient.mrn)
  const bandWrong = band.trim().length >= 4 && !bandOk
  const doseOk = !!item?.barcode && norm(dose) === norm(item.barcode)
  const doseWrong = dose.trim().length >= 4 && !doseOk
  const offset = Math.round((Date.now() - new Date(entry.scheduledAt).getTime()) / 60000)
  const timeOk = Math.abs(offset) <= WINDOW_MIN
  const nurses = [...staff.values()].filter((s) => s.role === "nurse" && s.id !== user?.id)
  const needsWitness = !!item?.highAlert

  const scanned = bandOk && doseOk
  const identified = scanned || (override && !!overrideReason)
  const canConfirm = identified && confirmDose && confirmRoute && (!needsWitness || !!witness)

  const rights = [
    { label: "Right patient", ok: override ? null : bandOk, detail: patient ? `${patient.name} · MRN ${patient.mrn}` : "" },
    { label: "Right drug", ok: override ? null : doseOk, detail: item?.name ?? "" },
    { label: "Right dose", ok: confirmDose, detail: entry.dose },
    { label: "Right route", ok: confirmRoute, detail: entry.route },
    { label: "Right time", ok: timeOk, detail: `Scheduled ${formatTime(entry.scheduledAt)} · ${offset >= 0 ? `${offset} min ago` : `in ${-offset} min`}` },
  ]

  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      isDismissable={false}
      size="lg"
      title="Administer medication (BCMA)"
      description={`${item?.name ?? entry.itemId} · ${entry.dose} · ${entry.route} · due ${formatTime(entry.scheduledAt)}`}
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={!canConfirm}
            onPress={() => {
              const parts = [override && overrideReason ? `Scan override: ${overrideReason}` : "", !timeOk ? `Outside ±${WINDOW_MIN} min window` : "", note.trim()]
              recordMar(entry.id, "given", parts.filter(Boolean).join(" · ") || undefined, { scanned, witnessId: witness ?? undefined })
              toast.success("Administration documented", { description: scanned ? "Wristband and dose barcode verified" : "Scan override recorded — counted against BCMA compliance" })
              onClose()
            }}
          >
            Confirm administration
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {item?.highAlert && (
          <Chip size="sm" color="danger" variant="primary">
            ISMP high-alert — independent double check
          </Chip>
        )}
        {item?.controlled && (
          <Chip size="sm" color="warning" variant="soft" className="num">
            {region === "us" ? `DEA C-${item.controlled}` : `CD${item.controlled} — CD register & witness`}
          </Chip>
        )}
        {patient && patient.allergies.length > 0 && (
          <Chip size="sm" color="danger" variant="soft">
            Allergies: {patient.allergies.map((a) => a.substance).join(", ")}
          </Chip>
        )}
      </div>

      <Switch isSelected={override} onChange={setOverride}>
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <span className="text-sm">Override scan</span>
        </Switch.Content>
      </Switch>

      {!override ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={cn("space-y-2 rounded-xl border p-3", bandOk ? "border-success" : bandWrong ? "border-danger" : "border-border")}>
            <div className="label-caps flex items-center gap-1.5 text-muted">
              <ScanBarcode className="size-3.5" aria-hidden /> Step 1 · Scan wristband
            </div>
            <TextInput label="Patient wristband" value={band} onChange={setBand} autoFocus placeholder="Scan or type MRN" error={bandWrong ? "Wrong patient — wristband does not match this order" : undefined} />
            {patient && (
              <div className="rounded-lg bg-surface-secondary p-2">
                <Barcode value={patient.mrn} height={28} />
                <div className="num mt-1 text-[11px] text-muted">MRN {patient.mrn}</div>
              </div>
            )}
            {bandOk && (
              <p className="flex items-center gap-1 text-xs font-semibold text-success">
                <CheckCircle2 className="size-3.5" aria-hidden /> Patient verified
              </p>
            )}
          </div>
          <div className={cn("space-y-2 rounded-xl border p-3", doseOk ? "border-success" : doseWrong ? "border-danger" : "border-border", !bandOk && "opacity-60")}>
            <div className="label-caps flex items-center gap-1.5 text-muted">
              <ScanBarcode className="size-3.5" aria-hidden /> Step 2 · Scan dose
            </div>
            <TextInput label={region === "us" ? "Unit-dose barcode (NDC)" : "Pack barcode (GTIN)"} value={dose} onChange={setDose} isDisabled={!bandOk} placeholder="Scan medication" error={doseWrong ? "Wrong medication — barcode does not match the order" : undefined} />
            {item?.barcode ? (
              <div className="rounded-lg bg-surface-secondary p-2">
                <Barcode value={item.barcode} height={28} />
                <div className="num mt-1 text-[11px] text-muted">{item.barcode}</div>
              </div>
            ) : (
              <p className="text-xs text-warning">No barcode on file — use override.</p>
            )}
            {doseOk && (
              <p className="flex items-center gap-1 text-xs font-semibold text-success">
                <CheckCircle2 className="size-3.5" aria-hidden /> Medication verified
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-warning p-3">
          <p className="text-xs text-warning-soft-foreground">Overrides are logged with your name and reported in the BCMA compliance audit. Verify identity with two identifiers (name + date of birth) before giving.</p>
          <SelectInput label="Override reason" value={overrideReason} onChange={setOverrideReason} options={OVERRIDE_REASONS.map((r) => ({ value: r, label: r }))} isRequired placeholder="Select a reason" />
        </div>
      )}

      <fieldset className="space-y-1.5 rounded-xl bg-surface-secondary p-3">
        <legend className="label-caps mb-1 text-muted">Rights of medication administration</legend>
        {rights.map((r) => (
          <div key={r.label} className="flex items-center gap-2 text-sm">
            {r.ok === true ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : r.ok === false ? <CircleAlert className="size-4 text-warning" aria-hidden /> : <CircleAlert className="size-4 text-muted" aria-hidden />}
            <span className="w-28 font-medium">{r.label}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted">{r.ok === null ? "Not scanned (override)" : r.detail}</span>
          </div>
        ))}
        <div className="flex flex-wrap gap-4 pt-1">
          <Checkbox isSelected={confirmDose} onChange={setConfirmDose}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Label className="text-sm">Dose checked ({entry.dose})</Label>
            </Checkbox.Content>
          </Checkbox>
          <Checkbox isSelected={confirmRoute} onChange={setConfirmRoute}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Label className="text-sm">Route checked ({entry.route})</Label>
            </Checkbox.Content>
          </Checkbox>
        </div>
        {!timeOk && <p className="text-xs text-warning">Outside the ±{WINDOW_MIN}-minute administration window — the variance will be documented.</p>}
      </fieldset>

      {needsWitness && <SelectInput label="Second nurse (independent double check)" value={witness} onChange={setWitness} options={nurses.map((n) => ({ value: n.id, label: n.name, description: n.title }))} isRequired placeholder="Select witness" />}
      <TextAreaInput label="Note" value={note} onChange={setNote} rows={2} placeholder="Optional — site, pain reassessment, etc." />
    </Dialog>
  )
}

/** Not given: held (clinical reason) or refused by the patient. */
export function HoldDialog({ entry, onClose }: { entry: MarEntry; onClose: () => void }) {
  const { recordMar } = useActions()
  const item = useStore((s) => s.inventory.find((i) => i.id === entry.itemId))
  const [status, setStatus] = useState<MarStatus>("held")
  const [note, setNote] = useState("")
  return (
    <Dialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title="Dose not given"
      description={`${item?.name} · ${entry.dose} · ${entry.route} · due ${formatTime(entry.scheduledAt)}`}
      footer={
        <>
          <Button variant="tertiary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger-soft"
            isDisabled={!note.trim()}
            onPress={() => {
              recordMar(entry.id, status, note.trim())
              toast.success(status === "held" ? "Dose held" : "Refusal documented")
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <SelectInput
        label="Reason"
        value={status}
        onChange={setStatus}
        options={[
          { value: "held", label: "Held — clinical reason (e.g. NPO, low BP, low HR)" },
          { value: "refused", label: "Refused by patient" },
        ]}
      />
      <TextAreaInput label="Note" value={note} onChange={setNote} rows={2} isRequired placeholder="e.g. SBP 88 — prescriber notified" />
    </Dialog>
  )
}
