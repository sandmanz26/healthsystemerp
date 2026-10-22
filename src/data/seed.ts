/**
 * Builds the demo dataset relative to "now", so the demo always looks like a live hospital
 * day regardless of when it is opened. Deterministic for a given day and region (seeded PRNG).
 *
 * Patients are synthetic (Synthea-style): realistic demographics, payer mix and clinical
 * courses, but no real person. Codes, identifiers and workflows are the real ones.
 */
import { DX_MAP, LAB_MAP, PANEL_MAP, PX_MAP, RAD_MAP, TARIFFS, panelTests, rangeFor, type TariffKey, FREQ_MAP } from "@/domain/catalog"
import { flagResult, sepsisBundle } from "@/domain/clinical"
import { DENIAL_REASONS, expectedFfs, groupEncounter, grouperFor } from "@/domain/finance"
import { nhsCheckDigit } from "@/domain/interop"
import { MODULES, type ModuleId } from "@/domain/modules"
import { MEASURES, riskGrade } from "@/domain/quality"
import { formatMrn, type Region } from "@/domain/region"
import type {
  Allergy, Appointment, AuditEntry, Bed, Charge, Claim, ClaimStatus, ClinicalNote, Coverage, Diagnosis, Encounter, EncounterStatus,
  Incident, IndicatorValue, Invoice, MarEntry, Notification, Patient, PayerType, Prescription, PrescriptionStatus, Procedure,
  RosterEntry, ServiceOrder, ShiftCode, Surgery, SyncJob, Vitals,
} from "@/domain/types"
import { dayKey } from "@/lib/format"
import { createRandom, type Random } from "@/lib/random"
import { DATA_VERSION, type HospitalData, type ModuleState } from "@/store/schema"
import { FACILITY, OR_ROOMS, SCHEDULE_TEMPLATE, WARD_LAYOUT, inventoryFor, staffFor, unitsFor } from "./master"
import { ER_SCENARIOS, INPATIENT_SCENARIOS, OUTPATIENT_SCENARIOS, type InpatientScenario, type ItemRef, type Scenario } from "./scenarios"

// ---------------------------------------------------------------------------------------
// Names & addresses
// ---------------------------------------------------------------------------------------

const NAMES: Record<Region, { male: string[]; female: string[]; boys: string[]; girls: string[]; last: string[]; streets: string[] }> = {
  us: {
    male: ["James", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles", "Christopher", "Daniel", "Anthony", "Mark", "Donald", "Steven", "Kenneth", "Kevin", "Brian", "Jose", "Carlos", "Luis", "Jamal", "DeShawn", "Wei", "Raj", "Mohamed", "Gary", "Larry"],
    female: ["Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen", "Lisa", "Nancy", "Betty", "Sandra", "Ashley", "Kimberly", "Donna", "Michelle", "Maria", "Guadalupe", "Keisha", "Aaliyah", "Mei", "Priya", "Fatima", "Carol", "Deborah"],
    boys: ["Liam", "Noah", "Oliver", "Elijah", "Mateo", "Lucas", "Jayden", "Ethan"],
    girls: ["Olivia", "Emma", "Ava", "Sophia", "Mia", "Isabella", "Amara", "Harper"],
    last: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Thompson", "White", "Harris", "Clark", "Lewis", "Robinson", "Walker", "Young", "Nguyen", "Patel", "Washington", "O'Connor", "Schmidt", "Kowalski"],
    streets: ["Maple Ave", "Oak St", "High St", "Broad St", "Summit St", "Neil Ave", "Parsons Ave", "Livingston Ave", "Cleveland Ave", "Morse Rd", "Karl Rd", "Sawmill Rd"],
  },
  uk: {
    male: ["John", "David", "Peter", "Michael", "Paul", "Andrew", "Mark", "Stephen", "Ian", "Gary", "Robert", "Christopher", "Daniel", "James", "Thomas", "Mohammed", "Ahmed", "Imran", "Krzysztof", "Callum", "Rhys", "Owen", "Keith", "Graham"],
    female: ["Margaret", "Susan", "Patricia", "Elizabeth", "Sarah", "Karen", "Julie", "Helen", "Joanne", "Claire", "Emma", "Rebecca", "Laura", "Gemma", "Nicola", "Fatima", "Aisha", "Priya", "Agnieszka", "Siobhan", "Bethan", "Jean", "Brenda"],
    boys: ["Oliver", "George", "Arthur", "Noah", "Muhammad", "Leo", "Harry", "Jack"],
    girls: ["Olivia", "Amelia", "Isla", "Ava", "Lily", "Freya", "Maryam", "Poppy"],
    last: ["Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Johnson", "Davies", "Robinson", "Wright", "Thompson", "Evans", "Walker", "White", "Roberts", "Green", "Hall", "Wood", "Jackson", "Clarke", "Patel", "Khan", "Hussain", "Ali", "Begum", "Murphy", "Kelly", "Nowak", "Hughes", "Edwards"],
    streets: ["Chapeltown Road", "Harehills Lane", "Otley Road", "Kirkstall Road", "Roundhay Road", "Street Lane", "Headingley Lane", "Burley Road", "York Road", "Dewsbury Road", "Scott Hall Road"],
  },
}

const SPANISH = new Set(["Jose", "Carlos", "Luis", "Maria", "Guadalupe", "Mateo"])
const POLISH = new Set(["Krzysztof", "Agnieszka", "Nowak", "Kowalski"])

const GP_PRACTICES = ["Chapel Allerton Surgery", "Roundhay Road Medical Practice", "Hyde Park Surgery", "Kirkstall Lane Medical Centre", "Meanwood Group Practice", "Burley Park Medical Centre"]
const US_PCPS = ["Dr. A. Okafor (Northside Family Practice)", "Dr. L. Brennan (Clintonville Internal Medicine)", "Dr. S. Reyes (Southside Community Health Center)", "Dr. M. Weiss (German Village Primary Care)"]

const ALLERGIES: (Allergy & { flag?: "latex-allergy" })[] = [
  { substance: "Penicillin", reaction: "Hives", severity: "moderate", type: "allergy" },
  { substance: "Sulfonamide antibiotics", reaction: "Maculopapular rash", severity: "mild", type: "allergy" },
  { substance: "Codeine", reaction: "Nausea & vomiting", severity: "mild", type: "intolerance" },
  { substance: "Latex", reaction: "Contact dermatitis", severity: "moderate", type: "allergy", flag: "latex-allergy" },
  { substance: "Ibuprofen", reaction: "Angioedema", severity: "severe", type: "allergy" },
  { substance: "Shellfish", reaction: "Anaphylaxis", severity: "severe", type: "allergy" },
]

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

interface Ctx {
  rng: Random
  now: number
  region: Region
  data: HospitalData
  /** Patients with an active encounter today — nobody is in two places at once. */
  active: Set<string>
}

const isoAt = (ms: number) => new Date(ms).toISOString()

// ---------------------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------------------

/** NHS numbers in the 999 range are reserved for testing — valid format, never a real patient. */
function nhsNumber(rng: Random): string {
  for (;;) {
    const first9 = `999${String(rng.int(0, 999999)).padStart(6, "0")}`
    const check = nhsCheckDigit(first9)
    if (check !== null) return `${first9}${check}`
  }
}

/** Medicare Beneficiary Identifier: 11 characters, format CAANNAANNAANN rules per CMS. */
function mbi(rng: Random): string {
  const L = "ACDEFGHJKMNPQRTUVWXY"
  const N = "0123456789"
  const LN = L + N
  const pick = (s: string) => s[rng.int(0, s.length - 1)]
  const raw = [pick("123456789"), pick(L), pick(LN), pick(N), pick(L), pick(LN), pick(N), pick(L), pick(L), pick(N), pick(N)].join("")
  return `${raw.slice(0, 4)}-${raw.slice(4, 7)}-${raw.slice(7)}`
}

function coverageFor(rng: Random, payer: PayerType): Coverage | undefined {
  const digits = (n: number) => Array.from({ length: n }, () => rng.int(0, 9)).join("")
  switch (payer) {
    case "medicare":
      return rng.chance(0.45)
        ? { payerName: rng.pick(["Humana Gold Plus", "Aetna Medicare Advantage", "UnitedHealthcare AARP Medicare Advantage"]), plan: "Medicare Advantage HMO", memberId: `H${digits(8)}` }
        : { payerName: "Medicare", plan: "Part A & B (traditional)", memberId: mbi(rng) }
    case "medicaid":
      return { payerName: rng.pick(["Ohio Medicaid — CareSource", "Ohio Medicaid — Molina Healthcare", "Ohio Medicaid — Buckeye Health Plan"]), plan: "Managed care", memberId: digits(12) }
    case "commercial": {
      const p = rng.pick([
        ["Anthem Blue Cross Blue Shield", "PPO", () => `YRK${digits(9)}`],
        ["Aetna", "Choice POS II", () => `W${digits(9)}`],
        ["UnitedHealthcare", "Choice Plus", () => digits(9)],
        ["Cigna", "Open Access Plus", () => `U${digits(8)}01`],
        ["Medical Mutual of Ohio", "SuperMed PPO", () => `MMO${digits(8)}`],
      ] as const)
      return { payerName: p[0], plan: `${p[1]}${rng.chance(0.3) ? " · HDHP" : ""}`, memberId: p[2](), group: digits(6) }
    }
    case "private":
      return { payerName: rng.pick(["Bupa", "AXA Health", "Aviva", "Vitality"]), plan: "Corporate scheme", memberId: digits(8) }
    case "overseas":
      return { payerName: "Overseas visitor — chargeable", plan: "NHS (Charges to Overseas Visitors) Regulations 2015", memberId: `OVS-${digits(6)}` }
    default:
      return undefined
  }
}

function payerFor(region: Region, rng: Random, age: number): PayerType {
  if (region === "uk") return rng.chance(0.93) ? "nhs" : rng.chance(0.8) ? "private" : "overseas"
  if (age >= 65) return rng.chance(0.92) ? "medicare" : "commercial"
  if (age < 18) return rng.chance(0.45) ? "medicaid" : "commercial"
  const r = rng.next()
  return r < 0.58 ? "commercial" : r < 0.88 ? "medicaid" : "self-pay"
}


function makePatients(ctx: Pick<Ctx, "rng" | "now" | "region">): Patient[] {
  const { rng, now, region } = ctx
  const names = NAMES[region]
  const patients: Patient[] = []
  for (let i = 0; i < 180; i++) {
    const gender = rng.chance(0.5) ? "male" : "female"
    // Children are ~15% of a general hospital's population; inpatients skew old.
    // The first few records guarantee enough infants and children for today's pediatric cases.
    const ageYears = i < 8 ? rng.int(0, 1) : i < 22 ? rng.int(2, 12) : rng.chance(0.06) ? rng.int(2, 17) : rng.chance(0.45) ? rng.int(65, 92) : rng.int(18, 64)
    const birth = new Date(now - ageYears * 365.25 * DAY - rng.int(0, 364) * DAY)
    const first = rng.pick(ageYears < 18 ? (gender === "male" ? names.boys : names.girls) : gender === "male" ? names.male : names.female)
    const last = rng.pick(names.last)
    const payer = payerFor(region, rng, ageYears)
    const allergy = rng.chance(0.16) ? rng.pick(ALLERGIES) : undefined
    const language = region === "us" && (SPANISH.has(first) || SPANISH.has(last)) && rng.chance(0.6) ? "Spanish" : region === "uk" && (POLISH.has(first) || POLISH.has(last)) && rng.chance(0.6) ? "Polish" : undefined
    const flags: Patient["flags"] = []
    if (allergy?.flag) flags.push(allergy.flag)
    if (language) flags.push("interpreter")
    const zip = region === "us" ? String(43201 + rng.int(0, 34)) : `LS${rng.int(1, 28)} ${rng.int(1, 9)}${"ABDEFGHJLNPQRSTUWXYZ"[rng.int(0, 19)]}${"ABDEFGHJLNPQRSTUWXYZ"[rng.int(0, 19)]}`
    patients.push({
      id: `pt${i + 1}`,
      mrn: formatMrn(region, 40_102_340 + i * 37),
      nhsNumber: region === "uk" ? nhsNumber(rng) : undefined,
      name: `${first} ${last}`,
      gender,
      birthDate: birth.toISOString(),
      phone: region === "us" ? `(614) 555-01${String(rng.int(0, 99)).padStart(2, "0")}` : `07700 900${String(rng.int(0, 999)).padStart(3, "0")}`,
      address: region === "us" ? `${rng.int(100, 4800)} ${rng.pick(names.streets)}, Columbus, OH ${zip}` : `${rng.int(1, 220)} ${rng.pick(names.streets)}, Leeds ${zip}`,
      postcode: zip,
      preferredLanguage: language,
      allergies: allergy ? [{ substance: allergy.substance, reaction: allergy.reaction, severity: allergy.severity, type: allergy.type }] : [],
      payer,
      coverage: coverageFor(rng, payer),
      primaryCare: region === "us" ? (payer === "self-pay" ? undefined : rng.pick(US_PCPS)) : rng.pick(GP_PRACTICES),
      nextOfKin: `${rng.pick(gender === "male" ? names.female : names.male)} ${last} (${ageYears >= 65 ? "spouse" : ageYears < 18 ? "parent" : rng.pick(["spouse", "sibling", "partner"])})`,
      codeStatus: ageYears >= 85 && rng.chance(0.35) ? "dnr" : "full",
      advanceDirective: ageYears >= 65 ? rng.chance(0.55) : undefined,
      flags,
      createdAt: isoAt(now - rng.int(30, 2500) * DAY),
    })
  }
  return patients
}

const ageYears = (p: Patient, now: number) => (now - new Date(p.birthDate).getTime()) / (365.25 * DAY)

/** Whether a scenario can plausibly happen to this patient (no cesareans for men). */
function fits(p: Patient, s: Scenario, now: number): boolean {
  const age = ageYears(p, now)
  const who = s.who ?? {}
  // Adult unless the scenario says otherwise (a pediatric case sets only maxAge).
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
      bedType: w.bedType,
      status: "available" as const,
    })),
  )
}

