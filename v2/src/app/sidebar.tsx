/**
 * Open-plane sidebar: the product, the facility it is scoped to, search, the enabled
 * modules grouped by category, and the user at the foot. It sits on the page ground with
 * no panel of its own; the active page is a neutral pill.
 */
import { Button } from "@heroui/react"
import { Lock, Puzzle, Search } from "lucide-react"
import { NavLink } from "react-router-dom"
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@v2/domain/modules"
import { REGIONS, type Region } from "@v2/domain/region"
import { cn } from "@v2/lib/cn"
import { useActions, useStore } from "@v2/store"
import { useEnabledModules, useRegion } from "@v2/store/selectors"
import { Logo } from "./logo"
import { NAV, isNavVisible, navLabel, type NavItem } from "./navigation"
import { AppearanceMenu, Notifications, RoleSwitcher } from "./topbar"

const GROUPS = ["home", ...CATEGORY_ORDER] as const

export function Sidebar({ onNavigate, onOpenSearch }: { onNavigate?: () => void; onOpenSearch?: () => void }) {
  const enabled = useEnabledModules()
  const role = useStore((s) => s.session.role)
  const facility = useStore((s) => s.facility)
  const region = useRegion()
  const { lock } = useActions()
  const visible = NAV.filter((n) => isNavVisible(n, enabled, role))

  return (
    <nav aria-label="Main navigation" className="flex h-full flex-col bg-background text-foreground">
      <div className="px-4 pb-3 pt-5">
        <Logo />
        <div className="mt-3 px-2 text-xs text-muted">
          <div className="truncate text-[13px] text-foreground" title={facility.name}>
            {facility.name}
          </div>
          <div className="num truncate">
            {region === "us" ? "CCN" : "ODS"} {facility.code} · {REGIONS[region].name}
          </div>
        </div>
        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="mt-3 flex h-8 w-full items-center gap-2 rounded-md border border-field-border bg-surface px-2.5 text-sm text-muted hover:border-foreground/30"
          >
            <Search className="size-4" aria-hidden />
            <span className="flex-1 text-left">Search</span>
            <span className="text-xs">Ctrl K</span>
          </button>
        )}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {GROUPS.map((group) => {
          const items = visible.filter((n) => n.group === group)
          if (!items.length) return null
          return (
            <div key={group}>
              {group !== "home" && <div className="mb-0.5 px-3 text-[13px] text-muted">{CATEGORY_LABEL[group]}</div>}
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.path}>
                    <NavRow item={item} region={region} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
        {(role === "admin" || role === "manager") && (
          <NavLink
            to="/modules"
            onClick={onNavigate}
            className={({ isActive }) => cn("flex h-8 items-center gap-2.5 rounded-md px-3 text-sm", isActive ? "bg-chrome-active font-medium" : "text-foreground/80 hover:bg-chrome-active/60")}
          >
            <Puzzle className="size-4 shrink-0" aria-hidden />
            Modules
          </NavLink>
        )}
      </div>
      <div className="border-t border-border px-3 py-3">
        <RoleSwitcher />
        <div className="mt-1 flex items-center gap-1 px-1">
          <Notifications />
          <AppearanceMenu />
          <Button isIconOnly size="sm" variant="ghost" aria-label="Lock workstation" onPress={lock}>
            <Lock className="size-4" />
          </Button>
        </div>
      </div>
    </nav>
  )
}

function NavRow({ item, region, onNavigate }: { item: NavItem; region: Region; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn("flex h-8 items-center gap-2.5 rounded-md px-3 text-sm transition-colors", isActive ? "bg-chrome-active font-medium text-foreground" : "text-foreground/80 hover:bg-chrome-active/60 hover:text-foreground")
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{navLabel(item, region)}</span>
    </NavLink>
  )
}
