/**
 * Builds the demo dataset relative to "now", so the demo always looks like a live hospital
 * day regardless of when it is opened. Deterministic for a given day (seeded PRNG).
 */
import { ICD10, ICD9CM, LAB_MAP, RAD_MAP, TARIFFS } from "@/domain/catalog"
import { flagResult } from "@/domain/clinical"
import { estimateGroup } from "@/domain/finance"
import { MODULES, type ModuleId } from "@/domain/modules"
import { INM, riskGrade } from "@/domain/quality"
import type {
  Appointment, AuditEntry, Bed, Charge, Claim, ClaimStatus, ClinicalNote, Diagnosis, Encounter, EncounterStatus, Incident,
  IndicatorValue, InventoryItem, Invoice, MarEntry, Notification, Patient, PayerType, Prescription, PrescriptionStatus,
  RosterEntry, ServiceOrder, ShiftCode, Surgery, SyncJob, Vitals,
} from "@/domain/types"
import { dayKey } from "@/lib/format"
import { createRandom, type Random } from "@/lib/random"
import { DATA_VERSION, type HospitalData, type ModuleState } from "@/store/schema"
import { INVENTORY, SCHEDULE_TEMPLATE, STAFF, UNITS, WARD_LAYOUT } from "./master"
import { ER_SCENARIOS, INPATIENT_SCENARIOS, OUTPATIENT_SCENARIOS, type Scenario } from "./scenarios"

const FIRST_M = ["Ahmad", "Budi", "Dedi", "Eko", "Fajar", "Gilang", "Hadi", "Irfan", "Joko", "Kurniawan", "Lukman", "Muhammad", "Nanda", "Rizal", "Slamet", "Taufik", "Wawan", "Yoga", "Asep", "Ujang"]
const FIRST_F = ["Ani", "Bunga", "Citra", "Dewi", "Endah", "Fitri", "Gita", "Hana", "Indah", "Kartini", "Lina", "Mega", "Nur", "Putri", "Rahayu", "Sri", "Tuti", "Wulan", "Yanti", "Euis"]
const LAST = ["Saputra", "Wijaya", "Hidayat", "Lestari", "Pratama", "Kusuma", "Nugroho", "Rahmawati", "Setiawan", "Sulistyo", "Hermawan", "Purnomo", "Suryadi", "Gunawan", "Siregar", "Nasution", "Simanjuntak", "Sihombing", "Permana", "Sunarya"]
const STREETS = ["Jl. Dago", "Jl. Cihampelas", "Jl. Buah Batu", "Jl. Soekarno-Hatta", "Jl. Pasteur", "Jl. Setiabudi", "Jl. Antapani", "Jl. Cibaduyut", "Jl. Kopo", "Jl. Ujungberung"]
const ALLERGIES = [
  { substance: "Penisilin", reaction: "Ruam & gatal", severity: "sedang" as const },
  { substance: "Sulfa", reaction: "Sesak napas", severity: "berat" as const },
  { substance: "Ibuprofen", reaction: "Bengkak bibir", severity: "sedang" as const },
  { substance: "Seafood", reaction: "Urtikaria", severity: "ringan" as const },
]

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

interface Ctx {
  rng: Random
  now: number
  data: HospitalData
  /** Patients with an active encounter today — nobody is in two places at once. */
  active: Set<string>
}

const isoAt = (ms: number) => new Date(ms).toISOString()

function makePatients(rng: Random, now: number): Patient[] {
  const patients: Patient[] = []
  for (let i = 0; i < 160; i++) {
    const gender = rng.chance(0.5) ? "male" : "female"
    const first = rng.pick(gender === "male" ? FIRST_M : FIRST_F)
    // Children are ~15% of the population of a general hospital.
    const ageYears = rng.chance(0.18) ? rng.int(0, 12) : rng.int(18, 82)
    const birth = new Date(now - ageYears * 365.25 * DAY - rng.int(0, 364) * DAY)
    const payerRoll = rng.next()
    const payer: PayerType = payerRoll < 0.68 ? "bpjs" : payerRoll < 0.86 ? "umum" : "asuransi"
    patients.push({
      id: `pt${i + 1}`,
      mrn: String(102340 + i * 7).padStart(6, "0"),
      nik: `3273${String(rng.int(10, 99))}${birth.getDate().toString().padStart(2, "0")}${String(birth.getMonth() + 1).padStart(2, "0")}${String(birth.getFullYear()).slice(2)}${String(rng.int(1, 9999)).padStart(4, "0")}`,
      name: `${first} ${rng.pick(LAST)}`,
      gender,
      birthDate: birth.toISOString(),
      phone: `08${rng.int(11, 99)}-${rng.int(1000, 9999)}-${rng.int(1000, 9999)}`,
      address: `${rng.pick(STREETS)} No. ${rng.int(1, 220)}, Bandung`,
      bloodType: rng.pick(["A", "B", "AB", "O"] as const),
      allergies: rng.chance(0.14) ? [rng.pick(ALLERGIES)] : [],
      payer,
      bpjsNumber: payer === "bpjs" ? `000${rng.int(1000000000, 9999999999)}` : undefined,
      bpjsClass: payer === "bpjs" ? rng.pick([1, 2, 3, 3, 3] as const) : undefined,
      insurer: payer === "asuransi" ? rng.pick(["Prudential", "Allianz", "AXA Mandiri", "Admedika"]) : undefined,
      createdAt: isoAt(now - rng.int(30, 1500) * DAY),
    })
  }
  return patients
}

const ageYears = (p: Patient, now: number) => (now - new Date(p.birthDate).getTime()) / (365.25 * DAY)

/** Whether a scenario can plausibly happen to this patient (no C-sections for men). */
function fits(p: Patient, s: Scenario, now: number): boolean {
  const age = ageYears(p, now)
  const who = s.who ?? {}
  // Adult unless the scenario says otherwise (a paediatric case sets only maxAge).
  const minAge = who.minAge ?? (who.maxAge !== undefined ? 0 : 15)
  return (!who.sex || who.sex === p.gender) && age >= minAge && age <= (who.maxAge ?? 200)
}

/** Picks a patient who fits the scenario; `used` keeps one active encounter per patient. */
function pickPatient(ctx: Ctx, pool: Patient[], s: Scenario, used?: Set<string>): Patient {
  const free = pool.filter((p) => !used?.has(p.id))
  const candidates = free.filter((p) => fits(p, s, ctx.now))
  const p = ctx.rng.pick(candidates.length ? candidates : free)
  used?.add(p.id)
  return p
}