// ---------------------------------------------------------------------------------------
// Clinical content
// ---------------------------------------------------------------------------------------

const NORMAL = { systolic: 122, diastolic: 76, heartRate: 78, respRate: 16, temperature: 36.8, spo2: 97 }

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

function diagnosesFrom(ctx: Ctx, s: Scenario, inpatient = false): Diagnosis[] {
  return [s.dx, ...(s.extraDx ?? [])].map((key, i) => {
    const c = DX_MAP[key][ctx.region]
    // POA: everything present on admission except a hospital-acquired complication.
    return { code: c.code, display: c.display, primary: i === 0, poa: inpatient && ctx.region === "us" ? "Y" : undefined }
  })
}

function proceduresFrom(ctx: Ctx, s: Scenario): Procedure[] {
  return (s.procedures ?? []).flatMap((key) => {
    const p = PX_MAP[key]
    const c = ctx.region === "us" ? p.us : p.uk
    return c ? [{ code: c.code, display: c.display }] : []
  })
}

function noteFrom(s: Scenario, at: number, authorId: string, type: ClinicalNote["type"] = "progress"): ClinicalNote {
  return { id: `n${at}${authorId}`, at: isoAt(at), authorId, role: "doctor", type, subjective: s.s, objective: s.o, assessment: s.a, plan: s.p }
}

const itemOf = (ref: ItemRef, region: Region) => (typeof ref === "string" ? ref : ref[region])

// ---------------------------------------------------------------------------------------
// Accounts & charges
// ---------------------------------------------------------------------------------------

function accountNumber(ctx: Ctx): string {
  ctx.data.accountCounter += 1
  return ctx.region === "us" ? `70${String(ctx.data.accountCounter).padStart(8, "0")}` : `SP${String(ctx.data.accountCounter).padStart(8, "0")}`
}

