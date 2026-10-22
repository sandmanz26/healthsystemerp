import { Avatar, Button, Dropdown, Header, Label, Popover } from "@heroui/react"
import { Bell, Check, ChevronsUpDown, Menu, Monitor, Moon, Search, Sun } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { ROLES, ROLE_ORDER } from "@v2/domain/roles"
import type { RoleId } from "@v2/domain/types"
import { cn } from "@v2/lib/cn"
import { formatRelative, initials } from "@v2/lib/format"
import { usePrefs, type ThemePref } from "@v2/lib/prefs"
import { useActions, useStore } from "@v2/store"
import { useRegion, useSession } from "@v2/store/selectors"
import { navForPath, navLabel } from "./navigation"

const THEME_ICON = { light: Sun, dark: Moon, system: Monitor }
const THEME_LABEL: Record<ThemePref, string> = { light: "Light", dark: "Dark (night shift)", system: "Match system" }

/**
 * Phone and tablet only (the desktop shell has no top bar): the screen's name, the menu and
 * search. Everything else lives in the sidebar sheet.
 */
export function Topbar({ onOpenMenu, onOpenSearch }: { onOpenMenu: () => void; onOpenSearch: () => void }) {
  const { pathname } = useLocation()
  const region = useRegion()
  const nav = navForPath(pathname)
  return (
    <header className="no-print sticky top-0 z-30 flex h-12 items-center gap-1 border-b border-border bg-background px-2 lg:hidden">
      <Button isIconOnly variant="ghost" aria-label="Open menu" onPress={onOpenMenu}>
        <Menu className="size-5" />
      </Button>
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{nav ? navLabel(nav, region) : "Medisphere"}</span>
      <Button isIconOnly variant="ghost" aria-label="Search patients or pages" onPress={onOpenSearch}>
        <Search className="size-5" />
      </Button>
      <Notifications />
    </header>
  )
}

export function Notifications() {
  const role = useStore((s) => s.session.role)
  const all = useStore((s) => s.notifications)
  const { markNotificationRead, markAllNotificationsRead } = useActions()
  const navigate = useNavigate()
  const mine = all.filter((n) => n.roles.includes(role) || role === "admin").slice(0, 12)
  const unread = mine.filter((n) => !n.read).length

  return (
    <Popover>
      <Button isIconOnly variant="ghost" size="sm" aria-label={`Notifications, ${unread} unread`} className="relative">
        <Bell className="size-4" />
        {unread > 0 && <span className="tabular absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-xs font-medium leading-4 text-white">{unread}</span>}
      </Button>
      <Popover.Content placement="bottom end" className="w-[min(92vw,380px)] p-0">
        <Popover.Dialog className="p-0">
          <div className="flex items-center justify-between border-b border-separator px-4 py-3">
            <Popover.Heading className="text-sm font-semibold">Notifications</Popover.Heading>
            {unread > 0 && (
              <Button size="sm" variant="ghost" onPress={() => markAllNotificationsRead(role)}>
                Mark all as read
              </Button>
            )}
          </div>
          <ul className="max-h-[60vh] divide-y divide-separator overflow-y-auto">
            {mine.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">No notifications.</li>}
            {mine.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-secondary", !n.read && "bg-surface-secondary")}
                  onClick={() => {
                    markNotificationRead(n.id)
                    if (n.href) navigate(n.href)
                  }}
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.level === "danger" ? "bg-danger" : n.level === "warning" ? "bg-warning" : "bg-muted")} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{n.title}</span>
                    <span className="block text-xs text-muted">{n.body}</span>
                    <span className="mt-1 block text-xs text-muted">{formatRelative(n.at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}

/**
 * Demo-only persona switcher. In production this is the logged-in user; here it lets
 * reviewers see how the same hospital looks to each role.
 */
export function RoleSwitcher() {
  const { role, user } = useSession()
  const { switchRole } = useActions()
  const navigate = useNavigate()
  return (
    <Dropdown>
      <Dropdown.Trigger className="flex w-full min-w-0 items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-chrome-active">
        <Avatar size="sm" variant="soft">
          <Avatar.Fallback>{initials(user?.name ?? "?")}</Avatar.Fallback>
        </Avatar>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-medium">{user?.name}</span>
          <span className="block truncate text-xs text-muted">{ROLES[role].label}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="top start" className="min-w-72">
        <div className="px-3 pb-1 pt-2 text-xs font-medium text-muted">View as (demo)</div>
        <Dropdown.Menu
          aria-label="Switch role"
          selectionMode="single"
          selectedKeys={new Set([role])}
          onAction={(key) => {
            switchRole(key as RoleId)
            navigate("/")
          }}
        >
          {ROLE_ORDER.map((r) => (
            <Dropdown.Item key={r} id={r} textValue={ROLES[r].label}>
              <div className="flex flex-col">
                <Label>{ROLES[r].label}</Label>
                <span className="text-xs text-muted">{ROLES[r].description}</span>
              </div>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}

/** Theme: light, dark (night shift, true neutrals) or match the system. */
export function AppearanceMenu() {
  const { theme, setTheme } = usePrefs()
  const ThemeIcon = THEME_ICON[theme]
  return (
    <Dropdown>
      <Dropdown.Trigger aria-label="Theme" className="grid size-8 place-items-center rounded-md hover:bg-chrome-active">
        <ThemeIcon className="size-4" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="top start" className="min-w-56">
        <Dropdown.Menu aria-label="Theme" onAction={(key) => setTheme(String(key) as ThemePref)}>
          <Dropdown.Section>
            <Header className="px-2 pb-1 pt-1.5 text-xs text-muted">Theme</Header>
            {(Object.keys(THEME_LABEL) as ThemePref[]).map((t) => (
              <Dropdown.Item key={t} id={t} textValue={THEME_LABEL[t]}>
                <Label>{THEME_LABEL[t]}</Label>
                {theme === t && <Check className="ml-auto size-4" aria-label="selected" />}
              </Dropdown.Item>
            ))}
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