function makeBeds(): Bed[] {
  return WARD_LAYOUT.flatMap((w) =>
    Array.from({ length: w.count }, (_, i) => ({
      id: `${w.prefix}-${String(i + 1).padStart(2, "0")}`,
      unitId: w.unitId,
      code: `${w.prefix}-${String(i + 1).padStart(2, "0")}`,
      bedClass: w.bedClass,
      status: "available" as const,
    })),
  )
}

const NORMAL = { systolic: 122, diastolic: 78, heartRate: 82, respRate: 18, temperature: 36.8, spo2: 97 }

/**
 * Vital signs for a scenario. `progress` moves values toward normal (1 = fully recovered)
 * or away from it (negative = deteriorating), so trends on charts make clinical sense.
 */
function vitalsFrom(s: Scenario, at: number, by: string, rng: Random, progress = 0): Vitals {
  const blend = (key: keyof typeof NORMAL, spread: number, decimals = 0) => {
    const base = s.vitals[key] as number | undefined
    if (base === undefined) return undefined
    const target = NORMAL[key]
    const v = base + (target - base) * progress + (rng.next() - 0.5) * spread
    const f = 10 ** decimals
    return Math.round(v * f) / f
  }
  return {
    id: `v${at}${rng.int(100, 999)}`,
    at: isoAt(at),
    by,
    systolic: blend("systolic", 8),
    diastolic: blend("diastolic", 6),
    heartRate: blend("heartRate", 8),
    respRate: blend("respRate", 2),
    temperature: blend("temperature", 0.4, 1),
    spo2: (() => {
      const v = blend("spo2", 2)
      return v === undefined ? undefined : Math.min(100, v)
    })(),
    onOxygen: s.vitals.onOxygen && progress < 0.6,
    consciousness: progress >= 0.8 ? "A" : (s.vitals.consciousness ?? "A"),
    painScore: s.vitals.painScore === undefined ? undefined : Math.max(0, Math.round(s.vitals.painScore * (1 - Math.max(0, progress) * 0.6))),
    weight: s.vitals.weight,
  }
}

function diagnosesFrom(s: Scenario): Diagnosis[] {
  const find = (code: string) => ICD10.find((c) => c.code === code)!
  return [s.dx, ...(s.extraDx ?? [])].map((code, i) => ({ code, display: find(code).display, primary: i === 0 }))
}

function noteFrom(s: Scenario, at: number, authorId: string): ClinicalNote {
  return { id: `n${at}${authorId}`, at: isoAt(at), authorId, role: "doctor", subjective: s.s, objective: s.o, assessment: s.a, plan: s.p }
}

/** Starts an invoice for an encounter. Charges are pushed by the generators below. */
function openInvoice(ctx: Ctx, enc: Encounter): Invoice {
  ctx.data.invoiceCounter += 1
  const inv: Invoice = {
    id: `i${enc.id}`,
    number: `INV/${dayKey(enc.createdAt).replaceAll("-", "")}/${String(ctx.data.invoiceCounter).padStart(5, "0")}`,
    encounterId: enc.id,
    patientId: enc.patientId,
    payer: enc.payer,
    charges: [],
    payments: [],
    status: "open",
    createdAt: enc.createdAt,
  }
  ctx.data.invoices.push(inv)
  return inv
}

function charge(inv: Invoice, at: number, c: Omit<Charge, "id" | "at">) {
  inv.charges.push({ ...c, id: `${inv.id}.${inv.charges.length + 1}`, at: isoAt(at) })
}

function tariff(inv: Invoice, at: number, key: keyof typeof TARIFFS, qty = 1) {
  const t = TARIFFS[key]
  charge(inv, at, { category: t.category, description: t.description, qty, price: t.price, ref: key })
}

function addOrders(ctx: Ctx, enc: Encounter, s: Scenario, at: number, status: ServiceOrder["status"], doctorId: string) {
  const { rng } = ctx
  const inv = ctx.data.invoices.find((i) => i.encounterId === enc.id)
  const mk = (kind: "lab" | "rad", codes: string[]): ServiceOrder => {
    const resulted = status === "resulted" || status === "validated"
    const order: ServiceOrder = {
      id: `${kind}-${enc.id}`,
      kind,
      encounterId: enc.id,
      patientId: enc.patientId,
      testCodes: codes,
      priority: enc.kind === "emergency" || rng.chance(0.15) ? "cito" : "rutin",
      clinicalNote: s.a,
      status,
      orderedBy: doctorId,
      orderedAt: isoAt(at),
      collectedAt: status !== "ordered" ? isoAt(at + 15 * MIN) : undefined,
      resultedAt: resulted ? isoAt(at + 70 * MIN) : undefined,
      validatedBy: status === "validated" ? (kind === "lab" ? "d11" : "d10") : undefined,
      results: [],
    }
    if (kind === "lab" && resulted) order.results = codes.map((code) => labValue(code, s, rng))
    if (kind === "rad" && resulted) order.report = radReport(codes[0], s)
    if (inv)
      for (const code of codes) {
        const def = kind === "lab" ? LAB_MAP[code] : RAD_MAP[code]
        charge(inv, at, { category: kind === "lab" ? "laboratorium" : "radiologi", description: def.name, qty: 1, price: def.price, ref: order.id })
      }
    return order
  }
  if (s.labs?.length) ctx.data.orders.push(mk("lab", s.labs))
  if (s.rads?.length) ctx.data.orders.push(mk("rad", s.rads))
}

/** Lab values consistent with the scenario's diagnosis (dengue → low platelets, etc). */
function labValue(code: string, s: Scenario, rng: Random) {
  const t = LAB_MAP[code]
  const mid = t.low !== undefined && t.high !== undefined ? (t.low + t.high) / 2 : 1
  let value: string
  if (code === "TROMBO" && (s.dx === "A91" || s.dx === "A90")) value = String(rng.int(38, 98))
  else if (code === "HT" && s.dx === "A91") value = String(rng.int(48, 53))
  else if (code === "GDS" && s.dx.startsWith("E11")) value = String(rng.int(260, 480))
  else if (code === "GDP" && s.dx.startsWith("E11")) value = String(rng.int(140, 210))
  else if (code === "HBA1C" && s.dx.startsWith("E11")) value = (rng.int(72, 98) / 10).toFixed(1)
  else if (code === "K" && (s.dx === "N18.5" || s.dx === "I50.9")) value = (rng.int(58, 69) / 10).toFixed(1)
  else if ((code === "UR" || code === "CR") && s.dx === "N18.5") value = code === "UR" ? String(rng.int(160, 220)) : (rng.int(78, 95) / 10).toFixed(1)
  else if (code === "TROP" && (s.dx === "I21.9" || s.dx === "I20.9")) value = (rng.int(8, 60) / 100).toFixed(2)
  else if (code === "LEU" && (s.dx === "R10.4" || s.dx === "K35.8")) value = (rng.int(132, 178) / 10).toFixed(1)
  else if (code === "CHOL" && s.dx === "E78.5") value = String(rng.int(238, 290))
  else if (code === "NS1") value = s.dx === "A90" || s.dx === "A91" ? "Positif" : "Negatif"
  else if (code === "WIDAL") value = "S. Typhi O 1/320"
  else if (code === "UL") value = "Leukosit 10–15/LPB"
  else value = (mid * (0.9 + rng.next() * 0.2)).toFixed(t.high && t.high < 10 ? 1 : 0)
  return { testCode: code, value, flag: flagResult(code, value) }
}