/** Starts an account for an encounter. Charges are pushed by the generators below. */
function openInvoice(ctx: Ctx, enc: Encounter): Invoice {
  ctx.data.invoiceCounter += 1
  const inv: Invoice = {
    id: `i${enc.id}`,
    number: `${ctx.region === "us" ? "HB" : "INV"}-${dayKey(enc.createdAt).replaceAll("-", "").slice(2)}-${String(ctx.data.invoiceCounter).padStart(5, "0")}`,
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

function tariff(ctx: Ctx, inv: Invoice, at: number, key: TariffKey, qty = 1) {
  const t = TARIFFS[key]
  charge(inv, at, { category: t.category, description: t.description, code: "code" in t ? t.code : undefined, revCode: ctx.region === "us" && "revCode" in t ? t.revCode : undefined, qty, price: t.price[ctx.region], ref: key })
}

// ---------------------------------------------------------------------------------------
// Orders & results
// ---------------------------------------------------------------------------------------

const has = (s: Scenario, ...keys: string[]) => keys.some((k) => s.dx === k || s.extraDx?.includes(k))

/** Lab value in conventional units, consistent with the scenario (sepsis → high lactate…). */
function labConventional(code: string, s: Scenario, rng: Random, patient: Patient): number | string {
  const r = (lo: number, hi: number) => lo + rng.next() * (hi - lo)
  switch (code) {
    case "WBC": return has(s, "sepsis", "pneumonia", "appendicitis", "uti", "cellulitis") ? r(13.5, 19.8) : r(5.2, 9.4)
    case "HGB": return patient.gender === "female" ? r(11.8, 13.9) : r(13.2, 15.8)
    case "HCT": return patient.gender === "female" ? r(36, 41) : r(40, 46)
    case "PLT": return has(s, "sepsis") ? r(96, 148) : r(180, 340)
    case "NA": return has(s, "dehydration") ? r(131, 134) : r(137, 142)
    case "K": return has(s, "hyperkalemia") ? r(6.6, 6.9) : has(s, "esrd") ? r(5.2, 5.6) : r(3.8, 4.6)
    case "BUN": return has(s, "esrd") ? r(68, 92) : has(s, "aki") ? r(42, 56) : has(s, "dehydration") ? r(26, 32) : r(10, 18)
    case "CREAT": return has(s, "esrd") ? r(7.8, 9.6) : has(s, "aki") ? r(1.9, 2.6) : r(0.7, 1.1)
    case "GLU": return has(s, "t2dm-hyper") ? r(410, 470) : has(s, "t2dm") ? r(182, 260) : has(s, "stroke", "sepsis") ? r(130, 160) : r(84, 118)
    case "A1C": return has(s, "t2dm", "t2dm-hyper") ? r(8.2, 10.4) : r(5.1, 5.6)
    case "CHOL": return has(s, "hld") ? r(238, 292) : r(158, 196)
    case "ALT": return has(s, "cholelithiasis") ? r(64, 108) : r(14, 38)
    case "AST": return has(s, "cholelithiasis") ? r(58, 92) : r(16, 34)
    case "TBIL": return has(s, "cholelithiasis") ? r(1.1, 1.6) : r(0.3, 0.9)
    case "TROP": return has(s, "nstemi") ? r(180, 1240) : has(s, "stroke") ? r(9, 24) : r(2, 11)
    case "LACT": return has(s, "sepsis") ? r(3.4, 4.8) : r(0.9, 1.6)
    case "PCT": return has(s, "sepsis") ? r(4.2, 14) : has(s, "pneumonia") ? r(0.8, 2.4) : r(0.04, 0.18)
    case "BNP": return has(s, "hf") ? r(4200, 9800) : r(40, 110)
    case "INR": return r(0.95, 1.12)
    case "LIPASE": return r(18, 46)
    case "BCX": return has(s, "sepsis") ? "Gram-positive cocci in pairs — 1 of 2 sets (S. pneumoniae)" : "No growth to date"
    case "UA": return has(s, "uti") ? "LE 3+, nitrite positive, WBC > 50/hpf, bacteria many" : has(s, "appendicitis") ? "Trace leukocytes, nitrite negative" : "Negative"
    case "HCG": return "Negative"
    default: return ""
  }
}

function labValue(code: string, s: Scenario, ctx: Ctx, patient: Patient) {
  const test = LAB_MAP[code]
  const conv = labConventional(code, s, ctx.rng, patient)
  if (typeof conv === "string") return { testCode: code, value: conv, flag: flagResult(code, conv, ctx.region) }
  const range = rangeFor(test, ctx.region)!
  const v = ctx.region === "uk" && test.toSI ? test.toSI(conv) : conv
  const value = v.toFixed(range.decimals ?? 0)
  return { testCode: code, value, unit: range.unit, flag: flagResult(code, value, ctx.region) }
}

function radReport(code: string, s: Scenario): string {
  switch (code) {
    case "XR-CHEST":
      if (has(s, "pneumonia", "sepsis")) return "FINDINGS: Right lower lobe airspace consolidation with air bronchograms. No pleural effusion or pneumothorax. Heart size normal.\nIMPRESSION: Right lower lobe pneumonia."
      if (has(s, "hf")) return "FINDINGS: Cardiomegaly. Upper lobe venous diversion, bilateral interstitial edema and small bilateral pleural effusions.\nIMPRESSION: Congestive heart failure."
      if (has(s, "copd-ae")) return "FINDINGS: Hyperinflated lungs with flattened hemidiaphragms. No focal consolidation.\nIMPRESSION: Emphysematous changes; no pneumonia."
      return "FINDINGS: Lungs clear. Cardiomediastinal silhouette normal.\nIMPRESSION: No acute cardiopulmonary process."
    case "CT-HEAD":
      return has(s, "stroke")
        ? "FINDINGS: No intracranial hemorrhage. Hyperdense left MCA sign; subtle loss of grey-white differentiation in the left insular ribbon. ASPECTS 8.\nIMPRESSION: Early left MCA territory infarct. No hemorrhage — no contraindication to thrombolysis on imaging."
        : "FINDINGS: No acute intracranial hemorrhage, mass effect or skull fracture. Small left occipital scalp hematoma.\nIMPRESSION: No acute intracranial abnormality."
    case "US-RUQ":
      return "FINDINGS: Multiple mobile, echogenic, shadowing gallstones, largest 1.4 cm. Gallbladder wall 2 mm, no pericholecystic fluid, sonographic Murphy negative. CBD 4 mm.\nIMPRESSION: Cholelithiasis without sonographic evidence of cholecystitis."
    case "CT-AP":
      return "FINDINGS: Dilated, fluid-filled appendix measuring 11 mm with periappendiceal fat stranding. No abscess, free air or free fluid.\nIMPRESSION: Acute uncomplicated appendicitis."
    case "XR-WRIST":
      return "FINDINGS: Transverse fracture of the distal radial metaphysis with 20° dorsal angulation. Ulnar styloid intact.\nIMPRESSION: Colles-type distal radius fracture."
    case "XR-HIP":
      return "FINDINGS: Displaced subcapital fracture of the right femoral neck (Garden IV). No other fracture.\nIMPRESSION: Displaced intracapsular right femoral neck fracture."
    case "US-OB":
      return "FINDINGS: Single live intrauterine pregnancy, cephalic. Biometry consistent with 28w1d; EFW 1,150 g (45th centile). Posterior placenta, normal amniotic fluid.\nIMPRESSION: Normal interval growth."
    case "MR-BRAIN":
      return has(s, "stroke")
        ? "FINDINGS: Restricted diffusion in the left insula and frontal operculum. No hemorrhagic transformation.\nIMPRESSION: Acute left MCA territory infarct."
        : "FINDINGS: Few nonspecific T2/FLAIR white matter hyperintensities. No mass, hemorrhage or acute infarct.\nIMPRESSION: No acute abnormality; findings commonly seen in migraine."
    case "ECHO":
      return has(s, "hf")
        ? "FINDINGS: LV dilated, global hypokinesis, LVEF 30% (biplane Simpson's). Moderate functional MR.\nIMPRESSION: Severe LV systolic dysfunction."
        : has(s, "nstemi") ? "FINDINGS: LVEF 50% with mild anterior wall hypokinesis. No significant valve disease.\nIMPRESSION: Mildly reduced LV function." : "FINDINGS: Normal LV size and function, LVEF 60%. Valves normal.\nIMPRESSION: Normal study."
    default:
      return "FINDINGS: Unremarkable.\nIMPRESSION: No acute abnormality."
  }
}

function addOrders(ctx: Ctx, enc: Encounter, patient: Patient, s: Scenario, at: number, status: ServiceOrder["status"], doctorId: string) {
  const { rng } = ctx
  const inv = ctx.data.invoices.find((i) => i.encounterId === enc.id)
  const age = ageYears(patient, ctx.now)
  // Pregnancy tests only for people who can be pregnant.
  const panels = (s.labs ?? []).filter((p) => p !== "HCG" || (patient.gender === "female" && age >= 12 && age <= 55))
  const mk = (kind: "lab" | "rad", codes: string[]): ServiceOrder => {
    const resulted = status === "resulted" || status === "validated"
    const order: ServiceOrder = {
      id: `${kind}-${enc.id}`,
      kind,
      encounterId: enc.id,
      patientId: enc.patientId,
      testCodes: codes,
      priority: enc.kind === "emergency" || rng.chance(0.15) ? "stat" : "routine",
      clinicalNote: s.a,
      status,
      orderedBy: doctorId,
      orderedAt: isoAt(at),
      collectedAt: status !== "ordered" ? isoAt(at + 12 * MIN) : undefined,
      resultedAt: resulted ? isoAt(at + 55 * MIN) : undefined,
      validatedBy: status === "validated" ? (kind === "lab" ? "l1" : "d10") : undefined,
      results: [],
    }
    if (kind === "lab" && resulted) order.results = codes.map((code) => labValue(code, s, ctx, patient))
    if (kind === "rad" && resulted) order.report = radReport(codes[0], s)
    if (kind === "rad" && ctx.region === "us" && codes.some((c) => RAD_MAP[c]?.priorAuth))
      order.auth = enc.kind === "emergency" || enc.kind === "inpatient" || enc.payer === "medicaid" || enc.payer === "self-pay" ? "not-required" : rng.chance(0.6) ? "approved" : "pending"
    if (order.results.some((r) => r.flag === "HH" || r.flag === "LL") && status === "validated")
      order.criticalCall = { at: isoAt(at + 62 * MIN), to: "Attending physician (read-back confirmed)", by: "l1" }
    if (inv) {
      if (kind === "lab")
        for (const panel of new Set(codes.map((c) => LAB_MAP[c].panel))) {
          const def = PANEL_MAP[panel]
          charge(inv, at, { category: "laboratory", description: def.name, code: def.cpt, revCode: ctx.region === "us" ? "0300" : undefined, qty: 1, price: def.price[ctx.region], ref: order.id })
        }
      else
        for (const code of codes) {
          const def = RAD_MAP[code]
          charge(inv, at, { category: "radiology", description: def.name, code: def.cpt, revCode: ctx.region === "us" ? def.revCode : undefined, qty: 1, price: def.price[ctx.region], ref: order.id })
        }
    }
    return order
  }
  if (panels.length) ctx.data.orders.push(mk("lab", panels.flatMap(panelTests)))
  if (s.rads?.length) ctx.data.orders.push(mk("rad", s.rads))
}

function addPrescription(ctx: Ctx, enc: Encounter, s: Scenario, at: number, status: PrescriptionStatus, doctorId: string): Prescription | undefined {
  if (!s.drugs?.length) return undefined
  const rx: Prescription = {
    id: `rx-${enc.id}`,
    encounterId: enc.id,
    patientId: enc.patientId,
    items: s.drugs.map(([ref, dose, frequency, route, days, qty]) => ({ itemId: itemOf(ref, ctx.region), dose, frequency, route, days, qty })),
    status,
    prescribedBy: doctorId,
    prescribedAt: isoAt(at),
    reviewedBy: status !== "new" ? "p1" : undefined,
    dispensedAt: status === "dispensed" ? isoAt(at + 35 * MIN) : undefined,
  }
  ctx.data.prescriptions.push(rx)
  const inv = ctx.data.invoices.find((i) => i.encounterId === enc.id)
  if (status === "dispensed" && inv)
    for (const line of rx.items) {
      const item = ctx.data.inventory.find((x) => x.id === line.itemId)!
      charge(inv, at + 35 * MIN, { category: "pharmacy", description: item.name, revCode: ctx.region === "us" ? (line.route === "IV" || line.route === "SC" ? "0636" : "0250") : undefined, qty: line.qty, price: item.price, ref: rx.id })
    }
  return rx
}

// ---------------------------------------------------------------------------------------
// Revenue cycle
// ---------------------------------------------------------------------------------------

function eligibilityFor(ctx: Ctx, p: Patient, at: number): Encounter["eligibility"] {
  const ref = `${ctx.region === "us" ? "TRN" : "PDS"}-${String(at).slice(-8)}`
  if (ctx.region === "uk")
    return p.payer === "nhs" ? { at: isoAt(at), status: "active", summary: `NHS number verified · Registered GP: ${p.primaryCare}`, reference: ref } : undefined
  if (!p.coverage) return undefined
  const summary =
    p.payer === "medicare"
      ? p.coverage.plan?.includes("Advantage") ? "Medicare Advantage active · Prior auth required for inpatient & advanced imaging" : "Part A & B active · Part A deductible met"
      : p.payer === "medicaid" ? "Active · $0 copay · Managed care plan on file"
      : `Active · Copay $${ctx.rng.pick([30, 40, 50])} · Deductible remaining $${ctx.rng.int(2, 18) * 100} of $${ctx.rng.pick([1500, 2000, 3000])}`
  return { at: isoAt(at), status: "active", summary, reference: ref }
}

const claimNumber = (ctx: Ctx, n: number) => (ctx.region === "us" ? `2${String(26_000_000_000 + n * 7_919).padStart(12, "0")}` : `SUS-${String(4_100_000 + n * 37)}`)

function closeFinance(ctx: Ctx, enc: Encounter, at: number, settle: boolean) {
  const inv = ctx.data.invoices.find((i) => i.encounterId === enc.id)
  if (!inv) return
  const total = inv.charges.reduce((sum, c) => sum + c.qty * c.price, 0)
  const patient = ctx.data.patients.find((p) => p.id === enc.patientId)!
  if (enc.payer === "self-pay" || enc.payer === "overseas") {
    if (settle) {
      // Uninsured patients get the hospital's self-pay discount (financial assistance policy).
      const discount = ctx.region === "us" ? Math.round(total * 0.35) : 0
      inv.payments.push({ id: `pay-${inv.id}`, at: isoAt(at), method: ctx.rng.pick(["card", "card", "cash", "bank-transfer"] as const), amount: total - discount, by: "c1" })
      if (discount) inv.payments.push({ id: `adj-${inv.id}`, at: isoAt(at), method: "payer", amount: discount, by: "c1" })
      inv.status = "paid"
      inv.closedAt = isoAt(at)
    }
    return
  }
  inv.status = "claim"
  inv.closedAt = isoAt(at)
  const ageDays = (ctx.now - at) / DAY
  const r = ctx.rng.next()
  const grouper = grouperFor(enc, ctx.region)
  const uk = ctx.region === "uk"
  // Typical pipeline: recent claims are still being coded, older ones are paid; ~10% deny.
  let status: ClaimStatus = !settle
    ? "draft"
    : ageDays > 20
      ? r < 0.84 ? "paid" : r < 0.92 ? "accepted" : r < 0.96 ? "denied" : "appealed"
      : ageDays > 7
        ? r < 0.35 ? "submitted" : r < 0.7 ? "accepted" : r < 0.95 ? "paid" : "denied"
        : ageDays > 3 ? (r < 0.15 ? "coded" : "submitted") : r < 0.3 ? "draft" : r < 0.65 ? "coded" : "submitted"
  // NHS spells are submitted to SUS+, not paid individually.
  if (uk && enc.payer === "nhs" && (status === "paid" || status === "denied" || status === "appealed")) status = "accepted"
  const noAuth = !uk && enc.kind === "inpatient" && enc.payer === "commercial" && !enc.authNumber
  if (noAuth && settle && ageDays > 7) status = "denied"
  const group = status === "draft" || grouper === "FFS" ? null : groupEncounter(enc, ctx.region)
  const expected = grouper === "FFS" ? (uk ? total : expectedFfs(total, enc.payer)) : group?.tariff
  const denial = status === "denied" || status === "appealed" ? (noAuth ? DENIAL_REASONS[0] : uk ? { carc: "INS-PA", text: "Insurer pre-authorisation not obtained" } : ctx.rng.pick(DENIAL_REASONS.slice(1))) : undefined
  const respon = !uk && enc.payer === "commercial" && expected ? Math.round(expected * 0.12) : 0
  ctx.data.claims.push({
    id: `clm-${enc.id}`,
    number: claimNumber(ctx, ctx.data.claims.length + 1),
    encounterId: enc.id,
    invoiceId: inv.id,
    payer: enc.payer,
    payerName: uk && enc.payer === "nhs" ? "NHS England (via ICB commissioner)" : patient.coverage?.payerName ?? "—",
    grouper,
    groupCode: group?.code,
    groupName: group?.name,
    weight: group?.weight,
    gmlos: group?.gmlos,
    billed: total,
    tariff: status === "draft" ? undefined : expected,
    paid: status === "paid" && expected ? expected - respon : undefined,
    patientResponsibility: status === "paid" && respon ? respon : undefined,
    status,
    denial,
    note: status === "appealed" ? "Level 1 appeal submitted with clinical documentation" : undefined,
    updatedAt: isoAt(Math.min(ctx.now, at + ctx.rng.int(1, 6) * DAY)),
  } satisfies Claim)
}

function baseEncounter(ctx: Ctx, id: string, patient: Patient, kind: Encounter["kind"], unitId: string, practitionerId: string, createdAt: number, status: EncounterStatus, s: Scenario): Encounter {
  return {
    id,
    kind,
    patientId: patient.id,
    unitId,
    practitionerId,
    payer: patient.payer,
    status,
    accountNumber: accountNumber(ctx),
    createdAt: isoAt(createdAt),
    chiefComplaint: s.complaint,
    eligibility: eligibilityFor(ctx, patient, createdAt + 2 * MIN),
    diagnoses: [],
    procedures: [],
    notes: [],
    vitals: [],
    handovers: [],
    assessments: [],
    exchange: "pending",
  }
}

const doctorFor = (ctx: Ctx, unitId: string) => ctx.data.staff.find((s) => s.role === "doctor" && s.unitId === unitId)?.id ?? "d3"
const nurseFor = (ctx: Ctx, unitId: string) => ctx.data.staff.find((s) => s.role === "nurse" && s.unitId === unitId)?.id ?? "n1"
const edTariff = (triage?: number): TariffKey => `ed-${triage ?? 3}` as TariffKey
const clinicTariff = (newPatient: boolean): TariffKey => (newPatient ? "clinic-new" : "clinic-est")
const roomTariff = (bedType: Bed["bedType"]): TariffKey => `room-${bedType}` as TariffKey

// ---------------------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------------------

/** Historical outpatient & ED visits for the last 30 days — they feed reports and claims. */
function makeHistory(ctx: Ctx, patients: Patient[]) {
  const { rng, now, data } = ctx
  const clinics = Object.keys(OUTPATIENT_SCENARIOS)
  let n = 0
  for (let day = 30; day >= 1; day--) {
    const weekend = [0, 6].includes(new Date(now - day * DAY).getDay())
    const visits = weekend ? 0 : rng.int(14, 20)
    for (let v = 0; v < visits; v++) {
      const unitId = rng.pick([...clinics, "clinic-fm", "clinic-fm", "clinic-im"])
      const s = rng.pick(OUTPATIENT_SCENARIOS[unitId])
      const patient = pickPatient(ctx, patients, s)
      const start = now - day * DAY - rng.int(2, 9) * HOUR
      const doc = doctorFor(ctx, unitId)
      const enc = baseEncounter(ctx, `h${++n}`, patient, "outpatient", unitId, doc, start, "finished", s)
      Object.assign(enc, { startedAt: isoAt(start + 25 * MIN), endedAt: isoAt(start + 45 * MIN), diagnoses: diagnosesFrom(ctx, s), disposition: rng.chance(0.3) ? "follow-up" : "home", exchange: rng.chance(0.95) ? "synced" : "failed" })
      enc.notes.push(noteFrom(s, start + 40 * MIN, doc))
      enc.vitals.push(vitalsFrom(s, start + 12 * MIN, nurseFor(ctx, unitId), rng))
      data.encounters.push(enc)
      const inv = openInvoice(ctx, enc)
      tariff(ctx, inv, start + 40 * MIN, clinicTariff(rng.chance(0.3)))
      addOrders(ctx, enc, patient, s, start + 41 * MIN, "validated", doc)
      addPrescription(ctx, enc, s, start + 42 * MIN, "dispensed", doc)
      closeFinance(ctx, enc, start + 2 * HOUR, true)
    }
    for (let k = rng.int(5, 8); k > 0; k--) {
      const s = rng.pick(ER_SCENARIOS.filter((x) => x.dx !== "stroke"))
      const patient = pickPatient(ctx, patients, s)
      const start = now - day * DAY - rng.int(1, 20) * HOUR
      const doc = rng.pick(["d2", "d12"])
      const enc = baseEncounter(ctx, `h${++n}`, patient, "emergency", "ed", doc, start, "finished", s)
      const losMin = rng.int(140, ctx.region === "uk" ? 300 : 330)
      Object.assign(enc, { triage: s.triage, startedAt: isoAt(start + rng.int(6, 40) * MIN), endedAt: isoAt(start + losMin * MIN), diagnoses: diagnosesFrom(ctx, s), procedures: proceduresFrom(ctx, s), disposition: "home", exchange: "synced" })
      enc.notes.push(noteFrom(s, start + 20 * MIN, doc, "ed"))
      data.encounters.push(enc)
      const inv = openInvoice(ctx, enc)
      tariff(ctx, inv, start, edTariff(s.triage))
      addOrders(ctx, enc, patient, s, start + 25 * MIN, "validated", doc)
      closeFinance(ctx, enc, start + 5 * HOUR, true)
    }
  }
  // Discharged inpatients (for ALOS / occupancy history): ~210 discharges in 30 days on 44
  // beds keeps historical occupancy close to today's.
  const pool = INPATIENT_SCENARIOS.filter((s) => s.dx !== "bronchiolitis" || ctx.rng.chance(0.3))
  for (let i = 0; i < 210; i++) {
    const s = rng.pick(pool)
    const patient = pickPatient(ctx, patients, s)
    const los = s.observation ? 1 : rng.int(2, 7)
    const end = now - rng.int(1, 29) * DAY - rng.int(1, 6) * HOUR
    const start = end - los * DAY
    const doc = s.doctor ?? "d3"
    const enc = baseEncounter(ctx, `hi${i}`, patient, "inpatient", s.unitHint, doc, start, "finished", s)
    // A few deaths, mostly in ICU — keeps mortality in a believable range.
    const died = s.unitHint === "icu" && i % 9 === 0
    Object.assign(enc, {
      startedAt: isoAt(start), endedAt: isoAt(end), diagnoses: diagnosesFrom(ctx, s, true), procedures: proceduresFrom(ctx, s),
      admissionClass: ctx.region === "us" ? (s.observation ? "observation" : "inpatient") : undefined,
      authNumber: ctx.region === "us" && patient.payer === "commercial" && i % 11 !== 0 ? `PA${String(880000 + i * 13)}` : undefined,
      disposition: died ? "expired" : ageYears(patient, now) > 78 && rng.chance(0.3) ? "snf" : "home", exchange: "synced",
    })
    enc.notes.push(noteFrom(s, start + 2 * HOUR, doc, "h&p"))
    data.encounters.push(enc)
    const inv = openInvoice(ctx, enc)
    tariff(ctx, inv, start, "ip-initial")
    if (enc.admissionClass === "observation") tariff(ctx, inv, end, "observation", 22)
    else tariff(ctx, inv, end, s.unitHint === "icu" ? "room-icu" : s.unitHint === "4w" && rng.chance(0.3) ? "room-telemetry" : s.unitHint === "mat" || s.unitHint === "peds" ? "room-private" : "room-med-surg", los)
    tariff(ctx, inv, end, "ip-subsequent", Math.max(0, los - 1))
    if (s.procedures?.some((p) => ["appendectomy", "lap-chole", "hemiarthroplasty", "cesarean"].includes(p))) {
      tariff(ctx, inv, start + DAY, "or-case")
      tariff(ctx, inv, start + DAY, "anesthesia")
    }
    addOrders(ctx, enc, patient, s, start + HOUR, "validated", doc)
    addPrescription(ctx, enc, s, start + HOUR, "dispensed", doc)
    closeFinance(ctx, enc, end, true)
  }
}

/** Today's clinics: a realistic mix of finished, in-progress and waiting patients. */
function makeOutpatientToday(ctx: Ctx, patients: Patient[]) {
  const { rng, now, data } = ctx
  const plan: [string, number, string][] = [["clinic-fm", 10, "F"], ["clinic-im", 6, "M"], ["clinic-cardio", 3, "C"], ["clinic-peds", 3, "P"], ["clinic-ob", 2, "O"], ["clinic-surg", 2, "S"], ["clinic-neuro", 1, "N"]]
  const startOfDay = new Date(now).setHours(0, 1, 0, 0)
  const dayFit = Math.min(1, (now - startOfDay) / (190 * MIN))
  for (const [unitId, count, prefix] of plan) {
    const doc = unitId === "clinic-im" ? "d3" : doctorFor(ctx, unitId)
    const scenarios = OUTPATIENT_SCENARIOS[unitId]
    for (let i = 0; i < count; i++) {
      const s = scenarios[i % scenarios.length]
      const patient = pickPatient(ctx, patients, s, ctx.active)
      // Earlier queue numbers arrived earlier and are further along. Shortly after midnight the
      // clinic day is compressed so "today" is never empty in the demo.
      const offset = (count - i) * rng.int(9, 14) * MIN + 10 * MIN
      const createdAt = now - offset * dayFit
      const share = i / count
      const status: EncounterStatus = share < 0.45 ? "finished" : share < 0.55 ? "in-progress" : share < 0.62 ? "called" : "registered"
      const enc = baseEncounter(ctx, `op${unitId}${i}`, patient, "outpatient", unitId, doc, createdAt, status, s)
      enc.queueNumber = `${prefix}${String(i + 1).padStart(3, "0")}`
      if (status !== "registered") enc.vitals.push(vitalsFrom(s, createdAt + 8 * MIN, nurseFor(ctx, unitId), rng))
      if (status === "called") enc.calledAt = isoAt(now - 1 * MIN)
      if (status === "in-progress" || status === "finished") {
        // Never later than "now", and earlier than the patient currently being called.
        enc.calledAt = isoAt(Math.min(createdAt + 20 * MIN * dayFit, now - 3 * MIN))
        enc.startedAt = isoAt(Math.min(createdAt + 22 * MIN * dayFit, now - 2 * MIN))
      }
      data.encounters.push(enc)
      const inv = openInvoice(ctx, enc)
      data.queueCounters[`${dayKey()}:${unitId}`] = i + 1
      if (status === "finished") {
        const t = Math.min(createdAt + 30 * MIN * dayFit, now - 2 * MIN)
        enc.endedAt = isoAt(t)
        enc.diagnoses = diagnosesFrom(ctx, s)
        enc.notes.push(noteFrom(s, t, doc))
        enc.disposition = rng.chance(0.35) ? "follow-up" : "home"
        enc.exchange = rng.chance(0.7) ? "synced" : rng.chance(0.5) ? "pending" : "failed"
        tariff(ctx, inv, t, clinicTariff(i % 3 === 0))
        const done = share < 0.25
        addOrders(ctx, enc, patient, s, t, done ? "validated" : rng.pick(["ordered", "collected", "in-progress", "resulted"] as const), doc)
        addPrescription(ctx, enc, s, t, done ? "dispensed" : rng.pick(["new", "reviewed", "prepared"] as const), doc)
        // Self-pay patients who already got their medicines have paid; the rest wait at the cashier.
        closeFinance(ctx, enc, t + 45 * MIN, done)
      }
    }
  }
}

function makeEmergencyNow(ctx: Ctx, patients: Patient[]) {
  const { rng, now, data } = ctx
  const fit = Math.min(1, (now - new Date(now).setHours(0, 1, 0, 0)) / (200 * MIN))
  // [scenario index, minutes since arrival, status]
  const board: [number, number, EncounterStatus][] = [
    [3, 4, "registered"],
    [0, 22, "in-progress"],
    [6, 35, "triaged"],
    [1, 58, "in-progress"],
    [2, 84, "in-progress"],
    [4, 110, "in-progress"],
    [5, 150, "in-progress"],
    [7, 260, "awaiting-admission"],
  ]
  // Patients who already left today — they make up today's four-hour / door-to-provider figures.
  const pool = ER_SCENARIOS.filter((x) => x.dx !== "stroke" && x.dx !== "sepsis")
  for (let i = 0; i < 14; i++) {
    const s = pool[i % pool.length]
    const patient = pickPatient(ctx, patients, s)
    const createdAt = now - (60 + i * 32) * MIN * fit - 5 * HOUR * fit
    const los = rng.int(110, i % 6 === 5 ? 290 : 235)
    const end = Math.min(createdAt + los * MIN * fit, now - 10 * MIN)
    const doc = i % 2 ? "d2" : "d12"
    const enc = baseEncounter(ctx, `ert${i}`, patient, "emergency", "ed", doc, createdAt, "finished", s)
    Object.assign(enc, { triage: s.triage, startedAt: isoAt(createdAt + rng.int(6, 38) * MIN * fit), endedAt: isoAt(end), diagnoses: diagnosesFrom(ctx, s), procedures: proceduresFrom(ctx, s), disposition: "home", exchange: "synced" })
    enc.notes.push(noteFrom(s, createdAt + 30 * MIN * fit, doc, "ed"))
    data.encounters.push(enc)
    const inv = openInvoice(ctx, enc)
    tariff(ctx, inv, createdAt, edTariff(s.triage))
    addOrders(ctx, enc, patient, s, createdAt + 25 * MIN * fit, "validated", doc)
    closeFinance(ctx, enc, end, false)
  }
  board.forEach(([si, mins, status], i) => {
    const s = ER_SCENARIOS[si]
    const patient = pickPatient(ctx, patients, s, ctx.active)
    const createdAt = now - mins * MIN * fit
    const doc = i % 2 ? "d2" : "d12"
    const enc = baseEncounter(ctx, `er${i}`, patient, "emergency", "ed", doc, createdAt, status, s)
    enc.queueNumber = `ED${String(i + 1).padStart(2, "0")}`
    if (status !== "registered") {
      enc.triage = s.triage
      enc.vitals.push(vitalsFrom(s, createdAt + 4 * MIN * fit, "n3", rng))
    }
    if (status === "in-progress" || status === "awaiting-admission") {
      // Door-to-provider varies with acuity and how busy the department was on arrival.
      enc.startedAt = isoAt(createdAt + (s.triage && s.triage <= 2 ? rng.int(2, 9) : rng.int(12, 34)) * MIN * fit)
      enc.notes.push(noteFrom(s, createdAt + 18 * MIN * fit, doc, "ed"))
      enc.diagnoses = diagnosesFrom(ctx, s)
      enc.procedures = proceduresFrom(ctx, s)
    }
    if (status === "awaiting-admission") {
      enc.disposition = "admit"
      enc.dispositionNote = ctx.region === "us" ? "Admit 4 West telemetry — urgent hemodialysis (boarding in ED)" : "Admit Ward 4 — urgent haemodialysis (DTA, awaiting bed)"
    }
    // The sepsis patient: time zero at triage, bundle partly done — the timer is the point.
    if (s.dx === "sepsis") {
      const t0 = createdAt + 6 * MIN * fit
      enc.sepsis = {
        identifiedAt: isoAt(t0),
        identifiedBy: "n3",
        septicShock: true,
        done: ctx.region === "us" ? { lactate: isoAt(t0 + 14 * MIN * fit), cultures: isoAt(t0 + 18 * MIN * fit), antibiotics: isoAt(t0 + 41 * MIN * fit) } : { oxygen: isoAt(t0 + 5 * MIN * fit), cultures: isoAt(t0 + 18 * MIN * fit), lactate: isoAt(t0 + 14 * MIN * fit), antibiotics: isoAt(t0 + 41 * MIN * fit) },
      }
    }
    data.encounters.push(enc)
    const inv = openInvoice(ctx, enc)
    if (status === "in-progress" || status === "awaiting-admission") {
      tariff(ctx, inv, createdAt, edTariff(s.triage))
      addOrders(ctx, enc, patient, s, createdAt + 20 * MIN * fit, i % 2 ? "in-progress" : "resulted", doc)
      addPrescription(ctx, enc, s, createdAt + 24 * MIN * fit, i < 4 ? "new" : "dispensed", doc)
    }
  })
}

function makeInpatientsNow(ctx: Ctx, patients: Patient[]) {
  const { rng, now, data, region } = ctx
  const byUnit = (unitId: string) => data.beds.filter((b) => b.unitId === unitId)
  const fill: Record<string, number> = { "4w": 12, "5e": 8, mat: 3, peds: 2, icu: 6 }
  let k = 0
  // Exactly two patients are getting worse: enough to show escalation, not so many that
  // the early-warning lists turn into noise (alarm fatigue is a real ward problem).
  const deteriorating = new Set(["hf", "pneumonia"])
  for (const [unitId, count] of Object.entries(fill)) {
    const beds = byUnit(unitId)
    const scenarios = INPATIENT_SCENARIOS.filter((s) => s.unitHint === unitId)
    for (let i = 0; i < count; i++) {
      const s: InpatientScenario = scenarios[i % scenarios.length]
      // Telemetry patients get telemetry beds; MRSA-risk abscess gets an isolation room.
      const bed = (s.dx === "hf" || s.dx === "syncope" || s.dx === "chest-pain" ? beds.find((b) => b.bedType === "telemetry" && b.status === "available") : s.dx === "cellulitis" && unitId === "5e" ? beds.find((b) => b.bedType === "isolation" && b.status === "available") : undefined) ?? beds.find((b) => b.status === "available" && b.bedType !== "isolation")!
      const patient = pickPatient(ctx, patients, s, ctx.active)
      // Post-op day-1 cases were admitted yesterday; everyone else 1–5 days ago.
      const los = s.observation ? 0 : s.complaint.startsWith("Post-op day 1") ? 1 : rng.int(1, 5)
      const start = now - los * DAY - rng.int(3, 14) * HOUR
      const doc = s.doctor ?? "d3"
      const nurse = nurseFor(ctx, unitId)
      const enc = baseEncounter(ctx, `ip${k++}`, patient, "inpatient", unitId, doc, start, "in-progress", s)
      enc.startedAt = isoAt(start)
      enc.bedId = bed.id
      enc.diagnoses = diagnosesFrom(ctx, s, true)
      enc.procedures = proceduresFrom(ctx, s)
      enc.exchange = rng.chance(0.85) ? "synced" : "failed"
      if (region === "us") {
        enc.admissionClass = s.observation ? "observation" : "inpatient"
        if (patient.payer === "commercial" || patient.coverage?.plan?.includes("Advantage")) enc.authNumber = k % 5 === 0 ? undefined : `PA${String(910000 + k * 17)}`
      }
      enc.notes.push(noteFrom(s, start + HOUR, doc, "h&p"))
      enc.notes.push({ ...noteFrom(s, now - rng.int(3, 9) * HOUR, doc), id: `n2${enc.id}` })
      // Vitals every 4 hours for the last 2 days: most patients recover, two deteriorate.
      const worse = deteriorating.delete(s.dx)
      for (let h = 48; h >= 0; h -= 4) {
        if (now - h * HOUR < start) continue
        const elapsed = (now - h * HOUR - start) / (now - start)
        // ICU patients improve slowly — they are still on organ support.
        const progress = worse ? -0.35 * elapsed : unitId === "icu" ? 0.05 + 0.35 * elapsed : 0.15 + 0.75 * elapsed
        enc.vitals.push(vitalsFrom(s, now - h * HOUR - 30 * MIN, nurse, rng, progress))
      }
      // Nursing assessments on admission and daily.
      const age = ageYears(patient, now)
      const morse = (age >= 65 ? 25 : 0) + 15 + 20 + (s.dx === "hip-fx" ? 20 : age >= 75 ? 10 : 0) + (s.vitals.consciousness && s.vitals.consciousness !== "A" ? 15 : 0)
      enc.assessments.push({ id: `mf${enc.id}`, at: isoAt(start + 2 * HOUR), by: nurse, kind: "morse", score: morse, answers: { history: age >= 65 ? 25 : 0, secondary: 15, iv: 20, gait: s.dx === "hip-fx" ? 20 : age >= 75 ? 10 : 0, mental: s.vitals.consciousness && s.vitals.consciousness !== "A" ? 15 : 0, aid: 0 } })
      const braden = unitId === "icu" ? rng.int(10, 13) : age >= 75 ? rng.int(13, 16) : rng.int(18, 22)
      enc.assessments.push({ id: `br${enc.id}`, at: isoAt(start + 2 * HOUR), by: nurse, kind: "braden", score: braden, answers: {} })
      // Nurses document too; the attending co-signs.
      if (i % 2 === 0)
        enc.notes.push({ id: `nn${enc.id}`, at: isoAt(now - rng.int(1, 4) * HOUR), authorId: nurse, role: "nurse", type: "nursing", subjective: "Reports poor sleep, pain improved since last shift.", objective: "Vitals as charted. IV site clean, no signs of phlebitis. Voiding adequately.", assessment: `Disturbed sleep pattern; fall risk (Morse ${morse}).`, plan: "Sleep hygiene, bed alarm on, call light in reach, hourly rounding." })
      if (i % 3 === 0)
        enc.handovers.push({
          id: `ho${enc.id}`,
          at: isoAt(now - 5 * HOUR),
          authorId: nurse,
          situation: s.a,
          background: s.s,
          assessment: worse ? "Vitals trending worse, NEWS2 rising" : "Stable",
          recommendation: worse ? "Hourly obs, escalate to provider if SpO₂ < 90% or SBP < 100" : "Continue plan, routine obs",
        })
      // Discharge planning: expected date from GMLOS (US) or typical length of stay (UK).
      const group = groupEncounter(enc, region)
      const expectedDays = s.observation ? 1 : Math.max(1, Math.round(group?.gmlos ?? (unitId === "icu" ? 5 : 4)))
      enc.dischargePlan = {
        edd: isoAt(start + expectedDays * DAY),
        barriers: s.barriers?.[region] ?? [],
        medicallyReady: !worse && rng.chance(0.3) && unitId !== "icu",
        imNotice: region === "us" && patient.payer === "medicare" && !s.observation ? k % 4 !== 0 : undefined,
      }
      // The septic shock patient in ICU completed the bundle.
      if (s.dx === "sepsis") {
        const t0 = start - 2 * HOUR
        enc.sepsis = { identifiedAt: isoAt(t0), identifiedBy: "n3", septicShock: true, done: Object.fromEntries(sepsisBundle(region).items.map((item, j) => [item.id, isoAt(t0 + (region === "uk" ? 8 + j * 8 : 20 + j * 25) * MIN)])) }
      }
      if (s.dx === "cellulitis" && unitId === "5e") patient.flags = [...new Set([...(patient.flags ?? []), "contact-isolation" as const])]
      bed.status = "occupied"
      bed.encounterId = enc.id
      data.encounters.push(enc)
      const inv = openInvoice(ctx, enc)
      tariff(ctx, inv, start, "ip-initial")
      if (enc.admissionClass === "observation") tariff(ctx, inv, now, "observation", Math.max(1, Math.round((now - start) / HOUR)))
      else tariff(ctx, inv, now, roomTariff(bed.bedType), Math.max(1, los))
      if (los > 1) tariff(ctx, inv, now, "ip-subsequent", los - 1)
      if (s.procedures?.some((p) => ["appendectomy", "lap-chole", "cesarean"].includes(p))) {
        tariff(ctx, inv, start + 4 * HOUR, "or-case")
        tariff(ctx, inv, start + 4 * HOUR, "anesthesia")
      }
      addOrders(ctx, enc, patient, s, now - rng.int(2, 10) * HOUR, rng.pick(["resulted", "validated", "validated", "collected"] as const), doc)
      const rx = addPrescription(ctx, enc, s, start + 2 * HOUR, "dispensed", doc)
      if (rx) makeMar(ctx, enc, rx)
    }
  }
  // Safety markers: elderly / hip fracture / stroke are fall risks; elderly stroke is DNR/DNI.
  for (const enc of data.encounters.filter((e) => e.kind === "inpatient" && e.status === "in-progress")) {
    const p = data.patients.find((x) => x.id === enc.patientId)!
    const morse = enc.assessments.find((a) => a.kind === "morse")?.score ?? 0
    if (morse >= 45) p.flags = [...new Set([...(p.flags ?? []), "fall-risk" as const])]
    const primary = DX_MAP.stroke[region].code
    if (enc.unitId === "icu" && enc.diagnoses[0]?.code === primary) {
      p.codeStatus = region === "us" ? "dnr-dni" : "dnr"
      p.advanceDirective = true
    }
  }
  // A few beds being cleaned or under maintenance — environmental services is part of bed flow.
  const free = data.beds.filter((b) => b.status === "available")
  free[0].status = "cleaning"
  free[3].status = "cleaning"
  free[5].status = "maintenance"
  free[7].status = "reserved"
}

function makeMar(ctx: Ctx, enc: Encounter, rx: Prescription) {
  const { now, data, rng } = ctx
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const nurse = nurseFor(ctx, enc.unitId)
  for (const line of rx.items) {
    const hours = FREQ_MAP[line.frequency]?.hours
    if (!hours?.length) continue
    const item = data.inventory.find((i) => i.id === line.itemId)
    for (const h of hours) {
      const at = today.getTime() + h * HOUR
      const past = at < now - 30 * MIN
      const given = past && rng.chance(0.93)
      data.mar.push({
        id: `mar-${enc.id}-${line.itemId}-${h}`,
        encounterId: enc.id,
        itemId: line.itemId,
        dose: line.dose,
        route: line.route,
        scheduledAt: isoAt(at),
        status: past ? (given ? "given" : "held") : "due",
        by: past ? nurse : undefined,
        at: past ? isoAt(at + rng.int(0, 25) * MIN) : undefined,
        note: past && !given ? "Held — patient NPO for procedure" : undefined,
        // ~ 96% scan compliance, as hospitals report to Leapfrog.
        scanned: given ? rng.chance(0.96) : undefined,
        witnessId: given && item?.highAlert ? "n2" : undefined,
      } satisfies MarEntry)
    }
  }
}

function makeAppointments(ctx: Ctx, patients: Patient[]): Appointment[] {
  const { rng, now, data } = ctx
  const out: Appointment[] = []
  const today = new Date(now)
  const opToday = data.encounters.filter((e) => e.kind === "outpatient" && dayKey(e.createdAt) === dayKey(today))
  // Most of today's clinic patients booked ahead; the rest walked in.
  opToday.forEach((enc, i) => {
    if (i % 3 === 2) return
    out.push({ id: `ap${i}`, patientId: enc.patientId, practitionerId: enc.practitionerId!, unitId: enc.unitId, date: enc.createdAt, time: new Date(enc.createdAt).toTimeString().slice(0, 5), status: "checked-in", source: rng.pick(["portal", "phone", "referral"] as const), encounterId: enc.id })
  })
  const later = [["d1", "clinic-fm"], ["d13", "clinic-im"], ["d4", "clinic-peds"], ["d8", "clinic-cardio"], ["d5", "clinic-ob"]]
  for (let i = 0; i < 12; i++) {
    const [doc, unit] = later[i % later.length]
    const p = patients.filter((x) => !ctx.active.has(x.id))[40 + i]
    const dayOffset = i < 7 ? 0 : 1
    const hour = 9 + (i % 6)
    const date = new Date(today)
    date.setDate(date.getDate() + dayOffset)
    date.setHours(hour, (i * 15) % 60, 0, 0)
    out.push({ id: `apl${i}`, patientId: p.id, practitionerId: doc, unitId: unit, date: date.toISOString(), time: `${String(hour).padStart(2, "0")}:${String((i * 15) % 60).padStart(2, "0")}`, status: dayOffset === 0 && i < 2 && date.getTime() < now ? "no-show" : "booked", source: rng.pick(["portal", "phone", "referral", "walk-in"] as const) })
  }
  return out
}

function makeRoster(ctx: Ctx): RosterEntry[] {
  const out: RosterEntry[] = []
  const start = new Date(ctx.now)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)) // Monday
  // Three 12-hour shifts a week, rotating days and nights.
  const pattern: ShiftCode[] = ["D", "D", "OFF", "OFF", "N", "N", "OFF"]
  const clinical = ctx.data.staff.filter((s) => s.role === "nurse" || (s.role === "doctor" && s.unitId === "ed"))
  clinical.forEach((s, idx) => {
    for (let d = 0; d < 14; d++) {
      const date = new Date(start)
      date.setDate(start.getDate() + d)
      out.push({ staffId: s.id, date: dayKey(date), shift: pattern[(d + idx * 2) % pattern.length] })
    }
  })
  return out
}

