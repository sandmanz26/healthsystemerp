import { DEFAULT_USER_FOR_ROLE } from "@/data/master"
import { createSeed } from "@/data/seed"
import { MODULE_MAP, blockersForDisable, missingForEnable, type FacilityType, type ModuleId } from "@/domain/modules"
import type { Region } from "@/domain/region"
import type { RoleId } from "@/domain/types"
import { audit, nowIso, type SetFn } from "../helpers"
import type { FacilityProfile } from "../schema"

export function tenantActions(set: SetFn) {
  return {
    /** Finishes first-run setup. Choosing another region rebuilds the demo data for that market. */
    completeOnboarding(input: { facilityName: string; type: FacilityType; modules: ModuleId[]; region: Region }) {
      set((d) => {
        if (input.region !== d.facility.region) Object.assign(d, createSeed(input.modules, input.region), { session: d.session })
        d.facility.name = input.facilityName.trim() || d.facility.name
        d.facility.type = input.type
        for (const id of Object.keys(d.modules) as ModuleId[]) {
          if (MODULE_MAP[id].core) continue
          d.modules[id].enabled = input.modules.includes(id)
          d.modules[id].enabledAt = nowIso()
        }
        d.onboarded = true
        audit(d, "Completed onboarding", input.type)
      })
    },

    /** Enables a module together with any required modules that are still off. */
    enableModule(id: ModuleId) {
      set((d) => {
        const enabled = new Set((Object.keys(d.modules) as ModuleId[]).filter((m) => d.modules[m].enabled))
        for (const m of [...missingForEnable(id, enabled), id]) {
          d.modules[m].enabled = true
          d.modules[m].enabledAt = nowIso()
          audit(d, "Enabled module", MODULE_MAP[m].name)
        }
      })
    },

    /** Returns the modules blocking the change; disables only when there are none. */
    disableModule(id: ModuleId): ModuleId[] {
      let blockers: ModuleId[] = []
      set((d) => {
        const enabled = new Set((Object.keys(d.modules) as ModuleId[]).filter((m) => d.modules[m].enabled))
        blockers = blockersForDisable(id, enabled)
        if (blockers.length || MODULE_MAP[id].core) return
        d.modules[id].enabled = false
        audit(d, "Disabled module", MODULE_MAP[id].name)
      })
      return blockers
    },

    toggleSetupItem(id: ModuleId, itemId: string) {
      set((d) => {
        const done = d.modules[id].setupDone
        const i = done.indexOf(itemId)
        if (i >= 0) done.splice(i, 1)
        else done.push(itemId)
      })
    },

    switchRole(role: RoleId) {
      set((d) => {
        d.session = { role, userId: DEFAULT_USER_FOR_ROLE[role], locked: false }
      })
    },

    lock() {
      set((d) => {
        d.session.locked = true
      })
    },

    unlock() {
      set((d) => {
        d.session.locked = false
      })
    },

    updateFacility(patch: Partial<FacilityProfile>) {
      set((d) => {
        Object.assign(d.facility, patch)
        audit(d, "Updated facility profile", d.facility.name)
      })
    },

    markNotificationRead(id: string) {
      set((d) => {
        const n = d.notifications.find((x) => x.id === id)
        if (n) n.read = true
      })
    },

    markAllNotificationsRead(role: RoleId) {
      set((d) => {
        for (const n of d.notifications) if (n.roles.includes(role)) n.read = true
      })
    },

    /** Rebuilds the demo dataset for today, keeping onboarding choices. */
    resetDemo() {
      set((d) => {
        const enabled = (Object.keys(d.modules) as ModuleId[]).filter((m) => d.modules[m].enabled)
        const fresh = createSeed(enabled, d.facility.region)
        Object.assign(d, fresh, { onboarded: d.onboarded, session: d.session, facility: d.facility })
      })
    },

    /** Back to first-run (choose facility type again). */
    restartOnboarding() {
      set((d) => {
        Object.assign(d, createSeed(undefined, d.facility.region), { onboarded: false })
      })
    },
  }
}
