import { Button, Drawer, Spinner } from "@heroui/react"
import { RefreshCw } from "lucide-react"
import { Suspense, useCallback, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { dayKey, formatDate } from "@/lib/format"
import { useHotkey } from "@/lib/use-hotkey"
import { useActions, useStore } from "@/store"
import { CommandPalette } from "./command-palette"
import { LockScreen } from "./lock-screen"
import { ModuleGate } from "./module-gate"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const locked = useStore((s) => s.session.locked)
  const { pathname } = useLocation()
  useHotkey("k", useCallback(() => setSearchOpen(true), []), { mod: true })

  return (
    <div className="flex min-h-full">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 border-r border-separator bg-surface lg:block">
        <Sidebar />
      </aside>

      <Drawer.Backdrop isOpen={menuOpen} onOpenChange={setMenuOpen}>
        <Drawer.Content placement="left" className="w-72">
          <Drawer.Dialog aria-label="Menu" className="h-full p-0">
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMenuOpen(true)} onOpenSearch={() => setSearchOpen(true)} />
        <StaleDataBanner />
        <main className="flex-1" key={pathname}>
          <ModuleGate>
            <Suspense fallback={<PageSpinner />}>
              <Outlet />
            </Suspense>
          </ModuleGate>
        </main>
      </div>

      <CommandPalette isOpen={searchOpen} onOpenChange={setSearchOpen} />
      {locked && <LockScreen />}
    </div>
  )
}

export function PageSpinner() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner aria-label="Memuat" />
    </div>
  )
}

/** Demo data is generated for "today"; on a later day, offer to regenerate it. */
function StaleDataBanner() {
  const seededOn = useStore((s) => s.seededOn)
  const { resetDemo } = useActions()
  if (seededOn === dayKey()) return null
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-warning/30 bg-warning-soft px-4 py-2 text-sm text-warning-soft-foreground sm:px-6">
      <span>Data demo dibuat untuk {formatDate(seededOn)}. Antrean & jadwal "hari ini" mungkin kosong.</span>
      <Button size="sm" variant="secondary" onPress={resetDemo}>
        <RefreshCw className="size-4" aria-hidden />
        Muat data hari ini
      </Button>
    </div>
  )
}