function makeSurgeries(ctx: Ctx, patients: Patient[]): Surgery[] {
  const { now, data, region } = ctx
  const at = (dayOffset: number, h: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() + dayOffset)
    d.setHours(h, 0, 0, 0)
    return d.toISOString()
  }
  const px = (key: string) => (region === "us" ? PX_MAP[key].us.code : PX_MAP[key].uk?.code)
  const free = (s: Scenario) => pickPatient(ctx, patients, s, ctx.active)
  const hip = data.encounters.find((e) => e.status === "in-progress" && e.diagnoses[0]?.code === DX_MAP["hip-fx"][region].code)
  const appy = data.encounters.find((e) => e.kind === "emergency" && e.status === "in-progress" && e.chiefComplaint.includes("Right lower quadrant"))
  const all = (ids: string[]) => Object.fromEntries(ids.map((i) => [i, true]))
  const rooms = OR_ROOMS[region]
  const chole = free({ dx: "cholelithiasis", complaint: "", s: "", o: "", a: "", p: "", vitals: {} })
  const cs = free({ dx: "prev-cs", complaint: "", s: "", o: "", a: "", p: "", vitals: {}, who: { sex: "female", minAge: 24, maxAge: 40 } })
  const hernia = free({ dx: "inguinal-hernia", complaint: "", s: "", o: "", a: "", p: "", vitals: {}, who: { sex: "male", minAge: 35, maxAge: 75 } })
  const auth = (p: Patient) => (region === "us" && (p.payer === "commercial" || p.coverage?.plan?.includes("Advantage")) ? ("approved" as const) : undefined)
  return [
    { id: "op1", patientId: chole.id, procedure: "Laparoscopic cholecystectomy", procedureCode: px("lap-chole"), surgeonId: "d6", anesthetistId: "d9", room: rooms[0], scheduledAt: at(0, 7), durationMin: 90, status: "done", auth: auth(chole), checklist: all(["si-identity", "si-site", "si-consent", "si-anesthesia", "si-allergy", "si-airway", "si-blood", "to-team", "to-confirm", "to-antibiotic", "to-imaging", "so-procedure", "so-count", "so-specimen", "so-concerns"]) },
    { id: "op2", patientId: cs.id, procedure: region === "us" ? "Repeat cesarean delivery" : "Elective caesarean section", procedureCode: px("cesarean"), surgeonId: "d5", anesthetistId: "d9", room: rooms[1], scheduledAt: at(0, 9), durationMin: 60, status: "time-out", auth: auth(cs), checklist: all(["si-identity", "si-site", "si-consent", "si-anesthesia", "si-allergy", "si-airway", "si-blood"]) },
    { id: "op3", patientId: hernia.id, procedure: region === "us" ? "Laparoscopic inguinal hernia repair" : "Laparoscopic inguinal hernia repair (TEP)", procedureCode: px("hernia-repair"), surgeonId: "d6", anesthetistId: "d9", room: rooms[0], scheduledAt: at(0, 13), durationMin: 75, status: "scheduled", auth: region === "us" && (hernia.payer === "commercial" || hernia.coverage?.plan?.includes("Advantage")) ? "pending" : undefined, checklist: {} },
    { id: "op4", patientId: hip?.patientId ?? patients[5].id, encounterId: hip?.id, procedure: "Hemiarthroplasty, right hip", procedureCode: px("hemiarthroplasty"), surgeonId: "d15", anesthetistId: "d9", room: rooms[2], scheduledAt: at(1, 8), durationMin: 120, status: "scheduled", checklist: {} },
    ...(appy ? [{ id: "op5", patientId: appy.patientId, encounterId: appy.id, procedure: "Laparoscopic appendectomy", procedureCode: px("appendectomy"), surgeonId: "d6", anesthetistId: "d9", room: rooms[1], scheduledAt: at(0, 17), durationMin: 60, status: "scheduled" as const, checklist: {} }] : []),
  ]
}

