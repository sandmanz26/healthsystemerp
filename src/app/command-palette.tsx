/**
 * Ctrl/⌘+K: jump to any patient or any page. The fastest path for staff who know what
 * they want — and the main way doctors find a patient who is not on their worklist.
 */
import { Avatar, Modal, SearchField } from "@heroui/react"
import { CornerDownLeft } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { PayerChip } from "@/components/status"
import { ageLabel } from "@/domain/clinical"
import { matchPatient } from "@/domain/search"
import { cn } from "@/lib/cn"
import { initials } from "@/lib/format"
import { useStore } from "@/store"
import { formatNhsNumber } from "@/domain/interop"
import type { PayerType } from "@/domain/types"
import { useEnabledModules, useRegion } from "@/store/selectors"
import { NAV, isNavVisible, navLabel } from "./navigation"

type Result = { kind: "page"; path: string; label: string; icon: (typeof NAV)[number]["icon"] } | { kind: "patient"; id: string; name: string; sub: string; payer: PayerType }

export function CommandPalette({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const patients = useStore((s) => s.patients)
  const role = useStore((s) => s.session.role)
  const enabled = useEnabledModules()
  const region = useRegion()

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    const pages: Result[] = NAV.filter((n) => isNavVisible(n, enabled, role) && (!q || navLabel(n, region).toLowerCase().includes(q) || n.label.toLowerCase().includes(q))).map((n) => ({ kind: "page", path: n.path, label: navLabel(n, region), icon: n.icon }))
    const pts: Result[] = q.length >= 2
      ? patients.filter((p) => matchPatient(p, q)).slice(0, 6).map((p) => ({
          kind: "patient",
          id: p.id,
          name: p.name,
          sub: [`MRN ${p.mrn}`, region === "uk" && p.nhsNumber ? `NHS ${formatNhsNumber(p.nhsNumber)}` : null, ageLabel(p.birthDate)].filter(Boolean).join(" · "),
          payer: p.payer,
        }))
      : []
    return [...pts, ...pages.slice(0, q ? 6 : 8)]
  }, [query, patients, enabled, role, region])

  const go = (r: Result | undefined) => {
    if (!r) return
    navigate(r.kind === "page" ? r.path : `/patients/${r.id}`)
    onOpenChange(false)
    setQuery("")
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container placement="top" size="md">
        <Modal.Dialog aria-label="Quick search" className="p-0">
          <div className="border-b border-separator p-3">
            <SearchField
              aria-label="Search"
              autoFocus
              value={query}
              onChange={(v) => {
                setQuery(v)
                setActive(0)
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, results.length - 1))
                if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0))
                if (e.key === "Enter") go(results[active])
              }}
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder={region === "uk" ? "Patient name, MRN, NHS number or page…" : "Patient name, MRN, DOB or page…"} />
              </SearchField.Group>
            </SearchField>
          </div>
          <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox" aria-label="Results">
            {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No results.</li>}
            {results.map((r, i) => (
              <li key={r.kind === "page" ? r.path : r.id} role="option" aria-selected={i === active}>
                <button type="button" onClick={() => go(r)} onMouseEnter={() => setActive(i)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm", i === active && "bg-surface-secondary")}>
                  {r.kind === "page" ? (
                    <>
                      <r.icon className="size-4 text-muted" aria-hidden />
                      <span className="flex-1">{r.label}</span>
                      <span className="text-xs text-muted">Page</span>
                    </>
                  ) : (
                    <>
                      <Avatar size="sm" variant="soft" color="accent">
                        <Avatar.Fallback>{initials(r.name)}</Avatar.Fallback>
                      </Avatar>
                      <span className="flex-1">
                        <span className="block font-medium">{r.name}</span>
                        <span className="tabular block text-xs text-muted">{r.sub}</span>
                      </span>
                      <PayerChip payer={r.payer} />
                    </>
                  )}
                  {i === active && <CornerDownLeft className="size-3.5 text-muted" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
