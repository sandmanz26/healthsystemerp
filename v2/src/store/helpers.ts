/**
 * Helpers that operate on an Immer draft of the data. Actions compose these so that
 * cross-module side effects (charges, audit, interface messages, notifications) live in one place.
 */
import { TARIFFS, type TariffKey } from "@v2/domain/catalog"
import type { ModuleId } from "@v2/domain/modules"
import type { Region } from "@v2/domain/region"
import type { Charge, Encounter, IntegrationId, Invoice, Notification, RoleId } from "@v2/domain/types"
import { dayKey } from "@v2/lib/format"
import { uid } from "@v2/lib/id"
import type { HospitalData } from "./schema"

export type Draft = HospitalData
export type SetFn = (recipe: (draft: Draft) => void) => void
export type GetFn = () => HospitalData

export const nowIso = () => new Date().toISOString()

export const isOn = (d: Draft, id: ModuleId) => d.modules[id]?.enabled ?? false

export const regionOf = (d: Draft): Region => d.facility.region

export function audit(d: Draft, action: string, target: string, breakGlass?: { reason: string }) {
  d.audit.unshift({ id: uid("au"), at: nowIso(), userId: d.session.userId, action, target, breakGlass })
  // Keep the client-side log bounded; the real system ships entries to the server (WORM storage).
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

export function nextAccountNumber(d: Draft): string {
  d.accountCounter += 1
  return regionOf(d) === "us" ? `70${String(d.accountCounter).padStart(8, "0")}` : `SP${String(d.accountCounter).padStart(8, "0")}`
}

export function ensureInvoice(d: Draft, enc: Encounter): Invoice {
  let inv = d.invoices.find((i) => i.encounterId === enc.id && i.status !== "void")
  if (!inv) {
    d.invoiceCounter += 1
    inv = {
      id: uid("inv"),
      number: `${regionOf(d) === "us" ? "HB" : "INV"}-${dayKey().replaceAll("-", "").slice(2)}-${String(d.invoiceCounter).padStart(5, "0")}`,
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
  inv.charges.push({ ...c, revCode: regionOf(d) === "us" ? c.revCode : undefined, id: uid("ch"), at: nowIso() })
}

export function addTariff(d: Draft, enc: Encounter, key: TariffKey, qty = 1) {
  const t = TARIFFS[key]
  addCharge(d, enc, { category: t.category, description: t.description, code: "code" in t ? t.code : undefined, revCode: "revCode" in t ? t.revCode : undefined, qty, price: t.price[regionOf(d)], ref: key })
}

/** Which module owns an interface. */
const INTERFACE_MODULE: Record<IntegrationId, ModuleId> = {
  hl7v2: "interop",
  fhir: "interop",
  sus: "interop",
  iis: "interop",
  x12: "payer",
  surescripts: "payer",
  pds: "payer",
  eps: "payer",
  "gp-connect": "payer",
}

/** Queue an outbound interface message; a no-op when the owning module is off. */
export function queueSync(d: Draft, integration: IntegrationId, resource: string, ref: string) {
  if (!isOn(d, INTERFACE_MODULE[integration])) return
  d.syncJobs.unshift({ id: uid("sync"), integration, resource, ref, status: "pending", at: nowIso(), attempts: 0 })
}

export function nextQueueNumber(d: Draft, unitId: string, prefix: string): string {
  const key = `${dayKey()}:${unitId}`
  d.queueCounters[key] = (d.queueCounters[key] ?? 0) + 1
  return `${prefix}${String(d.queueCounters[key]).padStart(prefix === "ED" ? 2 : 3, "0")}`
}

export const CLINICAL_ROLES: RoleId[] = ["doctor", "nurse"]
