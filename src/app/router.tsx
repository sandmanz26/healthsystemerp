/**
 * Routes. Every feature page is lazy-loaded so a clinic that only uses three modules
 * never downloads the code of the other eighteen.
 */
import { lazy } from "react"
import { createHashRouter, Navigate } from "react-router-dom"
import { AppLayout } from "./layout"
import { Fullscreen, RequireOnboarding } from "./route-guards"

const page = (load: () => Promise<{ default: React.ComponentType }>) => {
  const Component = lazy(load)
  return <Component />
}

export const router = createHashRouter([
  {
    element: <Fullscreen />,
    children: [{ path: "/onboarding", element: page(() => import("@/features/onboarding/onboarding-page")) }],
  },
  {
    element: <RequireOnboarding />,
    children: [
      {
        element: <Fullscreen />,
        children: [{ path: "/registration/display", element: page(() => import("@/features/registration/queue-display-page")) }],
      },
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: page(() => import("@/features/home/home-page")) },
          { path: "/modules", element: page(() => import("@/features/modules/module-center-page")) },
          { path: "/patients", element: page(() => import("@/features/patients/patients-page")) },
          { path: "/patients/:id", element: page(() => import("@/features/patients/patient-detail-page")) },
          { path: "/registration", element: page(() => import("@/features/registration/registration-page")) },
          { path: "/appointments", element: page(() => import("@/features/appointments/appointments-page")) },
          { path: "/outpatient", element: page(() => import("@/features/outpatient/outpatient-page")) },
          { path: "/encounters/:id", element: page(() => import("@/features/emr/encounter-page")) },
          { path: "/emergency", element: page(() => import("@/features/emergency/emergency-page")) },
          { path: "/inpatient", element: page(() => import("@/features/inpatient/inpatient-page")) },
          { path: "/nursing", element: page(() => import("@/features/nursing/nursing-page")) },
          { path: "/surgery", element: page(() => import("@/features/surgery/surgery-page")) },
          { path: "/laboratory", element: page(() => import("@/features/laboratory/laboratory-page")) },
          { path: "/radiology", element: page(() => import("@/features/radiology/radiology-page")) },
          { path: "/pharmacy", element: page(() => import("@/features/pharmacy/pharmacy-page")) },
          { path: "/billing", element: page(() => import("@/features/billing/billing-page")) },
          { path: "/claims", element: page(() => import("@/features/claims/claims-page")) },
          { path: "/inventory", element: page(() => import("@/features/inventory/inventory-page")) },
          { path: "/hr", element: page(() => import("@/features/hr/hr-page")) },
          { path: "/quality", element: page(() => import("@/features/quality/quality-page")) },
          { path: "/reports", element: page(() => import("@/features/reports/reports-page")) },
          { path: "/integrations", element: page(() => import("@/features/integrations/integrations-page")) },
          { path: "/settings", element: page(() => import("@/features/settings/settings-page")) },
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
])
