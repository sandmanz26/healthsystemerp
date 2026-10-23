import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Inbox } from "lucide-react"

interface EmptyProps {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
}

/** Empty state: what is missing, why, and the one thing to do about it. */
export function Empty({ icon: Icon = Inbox, title, description, action }: EmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-10 text-center">
      <Icon className="mb-1 size-5 text-muted" aria-hidden />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