function radReport(code: string, s: Scenario): string {
  if (code === "XR-THX") return "Tampak infiltrat di lapang bawah paru kanan. Sinus kostofrenikus tajam. Jantung tidak membesar.\nKesan: pneumonia lobus inferior dekstra."
  if (code === "CT-HEAD") return "Tampak area hipodens di teritori arteri serebri media kiri. Tidak tampak perdarahan intrakranial.\nKesan: infark serebri akut di teritori ACM sinistra."
  if (code === "US-ABD") return s.dx === "K80.2" ? "Kandung empedu berisi batu multipel ukuran terbesar 1,2 cm, dinding tidak menebal.\nKesan: kolelitiasis." : "Tampak struktur tubular non-kompresibel diameter 9 mm di fossa iliaka kanan.\nKesan: sesuai apendisitis akut."
  if (code === "XR-EXT") return "Tampak garis fraktur komplit di regio yang diperiksa dengan angulasi ringan.\nKesan: fraktur tertutup."
  if (code === "US-OBS") return "Janin tunggal hidup intrauterin, presentasi kepala, biometri sesuai usia kehamilan 28 minggu. Plasenta di korpus posterior.\nKesan: kehamilan normal."
  return "Dalam batas normal."
}

function addPrescription(ctx: Ctx, enc: Encounter, s: Scenario, at: number, status: PrescriptionStatus, doctorId: string): Prescription | undefined {
  if (!s.drugs?.length) return undefined
  const rx: Prescription = {
    id: `rx-${enc.id}`,
    encounterId: enc.id,
    patientId: enc.patientId,
    items: s.drugs.map(([itemId, dose, frequency, route, days, qty]) => ({ itemId, dose, frequency, route, days, qty })),
    status,
    prescribedBy: doctorId,
    prescribedAt: isoAt(at),
    reviewedBy: status !== "new" ? "p1" : undefined,
    dispensedAt: status === "dispensed" ? isoAt(at + 40 * MIN) : undefined,
  }
  ctx.data.prescriptions.push(rx)
  const inv = ctx.data.invoices.find((i) => i.encounterId === enc.id)
  if (status === "dispensed" && inv)
    for (const line of rx.items) {
      const item = ctx.data.inventory.find((x) => x.id === line.itemId)!
      charge(inv, at + 40 * MIN, { category: "obat", description: item.name, qty: line.qty, price: item.price, ref: rx.id })
    }
  return rx
}

function closeFinance(ctx: Ctx, enc: Encounter, at: number, settle: boolean) {
  const inv = ctx.data.invoices.find((i) => i.encounterId === enc.id)
  if (!inv) return
  const total = inv.charges.reduce((sum, c) => sum + c.qty * c.price, 0)
  if (enc.payer === "umum") {
    if (settle) {
      inv.payments.push({ id: `pay-${inv.id}`, at: isoAt(at), method: ctx.rng.pick(["tunai", "qris", "debit"] as const), amount: total, by: "c1" })
      inv.status = "paid"
      inv.closedAt = isoAt(at)
    }
    return
  }
  inv.status = "claim"
  inv.closedAt = isoAt(at)
  const ageDays = (ctx.now - at) / DAY
  const r = ctx.rng.next()
  // Typical casemix pipeline: recent claims are still being coded, older ones are paid,
  // and roughly one in ten comes back "pending" from the verifier.
  const status: ClaimStatus = !settle
    ? "draft"
    : ageDays > 20
      ? r < 0.7 ? "paid" : r < 0.9 ? "approved" : "pending"
      : ageDays > 7
        ? r < 0.5 ? "submitted" : r < 0.82 ? "approved" : r < 0.95 ? "pending" : "rejected"
        : r < 0.4 ? "draft" : r < 0.7 ? "coded" : "submitted"
  // JKN claims are grouped (iDRG since Oct 2025); private insurers pay per item (fee-for-service).
  const grouper = enc.payer === "bpjs" ? "iDRG" : "FFS"
  const group = status === "draft" || grouper === "FFS" ? null : estimateGroup(enc, grouper)
  const claim: Claim = {
    id: `clm-${enc.id}`,
    encounterId: enc.id,
    invoiceId: inv.id,
    payer: enc.payer,
    grouper,
    groupCode: group?.code,
    groupName: group?.name,
    tariff: grouper === "FFS" ? (status === "draft" ? undefined : total) : group?.tariff,
    status,
    note: status === "pending" ? "Konfirmasi: lampirkan hasil penunjang yang mendukung diagnosis sekunder" : status === "rejected" ? "Diagnosis utama tidak sesuai resume medis" : undefined,
    updatedAt: isoAt(Math.min(ctx.now, at + ctx.rng.int(1, 6) * DAY)),
  }
  ctx.data.claims.push(claim)
}

/** SEP format: kode faskes (4) + "R" + 3 + MMYY + "V" + 6-digit sequence. */
function sepNumber(at: number, seed: string): string {
  const d = new Date(at)
  const seq = [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 999983, 7)
  return `3273R001${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getFullYear()).slice(2)}V${String(seq).padStart(6, "0")}`
}

function baseEncounter(id: string, patient: Patient, kind: Encounter["kind"], unitId: string, practitionerId: string, createdAt: number, status: EncounterStatus, s: Scenario): Encounter {
  return {
    id,
    kind,
    patientId: patient.id,
    unitId,
    practitionerId,
    payer: patient.payer,
    status,
    createdAt: isoAt(createdAt),
    chiefComplaint: s.complaint,
    diagnoses: [],
    procedures: [],
    notes: [],
    vitals: [],
    handovers: [],
    satusehat: "pending",
    sepNumber: patient.payer === "bpjs" ? sepNumber(createdAt, id) : undefined,
  }
}

