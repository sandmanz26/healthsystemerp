import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@v2/lib/cn"

export type Tone = "default" | "accent" | "success" | "warning" | "danger"

const VALUE: Record<Tone, string> = {
  default: "",
  accent: "",
  success: "",
  warning: "text-warning",
  danger: "text-danger",
}

interface StatProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  /** Kept for call-site compatibility; KPIs show no icon. */
  icon?: LucideIcon
  tone?: Tone
  onClick?: () => void
}

/**
 * A KPI: label, figure, one line of context. Inside a `.stat-strip` the KPIs share one
 * container divided by hairlines; only a reading that needs action takes a status colour.
 */
export function Stat({ label, value, hint, tone = "default", onClick }: StatProps) {
  // A zero needs no action, so it never takes a status colour.
  const shown = value === 0 ? "default" : tone
  const body = (
    <div className={cn("stat h-full px-5 py-4", onClick && "transition-colors hover:bg-surface-secondary")}>
      <div className="text-[13px] text-muted">{label}</div>
      <div className={cn("num mt-1.5 text-[28px] font-semibold leading-none tracking-tight", VALUE[shown])}>{value}</div>
      {hint && <div className="mt-2 text-[13px] text-muted">{hint}</div>}
    </div>
  )
  if (!onClick) return body
  return (
    <button type="button" onClick={onClick} className="block h-full w-full text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus">
      {body}
    </button>
  )
}
