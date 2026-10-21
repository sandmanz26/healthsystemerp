/**
 * Derived data hooks. Keep components thin: anything computed from more than one
 * collection lives here.
 */
import { useMemo } from "react"
import { MODULE_MAP, type ModuleId } from "@/domain/modules"
import type { Encounter, InventoryItem, Patient, Staff } from "@/domain/types"
import { useStore } from "./index"
import type { HospitalData } from "./schema"

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
      return n(active.filter((e) => e.kind === "outpatient").length, "kunjungan rawat jalan belum selesai")
    case "emergency":
      return n(active.filter((e) => e.kind === "emergency").length, "pasien masih di IGD")
    case "inpatient":
      return n(d.beds.filter((b) => b.status === "occupied").length, "pasien sedang dirawat inap")
    case "nursing":
      return n(d.mar.filter((m) => m.status === "due").length, "jadwal pemberian obat belum dikonfirmasi")
    case "surgery":
      return n(d.surgeries.filter((s) => s.status !== "done" && s.status !== "cancelled").length, "operasi terjadwal / berjalan")
    case "laboratory":
    case "radiology": {
      const kind = id === "laboratory" ? "lab" : "rad"
      return n(d.orders.filter((o) => o.kind === kind && o.status !== "validated" && o.status !== "cancelled").length, "order belum divalidasi")
    }
    case "pharmacy":
      return n(d.prescriptions.filter((p) => p.status === "new" || p.status === "reviewed" || p.status === "prepared").length, "resep belum diserahkan")
    case "billing":
      return n(d.invoices.filter((i) => i.status === "open" && i.payer === "umum").length, "tagihan belum lunas")
    case "claims":
      return n(d.claims.filter((c) => c.status !== "paid" && c.status !== "approved").length, "klaim belum selesai")
    case "inventory":
      return n(d.purchases.filter((p) => p.status === "submitted" || p.status === "approved").length, "permintaan pembelian berjalan")
    case "appointments":
      return n(d.appointments.filter((a) => a.status === "booked").length, "janji temu terjadwal")
    case "bpjs":
    case "satusehat": {
      const integration = id === "satusehat" ? ["satusehat"] : ["bpjs-vclaim", "bpjs-antrean"]
      return n(d.syncJobs.filter((j) => integration.includes(j.integration) && j.status !== "synced").length, "data belum terkirim")
    }
    case "quality":
      return n(d.incidents.filter((i) => i.status !== "selesai").length, "laporan insiden belum selesai")
    default:
      return []
  }
}
