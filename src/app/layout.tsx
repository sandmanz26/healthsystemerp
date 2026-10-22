import { Button, Drawer } from "@heroui/react"
import { HardDriveDownload, RefreshCw } from "lucide-react"
import { Suspense, useCallback, useState, useSyncExternalStore } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { dayKey, formatDate } from "@/lib/format"
import { useHotkey } from "@/lib/use-hotkey"
import { useActions, useStore } from "@/store"
import { storageHealth } from "@/store/storage"
import { CommandPalette } from "./command-palette"
import { ErrorBoundary } from "./error-boundary"
import { LockScreen } from "./lock-screen"
import { ModuleGate } from "./module-gate"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const locked = useStore((s) => s.session.locked)
  const { pathname } = useLocation()
  const { resetDemo } = useActions()
  useHotkey("k", useCallback(() => setSearchOpen(true), []), { mod: true })

  return (
    <div className="flex min-h-full">
      <aside className="no-print sticky top-0 hidden h-screen w-[260px] shrink-0 bg-chrome lg:block">
        <Sidebar />
      </aside>

      <Drawer.Backdrop isOpen={menuOpen} onOpenChange={setMenuOpen}>
        <Drawer.Content placement="left" className="w-72 bg-chrome">
          <Drawer.Dialog aria-label="Menu" className="h-full p-0">
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMenuOpen(true)} onOpenSearch={() => setSearchOpen(true)} />
        <StaleDataBanner />
        <StorageBanner />
        <main className="flex-1" key={pathname}>
          <ErrorBoundary resetKey={pathname} onResetData={resetDemo}>
            <ModuleGate>
              <Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </Suspense>
            </ModuleGate>
          </ErrorBoundary>
        </main>
      </div>

      <CommandPalette isOpen={searchOpen} onOpenChange={setSearchOpen} />
      {locked && <LockScreen />}
    </div>
  )
}

/**
 * Loading state with the structure of a real page (header, readouts, worklist) so nothing
 * jumps when the screen arrives. Pulses only when the user allows motion.
 */
export function PageSkeleton() {
  const bar = "rounded-md bg-surface-tertiary motion-safe:animate-pulse"
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className={`${bar} h-3 w-40`} />
      <div className={`${bar} mt-2 h-7 w-72`} />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[92px] rounded-[14px] border border-border bg-surface p-4">
            <div className={`${bar} h-3 w-24`} />
            <div className={`${bar} mt-3 h-6 w-16`} />
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-[14px] border border-border bg-surface">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-separator px-5 py-4 last:border-0">
            <div className={`${bar} h-4 w-12`} />
            <div className={`${bar} h-4 flex-1`} />
            <div className={`${bar} h-4 w-24`} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Kept for full-screen routes (onboarding, TV display) where a skeleton has no shape to mirror. */
export const PageSpinner = PageSkeleton

/** Demo data is generated for "today"; on a later day, offer to regenerate it. */
/** Partial state: the app works, but this device cannot save (private window, full disk). */
function StorageBanner() {
  const health = useSyncExternalStore(storageHealth.subscribe, storageHealth.get)
  if (health === "ok") return null
  return (
    <div role="status" className="no-print flex items-center gap-2 border-b border-danger/30 bg-danger-soft px-4 py-2 text-sm text-danger sm:px-6">
      <HardDriveDownload className="size-4 shrink-0" aria-hidden />
      Changes are not being saved on this device — browser storage is unavailable (private window or full disk). What you see is current for this session only.
    </div>
  )
}

function StaleDataBanner() {
  const seededOn = useStore((s) => s.seededOn)
  const { resetDemo } = useActions()
  if (seededOn === dayKey()) return null
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-warning/30 bg-warning-soft px-4 py-2 text-sm text-warning-soft-foreground sm:px-6">
      <span>Demo data was generated for {formatDate(seededOn)}. Today's queues and schedules may be empty.</span>
      <Button size="sm" variant="secondary" onPress={resetDemo}>
        <RefreshCw className="size-4" aria-hidden />
        Load today's data
      </Button>
    </div>
  )
}
