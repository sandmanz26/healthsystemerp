import { Drawer } from "@heroui/react"
import type { ReactNode } from "react"

interface SidePanelProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

/** Right-hand drawer for detail views that should keep the list visible behind them. */
export function SidePanel({ isOpen, onOpenChange, title, description, children, footer }: SidePanelProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right" className="w-full sm:max-w-xl">
        <Drawer.Dialog className="flex h-full flex-col">
          <Drawer.CloseTrigger />
          <Drawer.Header className="flex-col items-start gap-1">
            <Drawer.Heading>{title}</Drawer.Heading>
            {description && <div className="text-sm text-muted">{description}</div>}
          </Drawer.Header>
          <Drawer.Body className="flex-1 space-y-5 overflow-y-auto">{children}</Drawer.Body>
          {footer && <Drawer.Footer>{footer}</Drawer.Footer>}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  )
}
