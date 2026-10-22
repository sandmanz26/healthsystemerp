import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/cn"

export type Tone = "default" | "accent" | "success" | "warning" | "danger"

const RULE: Record<Tone, string> = {
  default: "bg-border",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
}

interface StatProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: LucideIcon
  tone?: Tone
  onClick?: () => void
}

/**
 * A readout: caps label, a large figure, and a tone rule on the left edge — like a reading
 * written on a whiteboard grid. Clickable readouts jump to the matching worklist.
 */
export function Stat({ label, value, hint, icon: Icon, tone = "default", onClick }: StatProps) {
  const body = (
    <div className={cn("relative h-full overflow-hidden rounded-[14px] border border-border bg-surface py-4 pl-5 pr-4", onClick && "transition hover:border-foreground/25")}>
      <span className={cn("absolute inset-y-3 left-0 w-1 rounded-r-full", RULE[tone])} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <span className="label-caps text-muted">{label}</span>
        {Icon && <Icon className="size-4 shrink-0 text-muted" aria-hidden />}
      </div>
      <div className={cn("num mt-2 text-[28px] font-semibold leading-none tracking-tight", tone === "danger" && "text-danger")}>{value}</div>
      {hint && <div className="mt-2 text-xs text-muted">{hint}</div>}
    </div>
  )
  if (!onClick) return body
  return (
    <button type="button" onClick={onClick} className="block h-full w-full rounded-[14px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
      {body}
    </button>
  )
}
