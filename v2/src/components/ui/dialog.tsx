import { Modal } from "@heroui/react"
import type { ReactNode } from "react"

interface DialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: "xs" | "sm" | "md" | "lg" | "full"
  /** Prevent closing by clicking outside — for forms with unsaved input. */
  isDismissable?: boolean
}

/** Controlled modal dialog. */
export function Dialog({ isOpen, onOpenChange, title, description, children, footer, size = "md", isDismissable = true }: DialogProps) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={isDismissable}>
      <Modal.Container size={size} scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header className="flex-col items-start gap-1">
            <Modal.Heading>{title}</Modal.Heading>
            {description && <p className="text-sm text-muted">{description}</p>}
          </Modal.Header>
          <Modal.Body className="space-y-4">{children}</Modal.Body>
          {footer && <Modal.Footer>{footer}</Modal.Footer>}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