const doctorFor = (unitId: string) => STAFF.find((s) => s.role === "doctor" && s.unitId === unitId)?.id ?? "d1"

/** Historical outpatient & ER visits for the last 30 days — they feed reports and claims. */
function makeHistory(ctx: Ctx, patients: Patient[]) {
  const { rng, now, data } = ctx
  const polis = Object.keys(OUTPATIENT_SCENARIOS)
  let n = 0
  for (let day = 30; day >= 1; day--) {
    // Clinics are closed on Sunday; weekdays are busy (matches today's volume).
    const sunday = new Date(now - day * DAY).getDay() === 0
    const visits = sunday ? 0 : rng.int(14, 20)
    for (let v = 0; v < visits; v++) {
      const unitId = rng.pick([...polis, "poli-umum", "poli-umum", "poli-dalam"])
      const s = rng.pick(OUTPATIENT_SCENARIOS[unitId])
      const patient = pickPatient(ctx, patients, s)
      const start = now - day * DAY - rng.int(2, 9) * HOUR
      const doc = doctorFor(unitId)
      const enc = baseEncounter(`h${++n}`, patient, "outpatient", unitId, doc, start, "finished", s)
      Object.assign(enc, { startedAt: isoAt(start + 35 * MIN), endedAt: isoAt(start + 50 * MIN), diagnoses: diagnosesFrom(s), disposition: rng.chance(0.3) ? "kontrol" : "pulang", satusehat: rng.chance(0.93) ? "synced" : "failed" })
      enc.notes.push(noteFrom(s, start + 45 * MIN, doc))
      enc.vitals.push(vitalsFrom(s, start + 20 * MIN, "n5", rng))
      data.encounters.push(enc)
      const inv = openInvoice(ctx, enc)
      tariff(inv, start, "admin")
      tariff(inv, start + 45 * MIN, unitId === "poli-umum" || unitId === "poli-gigi" ? "konsul-umum" : "konsul-spesialis")
      addOrders(ctx, enc, s, start + 46 * MIN, "validated", doc)
      addPrescription(ctx, enc, s, start + 47 * MIN, "dispensed", doc)
      closeFinance(ctx, enc, start + 2 * HOUR, true)
    }
    for (let k = rng.int(3, 6); k > 0; k--) {
      const s = rng.pick(ER_SCENARIOS)
      const patient = pickPatient(ctx, patients, s)
      const start = now - day * DAY - rng.int(1, 20) * HOUR
      const enc = baseEncounter(`h${++n}`, patient, "emergency", "igd", rng.pick(["d2", "d12"]), start, "finished", s)
      Object.assign(enc, { triage: s.triage, startedAt: isoAt(start + 8 * MIN), endedAt: isoAt(start + 3 * HOUR), diagnoses: diagnosesFrom(s), procedures: (s.procedures ?? []).map((c) => ICD9CM.find((p) => p.code === c)!), disposition: "pulang", satusehat: "synced" })
      enc.notes.push(noteFrom(s, start + 20 * MIN, enc.practitionerId!))
      data.encounters.push(enc)
      const inv = openInvoice(ctx, enc)
      tariff(inv, start, "admin")
      tariff(inv, start, "igd")
      addOrders(ctx, enc, s, start + 25 * MIN, "validated", enc.practitionerId!)
      closeFinance(ctx, enc, start + 4 * HOUR, true)
    }
  }
  // Discharged inpatients (for ALOS / BOR history).
  // ~115 discharges in 30 days on 36 beds keeps historical BOR near today's occupancy.
  for (let i = 0; i < 115; i++) {
    const s = rng.pick(INPATIENT_SCENARIOS)
    const patient = pickPatient(ctx, patients, s)
    const los = rng.int(3, 8)
    const end = now - rng.int(1, 29) * DAY - rng.int(1, 6) * HOUR
    const start = end - los * DAY
    const unitId = s.unitHint
    const doc = s.doctor ?? "d3"
    const enc = baseEncounter(`hi${i}`, patient, "inpatient", unitId, doc, start, "finished", s)
    // A few deaths, mostly in ICU — keeps NDR/GDR in a believable range.
    const died = unitId === "icu" && i % 9 === 0
    Object.assign(enc, { startedAt: isoAt(start), endedAt: isoAt(end), diagnoses: diagnosesFrom(s), procedures: (s.procedures ?? []).map((c) => ICD9CM.find((p) => p.code === c)!), disposition: died ? "meninggal" : "pulang", satusehat: "synced" })
    enc.notes.push(noteFrom(s, start + 2 * HOUR, doc))
    data.encounters.push(enc)
    const inv = openInvoice(ctx, enc)
    tariff(inv, start, "admin")
    tariff(inv, end, unitId === "icu" ? "kamar-ICU" : unitId === "anggrek" ? "kamar-VIP" : "kamar-KRIS", los)
    tariff(inv, start, "konsul-spesialis", los)
    if (s.procedures?.some((p) => ["47.09", "74.1", "79.35", "51.23"].includes(p))) tariff(inv, start + DAY, "operasi")
    addOrders(ctx, enc, s, start + HOUR, "validated", doc)
    addPrescription(ctx, enc, s, start + HOUR, "dispensed", doc)
    closeFinance(ctx, enc, end, true)
  }
}

