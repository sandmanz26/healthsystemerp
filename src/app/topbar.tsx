import { Avatar, Button, Dropdown, Header, Kbd, Label, Popover, Tooltip } from "@heroui/react"
import { Bell, Check, ChevronDown, Lock, Menu, Monitor, Moon, Search, Sun } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { ROLES, ROLE_ORDER } from "@/domain/roles"
import type { RoleId } from "@/domain/types"
import { cn } from "@/lib/cn"
import { formatRelative, initials } from "@/lib/format"
import { usePrefs, type AccentPref, type ThemePref } from "@/lib/prefs"
import { useActions, useStore } from "@/store"
import { useSession } from "@/store/selectors"
import { ShiftIndicator } from "./shift-indicator"

const THEME_ICON = { light: Sun, dark: Moon, system: Monitor }
const THEME_LABEL: Record<ThemePref, string> = { light: "Terang", dark: "Gelap (jaga malam)", system: "Ikuti sistem" }
const ACCENT_LABEL: Record<AccentPref, string> = { blue: "Biru-putih", mono: "Hitam-putih" }

export function Topbar({ onOpenMenu, onOpenSearch }: { onOpenMenu: () => void; onOpenSearch: () => void }) {
  const { lock } = useActions()

  return (
    <header className="no-print sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-separator bg-background/90 px-4 backdrop-blur sm:px-8">
      <Button isIconOnly variant="ghost" className="lg:hidden" aria-label="Buka menu" onPress={onOpenMenu}>
        <Menu className="size-5" />
      </Button>

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-left text-sm text-muted transition hover:border-accent/60 sm:max-w-sm"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Cari pasien atau menu…</span>
        <Kbd className="ml-auto hidden sm:inline-flex">
          <Kbd.Abbr keyValue="ctrl" />
          <Kbd.Content>K</Kbd.Content>
        </Kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <ShiftIndicator />
        <Notifications />
        <AppearanceMenu />
        <Tooltip delay={300}>
          <Button isIconOnly variant="ghost" aria-label="Kunci layar" onPress={lock}>
            <Lock className="size-5" />
          </Button>
          <Tooltip.Content>Kunci layar (workstation bersama)</Tooltip.Content>
        </Tooltip>
        <RoleSwitcher />
      </div>
    </header>
  )
}

function Notifications() {
  const role = useStore((s) => s.session.role)
  const all = useStore((s) => s.notifications)
  const { markNotificationRead, markAllNotificationsRead } = useActions()
  const navigate = useNavigate()
  const mine = all.filter((n) => n.roles.includes(role) || role === "admin").slice(0, 12)
  const unread = mine.filter((n) => !n.read).length

  return (
    <Popover>
      <Button isIconOnly variant="ghost" aria-label={`Notifikasi, ${unread} belum dibaca`} className="relative">
        <Bell className="size-5" />
        {unread > 0 && <span className="tabular absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-danger-foreground">{unread}</span>}
      </Button>
      <Popover.Content placement="bottom end" className="w-[min(92vw,380px)] p-0">
        <Popover.Dialog className="p-0">
          <div className="flex items-center justify-between border-b border-separator px-4 py-3">
            <Popover.Heading className="text-sm font-semibold">Notifikasi</Popover.Heading>
            {unread > 0 && (
              <Button size="sm" variant="ghost" onPress={() => markAllNotificationsRead(role)}>
                Tandai semua dibaca
              </Button>
            )}
          </div>
          <ul className="max-h-[60vh] divide-y divide-separator overflow-y-auto">
            {mine.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">Tidak ada notifikasi.</li>}
            {mine.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-secondary", !n.read && "bg-accent-soft/40")}
                  onClick={() => {
                    markNotificationRead(n.id)
                    if (n.href) navigate(n.href)
                  }}
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.level === "danger" ? "bg-danger" : n.level === "warning" ? "bg-warning" : "bg-accent")} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{n.title}</span>
                    <span className="block text-xs text-muted">{n.body}</span>
                    <span className="mt-1 block text-[11px] text-muted">{formatRelative(n.at)}</span>
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
function RoleSwitcher() {
  const { role, user } = useSession()
  const { switchRole } = useActions()
  const navigate = useNavigate()
  return (
    <Dropdown>
      <Dropdown.Trigger className="ml-1 flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-surface-secondary">
        <Avatar size="sm" color="accent" variant="soft">
          <Avatar.Fallback>{initials(user?.name ?? "?")}</Avatar.Fallback>
        </Avatar>
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-40 truncate text-sm font-medium">{user?.name}</span>
          <span className="block text-xs text-muted">{ROLES[role].label}</span>
        </span>
        <ChevronDown className="size-4 text-muted" aria-hidden />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="min-w-72">
        <div className="px-3 pb-1 pt-2 text-xs font-medium text-muted">Lihat sebagai (demo)</div>
        <Dropdown.Menu
          aria-label="Ganti peran"
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

/** Theme (light / dark / system) and colour scheme (blue / monochrome). */
function AppearanceMenu() {
  const { theme, setTheme, accent, setAccent } = usePrefs()
  const ThemeIcon = THEME_ICON[theme]
  return (
    <Dropdown>
      <Dropdown.Trigger aria-label="Tampilan" className="grid size-10 place-items-center rounded-xl hover:bg-surface-secondary">
        <ThemeIcon className="size-5" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="min-w-56">
        <Dropdown.Menu
          aria-label="Tampilan"
          onAction={(key) => {
            const [kind, value] = String(key).split(":")
            if (kind === "theme") setTheme(value as ThemePref)
            else setAccent(value as AccentPref)
          }}
        >
          <Dropdown.Section>
            <Header className="label-caps px-2 pb-1 pt-1.5 text-muted">Mode</Header>
            {(Object.keys(THEME_LABEL) as ThemePref[]).map((t) => (
              <Dropdown.Item key={t} id={`theme:${t}`} textValue={THEME_LABEL[t]}>
                <Label>{THEME_LABEL[t]}</Label>
                {theme === t && <Check className="ml-auto size-4 text-accent" aria-label="dipilih" />}
              </Dropdown.Item>
            ))}
          </Dropdown.Section>
          <Dropdown.Section>
            <Header className="label-caps px-2 pb-1 pt-2 text-muted">Warna</Header>
            {(Object.keys(ACCENT_LABEL) as AccentPref[]).map((a) => (
              <Dropdown.Item key={a} id={`accent:${a}`} textValue={ACCENT_LABEL[a]}>
                <span className={a === "blue" ? "size-3 rounded-full bg-[oklch(0.55_0.2_260)]" : "size-3 rounded-full bg-[oklch(0.18_0_0)] ring-1 ring-border"} aria-hidden />
                <Label>{ACCENT_LABEL[a]}</Label>
                {accent === a && <Check className="ml-auto size-4 text-accent" aria-label="dipilih" />}
              </Dropdown.Item>
            ))}
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
