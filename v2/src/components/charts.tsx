/**
 * Chart primitives on top of Recharts, following the app's data-viz rules: thin marks,
 * recessive grid, one y-axis, hover tooltip on every chart, text in text colours (never the
 * series colour), categorical slots assigned in fixed order.
 */
import type { ReactNode } from "react"

interface TooltipPayload {
  name?: string
  value?: number | string
  color?: string
  dataKey?: string | number
}

/** Tooltip body shared by all charts. */
export function ChartTooltip({ active, payload, label, format = String }: { active?: boolean; payload?: TooltipPayload[]; label?: ReactNode; format?: (v: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-overlay px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <div className="mb-1 font-semibold text-foreground">{label}</div>}
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="text-muted">{p.name}</span>
          <span className="tabular ml-auto pl-3 font-semibold text-foreground">{typeof p.value === "number" ? format(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

/** Legend rendered in HTML (always present for ≥ 2 series). */
export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  )
}