/** Today's outpatient clinic: a realistic mix of finished, in-progress and waiting patients. */
function makeOutpatientToday(ctx: Ctx, patients: Patient[]) {
  const { rng, now, data } = ctx
  const plan: [string, number][] = [["poli-umum", 10], ["poli-dalam", 6], ["poli-anak", 3], ["poli-obgyn", 2], ["poli-bedah", 1], ["poli-saraf", 1], ["poli-gigi", 2]]
  const prefixes: Record<string, string> = { "poli-umum": "A", "poli-dalam": "B", "poli-anak": "C", "poli-obgyn": "D", "poli-bedah": "E", "poli-saraf": "F", "poli-gigi": "G" }
  const startOfDay = new Date(now).setHours(0, 1, 0, 0)
  const dayFit = Math.min(1, (now - startOfDay) / (190 * MIN))
  for (const [unitId, count] of plan) {
    const doc = doctorFor(unitId)
    for (let i = 0; i < count; i++) {
      const s = OUTPATIENT_SCENARIOS[unitId][i % OUTPATIENT_SCENARIOS[unitId].length]
      const patient = pickPatient(ctx, patients, s, ctx.active)
      // Earlier queue numbers arrived earlier and are further along. Shortly after midnight the
      // clinic day is compressed so "today" is never empty in the demo.
      const offset = (count - i) * rng.int(9, 14) * MIN + 10 * MIN
      const createdAt = now - offset * dayFit
      const share = i / count
      const status: EncounterStatus = share < 0.45 ? "finished" : share < 0.55 ? "in-progress" : share < 0.62 ? "called" : "registered"
      const enc = baseEncounter(`op${unitId}${i}`, patient, "outpatient", unitId, doc, createdAt, status, s)
      enc.queueNumber = `${prefixes[unitId]}${String(i + 1).padStart(3, "0")}`
      if (status !== "registered") enc.vitals.push(vitalsFrom(s, createdAt + 8 * MIN, "n5", rng))
      if (status === "called") enc.calledAt = isoAt(now - 1 * MIN)
      if (status === "in-progress" || status === "finished") {
        // Never later than "now", and earlier than the patient currently being called.
        enc.calledAt = isoAt(Math.min(createdAt + 20 * MIN * dayFit, now - 3 * MIN))
        enc.startedAt = isoAt(Math.min(createdAt + 22 * MIN * dayFit, now - 2 * MIN))
      }
      data.encounters.push(enc)
      const inv = openInvoice(ctx, enc)
      tariff(inv, createdAt, "admin")
      data.queueCounters[`${dayKey()}:${unitId}`] = i + 1
      if (status === "finished") {
        const t = Math.min(createdAt + 30 * MIN * dayFit, now - 2 * MIN)
        enc.endedAt = isoAt(t)
        enc.diagnoses = diagnosesFrom(s)
        enc.notes.push(noteFrom(s, t, doc))
        enc.disposition = rng.chance(0.35) ? "kontrol" : "pulang"
        enc.satusehat = rng.chance(0.7) ? "synced" : rng.chance(0.5) ? "pending" : "failed"
        tariff(inv, t, unitId === "poli-umum" || unitId === "poli-gigi" ? "konsul-umum" : "konsul-spesialis")
        const done = share < 0.25
        addOrders(ctx, enc, s, t, done ? "validated" : rng.pick(["ordered", "collected", "in-progress", "resulted"] as const), doc)
        addPrescription(ctx, enc, s, t, done ? "dispensed" : rng.pick(["new", "reviewed", "prepared"] as const), doc)
        // Umum patients who already got their drugs have paid; the rest wait at the cashier.
        closeFinance(ctx, enc, t + 45 * MIN, done)
      }
    }
  }
}

function makeEmergencyNow(ctx: Ctx, patients: Patient[]) {
  const { rng, now, data } = ctx
  const picks = [0, 2, 4, 1, 5, 6, 3, 7]
  picks.forEach((si, i) => {
    const s = ER_SCENARIOS[si]
    const patient = pickPatient(ctx, patients, s, ctx.active)
    const createdAt = now - [4, 18, 35, 52, 75, 96, 140, 190][i] * MIN * Math.min(1, (now - new Date(now).setHours(0, 1, 0, 0)) / (200 * MIN))
    const status: EncounterStatus = i === 0 ? "registered" : i === 7 ? "awaiting-admission" : i < 3 ? "triaged" : "in-progress"
    const doc = i % 2 ? "d2" : "d12"
    const enc = baseEncounter(`er${i}`, patient, "emergency", "igd", doc, createdAt, status, s)
    enc.queueNumber = `IGD-${String(i + 1).padStart(2, "0")}`
    if (status !== "registered") {
      enc.triage = s.triage
      enc.vitals.push(vitalsFrom(s, createdAt + 4 * MIN, "n3", rng))
    }
    if (status === "in-progress" || status === "awaiting-admission") {
      enc.startedAt = isoAt(createdAt + 9 * MIN)
      enc.notes.push(noteFrom(s, createdAt + 20 * MIN, doc))
      enc.diagnoses = diagnosesFrom(s)
      enc.procedures = (s.procedures ?? []).map((c) => ICD9CM.find((p) => p.code === c)!)
    }
    if (status === "awaiting-admission") {
      enc.disposition = "rawat-inap"
      enc.dispositionNote = "Rawat ICU — monitoring stroke akut"
    }
    data.encounters.push(enc)
    const inv = openInvoice(ctx, enc)
    tariff(inv, createdAt, "admin")
    tariff(inv, createdAt, "igd")
    if (status === "in-progress" || status === "awaiting-admission") {
      addOrders(ctx, enc, s, createdAt + 22 * MIN, i % 2 ? "in-progress" : "resulted", doc)
      addPrescription(ctx, enc, s, createdAt + 25 * MIN, "new", doc)
    }
  })
}

