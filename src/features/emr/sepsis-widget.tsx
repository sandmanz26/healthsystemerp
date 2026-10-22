/**
 * Sepsis screening and bundle tracker for the encounter rail.
 *
 * Before recognition it shows the latest screen (CMS SEP-1 severe sepsis criteria in the US,
 * NICE NG51 red flags in the UK). Once the pathway is started, time zero is fixed and every
 * bundle element counts down to its deadline — the same clock SEP-1 abstraction and the
 * Sepsis Six audit use.
 */
import { Button, Checkbox, Chip, Label, Switch } from "@heroui/react"
import { ShieldAlert } from "lucide-react"
import { useMemo, useState } from "react"
import { Panel } from "@/components/ui/panel"
import { sepsisBundle, sepsisScreen } from "@/domain/clinical"
import type { Encounter } from "@/domain/types"
import { cn } from "@/lib/cn"
import { formatDuration, formatTime } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useNow } from "@/lib/use-now"
import { useActions, useStore } from "@/store"
import { useRegion } from "@/store/selectors"

const CAPTION = { us: "CMS SEP-1 (3-h / 6-h bundles)", uk: "UK Sepsis Trust — Sepsis Six (NICE NG51)" }

export function SepsisWidget({ encounter, canAct }: { encounter: Encounter; canAct: boolean }) {
  const region = useRegion()
  const now = useNow(10_000)
  const { startSepsis, toggleBundleItem } = useActions()
  const allOrders = useStore((s) => s.orders)
  const [shock, setShock] = useState(false)

  // Latest WBC and lactate on this encounter feed the screen.
  const labs = useMemo(() => {
    const out: { wbc?: number; lactate?: number } = {}
    const resulted = allOrders.filter((o) => o.encounterId === encounter.id && o.kind === "lab" && o.results.length).sort((a, b) => (a.resultedAt ?? a.orderedAt).localeCompare(b.resultedAt ?? b.orderedAt))
    for (const o of resulted)
      for (const r of o.results) {
        const v = Number(r.value)
        if (Number.isNaN(v)) continue
        if (r.testCode === "WBC") out.wbc = v
        if (r.testCode === "LACT") out.lactate = v
      }
    return out
  }, [allOrders, encounter.id])

  const latest = useMemo(() => [...encounter.vitals].sort((a, b) => b.at.localeCompare(a.at))[0], [encounter.vitals])
  const screen = sepsisScreen(region, latest, labs)
  const bundle = sepsisBundle(region)
  const sepsis = encounter.sepsis

  if (!sepsis) {
    return (
      <Panel
        title={
          <span className="flex items-center gap-2">
            <ShieldAlert className={cn("size-4", screen.positive ? "text-danger" : "text-muted")} aria-hidden /> Sepsis screen
          </span>
        }
        actions={
          <Chip size="sm" variant={screen.positive ? "primary" : "soft"} color={screen.positive ? "danger" : "default"}>
            {screen.positive ? "Positive" : "Negative"}
          </Chip>
        }
      >
        <p className={cn("text-sm", screen.positive && "font-semibold text-danger")}>{screen.label}</p>
        {screen.criteria.length > 0 && (
          <ul className="mt-2 list-inside list-disc text-xs text-muted">
            {screen.criteria.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
        {screen.positive && canAct && (
          <div className="mt-3 space-y-2">
            {region === "us" && (
              <Switch isSelected={shock} onChange={setShock}>
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <span className="text-sm">Septic shock (hypotension or lactate ≥ 4)</span>
                </Switch.Content>
              </Switch>
            )}
            <Button
              variant="danger"
              fullWidth
              onPress={() => {
                startSepsis(encounter.id, region === "us" ? shock : true)
                toast.warning(region === "us" ? "SEP-1 clock started" : "Sepsis Six started — complete within 1 hour")
              }}
            >
              Start sepsis pathway
            </Button>
          </div>
        )}
        <p className="label-caps mt-3 text-muted">{CAPTION[region]}</p>
      </Panel>
    )
  }

  const t0 = new Date(sepsis.identifiedAt).getTime()
  const done = bundle.items.filter((i) => sepsis.done[i.id]).length

  return (
    <Panel
      className="ring-1 ring-danger"
      title={
        <span className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-danger" aria-hidden /> {bundle.name}
        </span>
      }
      description={`Time zero ${formatTime(sepsis.identifiedAt)} · ${formatDuration(Math.max(0, Math.round((now - t0) / 60000)))} elapsed${sepsis.septicShock ? " · septic shock" : ""}`}
      actions={
        <Chip size="sm" variant="soft" className="num">
          {done}/{bundle.items.length}
        </Chip>
      }
    >
      <ul className="space-y-2">
        {bundle.items.map((item) => {
          const doneAt = sepsis.done[item.id]
          const notApplicable = item.shockOnly && !sepsis.septicShock
          const remaining = Math.round((t0 + item.dueMin * 60000 - now) / 60000)
          const overdue = !doneAt && !notApplicable && remaining < 0
          return (
            <li key={item.id} className={cn("flex items-start justify-between gap-2 rounded-lg px-2 py-1.5", overdue && "bg-danger-soft", notApplicable && "opacity-50")}>
              <Checkbox isSelected={!!doneAt} isDisabled={!canAct || notApplicable} onChange={() => toggleBundleItem(encounter.id, item.id)}>
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Label className={cn("text-sm", overdue && "font-semibold text-danger-soft-foreground")}>{item.label}</Label>
                </Checkbox.Content>
              </Checkbox>
              <span className={cn("num shrink-0 text-xs", overdue ? "font-bold text-danger" : "text-muted")}>
                {doneAt ? `✓ ${formatTime(doneAt)}` : notApplicable ? "N/A" : overdue ? `${formatDuration(-remaining)} over` : `${formatDuration(remaining)} left`}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="label-caps mt-3 text-muted">{CAPTION[region]}</p>
    </Panel>
  )
}
