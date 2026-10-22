/**
 * The binder. Modules are grouped like the coloured dividers of a medical-record folder;
 * the active page is a tab that runs into the paper of the page. The footer shows the
 * facility's module "slots" — the modular concept made visible.
 */
import { Puzzle } from "lucide-react"
import { NavLink } from "react-router-dom"
import { CATEGORY_LABEL, CATEGORY_ORDER, MODULES } from "@/domain/modules"
import { cn } from "@/lib/cn"
import { useStore } from "@/store"
import { useEnabledModules } from "@/store/selectors"
import { Logo } from "./logo"
import { CATEGORY_COLOR, NAV, isNavVisible, type NavItem } from "./navigation"

const GROUPS = ["home", ...CATEGORY_ORDER] as const

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const enabled = useEnabledModules()
  const role = useStore((s) => s.session.role)
  const facility = useStore((s) => s.facility)
  const visible = NAV.filter((n) => isNavVisible(n, enabled, role))
  const optional = MODULES.filter((m) => !m.core)

  return (
    <nav aria-label="Navigasi utama" className="flex h-full flex-col bg-chrome text-chrome-foreground">
      <div className="px-5 pb-5 pt-6">
        <Logo inverted />
        <div className="mt-5 border-l-2 border-chrome-muted/40 pl-3">
          <div className="truncate text-sm font-semibold" title={facility.name}>
            {facility.name}
          </div>
          <div className="num text-[11px] text-chrome-muted">
            {facility.city} · {facility.code}
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto pb-4 pl-3">
        {GROUPS.map((group) => {
          const items = visible.filter((n) => n.group === group)
          if (!items.length) return null
          return (
            <div key={group}>
              {group !== "home" && (
                <div className="mb-1 flex items-center gap-2 px-3">
                  <span className={cn("h-3 w-1 rounded-full", CATEGORY_COLOR[group])} aria-hidden />
                  <span className="label-caps text-chrome-muted">{CATEGORY_LABEL[group]}</span>
                </div>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.path}>
                    <BinderTab item={item} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      {(role === "admin" || role === "manager") && (
        <NavLink to="/modules" onClick={onNavigate} className="group mx-3 mb-4 block rounded-xl border border-chrome-muted/25 p-3 transition hover:border-chrome-muted/60">
          <div className="flex items-center justify-between">
            <span className="label-caps text-chrome-muted">Slot modul</span>
            <span className="num text-xs">
              {optional.filter((m) => enabled.has(m.id)).length}/{optional.length}
            </span>
          </div>
          <div className="mt-2 flex gap-[3px]" aria-hidden>
            {optional.map((m) => (
              <span key={m.id} className={cn("h-4 flex-1 rounded-[2px]", enabled.has(m.id) ? CATEGORY_COLOR[m.category] : "bg-chrome-muted/20")} />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-chrome-foreground/90 group-hover:text-chrome-foreground">
            <Puzzle className="size-3.5" aria-hidden /> Tambah atau atur modul
          </div>
        </NavLink>
      )}
    </nav>
  )
}

function BinderTab({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-3 rounded-l-xl py-2 pl-3 pr-4 text-sm font-medium transition-colors",
          isActive ? "bg-paper text-foreground" : "text-chrome-foreground/75 hover:bg-white/5 hover:text-chrome-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className={cn("absolute inset-y-2 left-0 w-1 rounded-full", CATEGORY_COLOR[item.group])} aria-hidden />}
          <Icon className="size-[18px] shrink-0" aria-hidden />
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}
