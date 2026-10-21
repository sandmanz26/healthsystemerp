/**
 * Helpers that operate on an Immer draft of the data. Actions compose these so that
 * cross-module side effects (charges, audit, sync jobs, notifications) live in one place.
 */
import { TARIFFS } from "@/domain/catalog"
import type { ModuleId } from "@/domain/modules"
import type { Charge, Encounter, Invoice, Notification, RoleId, SyncJob } from "@/domain/types"
import { dayKey } from "@/lib/format"
import { uid } from "@/lib/id"
import type { HospitalData } from "./schema"

export type Draft = HospitalData
export type SetFn = (recipe: (draft: Draft) => void) => void
export type GetFn = () => HospitalData

export const nowIso = () => new Date().toISOString()

export const isOn = (d: Draft, id: ModuleId) => d.modules[id]?.enabled ?? false

export function audit(d: Draft, action: string, target: string) {
  d.audit.unshift({ id: uid("au"), at: nowIso(), userId: d.session.userId, action, target })
  // Keep the client-side log bounded; the real system ships entries to the server.
  if (d.audit.length > 500) d.audit.length = 500
}

export function notify(d: Draft, n: Omit<Notification, "id" | "at" | "read">) {
  d.notifications.unshift({ ...n, id: uid("nt"), at: nowIso(), read: false })
}

export function findEncounter(d: Draft, id: string): Encounter {
  const enc = d.encounters.find((e) => e.id === id)
  if (!enc) throw new Error(`Encounter ${id} not found`)
  return enc
}

export function patientName(d: Draft, patientId: string): string {
  return d.patients.find((p) => p.id === patientId)?.name ?? patientId
}

export function ensureInvoice(d: Draft, enc: Encounter): Invoice {
  let inv = d.invoices.find((i) => i.encounterId === enc.id && i.status !== "void")
  if (!inv) {
    d.invoiceCounter += 1
    inv = {
      id: uid("inv"),
      number: `INV/${dayKey().replaceAll("-", "")}/${String(d.invoiceCounter).padStart(5, "0")}`,
      encounterId: enc.id,
      patientId: enc.patientId,
      payer: enc.payer,
      charges: [],
      payments: [],
      status: "open",
      createdAt: nowIso(),
    }
    d.invoices.push(inv)
  }
  return inv
}

export function addCharge(d: Draft, enc: Encounter, c: Omit<Charge, "id" | "at">) {
  const inv = ensureInvoice(d, enc)
  inv.charges.push({ ...c, id: uid("ch"), at: nowIso() })
}

export function addTariff(d: Draft, enc: Encounter, key: keyof typeof TARIFFS, qty = 1) {
  const t = TARIFFS[key]
  addCharge(d, enc, { category: t.category, description: t.description, qty, price: t.price, ref: key })
}

/** Queue an integration job; a no-op when the integration module is off. */
export function queueSync(d: Draft, integration: SyncJob["integration"], resource: string, ref: string) {
  const module: ModuleId = integration === "satusehat" ? "satusehat" : "bpjs"
  if (!isOn(d, module)) return
  d.syncJobs.unshift({ id: uid("sync"), integration, resource, ref, status: "pending", at: nowIso(), attempts: 0 })
}

export function nextQueueNumber(d: Draft, unitId: string, prefix: string): string {
  const key = `${dayKey()}:${unitId}`
  d.queueCounters[key] = (d.queueCounters[key] ?? 0) + 1
  return `${prefix}${String(d.queueCounters[key]).padStart(3, "0")}`
}

export const CLINICAL_ROLES: RoleId[] = ["doctor", "nurse"]
