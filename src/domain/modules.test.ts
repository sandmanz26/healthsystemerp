import { describe, expect, it } from "vitest"
import { FACILITY_PRESETS, MODULES, MODULE_MAP, blockersForDisable, missingForEnable, requiredClosure, withDependencies, withoutDependents, type ModuleId } from "./modules"

describe("module dependencies", () => {
  it("has no unknown or circular requirements", () => {
    for (const m of MODULES) {
      for (const r of m.requires) expect(MODULE_MAP[r], `${m.id} requires ${r}`).toBeDefined()
      expect(requiredClosure(m.id)).not.toContain(m.id)
    }
  })
  it("resolves transitive requirements", () => {
    expect(new Set(requiredClosure("claims"))).toEqual(new Set(["billing", "registration", "emr"]))
    expect(missingForEnable("claims", new Set<ModuleId>(["registration"]))).toEqual(expect.arrayContaining(["billing", "emr"]))
  })
  it("blocks disabling a module others need", () => {
    const on = new Set<ModuleId>(["registration", "emr", "outpatient"])
    expect(blockersForDisable("emr", on)).toEqual(["outpatient"])
    expect(blockersForDisable("outpatient", on)).toEqual([])
  })
  it("adds and removes dependency chains in the onboarding picker", () => {
    expect(withDependencies(["outpatient"])).toEqual(new Set(["outpatient", "registration", "emr"]))
    expect(withoutDependents("emr", ["registration", "emr", "outpatient", "pharmacy"])).toEqual(new Set(["registration"]))
  })
  it("every preset is closed under its requirements", () => {
    for (const p of FACILITY_PRESETS) {
      const start = new Set(p.start)
      for (const id of p.start) for (const r of requiredClosure(id)) expect(start.has(r) || MODULE_MAP[r].core, `${p.id}: ${id} needs ${r}`).toBe(true)
    }
  })
})
