import { Tabs } from "@heroui/react"

interface SegmentedProps<V extends string> {
  label: string
  value: V
  onChange: (value: V) => void
  options: { value: V; label: string; count?: number }[]
}

/** Compact filter switcher (Tabs without panels). Counts help triage worklists at a glance. */
export function Segmented<V extends string>({ label, value, onChange, options }: SegmentedProps<V>) {
  return (
    <div className="min-w-0 max-w-full">
      <Tabs selectedKey={value} onSelectionChange={(k) => onChange(String(k) as V)} variant="secondary">
        <Tabs.ListContainer>
          <Tabs.List aria-label={label} className="flex-wrap">
            {options.map((o) => (
              <Tabs.Tab key={o.value} id={o.value} className="whitespace-nowrap">
                {o.label}
                {o.count !== undefined && <span className="tabular ml-1.5 rounded-full bg-default px-1.5 text-xs text-muted">{o.count}</span>}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
    </div>
  )
}
