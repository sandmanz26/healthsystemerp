/**
 * Route guard: a page whose module is off explains why and links to the Module Center,
 * instead of 404-ing (deep links from bookmarks and notifications must not break).
 */
import { Button } from "@heroui/react"
import { Puzzle, ShieldOff } from "lucide-react"
import type { ReactNode } from "react"
import { Link, useLocation } from "react-router-dom"
import { Empty } from "@/components/ui/empty"
import { Page } from "@/components/ui/page"
import { MODULE_MAP } from "@/domain/modules"
import { ROLES } from "@/domain/roles"
import { useStore } from "@/store"
import { useEnabledModules } from "@/store/selectors"
import { isNavVisible, navForPath } from "./navigation"

export function ModuleGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const enabled = useEnabledModules()
  const role = useStore((s) => s.session.role)
  const nav = navForPath(pathname)
  if (!nav) return <>{children}</>

  const off = nav.modules.length > 0 && !nav.modules.some((m) => enabled.has(m))
  if (off) {
    const names = nav.modules.map((m) => MODULE_MAP[m].name).join(" / ")
    return (
      <Page>
        <Empty
          icon={Puzzle}
          title={`Modul ${names} belum aktif`}
          description="Faskes Anda belum mengaktifkan modul ini. Admin dapat mengaktifkannya kapan saja — data lain tidak terpengaruh."
          action={
            role === "admin" || role === "manager" ? (
              <Link to={`/modules?focus=${nav.modules[0]}`}>
                <Button variant="primary">Buka Pusat Modul</Button>
              </Link>
            ) : undefined
          }
        />
      </Page>
    )
  }
  if (!isNavVisible(nav, enabled, role)) {
    return (
      <Page>
        <Empty icon={ShieldOff} title="Tidak ada akses" description={`Peran ${ROLES[role].label} tidak memiliki akses ke ${nav.label}. Hubungi admin bila Anda membutuhkannya.`} />
      </Page>
    )
  }
  return <>{children}</>
}