function makeIncidents(ctx: Ctx): Incident[] {
  const { now, region } = ctx
  const mk = (id: string, daysAgo: number, category: Incident["category"], harm: Incident["harm"], unitId: string, description: string, immediateAction: string, impact: Incident["impact"], probability: Incident["probability"], status: Incident["status"], reportedBy?: string, sentinel?: boolean): Incident => ({
    id, at: isoAt(now - daysAgo * DAY), reportedAt: isoAt(now - daysAgo * DAY + 3 * HOUR), category, harm, unitId, description, immediateAction, impact, probability, grade: riskGrade(probability, impact), status, reportedBy, sentinel,
  })
  const coAmox = region === "us" ? "Amoxicillin-clavulanate" : "Co-amoxiclav"
  return [
    mk("inc1", 2, "medication", "near-miss", "pharmacy", `${coAmox} ordered for a patient with a documented penicillin allergy (hives); intercepted at pharmacist verification.`, "Prescriber contacted; changed to a non-beta-lactam. Allergy alert override reasons reviewed.", 3, 3, "under-review", "p1"),
    mk("inc2", 5, "fall", "low", "4w", "Patient (Morse 55) found on the floor beside the bed at 03:10 while walking to the bathroom; bed alarm was not activated.", "Post-fall huddle, provider assessment, neuro obs, bed alarm on, toileting schedule.", 3, 3, "under-review", "n1"),
    mk("inc3", 9, "identification", "near-miss", "ed", "Wristbands swapped between two patients with similar names; caught by two-identifier check before blood draw.", "Bands replaced; name alert placed on both charts.", 3, 2, "closed"),
    mk("inc4", 14, "equipment", "none", "icu", "Infusion pump ICU-03 repeatedly alarmed for downstream occlusion with no occlusion present.", "Pump removed from service, biomed ticket opened, FDA MedWatch considered.", 2, 3, "closed", "n4"),
    mk("inc5", 21, "pressure-injury", "low", "5e", region === "us" ? "Stage 2 hospital-acquired pressure injury to sacrum found on day 4 (Braden 12)." : "Category 2 pressure ulcer to sacrum found on day 4 (Braden 12).", "Pressure-redistribution mattress, 2-hourly repositioning, tissue viability referral.", 2, 4, "closed", "n2"),
    mk("inc6", 33, "surgery", "severe", "or", "Retained surgical sponge identified on post-operative imaging; patient returned to the OR for removal.", region === "us" ? "Disclosure to patient, RCA² started, Joint Commission sentinel event review." : "Duty of Candour notification, Never Event reported, PSII commissioned.", 5, 2, "under-review", "d6", true),
    mk("inc7", 41, "specimen", "near-miss", "lab", "Unlabelled blood specimen received from 4 West.", "Specimen rejected and redrawn; labelling at bedside re-education.", 2, 4, "closed", "l1"),
    mk("inc8", 55, "infection", "moderate", "icu", region === "us" ? "Central line-associated bloodstream infection (NHSN criteria met) on line day 6." : "Line-related bloodstream infection on line day 6.", "Line removed, cultures, insertion bundle audit.", 3, 2, "closed", "d14"),
  ]
}