function makeInpatientsNow(ctx: Ctx, patients: Patient[]) {
  const { rng, now, data } = ctx
  const byUnit = (unitId: string) => data.beds.filter((b) => b.unitId === unitId)
  const fill: Record<string, number> = { melati: 10, mawar: 9, anggrek: 4, icu: 4 }
  let k = 0
  // Exactly two patients are getting worse: enough to show escalation, not so many that
  // the early-warning lists turn into noise (alarm fatigue is a real ward problem).
  const deterioratingDx = new Set(["I50.9", "I21.9"])
  for (const [unitId, count] of Object.entries(fill)) {
    const beds = byUnit(unitId)
    const scenarios = INPATIENT_SCENARIOS.filter((s) => s.unitHint === unitId)
    for (let i = 0; i < count; i++) {
      const bed = beds[i]
      const s = scenarios[i % scenarios.length]
      const patient = pickPatient(ctx, patients, s, ctx.active)
      const los = rng.int(1, 6)
      const start = now - los * DAY - rng.int(1, 10) * HOUR
      const doc = s.doctor ?? "d3"
      const enc = baseEncounter(`ip${k++}`, patient, "inpatient", unitId, doc, start, "in-progress", s)
      enc.startedAt = isoAt(start)
      enc.bedId = bed.id
      enc.diagnoses = diagnosesFrom(s)
      enc.procedures = (s.procedures ?? []).map((c) => ICD9CM.find((p) => p.code === c)!)
      enc.satusehat = rng.chance(0.85) ? "synced" : "failed"
      enc.notes.push(noteFrom(s, start + HOUR, doc))
      enc.notes.push({ ...noteFrom(s, now - rng.int(3, 9) * HOUR, doc), id: `n2${enc.id}` })
      // Vitals every 8 hours for the last 2 days: most patients recover, two deteriorate.
      const deteriorating = deterioratingDx.delete(s.dx)
      const nurse = STAFF.find((x) => x.role === "nurse" && x.unitId === unitId)?.id ?? "n1"
      for (let h = 48; h >= 0; h -= 8) {
        if (now - h * HOUR < start) continue
        const elapsed = (now - h * HOUR - start) / (now - start)
        enc.vitals.push(vitalsFrom(s, now - h * HOUR - 30 * MIN, nurse, rng, deteriorating ? -0.3 * elapsed : 0.15 + 0.75 * elapsed))
      }
      // Nurses write CPPT too; the DPJP has to verify those notes.
      if (i % 2 === 0)
        enc.notes.push({ id: `nn${enc.id}`, at: isoAt(now - rng.int(1, 4) * HOUR), authorId: nurse, role: "nurse", subjective: "Pasien mengeluh sulit tidur, nyeri berkurang.", objective: "TTV terlampir. Infus lancar, tidak ada tanda flebitis.", assessment: "Gangguan pola tidur; risiko jatuh sedang.", plan: "Edukasi sleep hygiene, pasang pengaman tempat tidur, observasi per shift." })
      if (i % 3 === 0)
        enc.handovers.push({
          id: `ho${enc.id}`,
          at: isoAt(now - 5 * HOUR),
          authorId: STAFF.find((x) => x.role === "nurse" && x.unitId === unitId)?.id ?? "n1",
          situation: s.a,
          background: s.s,
          assessment: deteriorating ? "Tanda vital cenderung memburuk, NEWS2 meningkat" : "Kondisi stabil",
          recommendation: deteriorating ? "Observasi tiap jam, lapor DPJP bila SpO₂ < 90%" : "Lanjutkan terapi, observasi rutin",
        })
      bed.status = "occupied"
      bed.encounterId = enc.id
      data.encounters.push(enc)
      const inv = openInvoice(ctx, enc)
      tariff(inv, start, "admin")
      tariff(inv, now, bed.bedClass === "ICU" ? "kamar-ICU" : bed.bedClass === "VIP" ? "kamar-VIP" : bed.bedClass === "VVIP" ? "kamar-VVIP" : "kamar-KRIS", los)
      tariff(inv, now, "konsul-spesialis", los)
      addOrders(ctx, enc, s, now - rng.int(2, 10) * HOUR, rng.pick(["resulted", "validated", "collected"] as const), doc)
      const rx = addPrescription(ctx, enc, s, start + 2 * HOUR, "dispensed", doc)
      if (rx) makeMar(ctx, enc, rx)
    }
  }
  // Safety markers: elderly or post-op patients are fall risks; one ICU patient is DNR.
  for (const enc of data.encounters.filter((e) => e.kind === "inpatient" && e.status === "in-progress")) {
    const p = data.patients.find((x) => x.id === enc.patientId)!
    const flags = new Set(p.flags ?? [])
    if (ageYears(p, now) >= 65 || enc.diagnoses.some((d) => ["S72.0", "I63.9"].includes(d.code))) flags.add("fall-risk")
    if (enc.unitId === "icu" && enc.diagnoses[0]?.code === "I63.9" && ageYears(p, now) >= 75) flags.add("dnr")
    p.flags = [...flags]
  }
  const stroke = data.encounters.find((e) => e.unitId === "icu" && e.status === "in-progress" && e.diagnoses[0]?.code === "I63.9")
  if (stroke) {
    const p = data.patients.find((x) => x.id === stroke.patientId)!
    p.flags = [...new Set([...(p.flags ?? []), "dnr" as const])]
  }
  // A few beds being cleaned or under maintenance — housekeeping is part of bed flow.
  const free = data.beds.filter((b) => b.status === "available")
  free[0].status = "cleaning"
  free[3].status = "cleaning"
  free[5].status = "maintenance"
  free[7].status = "reserved"
}

const FREQ_HOURS: Record<string, number[]> = { "1x1": [8], "2x1": [8, 20], "3x1": [6, 14, 22], "4x1": [6, 12, 18, 24], "Tiap 8 jam": [6, 14, 22], "Tiap 12 jam": [8, 20] }

function makeMar(ctx: Ctx, enc: Encounter, rx: Prescription) {
  const { now, data, rng } = ctx
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  for (const line of rx.items) {
    const hours = FREQ_HOURS[line.frequency]
    if (!hours) continue
    for (const h of hours) {
      const at = today.getTime() + h * HOUR
      const past = at < now - 30 * MIN
      data.mar.push({
        id: `mar-${enc.id}-${line.itemId}-${h}`,
        encounterId: enc.id,
        itemId: line.itemId,
        dose: line.dose,
        route: line.route,
        scheduledAt: isoAt(at),
        status: past ? (rng.chance(0.92) ? "given" : "held") : "due",
        by: past ? STAFF.find((x) => x.role === "nurse" && x.unitId === enc.unitId)?.id ?? "n1" : undefined,
        at: past ? isoAt(at + rng.int(0, 25) * MIN) : undefined,
        note: undefined,
      } satisfies MarEntry)
    }
  }
}

function makeAppointments(ctx: Ctx, patients: Patient[]): Appointment[] {
  const { rng, now, data } = ctx
  const out: Appointment[] = []
  const today = new Date(now)
  const opToday = data.encounters.filter((e) => e.kind === "outpatient" && dayKey(e.createdAt) === dayKey(today))
  // Most of today's clinic patients booked ahead (Mobile JKN dominates for BPJS).
  opToday.forEach((enc, i) => {
    if (i % 3 === 2) return
    const p = patients.find((x) => x.id === enc.patientId)!
    out.push({ id: `ap${i}`, patientId: p.id, practitionerId: enc.practitionerId!, unitId: enc.unitId, date: enc.createdAt, time: new Date(enc.createdAt).toTimeString().slice(0, 5), status: "checked-in", source: p.payer === "bpjs" ? "mobile-jkn" : rng.pick(["telepon", "web"] as const), encounterId: enc.id })
  })
  const later = [["d1", "poli-umum"], ["d3", "poli-dalam"], ["d4", "poli-anak"], ["d8", "poli-gigi"], ["d5", "poli-obgyn"]]
  for (let i = 0; i < 12; i++) {
    const [doc, unit] = later[i % later.length]
    const p = patients[68 + i]
    const dayOffset = i < 7 ? 0 : 1
    const hour = 9 + (i % 6)
    const date = new Date(today)
    date.setDate(date.getDate() + dayOffset)
    date.setHours(hour, (i * 15) % 60, 0, 0)
    out.push({ id: `apl${i}`, patientId: p.id, practitionerId: doc, unitId: unit, date: date.toISOString(), time: `${String(hour).padStart(2, "0")}:${String((i * 15) % 60).padStart(2, "0")}`, status: dayOffset === 0 && i < 2 && date.getTime() < now ? "no-show" : "booked", source: p.payer === "bpjs" ? "mobile-jkn" : rng.pick(["telepon", "web", "loket"] as const) })
  }
  return out
}

