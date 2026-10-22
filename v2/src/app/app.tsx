import { Toast } from "@heroui/react"
import { useEffect, useState } from "react"
import { RouterProvider } from "react-router-dom"
import type { Region } from "@v2/domain/region"
import type { RoleId } from "@v2/domain/types"
import { MODULES } from "@v2/domain/modules"
import { applyTheme, usePrefs } from "@v2/lib/prefs"
import { useHydrated, useStore } from "@v2/store"
import { PageSpinner } from "./layout"
import { router } from "./router"

export function App() {
  const theme = usePrefs((s) => s.theme)
  const accent = usePrefs((s) => s.accent)
  const hydrated = useHydrated()
  useEffect(() => {
    applyTheme(theme, accent)
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => applyTheme("system", accent)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [theme, accent])

  const demoReady = useDemoLink(hydrated)

  if (!hydrated || !demoReady) return <PageSpinner />
  return (
    <>
      <RouterProvider router={router} />
      <Toast.Provider placement="bottom end" />
    </>
  )
}

/**
 * Demo link: `?demo=us|uk&role=doctor` skips onboarding with every module on, so a link (or
 * the taste-skill inspector, which opens a fresh browser) lands straight on a working screen.
 */
function useDemoLink(hydrated: boolean): boolean {
  const demo = new URLSearchParams(window.location.search).get("demo")
  const [ready, setReady] = useState(demo !== "us" && demo !== "uk")
  useEffect(() => {
    if (!hydrated || ready) return
    const params = new URLSearchParams(window.location.search)
    const region = params.get("demo") as Region
    const { onboarded, facility, actions } = useStore.getState()
    if (!onboarded || facility.region !== region)
      actions.completeOnboarding({ facilityName: "", type: "general", modules: MODULES.filter((m) => !m.core).map((m) => m.id), region })
    const role = params.get("role") as RoleId | null
    if (role) actions.switchRole(role)
    // One-shot: the store is now onboarded, so the app may render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true)
  }, [hydrated, ready])
  return ready
}