function makeIndicators(ctx: Ctx): IndicatorValue[] {
  const { rng, now, region } = ctx
  const out: IndicatorValue[] = []
  // Measures where this hospital is behind target — a realistic dashboard is never all green.
  const lagging = new Set(region === "us" ? ["sep-1", "lwbs", "hcahps"] : ["four-hour", "rtt", "twelve-hour"])
  for (let m = 5; m >= 0; m--) {
    const d = new Date(now)
    d.setDate(1)
    d.setMonth(d.getMonth() - m)
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const improvement = (5 - m) / 5
    for (const def of MEASURES[region]) {
      if (def.unit === "per 1,000") {
        const denominator = rng.int(900, 1150)
        const rate = def.target * (lagging.has(def.id) ? 1.25 : 0.82 - improvement * 0.12) * (0.9 + rng.next() * 0.2)
        out.push({ indicatorId: def.id, period, numerator: Math.max(0, Math.round((rate * denominator) / 1000)), denominator })
        continue
      }
      const denominator = rng.int(120, 640)
      const gap = lagging.has(def.id) ? (def.direction === "min" ? -7 + improvement * 2 : def.target * 0.45) : def.direction === "min" ? 2 + improvement * 2 : -def.target * 0.15
      const pct = Math.max(0, Math.min(100, def.target + gap + (rng.next() - 0.5) * 3))
      out.push({ indicatorId: def.id, period, numerator: Math.round((pct / 100) * denominator), denominator })
    }
  }
  return out
}

