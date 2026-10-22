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
import { moduleText } from "@/domain/modules"
import { ROLES } from "@/domain/roles"
import { useStore } from "@/store"
import { useEnabledModules, useRegion } from "@/store/selectors"
import { isNavVisible, navForPath, navLabel } from "./navigation"

export function ModuleGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const enabled = useEnabledModules()
  const role = useStore((s) => s.session.role)
  const region = useRegion()
  const nav = navForPath(pathname)
  if (!nav) return <>{children}</>

  const off = nav.modules.length > 0 && !nav.modules.some((m) => enabled.has(m))
  if (off) {
    const names = nav.modules.map((m) => moduleText(m, region).name).join(" / ")
    return (
      <Page>
        <Empty
          icon={Puzzle}
          title={`${names} is not turned on`}
          description="Your facility has not enabled this module yet. An administrator can turn it on at any time — no other data is affected."
          action={
            role === "admin" || role === "manager" ? (
              <Link to={`/modules?focus=${nav.modules[0]}`}>
                <Button variant="primary">{region === "uk" ? "Open Module Centre" : "Open Module Center"}</Button>
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
        <Empty icon={ShieldOff} title="No access" description={`The ${ROLES[role].label} role does not have access to ${navLabel(nav, region)}. Contact your administrator if you need it.`} />
      </Page>
    )
  }
  return <>{children}</>
}
