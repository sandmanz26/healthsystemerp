import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Inbox } from "lucide-react"

interface EmptyProps {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
}

export function Empty({ icon: Icon = Inbox, title, description, action }: EmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-default text-muted">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
