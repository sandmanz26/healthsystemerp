/**
 * Electronic prescribing with live review: allergy cross-reactivity, interactions,
 * duplicate therapy, high-alert drugs and Fornas status are checked while typing, the same
 * rules the pharmacist sees — fewer calls back from the pharmacy.
 */
import { Button, Chip } from "@heroui/react"
import { AlertOctagon, AlertTriangle, Info, Plus, Trash2 } from "lucide-react"
import { useMemo } from "react"
import { RxStatusChip } from "@/components/status"
import { SelectInput, TextInput } from "@/components/ui/fields"
import { Panel } from "@/components/ui/panel"
import { FREQUENCIES, ROUTES_OF_ADMIN } from "@/domain/catalog"
import { reviewPrescription, type DrugAlert } from "@/domain/clinical"
import type { Encounter, Patient, PrescriptionItem } from "@/domain/types"
import { cn } from "@/lib/cn"
import { formatDateTime, formatRupiah } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useDraft } from "@/lib/use-draft"
import { useActions, useStore } from "@/store"
import { stockOf, useInventoryMap } from "@/store/selectors"

const PER_DAY: Record<string, number> = { "1x1": 1, "2x1": 2, "3x1": 3, "4x1": 4, "Tiap 8 jam": 3, "Tiap 12 jam": 2, "Jika perlu": 1 }

type Line = Omit<PrescriptionItem, "qty"> & { qty: string }
const newLine = (): Line => ({ itemId: "", dose: "", frequency: "3x1", route: "Oral", days: 3, qty: "" })

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
  const [lines, setLines, clear] = useDraft<Line[]>(`rx:${encounter.id}`, [newLine()])
  const drugs = inventory.filter((i) => i.category === "obat")
  const existing = useMemo(() => allRx.filter((r) => r.encounterId === encounter.id).sort((a, b) => b.prescribedAt.localeCompare(a.prescribedAt)), [allRx, encounter.id])

  const chosen = lines.filter((l) => l.itemId).map((l) => items.get(l.itemId)!).filter(Boolean)
  const alerts = reviewPrescription(patient, chosen)
  const blocking = alerts.some((a) => a.level === "danger")

  const update = (i: number, patch: Partial<Line>) =>
    setLines((ls) =>
      ls.map((l, idx) => {
        if (idx !== i) return l
        const next = { ...l, ...patch }
        // Quantity follows dose frequency × days unless the prescriber typed one.
        if (("frequency" in patch || "days" in patch || "itemId" in patch) && !("qty" in patch)) next.qty = String((PER_DAY[next.frequency] ?? 1) * next.days)
        return next
      }),
    )

  const valid = lines.length > 0 && lines.every((l) => l.itemId && l.dose.trim() && Number(l.qty) > 0)
  const total = lines.reduce((s, l) => s + (items.get(l.itemId)?.price ?? 0) * (Number(l.qty) || 0), 0)

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Panel title="Resep elektronik" description="Telaah otomatis berjalan saat Anda mengetik.">
          <div className="space-y-3">
            {lines.map((l, i) => {
              const item = items.get(l.itemId)
              const stock = item ? stockOf(item) : 0
              return (
                <div key={i} className="grid gap-2 rounded-xl bg-surface-secondary p-3 md:grid-cols-[minmax(200px,2fr)_1fr_1fr_1fr_80px_80px_auto]">
                  <SelectInput
                    label="Obat"
                    value={l.itemId || null}
                    onChange={(v) => update(i, { itemId: v, dose: items.get(v)?.strength ?? "" })}
                    options={drugs.map((d) => ({ value: d.id, label: d.name, description: `${d.form ?? ""} · stok ${stockOf(d)}${d.highAlert ? " · HIGH ALERT" : ""}${d.fornas ? "" : " · non-Fornas"}` }))}
                    description={item ? `Stok ${stock} ${item.unit}` : undefined}
                  />
                  <TextInput label="Dosis" value={l.dose} onChange={(v) => update(i, { dose: v })} />
                  <SelectInput label="Frekuensi" value={l.frequency} onChange={(v) => update(i, { frequency: v })} options={FREQUENCIES.map((f) => ({ value: f, label: f }))} />
                  <SelectInput label="Rute" value={l.route} onChange={(v) => update(i, { route: v })} options={ROUTES_OF_ADMIN.map((r) => ({ value: r, label: r }))} />
                  <TextInput label="Hari" value={String(l.days)} onChange={(v) => update(i, { days: Math.max(1, Number(v.replace(/\D/g, "")) || 1) })} inputMode="numeric" />
                  <TextInput label="Jumlah" value={l.qty} onChange={(v) => update(i, { qty: v.replace(/\D/g, "") })} inputMode="numeric" error={item && Number(l.qty) > stock ? "Stok kurang" : undefined} />
                  <div className="flex items-end">
                    <Button isIconOnly variant="ghost" aria-label="Hapus baris" onPress={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : [newLine()]))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
            <Button size="sm" variant="ghost" onPress={() => setLines((ls) => [...ls, newLine()])}>
              <Plus className="size-4" aria-hidden /> Tambah obat
            </Button>
            <AlertList alerts={alerts} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="tabular text-sm text-muted">Perkiraan biaya {formatRupiah(total)}</span>
              <Button
                variant="primary"
                isDisabled={!valid || blocking}
                onPress={() => {
                  prescribe(encounter.id, lines.map((l) => ({ ...l, qty: Number(l.qty) })))
                  clear()
                  toast.success("Resep terkirim ke farmasi")
                }}
              >
                {blocking ? "Ada alergi — ganti obat" : "Kirim ke farmasi"}
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {existing.map((rx) => (
        <Panel key={rx.id} title={`Resep ${formatDateTime(rx.prescribedAt)}`} actions={<RxStatusChip status={rx.status} />}>
          <ul className="space-y-1 text-sm">
            {rx.items.map((l) => {
              const item = items.get(l.itemId)
              return (
                <li key={l.itemId} className="flex flex-wrap items-center gap-2">
                  <b>{item?.name}</b>
                  <span className="text-muted">
                    {l.dose} · {l.frequency} · {l.route} · {l.days} hari · {l.qty} {item?.unit}
                  </span>
                  {item?.highAlert && (
                    <Chip size="sm" color="danger" variant="soft">
                      High alert
                    </Chip>
                  )}
                </li>
              )
            })}
          </ul>
          {rx.reviewNote && <p className="mt-2 text-xs text-muted">Catatan apoteker: {rx.reviewNote}</p>}
        </Panel>
      ))}
    </div>
  )
}
