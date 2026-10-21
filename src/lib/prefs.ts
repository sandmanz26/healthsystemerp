/**
 * Per-device UI preferences (theme, collapsed sidebar). Not hospital data, so it lives
 * apart from the main store and survives "reset demo data".
 */
import { create } from "zustand"
import { persist } from "zustand/middleware"

export type ThemePref = "light" | "dark" | "system"

interface Prefs {
  theme: ThemePref
  setTheme: (t: ThemePref) => void
  /** Last unit chosen on worklists, per page, so staff land on "their" poli/ward. */
  unitFilter: Record<string, string>
  setUnitFilter: (page: string, unitId: string) => void
}

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
      unitFilter: {},
      setUnitFilter: (page, unitId) => set((s) => ({ unitFilter: { ...s.unitFilter, [page]: unitId } })),
    }),
    { name: "medisphere-prefs" },
  ),
)

export function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  const root = document.documentElement
  root.classList.toggle("dark", dark)
  root.dataset.theme = dark ? "dark" : "light"
}
