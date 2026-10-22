/**
 * Derived data hooks. Keep components thin: anything computed from more than one
 * collection lives here.
 */
import { useMemo } from "react"
import { MODULE_MAP, type ModuleId } from "@/domain/modules"
import type { Encounter, InventoryItem, Patient, Staff } from "@/domain/types"
import { useStore } from "./index"
import type { HospitalData } from "./schema"
import type { Region } from "@/domain/region"

export function useModuleEnabled(id: ModuleId): boolean {
  return useStore((s) => s.modules[id]?.enabled ?? false)
}

export function useEnabledModules(): Set<ModuleId> {
  const modules = useStore((s) => s.modules)
  return useMemo(() => new Set((Object.keys(modules) as ModuleId[]).filter((id) => modules[id].enabled || MODULE_MAP[id]?.core)), [modules])
}

export function useSession() {
  const session = useStore((s) => s.session)
  const staff = useStore((s) => s.staff)
  const user = staff.find((x) => x.id === session.userId)
  return { ...session, user }
}

export function usePatientMap(): Map<string, Patient> {
  const patients = useStore((s) => s.patients)
  return useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients])
}

export function useStaffMap(): Map<string, Staff> {
  const staff = useStore((s) => s.staff)
  return useMemo(() => new Map(staff.map((p) => [p.id, p])), [staff])
}

export function useUnitName(): (id: string | undefined) => string {
  const units = useStore((s) => s.units)
  return useMemo(() => {
    const m = new Map(units.map((u) => [u.id, u.name]))
    return (id) => (id ? m.get(id) ?? id : "-")
  }, [units])
}

export function useInventoryMap(): Map<string, InventoryItem> {
  const inventory = useStore((s) => s.inventory)
  return useMemo(() => new Map(inventory.map((i) => [i.id, i])), [inventory])
}

export function useEncounter(id: string | undefined): Encounter | undefined {
  return useStore((s) => s.encounters.find((e) => e.id === id))
}

export const stockOf = (item: InventoryItem) => item.batches.reduce((sum, b) => sum + b.qty, 0)

/** Active = not finished or cancelled. */
export const isActive = (e: Encounter) => e.status !== "finished" && e.status !== "cancelled"

/**
 * Work still open in a module. Shown before a module is switched off: the data is kept,
 * but the people doing that work lose the screen — they should finish or hand over first.
 */
export function inFlightWork(d: HospitalData, id: ModuleId): string[] {
  const n = (count: number, label: string) => (count > 0 ? [`${count} ${label}`] : [])
  const active = d.encounters.filter(isActive)
  switch (id) {
    case "registration":
    case "outpatient":
      return n(active.filter((e) => e.kind === "outpatient").length, "clinic visit(s) still open")
    case "emergency":
      return n(active.filter((e) => e.kind === "emergency").length, "patient(s) still in the ED")
    case "inpatient":
      return n(d.beds.filter((b) => b.status === "occupied").length, "inpatient(s) in a bed")
    case "nursing":
      return n(d.mar.filter((m) => m.status === "due").length, "eMAR dose(s) not yet documented")
    case "surgery":
      return n(d.surgeries.filter((s) => s.status !== "done" && s.status !== "cancelled").length, "case(s) scheduled or in progress")
    case "laboratory":
    case "radiology": {
      const kind = id === "laboratory" ? "lab" : "rad"
      return n(d.orders.filter((o) => o.kind === kind && o.status !== "validated" && o.status !== "cancelled").length, "order(s) not yet verified")
    }
    case "pharmacy":
      return n(d.prescriptions.filter((p) => p.status === "new" || p.status === "reviewed" || p.status === "prepared").length, "order(s) not yet dispensed")
    case "billing":
      return n(d.invoices.filter((i) => i.status === "open" && (i.payer === "self-pay" || i.payer === "overseas")).length, "open self-pay account(s)")
    case "claims":
      return n(d.claims.filter((c) => c.status !== "paid" && c.status !== "accepted").length, "claim(s) in progress")
    case "inventory":
      return n(d.purchases.filter((p) => p.status === "submitted" || p.status === "approved").length, "purchase request(s) open")
    case "appointments":
      return n(d.appointments.filter((a) => a.status === "booked").length, "booked appointment(s)")
    case "payer":
    case "interop": {
      const integrations = id === "interop" ? ["hl7v2", "fhir", "sus", "iis"] : ["x12", "surescripts", "pds", "eps", "gp-connect"]
      return n(d.syncJobs.filter((j) => integrations.includes(j.integration) && j.status !== "synced").length, "message(s) not yet delivered")
    }
    case "quality":
      return n(d.incidents.filter((i) => i.status !== "closed").length, "incident report(s) open")
    default:
      return []
  }
}

/** The facility's market pack (US or UK/EU). */
export function useRegion(): Region {
  return useStore((s) => s.facility.region)
}
