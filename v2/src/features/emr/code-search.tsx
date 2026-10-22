/**
 * Type-ahead over a code system (ICD-10-CM, WHO ICD-10, CPT, OPCS-4). Matches a code prefix
 * or words in the display name, so both "I10" and "hypertension" work.
 */
import { SearchField } from "@heroui/react"
import { useMemo, useState } from "react"
import { cn } from "@v2/lib/cn"

export interface CodeOption {
  code: string
  display: string
  snomed?: string
}

interface CodeSearchProps<T extends CodeOption> {
  codes: T[]
  onPick: (code: T) => void
  exclude?: string[]
  label: string
  placeholder?: string
  /** Code system shown on each result, e.g. "ICD-10-CM". */
  system?: string
}

export function CodeSearch<T extends CodeOption>({ codes, onPick, exclude = [], label, placeholder, system }: CodeSearchProps<T>) {
  const [q, setQ] = useState("")
  const [active, setActive] = useState(0)
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return codes.filter((c) => !exclude.includes(c.code) && (c.code.toLowerCase().startsWith(s) || c.display.toLowerCase().includes(s))).slice(0, 8)
  }, [q, codes, exclude])

  const pick = (c: T) => {
    onPick(c)
    setQ("")
    setActive(0)
  }

  return (
    <div className="relative">
      <SearchField
        aria-label={label}
        value={q}
        onChange={(v) => {
          setQ(v)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, results.length - 1))
          if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0))
          if (e.key === "Enter" && results[active]) pick(results[active])
        }}
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder={placeholder} />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      {results.length > 0 && (
        <ul role="listbox" aria-label={label} className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-overlay shadow-lg">
          {results.map((c, i) => (
            <li key={c.code} role="option" aria-selected={i === active}>
              <button type="button" onMouseEnter={() => setActive(i)} onClick={() => pick(c)} className={cn("flex w-full gap-3 px-3 py-2 text-left text-sm", i === active && "bg-surface-secondary")}>
                <span className="tabular w-20 shrink-0 font-semibold">{c.code}</span>
                <span className="min-w-0 flex-1">
                  {c.display}
                  {(system || c.snomed) && (
                    <span className="num mt-0.5 block text-[11px] text-muted">
                      {system}
                      {system && c.snomed && " · "}
                      {c.snomed && `SNOMED CT ${c.snomed}`}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
