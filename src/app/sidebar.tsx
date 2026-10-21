import { Puzzle } from "lucide-react"
import { NavLink } from "react-router-dom"
import { CATEGORY_LABEL, CATEGORY_ORDER, MODULES } from "@/domain/modules"
import { cn } from "@/lib/cn"
import { useStore } from "@/store"
import { useEnabledModules } from "@/store/selectors"
import { Logo } from "./logo"
import { NAV, isNavVisible, type NavItem } from "./navigation"

const GROUPS = ["home", ...CATEGORY_ORDER] as const

/** Sidebar grouped by module category. Only enabled modules for the current role appear. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const enabled = useEnabledModules()
  const role = useStore((s) => s.session.role)
  const facility = useStore((s) => s.facility.name)
  const visible = NAV.filter((n) => isNavVisible(n, enabled, role))

  return (
    <nav aria-label="Navigasi utama" className="flex h-full flex-col">
      <div className="px-4 pb-4 pt-5">
        <Logo />
        <div className="mt-3 truncate rounded-lg bg-surface-secondary px-2.5 py-1.5 text-xs font-medium text-muted" title={facility}>
          {facility}
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {GROUPS.map((group) => {
          const items = visible.filter((n) => n.group === group)
          if (!items.length) return null
          return (
            <div key={group}>
              {group !== "home" && <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{CATEGORY_LABEL[group]}</div>}
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.path}>
                    <SidebarLink item={item} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      {(role === "admin" || role === "manager") && (
        <div className="border-t border-separator p-3">
          <NavLink to="/modules" onClick={onNavigate} className="flex items-center gap-3 rounded-xl bg-accent-soft px-3 py-2.5 text-sm font-medium text-accent-soft-foreground hover:bg-accent-soft-hover">
            <Puzzle className="size-4" aria-hidden />
            <span className="flex-1">Tambah modul</span>
            <span className="tabular text-xs opacity-80">
              {MODULES.filter((m) => !m.core && enabled.has(m.id)).length}/{MODULES.filter((m) => !m.core).length}
            </span>
          </NavLink>
        </div>
      )}
    </nav>
  )
}

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
          isActive ? "bg-accent text-accent-foreground shadow-sm" : "text-foreground/80 hover:bg-surface-secondary hover:text-foreground",
        )
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
    </NavLink>
  )
}