function makeRoster(now: number): RosterEntry[] {
  const out: RosterEntry[] = []
  const start = new Date(now)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)) // Monday
  const pattern: ShiftCode[] = ["P", "P", "S", "S", "M", "M", "L", "L"]
  const clinical = STAFF.filter((s) => s.role === "nurse" || (s.role === "doctor" && s.unitId === "igd"))
  clinical.forEach((s, idx) => {
    for (let d = 0; d < 14; d++) {
      const date = new Date(start)
      date.setDate(start.getDate() + d)
      out.push({ staffId: s.id, date: dayKey(date), shift: pattern[(d + idx * 2) % pattern.length] })
    }
  })
  return out
}

function makeSurgeries(ctx: Ctx): Surgery[] {
  const { now, data } = ctx
  const at = (dayOffset: number, h: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() + dayOffset)
    d.setHours(h, 0, 0, 0)
    return d.toISOString()
  }
  const femur = data.encounters.find((e) => e.status === "in-progress" && e.diagnoses[0]?.code === "S72.0")
  const all = (ids: string[]) => Object.fromEntries(ids.map((i) => [i, true]))
  return [
    { id: "op1", patientId: "pt12", procedure: "Kolesistektomi laparoskopik", surgeonId: "d6", anesthetistId: "d9", room: "OK 1", scheduledAt: at(0, 8), durationMin: 120, status: "done", checklist: all(["si-identity", "si-site", "si-consent", "si-anesthesia", "si-allergy", "si-airway", "si-blood", "to-team", "to-confirm", "to-antibiotic", "to-imaging", "so-procedure", "so-count", "so-specimen", "so-concerns"]) },
    { id: "op2", patientId: "pt15", procedure: "Seksio sesarea", surgeonId: "d5", anesthetistId: "d9", room: "OK 2", scheduledAt: at(0, 10), durationMin: 90, status: "time-out", checklist: all(["si-identity", "si-site", "si-consent", "si-anesthesia", "si-allergy", "si-airway", "si-blood"]) },
    { id: "op3", patientId: "pt33", procedure: "Herniorafi", surgeonId: "d6", anesthetistId: "d9", room: "OK 1", scheduledAt: at(0, 13), durationMin: 90, status: "scheduled", checklist: {} },
    { id: "op4", patientId: femur?.patientId ?? "pt27", encounterId: femur?.id, procedure: "ORIF fraktur collum femur", surgeonId: "d6", anesthetistId: "d9", room: "OK 1", scheduledAt: at(1, 8), durationMin: 150, status: "scheduled", checklist: {} },
    { id: "op5", patientId: "pt44", procedure: "Apendektomi", surgeonId: "d6", anesthetistId: "d9", room: "OK 2", scheduledAt: at(1, 11), durationMin: 75, status: "scheduled", checklist: {} },
  ]
}

function makeIncidents(now: number): Incident[] {
  const mk = (id: string, daysAgo: number, type: Incident["type"], unitId: string, description: string, immediateAction: string, impact: Incident["impact"], probability: Incident["probability"], status: Incident["status"], reportedBy?: string): Incident => ({
    id, at: isoAt(now - daysAgo * DAY), reportedAt: isoAt(now - daysAgo * DAY + 3 * HOUR), type, unitId, description, immediateAction, impact, probability, grade: riskGrade(probability, impact), status, reportedBy,
  })
  return [
    mk("ikp1", 2, "KNC", "farmasi", "Resep tertulis amoksisilin untuk pasien alergi penisilin, terdeteksi saat telaah.", "Konfirmasi ke dokter, diganti azitromisin.", 2, 3, "investigasi", "p1"),
    mk("ikp2", 5, "KTD", "melati", "Pasien lansia jatuh dari tempat tidur saat ke kamar mandi malam hari.", "Pemeriksaan dokter jaga, foto, pasang pengaman tempat tidur.", 3, 3, "investigasi", "n1"),
    mk("ikp3", 9, "KTC", "igd", "Gelang identitas tertukar antara dua pasien dengan nama mirip, terdeteksi sebelum tindakan.", "Verifikasi ulang 2 identitas, gelang diganti.", 1, 3, "selesai"),
    mk("ikp4", 14, "KPC", "icu", "Pompa infus ICU-03 sering alarm oklusi palsu.", "Pompa ditarik, lapor IPSRS.", 2, 4, "selesai", "n4"),
    mk("ikp5", 21, "KTD", "mawar", "Flebitis grade 2 pada lokasi infus hari ke-4.", "Infus dipindah, kompres.", 2, 4, "selesai", "n2"),
    mk("ikp6", 33, "Sentinel", "ok", "Retensi kasa pasca operasi, ditemukan saat kontrol.", "Reoperasi, RCA dimulai.", 5, 1, "investigasi", "d6"),
    mk("ikp7", 41, "KNC", "lab", "Sampel darah tanpa label diterima laboratorium.", "Sampel ditolak, pengambilan ulang.", 1, 4, "selesai", "l1"),
    mk("ikp8", 55, "KTC", "farmasi", "Obat high-alert KCl disimpan di ruang rawat tanpa label.", "Ditarik ke farmasi, edukasi ruangan.", 3, 2, "selesai", "p2"),
  ]
}

function makeIndicators(rng: Random, now: number): IndicatorValue[] {
  const out: IndicatorValue[] = []
  for (let m = 5; m >= 0; m--) {
    const d = new Date(now)
    d.setDate(1)
    d.setMonth(d.getMonth() - m)
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    for (const def of INM) {
      const denominator = rng.int(80, 320)
      // Most indicators sit around target with a slow improvement trend; a couple lag behind.
      const lagging = def.id === "op-wait" || def.id === "fall-risk"
      const base = def.direction === "min" ? def.target + (lagging ? -12 : 4) + (5 - m) * 1.2 : def.target - 1.5 - (5 - m) * 0.2
      const pct = Math.max(0, Math.min(100, base + (rng.next() - 0.5) * 6))
      out.push({ indicatorId: def.id, period, numerator: Math.round((pct / 100) * denominator), denominator })
    }
  }
  return out
}

