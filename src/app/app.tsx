import { Toast } from "@heroui/react"
import { useEffect } from "react"
import { RouterProvider } from "react-router-dom"
import { applyTheme, usePrefs } from "@/lib/prefs"
import { useHydrated } from "@/store"
import { PageSpinner } from "./layout"
import { router } from "./router"

export function App() {
  const theme = usePrefs((s) => s.theme)
  const hydrated = useHydrated()
  useEffect(() => {
    applyTheme(theme)
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => applyTheme("system")
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [theme])

  if (!hydrated) return <PageSpinner />
  return (
    <>
      <RouterProvider router={router} />
      <Toast.Provider placement="bottom end" />
    </>
  )
}
