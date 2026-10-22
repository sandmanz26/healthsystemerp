/**
 * The application store: all hospital data plus the actions that change it.
 *
 * - Data is persisted to IndexedDB (frontend-only demo; a backend would replace this
 *   with API calls behind the same action names).
 * - Actions are grouped by domain in ./actions and share helpers for cross-module effects.
 * - Components read with narrow selectors: `useStore((s) => s.beds)`.
 */
import { useSyncExternalStore } from "react"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { createSeed } from "@/data/seed"
import { setFormatRegion } from "@/lib/format"
import { clinicalActions } from "./actions/clinical"
import { financeActions } from "./actions/finance"
import { operationsActions } from "./actions/operations"
import { orderActions } from "./actions/orders"
import { pharmacyActions } from "./actions/pharmacy"
import { tenantActions } from "./actions/tenant"
import type { SetFn } from "./helpers"
import { DATA_VERSION, type HospitalData } from "./schema"
import { idbStorage } from "./storage"

function createActions(set: SetFn) {
  return {
    ...tenantActions(set),
    ...clinicalActions(set),
    ...orderActions(set),
    ...pharmacyActions(set),
    ...financeActions(set),
    ...operationsActions(set),
  }
}

export type Actions = ReturnType<typeof createActions>
export type Store = HospitalData & { actions: Actions }

export const useStore = create<Store>()(
  persist(
    immer((set) => ({
      ...createSeed(),
      actions: createActions((recipe) => set((s) => recipe(s))),
    })),
    {
      name: "medisphere-data",
      version: DATA_VERSION,
      storage: createJSONStorage(() => idbStorage),
      partialize: ({ actions, ...data }) => (void actions, data),
      // Schema changed: start over with fresh demo data rather than migrate mock records.
      migrate: () => createSeed() as unknown as Store,
      onRehydrateStorage: () => (state) => state && setFormatRegion(state.facility.region),
    },
  ),
)

// Formatting (currency, dates, °F/°C) follows the facility's region.
setFormatRegion(useStore.getState().facility.region)
useStore.subscribe((s) => setFormatRegion(s.facility.region))

/** Stable action bag — never triggers a re-render. */
export const useActions = () => useStore((s) => s.actions)

/** True once persisted data has loaded; until then the UI shows a spinner, not seed data. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useStore.persist.onFinishHydration(cb),
    () => useStore.persist.hasHydrated(),
  )
}
