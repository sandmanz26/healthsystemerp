/** Labelled checkbox used by the registry and registration forms. */
import { Checkbox, Label } from "@heroui/react"
import type { ReactNode } from "react"

export function CheckField({ isSelected, onChange, children, description }: { isSelected: boolean; onChange: (v: boolean) => void; children: ReactNode; description?: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <Checkbox isSelected={isSelected} onChange={onChange}>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Label className="text-sm">{children}</Label>
        </Checkbox.Content>
      </Checkbox>
      {description && <p className="pl-7 text-xs text-muted">{description}</p>}
    </div>
  )
}