function makeSync(ctx: Ctx): SyncJob[] {
  const { data, region } = ctx
  const errors = region === "us"
    ? { hl7v2: "AE: PV1-3 location not mapped at receiving HIE (CDA-ADT-207)", fhir: "HTTP 503 from HIE FHIR endpoint — retry scheduled", x12: "271 AAA*N**72*C — Invalid/missing subscriber ID", surescripts: "Error 602 — receiving pharmacy NCPDP ID not found" }
    : { hl7v2: "AE: PV1-3 ward code not in receiving system's location table", fhir: "HTTP 422 — UKCore-Encounter: missing serviceProvider ODS code", pds: "PDS: no match on NHS number + date of birth", sus: "SUS+ CDS rejection — invalid registered GP practice code" }
  const jobs: SyncJob[] = []
  const recent = data.encounters.filter((e) => Date.now() - new Date(e.createdAt).getTime() < 3 * DAY)
  recent.forEach((e, i) => {
    const failed = e.exchange === "failed"
    const status = failed ? "failed" : e.exchange === "synced" ? "synced" : "pending"
    const event = e.kind === "inpatient" ? (e.status === "finished" ? "ADT^A03" : "ADT^A01") : "ADT^A04"
    jobs.push({ id: `hl7-${e.id}`, integration: "hl7v2", resource: event, ref: e.id, status: failed && i % 2 ? "failed" : status === "failed" ? "synced" : status, at: e.endedAt ?? e.createdAt, attempts: failed ? 3 : 1, error: failed && i % 2 ? errors.hl7v2 : undefined })
    jobs.push({ id: `fhir-${e.id}`, integration: "fhir", resource: "Encounter", ref: e.id, status, at: e.endedAt ?? e.createdAt, attempts: failed ? 3 : 1, error: failed ? errors.fhir : undefined })
    if (region === "us" && e.eligibility) jobs.push({ id: `x12-${e.id}`, integration: "x12", resource: "270/271", ref: e.id, status: i % 23 === 7 ? "failed" : "synced", at: e.eligibility.at, attempts: 1, error: i % 23 === 7 ? errors.x12 : undefined })
    if (region === "uk" && e.eligibility) jobs.push({ id: `pds-${e.id}`, integration: "pds", resource: "PDS trace", ref: e.id, status: i % 29 === 5 ? "failed" : "synced", at: e.eligibility.at, attempts: 1, error: i % 29 === 5 ? errors.pds : undefined })
  })
  for (const rx of data.prescriptions.filter((p) => Date.now() - new Date(p.prescribedAt).getTime() < 2 * DAY && data.encounters.find((e) => e.id === p.encounterId)?.kind === "outpatient").slice(0, 14))
    jobs.push(region === "us"
      ? { id: `erx-${rx.id}`, integration: "surescripts", resource: "NewRx", ref: rx.encounterId, status: rx.id.endsWith("3") ? "failed" : "synced", at: rx.prescribedAt, attempts: 1, error: rx.id.endsWith("3") ? errors.surescripts : undefined }
      : { id: `eps-${rx.id}`, integration: "eps", resource: "EPS prescription", ref: rx.encounterId, status: "synced", at: rx.prescribedAt, attempts: 1 })
  for (const c of data.claims.filter((x) => x.status === "submitted").slice(0, 10))
    jobs.push(region === "us"
      ? { id: `837-${c.id}`, integration: "x12", resource: data.encounters.find((e) => e.id === c.encounterId)?.kind === "inpatient" ? "837I" : "837P", ref: c.encounterId, status: "synced", at: c.updatedAt, attempts: 1 }
      : { id: `sus-${c.id}`, integration: "sus", resource: "CDS 6.3 APC/AE", ref: c.encounterId, status: c.id.endsWith("7") ? "failed" : "synced", at: c.updatedAt, attempts: 1, error: c.id.endsWith("7") ? errors.sus : undefined })
  return jobs.sort((a, b) => b.at.localeCompare(a.at))
}

