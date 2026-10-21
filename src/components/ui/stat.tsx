import { Card } from "@heroui/react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/cn"

export type Tone = "default" | "accent" | "success" | "warning" | "danger"

const TONE_ICON: Record<Tone, string> = {
  default: "bg-default text-default-foreground",
  accent: "bg-accent-soft text-accent-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  danger: "bg-danger-soft text-danger-soft-foreground",
}

interface StatProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: LucideIcon
  tone?: Tone
  onClick?: () => void
}

/** KPI tile. Clickable tiles act as shortcuts into the matching worklist. */
export function Stat({ label, value, hint, icon: Icon, tone = "default", onClick }: StatProps) {
  const body = (
    <Card className={cn("h-full gap-3 p-4", onClick && "transition hover:shadow-md")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        {Icon && (
          <span className={cn("grid size-8 place-items-center rounded-lg", TONE_ICON[tone])}>
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <div className="tabular text-2xl font-bold tracking-tight">{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </Card>
  )
  if (!onClick) return body
  return (
    <button type="button" onClick={onClick} className="block h-full w-full rounded-[calc(var(--radius)*1.5)] text-left focus-visible:outline-2 focus-visible:outline-focus">
      {body}
    </button>
  )
}
