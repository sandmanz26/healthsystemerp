import { Card } from "@heroui/react"
import type { ReactNode } from "react"
import { cn } from "@/lib/cn"

interface PanelProps {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** Remove body padding — for tables and lists that run edge to edge. */
  flush?: boolean
}

/** Paper card with an optional header row. The workhorse container of the app. */
export function Panel({ title, description, actions, children, className, flush }: PanelProps) {
  return (
    <Card className={cn("gap-0 overflow-hidden p-0", className)}>
      {(title || actions) && (
        <Card.Header className="flex flex-row items-start justify-between gap-3 border-b border-separator px-5 py-3.5">
          <div className="min-w-0">
            {title && <Card.Title className="font-display text-[15px] font-semibold leading-6">{title}</Card.Title>}
            {description && <Card.Description className="text-xs">{description}</Card.Description>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </Card.Header>
      )}
      <Card.Content className={cn(!flush && "p-5")}>{children}</Card.Content>
    </Card>
  )
}