function makeNotifications(ctx: Ctx): Notification[] {
  const { now, data, region } = ctx
  const out: Notification[] = []
  const critical = data.orders.find((o) => o.results.some((r) => r.flag === "HH" || r.flag === "LL") && !o.criticalCall)
  if (critical) {
    const p = data.patients.find((x) => x.id === critical.patientId)!
    out.push({ id: "nt1", at: isoAt(now - 12 * MIN), level: "danger", title: "Critical lab value", body: `${p.name} (MRN ${p.mrn}) — result outside critical limits. Call the responsible provider and document read-back.`, href: `/encounters/${critical.encounterId}`, roles: ["doctor", "nurse", "labtech"], read: false })
  }
  const sepsis = data.encounters.find((e) => e.sepsis && e.kind === "emergency")
  if (sepsis) out.push({ id: "nt6", at: isoAt(now - 30 * MIN), level: "danger", title: region === "us" ? "Sepsis alert — SEP-1 clock running" : "Red flag sepsis — Sepsis Six", body: `${data.patients.find((p) => p.id === sepsis.patientId)?.name}: bundle elements outstanding.`, href: `/encounters/${sepsis.id}`, roles: ["doctor", "nurse"], read: false })
  out.push({ id: "nt2", at: isoAt(now - 40 * MIN), level: "warning", title: "Below par level", body: "Several pharmacy and supply items are below par level.", href: "/inventory", roles: ["pharmacist", "admin", "manager"], read: false })
  const expired = data.staff.find((s) => s.license && new Date(s.license.expires).getTime() < now)
  if (expired) out.push({ id: "nt3", at: isoAt(now - 2 * HOUR), level: "danger", title: region === "us" ? "Medical license expired" : "Professional registration lapsed", body: `${expired.name}'s ${expired.license!.body} registration has expired — suspend clinical privileges and review clinic templates.`, href: "/hr", roles: ["admin", "manager"], read: false })
  out.push({ id: "nt4", at: isoAt(now - 3 * HOUR), level: "warning", title: region === "us" ? "New denials on 835 remittance" : "Private insurer rejections", body: region === "us" ? "Remittance posted with denied claims — work the denial queue within the appeal window." : "Insurer invoices returned — pre-authorisation missing.", href: "/claims", roles: ["coder", "manager"], read: false })
  out.push({ id: "nt5", at: isoAt(now - 5 * HOUR), level: "info", title: "Interface errors", body: region === "us" ? "Some ADT/FHIR messages were rejected by the HIE. Check location mapping." : "Some messages failed (PDS / SUS+). Check the interface log.", href: "/integrations", roles: ["admin"], read: true })
  return out
}

function moduleStates(enabled: ModuleId[]): Record<ModuleId, ModuleState> {
  return Object.fromEntries(
    MODULES.map((m) => [m.id, { enabled: !!m.core || enabled.includes(m.id), enabledAt: new Date().toISOString(), setupDone: m.setup.slice(0, Math.max(0, m.setup.length - 1)).map((s) => s.id) }]),
  ) as Record<ModuleId, ModuleState>
}

export function createSeed(enabled: ModuleId[] = MODULES.map((m) => m.id), region: Region = "us"): HospitalData {
  const now = Date.now()
  const rng = createRandom(Number(dayKey().replaceAll("-", "")) + (region === "uk" ? 7 : 0))
  const patients = makePatients({ rng, now, region })
  const staff = staffFor(region)
  const data: HospitalData = {
    version: DATA_VERSION,
    seededOn: dayKey(),
    onboarded: false,
    facility: { ...FACILITY[region] },
    modules: moduleStates(enabled),
    session: { role: "admin", userId: "a1", locked: false },
    units: unitsFor(region),
    staff,
    patients,
    beds: makeBeds(),
    encounters: [],
    orders: [],
    prescriptions: [],
    mar: [],
    inventory: inventoryFor(region),
    purchases: [],
    movements: [],
    schedules: SCHEDULE_TEMPLATE.map((s, i) => ({ ...s, id: `sch${i}` })),
    appointments: [],
    roster: [],
    surgeries: [],
    invoices: [],
    claims: [],
    incidents: [],
    indicators: [],
    syncJobs: [],
    audit: [],
    notifications: [],
    queueCounters: {},
    invoiceCounter: 0,
    accountCounter: 0,
    mrnCounter: 40_102_340 + patients.length * 37,
  }
  const ctx: Ctx = { rng, now, region, data, active: new Set() }
  makeHistory(ctx, patients)
  makeInpatientsNow(ctx, patients)
  makeOutpatientToday(ctx, patients)
  makeEmergencyNow(ctx, patients)
  data.roster = makeRoster(ctx)
  data.incidents = makeIncidents(ctx)
  data.indicators = makeIndicators(ctx)
  data.appointments = makeAppointments(ctx, patients)
  data.surgeries = makeSurgeries(ctx, patients)
  data.syncJobs = makeSync(ctx)
  data.notifications = makeNotifications(ctx)
  data.purchases = [
    { id: "pr1", createdAt: isoAt(now - 3 * DAY), createdBy: "p1", lines: [{ itemId: "azithro", qty: 200 }, { itemId: "albuterol", qty: 150 }], status: "approved" },
    { id: "pr2", createdAt: isoAt(now - DAY), createdBy: "p1", lines: [{ itemId: "rgt-lactate", qty: 10 }, { itemId: "sup-bcx", qty: 100 }], status: "submitted", note: region === "us" ? "Respiratory season — sepsis work-ups up 30%" : "Winter pressures — sepsis screening volume up" },
  ]
  data.movements = data.prescriptions
    .filter((p) => p.status === "dispensed")
    .slice(-40)
    .flatMap((p) => p.items.map((l, i) => ({ id: `mv-${p.id}-${i}`, at: p.dispensedAt!, itemId: l.itemId, qty: -l.qty, reason: "dispense" as const, ref: p.id })))
  const someone = data.patients[20]
  data.audit = [
    { id: "au1", at: isoAt(now - 6 * HOUR), userId: "a1", action: "Enabled module", target: "Coding & Claims" },
    { id: "au2", at: isoAt(now - 4 * HOUR), userId: "d3", action: "Opened chart", target: someone.name },
    { id: "au3", at: isoAt(now - 3 * HOUR), userId: "d12", action: "Break-the-glass access", target: data.patients[33].name, breakGlass: { reason: "Emergency — patient unresponsive, not on my list" } },
    { id: "au4", at: isoAt(now - 2 * HOUR), userId: "p1", action: "Verified order", target: "rx-h12" },
    { id: "au5", at: isoAt(now - 90 * MIN), userId: "c1", action: "Viewed record (no treatment relationship)", target: data.patients[71].name },
  ] satisfies AuditEntry[]
  return data
}
