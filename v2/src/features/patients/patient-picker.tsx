/**
 * Find a patient by MRN, NHS number, member ID, date of birth or name. Keyboard first:
 * type, arrow, Enter. Front-desk staff search dozens of times an hour, so results appear as
 * you type.
 */
import { Avatar, Button, SearchField } from "@heroui/react"
import { UserPlus } from "lucide-react"
import { useMemo, useState } from "react"
import { PayerChip } from "@v2/components/status"
import { ageLabel } from "@v2/domain/clinical"
import { formatNhsNumber } from "@v2/domain/interop"
import type { Patient } from "@v2/domain/types"
import { cn } from "@v2/lib/cn"
import { formatDate, initials } from "@v2/lib/format"
import { matchPatient } from "@v2/domain/search"
import { useStore } from "@v2/store"
import { useRegion } from "@v2/store/selectors"

interface PatientPickerProps {
  onPick: (patient: Patient) => void
  onCreateNew?: (query: string) => void
  autoFocus?: boolean
  selectedId?: string
}

export function PatientPicker({ onPick, onCreateNew, autoFocus, selectedId }: PatientPickerProps) {
  const patients = useStore((s) => s.patients)
  const region = useRegion()
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const results = useMemo(() => (query.trim().length < 2 ? [] : patients.filter((p) => matchPatient(p, query)).slice(0, 8)), [patients, query])

  return (
    <div className="space-y-2">
      <SearchField
        aria-label="Search patients"
        value={query}
        onChange={(v) => {
          setQuery(v)
          setActive(0)
        }}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, results.length - 1))
          if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0))
          if (e.key === "Enter" && results[active]) onPick(results[active])
        }}
        className="w-full"
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder={region === "us" ? "Name, MRN, member ID or DOB (yyyy-mm-dd)" : "Name, hospital number, NHS number or DOB (yyyy-mm-dd)"} />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      {query.trim().length >= 2 && (
        <ul className="max-h-72 divide-y divide-separator overflow-y-auto rounded-lg border border-border" role="listbox" aria-label="Patient search results">
          {results.map((p, i) => (
            <li key={p.id} role="option" aria-selected={p.id === selectedId}>
              <button
                type="button"
                onClick={() => onPick(p)}
                onMouseEnter={() => setActive(i)}
                className={cn("flex w-full items-center gap-3 px-3 py-2 text-left", i === active && "bg-surface-secondary", p.id === selectedId && "bg-accent-soft")}
              >
                <Avatar size="sm" variant="soft" color={p.gender === "female" ? "danger" : "accent"}>
                  <Avatar.Fallback>{initials(p.name)}</Avatar.Fallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="num text-xs text-muted">
                    MRN {p.mrn} · DOB {formatDate(p.birthDate)} ({ageLabel(p.birthDate)}){p.nhsNumber && ` · NHS ${formatNhsNumber(p.nhsNumber)}`}
                  </div>
                </div>
                <PayerChip payer={p.payer} />
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted">No matching patient. Search again before creating a new record.</li>}
        </ul>
      )}

      {onCreateNew && (
        <Button variant="ghost" size="sm" onPress={() => onCreateNew(query)}>
          <UserPlus className="size-4" aria-hidden />
          New patient
        </Button>
      )}
    </div>
  )
}
