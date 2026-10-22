import { useRef, type KeyboardEvent } from "react"
import { cn } from "@/lib/cn"

interface SegmentedProps<V extends string> {
  label: string
  value: V
  onChange: (value: V) => void
  options: { value: V; label: string; count?: number }[]
}

/**
 * Compact filter switcher for worklists. It filters one list rather than switching panels,
 * so it is a radio group (not tabs): one tab stop, arrow keys move the selection.
 */
export function Segmented<V extends string>({ label, value, onChange, options }: SegmentedProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
    const edge = e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : -1
    if (!step && edge < 0) return
    e.preventDefault()
    const next = edge >= 0 ? edge : (i + step + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label} className="flex max-w-full gap-1 overflow-x-auto border-b border-separator">
      {options.map((o, i) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "-mb-px flex min-h-9 items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors",
              "rounded-t-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
              active ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="tabular ml-1.5 rounded-full bg-default px-1.5 text-[11px] text-muted">{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
