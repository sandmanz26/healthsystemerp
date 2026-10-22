/**
 * Medication ordering (CPOE / ePMA) with live clinical decision support: allergy
 * cross-reactivity, interactions, therapeutic duplication, ISMP high-alert drugs, controlled
 * substances and formulary status are checked while typing — the same rules the pharmacist
 * verifies against, so fewer call-backs from pharmacy.
 */
import { Button, Chip } from "@heroui/react"
import { AlertOctagon, AlertTriangle, Info, Plus, Trash2 } from "lucide-react"
import { useMemo } from "react"
import { RxStatusChip } from "@/components/status"
import { SelectInput, TextInput } from "@/components/ui/fields"
import { Panel } from "@/components/ui/panel"
import { FREQUENCIES, ROUTES_OF_ADMIN, frequencyLabel } from "@/domain/catalog"
import { reviewPrescription, type DrugAlert } from "@/domain/clinical"
import type { Encounter, InventoryItem, Patient, PrescriptionItem } from "@/domain/types"
import { cn } from "@/lib/cn"
import { formatDateTime, formatMoney } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useDraft } from "@/lib/use-draft"
import { useActions, useStore } from "@/store"
import { stockOf, useInventoryMap, useRegion } from "@/store/selectors"
import type { Region } from "@/domain/region"

/** Doses per day for the quantity calculation (PRN / once count as one). */
const perDay = (id: string) => Math.max(1, FREQUENCIES.find((f) => f.id === id)?.hours.length ?? 1)

type Line = Omit<PrescriptionItem, "qty"> & { qty: string }
const newLine = (): Line => ({ itemId: "", dose: "", frequency: "tid", route: "PO", days: 3, qty: "" })

/** Safety badges for a drug: ISMP high-alert, DEA / Misuse of Drugs schedule, formulary. */
export function DrugBadges({ item, region }: { item: InventoryItem; region: Region }) {
  return (
    <>
      {item.highAlert && (
        <Chip size="sm" color="danger" variant="soft">
          High alert
        </Chip>
      )}
      {item.controlled && (
        <Chip size="sm" color="warning" variant="soft" className="num">
          {region === "us" ? `DEA C-${item.controlled}` : `CD${item.controlled}`}
        </Chip>
      )}
      {item.formulary === false && (
        <Chip size="sm" variant="soft">
          Non-formulary
        </Chip>
      )}
    </>
  )
}

function drugMeta(d: InventoryItem, region: Region): string {
  return [
    d.strength,
    d.form,
    `on hand ${stockOf(d)}`,
    d.highAlert && "HIGH ALERT",
    d.controlled && (region === "us" ? `DEA C-${d.controlled}` : `CD${d.controlled}`),
    d.formulary === false && "non-formulary",
  ]
    .filter(Boolean)
    .join(" · ")
}

export function AlertList({ alerts }: { alerts: DrugAlert[] }) {
  if (!alerts.length) return null
  return (
    <ul className="space-y-1.5" aria-live="polite">
      {alerts.map((a, i) => {
        const Icon = a.level === "danger" ? AlertOctagon : a.level === "warning" ? AlertTriangle : Info
        return (
          <li key={i} className={cn("flex gap-2 rounded-lg px-3 py-2 text-sm", a.level === "danger" ? "bg-danger-soft text-danger-soft-foreground" : a.level === "warning" ? "bg-warning-soft text-warning-soft-foreground" : "bg-accent-soft text-accent-soft-foreground")}>
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {a.message}
          </li>
        )
      })}
    </ul>
  )
}