function makeSync(ctx: Ctx): SyncJob[] {
  const errors = ["Location not found: poli belum dipetakan ke SATUSEHAT", "Practitioner IHS number tidak ditemukan", "Timeout 30s dari api-satusehat.kemkes.go.id"]
  return ctx.data.encounters
    .filter((e) => e.satusehat !== "not-required" && Date.now() - new Date(e.createdAt).getTime() < 3 * DAY)
    .map((e, i) => ({
      id: `sync-${e.id}`,
      integration: "satusehat" as const,
      resource: "Encounter",
      ref: e.id,
      status: e.satusehat === "synced" ? ("synced" as const) : e.satusehat === "failed" ? ("failed" as const) : ("pending" as const),
      at: e.endedAt ?? e.createdAt,
      attempts: e.satusehat === "failed" ? 3 : 1,
      error: e.satusehat === "failed" ? errors[i % errors.length] : undefined,
    }))
}

function makeNotifications(ctx: Ctx): Notification[] {
  const { now, data } = ctx
  const out: Notification[] = []
  const critical = data.orders.find((o) => o.results.some((r) => r.flag === "HH" || r.flag === "LL"))
  if (critical) {
    const p = data.patients.find((x) => x.id === critical.patientId)!
    out.push({ id: "nt1", at: isoAt(now - 12 * MIN), level: "danger", title: "Nilai kritis laboratorium", body: `${p.name} (RM ${p.mrn}) — ada hasil di luar batas kritis.`, href: `/encounters/${critical.encounterId}`, roles: ["doctor", "nurse", "labtech"], read: false })
  }
  out.push({ id: "nt2", at: isoAt(now - 40 * MIN), level: "warning", title: "Stok di bawah minimum", body: "6 item farmasi & BMHP di bawah stok minimum.", href: "/inventory", roles: ["pharmacist", "admin", "manager"], read: false })
  out.push({ id: "nt3", at: isoAt(now - 2 * HOUR), level: "danger", title: "SIP kedaluwarsa", body: "SIP dr. Lestari Anggraini, Sp.N sudah kedaluwarsa — jadwal praktik perlu ditinjau.", href: "/hr", roles: ["admin", "manager"], read: false })
  out.push({ id: "nt4", at: isoAt(now - 3 * HOUR), level: "warning", title: "Klaim pending BPJS", body: "Beberapa klaim dikembalikan dengan status pending — perlu dilengkapi.", href: "/claims", roles: ["coder", "manager"], read: false })
  out.push({ id: "nt5", at: isoAt(now - 5 * HOUR), level: "info", title: "Sinkron SATUSEHAT gagal", body: "Beberapa Encounter gagal dikirim. Periksa pemetaan lokasi.", href: "/integrations", roles: ["admin"], read: true })
  return out
}

function moduleStates(enabled: ModuleId[]): Record<ModuleId, ModuleState> {
  return Object.fromEntries(
    MODULES.map((m) => [m.id, { enabled: !!m.core || enabled.includes(m.id), enabledAt: new Date().toISOString(), setupDone: m.setup.slice(0, Math.max(0, m.setup.length - 1)).map((s) => s.id) }]),
  ) as Record<ModuleId, ModuleState>
}

export function createSeed(enabled: ModuleId[] = MODULES.map((m) => m.id)): HospitalData {
  const now = Date.now()
  const rng = createRandom(Number(dayKey().replaceAll("-", "")))
  const patients = makePatients(rng, now)
  const data: HospitalData = {
    version: DATA_VERSION,
    seededOn: dayKey(),
    onboarded: false,
    facility: { name: "RS Medisphere Bandung", type: "rs-madya", city: "Bandung", code: "3273015", orgId: "100026489" },
    modules: moduleStates(enabled),
    session: { role: "admin", userId: "a1", locked: false },
    units: UNITS,
    staff: STAFF,
    patients,
    beds: makeBeds(),
    encounters: [],
    orders: [],
    prescriptions: [],
    mar: [],
    inventory: structuredClone(INVENTORY) as InventoryItem[],
    purchases: [],
    movements: [],
    schedules: SCHEDULE_TEMPLATE.map((s, i) => ({ ...s, id: `sch${i}` })),
    appointments: [],
    roster: makeRoster(now),
    surgeries: [],
    invoices: [],
    claims: [],
    incidents: makeIncidents(now),
    indicators: makeIndicators(rng, now),
    syncJobs: [],
    audit: [],
    notifications: [],
    queueCounters: {},
    invoiceCounter: 0,
    mrnCounter: 102340 + patients.length * 7,
  }
  const ctx: Ctx = { rng, now, data, active: new Set() }
  makeHistory(ctx, patients)
  makeInpatientsNow(ctx, patients)
  makeOutpatientToday(ctx, patients)
  makeEmergencyNow(ctx, patients)
  data.appointments = makeAppointments(ctx, patients)
  data.surgeries = makeSurgeries(ctx)
  data.syncJobs = makeSync(ctx)
  data.notifications = makeNotifications(ctx)
  data.purchases = [
    { id: "pr1", createdAt: isoAt(now - 3 * DAY), createdBy: "p1", lines: [{ itemId: "obt-azt", qty: 200 }, { itemId: "obt-sal", qty: 150 }], status: "approved" },
    { id: "pr2", createdAt: isoAt(now - DAY), createdBy: "p1", lines: [{ itemId: "rgn-ns1", qty: 100 }], status: "submitted", note: "Musim DBD, kebutuhan NS1 naik" },
  ]
  data.movements = data.prescriptions
    .filter((p) => p.status === "dispensed")
    .slice(-40)
    .flatMap((p) => p.items.map((l, i) => ({ id: `mv-${p.id}-${i}`, at: p.dispensedAt!, itemId: l.itemId, qty: -l.qty, reason: "dispense" as const, ref: p.id })))
  data.audit = [
    { id: "au1", at: isoAt(now - 6 * HOUR), userId: "a1", action: "Mengaktifkan modul", target: "Klaim & Casemix" },
    { id: "au2", at: isoAt(now - 4 * HOUR), userId: "d3", action: "Membuka rekam medis", target: data.patients[20].name },
    { id: "au3", at: isoAt(now - 2 * HOUR), userId: "p1", action: "Menelaah resep", target: "rx-h12" },
  ] satisfies AuditEntry[]
  return data
}
