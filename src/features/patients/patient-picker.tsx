/**
 * Find a patient by No. RM, NIK, BPJS number or name. Keyboard first: type, arrow, Enter.
 * Front-desk staff search dozens of times an hour, so results appear as you type.
 */
import { Avatar, Button, SearchField } from "@heroui/react"
import { UserPlus } from "lucide-react"
import { useMemo, useState } from "react"
import { PayerChip } from "@/components/status"
import { ageLabel } from "@/domain/clinical"
import type { Patient } from "@/domain/types"
import { cn } from "@/lib/cn"
import { initials } from "@/lib/format"
import { matchPatient } from "@/domain/search"
import { useStore } from "@/store"

interface PatientPickerProps {
  onPick: (patient: Patient) => void
  onCreateNew?: (query: string) => void
  autoFocus?: boolean
  selectedId?: string
}

export function PatientPicker({ onPick, onCreateNew, autoFocus, selectedId }: PatientPickerProps) {
  const patients = useStore((s) => s.patients)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const results = useMemo(() => (query.trim().length < 2 ? [] : patients.filter((p) => matchPatient(p, query)).slice(0, 8)), [patients, query])

  return (
    <div className="space-y-2">
      <SearchField
        aria-label="Cari pasien"
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
          <SearchField.Input placeholder="Ketik No. RM, NIK, No. BPJS, atau nama (min. 2 huruf)" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      {query.trim().length >= 2 && (
        <ul className="max-h-72 divide-y divide-separator overflow-y-auto rounded-xl border border-border" role="listbox" aria-label="Hasil pencarian pasien">
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
                  <div className="tabular text-xs text-muted">
                    RM {p.mrn} · {ageLabel(p.birthDate)} · NIK {p.nik}
                  </div>
                </div>
                <PayerChip payer={p.payer} />
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted">Pasien tidak ditemukan.</li>}
        </ul>
      )}

      {onCreateNew && (
        <Button variant="ghost" size="sm" onPress={() => onCreateNew(query)}>
          <UserPlus className="size-4" aria-hidden />
          Pasien baru
        </Button>
      )}
    </div>
  )
}
