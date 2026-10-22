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
    children: [{ path: "/onboarding", element: page(() => import("@v2/features/onboarding/onboarding-page")) }],
  },
  {
    element: <RequireOnboarding />,
    children: [
      {
        element: <Fullscreen />,
        children: [{ path: "/registration/display", element: page(() => import("@v2/features/registration/queue-display-page")) }],
      },
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: page(() => import("@v2/features/home/home-page")) },
          { path: "/modules", element: page(() => import("@v2/features/modules/module-center-page")) },
          { path: "/patients", element: page(() => import("@v2/features/patients/patients-page")) },
          { path: "/patients/:id", element: page(() => import("@v2/features/patients/patient-detail-page")) },
          { path: "/registration", element: page(() => import("@v2/features/registration/registration-page")) },
          { path: "/appointments", element: page(() => import("@v2/features/appointments/appointments-page")) },
          { path: "/outpatient", element: page(() => import("@v2/features/outpatient/outpatient-page")) },
          { path: "/encounters/:id", element: page(() => import("@v2/features/emr/encounter-page")) },
          { path: "/emergency", element: page(() => import("@v2/features/emergency/emergency-page")) },
          { path: "/inpatient", element: page(() => import("@v2/features/inpatient/inpatient-page")) },
          { path: "/nursing", element: page(() => import("@v2/features/nursing/nursing-page")) },
          { path: "/surgery", element: page(() => import("@v2/features/surgery/surgery-page")) },
          { path: "/laboratory", element: page(() => import("@v2/features/laboratory/laboratory-page")) },
          { path: "/radiology", element: page(() => import("@v2/features/radiology/radiology-page")) },
          { path: "/pharmacy", element: page(() => import("@v2/features/pharmacy/pharmacy-page")) },
          { path: "/billing", element: page(() => import("@v2/features/billing/billing-page")) },
          { path: "/claims", element: page(() => import("@v2/features/claims/claims-page")) },
          { path: "/inventory", element: page(() => import("@v2/features/inventory/inventory-page")) },
          { path: "/hr", element: page(() => import("@v2/features/hr/hr-page")) },
          { path: "/quality", element: page(() => import("@v2/features/quality/quality-page")) },
          { path: "/reports", element: page(() => import("@v2/features/reports/reports-page")) },
          { path: "/integrations", element: page(() => import("@v2/features/integrations/integrations-page")) },
          { path: "/settings", element: page(() => import("@v2/features/settings/settings-page")) },
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
])