export function PrescriptionSection({ encounter, patient, readOnly }: { encounter: Encounter; patient: Patient; readOnly: boolean }) {
  const inventory = useStore((s) => s.inventory)
  const allRx = useStore((s) => s.prescriptions)
  const items = useInventoryMap()
  const { prescribe } = useActions()
  const region = useRegion()
  const [lines, setLines, clear] = useDraft<Line[]>(`rx:${encounter.id}`, [newLine()])
  const drugs = useMemo(() => inventory.filter((i) => i.category === "drug"), [inventory])
  const existing = useMemo(() => allRx.filter((r) => r.encounterId === encounter.id).sort((a, b) => b.prescribedAt.localeCompare(a.prescribedAt)), [allRx, encounter.id])

  const chosen = lines.filter((l) => l.itemId).map((l) => items.get(l.itemId)!).filter(Boolean)
  const alerts = reviewPrescription(patient, chosen, region)
  const blocking = alerts.some((a) => a.level === "danger")

  const update = (i: number, patch: Partial<Line>) =>
    setLines((ls) =>
      ls.map((l, idx) => {
        if (idx !== i) return l
        const next = { ...l, ...patch }
        // Quantity follows dose frequency × days unless the prescriber typed one.
        if (("frequency" in patch || "days" in patch || "itemId" in patch) && !("qty" in patch)) next.qty = String(perDay(next.frequency) * next.days)
        return next
      }),
    )

  const valid = lines.length > 0 && lines.every((l) => l.itemId && l.dose.trim() && Number(l.qty) > 0)
  const total = lines.reduce((s, l) => s + (items.get(l.itemId)?.price ?? 0) * (Number(l.qty) || 0), 0)

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Panel title={region === "us" ? "New medication order" : "Prescribe (ePMA)"} description="Allergy, interaction and formulary checks run as you type.">
          <div className="space-y-3">
            {lines.map((l, i) => {
              const item = items.get(l.itemId)
              const stock = item ? stockOf(item) : 0
              return (
                <div key={i} className="grid gap-2 rounded-xl bg-surface-secondary p-3 md:grid-cols-[minmax(200px,2fr)_1fr_1fr_1fr_80px_80px_auto]">
                  <SelectInput
                    label="Medication"
                    placeholder="Search formulary…"
                    value={l.itemId || null}
                    onChange={(v) => update(i, { itemId: v, dose: items.get(v)?.strength ?? "" })}
                    options={drugs.map((d) => ({ value: d.id, label: d.name, description: drugMeta(d, region) }))}
                    description={item ? `${stock} ${item.unit} on hand${item.atc ? ` · ATC ${item.atc}` : ""}` : undefined}
                  />
                  <TextInput label="Dose" value={l.dose} onChange={(v) => update(i, { dose: v })} />
                  <SelectInput label="Frequency" value={l.frequency} onChange={(v) => update(i, { frequency: v })} options={FREQUENCIES.map((f) => ({ value: f.id, label: frequencyLabel(f.id, region) }))} />
                  <SelectInput label="Route" value={l.route} onChange={(v) => update(i, { route: v })} options={ROUTES_OF_ADMIN.map((r) => ({ value: r, label: r }))} />
                  <TextInput label="Days" value={String(l.days)} onChange={(v) => update(i, { days: Math.max(1, Number(v.replace(/\D/g, "")) || 1) })} inputMode="numeric" />
                  <TextInput label="Qty" value={l.qty} onChange={(v) => update(i, { qty: v.replace(/\D/g, "") })} inputMode="numeric" error={item && Number(l.qty) > stock ? "Insufficient stock" : undefined} />
                  <div className="flex items-end">
                    <Button isIconOnly variant="ghost" aria-label="Remove line" onPress={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : [newLine()]))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  {item && (item.highAlert || item.controlled || item.formulary === false) && (
                    <div className="flex flex-wrap gap-1.5 md:col-span-7">
                      <DrugBadges item={item} region={region} />
                    </div>
                  )}
                </div>
              )
            })}
            <Button size="sm" variant="ghost" onPress={() => setLines((ls) => [...ls, newLine()])}>
              <Plus className="size-4" aria-hidden /> Add medication
            </Button>
            <AlertList alerts={alerts} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="tabular text-sm text-muted">Estimated cost {formatMoney(total)}</span>
              <Button
                variant="primary"
                isDisabled={!valid || blocking}
                onPress={() => {
                  prescribe(encounter.id, lines.map((l) => ({ ...l, qty: Number(l.qty) })))
                  clear()
                  toast.success(region === "us" ? "Order sent to pharmacy for verification" : "Prescription sent to pharmacy for screening")
                }}
              >
                {blocking ? "Allergy conflict — choose another drug" : "Sign & send to pharmacy"}
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {existing.map((rx) => (
        <Panel key={rx.id} title={`${region === "us" ? "Medication order" : "Prescription"} · ${formatDateTime(rx.prescribedAt)}`} actions={<RxStatusChip status={rx.status} />}>
          <ul className="space-y-1 text-sm">
            {rx.items.map((l) => {
              const item = items.get(l.itemId)
              return (
                <li key={l.itemId} className="flex flex-wrap items-center gap-2">
                  <b>{item?.name}</b>
                  <span className="text-muted">
                    {l.dose} · {frequencyLabel(l.frequency, region)} · {l.route} · {l.days} day(s) · {l.qty} {item?.unit}
                  </span>
                  {item && <DrugBadges item={item} region={region} />}
                </li>
              )
            })}
          </ul>
          {rx.reviewNote && <p className="mt-2 text-xs text-muted">Pharmacist note: {rx.reviewNote}</p>}
        </Panel>
      ))}
    </div>
  )
}
