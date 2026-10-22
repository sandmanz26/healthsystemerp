import { Suspense } from "react"
import { Navigate, Outlet } from "react-router-dom"
import { useStore } from "@v2/store"
import { PageSpinner } from "./layout"

/** Until onboarding is done, every route goes to the setup wizard. */
export function RequireOnboarding() {
  const onboarded = useStore((s) => s.onboarded)
  return onboarded ? <Outlet /> : <Navigate to="/onboarding" replace />
}

export function Fullscreen() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Outlet />
    </Suspense>
  )
}
