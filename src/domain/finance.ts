/**
 * Billing, coding and claims rules.
 *
 * US: hospital (UB-04 / 837I) claims are paid per MS-DRG for inpatient stays and per line
 * item (CPT/HCPCS, APC for Medicare outpatient) otherwise; denials come back on the 835 with
 * CARC/RARC codes. UK: NHS activity is clinically coded (ICD-10 + OPCS-4), grouped to HRGs
 * and submitted to SUS+; private patients are invoiced to their insurer.
 */
import { dxByCode } from "./catalog"
import type { Region } from "./region"
import type { Claim, Denial, Encounter, Invoice, Patient, PayerType } from "./types"

export const invoiceTotal = (inv: Invoice) => inv.charges.reduce((sum, c) => sum + c.qty * c.price, 0)
export const invoicePaid = (inv: Invoice) => inv.payments.reduce((sum, p) => sum + p.amount, 0)
export const invoiceBalance = (inv: Invoice) => invoiceTotal(inv) - invoicePaid(inv)

export const PAYER_LABEL: Record<PayerType, string> = {
  medicare: "Medicare",
  medicaid: "Medicaid",
  commercial: "Commercial",
  "self-pay": "Self-pay",
  nhs: "NHS",
  private: "Private insured",
  overseas: "Overseas visitor",
}

export const PAYERS_BY_REGION: Record<Region, PayerType[]> = {
  us: ["medicare", "medicaid", "commercial", "self-pay"],
  uk: ["nhs", "private", "overseas"],
}

/** Patient pays the facility directly (no claim). */
export const isSelfPay = (p: PayerType) => p === "self-pay" || p === "overseas"
/** No patient-facing bill at all (NHS-funded care). */
export const isNhsFunded = (p: PayerType) => p === "nhs"

export interface ClaimCheck {
  id: string
  label: string
  ok: boolean
}

/** Pre-bill edits — the reasons claims most often deny (US) or fail SUS+ validation (UK). */
export function claimChecklist(enc: Encounter, patient: Patient, region: Region): ClaimCheck[] {
  const primary = enc.diagnoses.find((d) => d.primary)
  const symptomCode = !!primary && primary.code.startsWith("R")
  const signed = enc.notes.some((n) => n.role === "doctor")
  if (region === "uk")
    return [
      { id: "nhs-number", label: "Verified NHS number (PDS trace)", ok: patient.payer !== "nhs" || !!patient.nhsNumber },
      { id: "dx", label: "Primary diagnosis coded (ICD-10)", ok: !!primary },
      { id: "dx-specific", label: "Primary diagnosis is not a symptom code (R-chapter)", ok: !!primary && !symptomCode },
      { id: "procedure", label: "Procedures coded in OPCS-4 (inpatient spells)", ok: enc.kind !== "inpatient" || enc.procedures.length > 0 || !enc.diagnoses.some((d) => ["K35.8", "K80.2", "S72.0", "O34.2"].includes(d.code)) },
      { id: "summary", label: "Discharge summary / clinic letter signed", ok: signed },
      { id: "closed", label: "Spell / attendance closed", ok: enc.status === "finished" },
    ]
  return [
    { id: "eligibility", label: "Eligibility verified (270/271)", ok: patient.payer === "self-pay" || enc.eligibility?.status === "active" },
    { id: "auth", label: "Prior authorization on file (if required)", ok: !(enc.kind === "inpatient" && patient.payer === "commercial") || !!enc.authNumber },
    { id: "dx", label: "Principal diagnosis coded (ICD-10-CM)", ok: !!primary },
    { id: "dx-specific", label: "Principal diagnosis is specific (no R-code when a cause is known)", ok: !!primary && !symptomCode },
    { id: "poa", label: "POA indicator on every inpatient diagnosis", ok: enc.kind !== "inpatient" || enc.diagnoses.every((d) => !!d.poa) },
    { id: "documentation", label: "Attending note / H&P signed", ok: signed },
    { id: "closed", label: "Encounter closed (discharged)", ok: enc.status === "finished" },
  ]
}

// ---------------------------------------------------------------------------------------
// MS-DRG — illustrative subset. Relative weights and GMLOS are approximations of recent CMS
// IPPS tables; production loads the current fiscal-year Table 5.
// ---------------------------------------------------------------------------------------

interface DrgRow {
  /** [MCC, CC, without CC/MCC]; a single row means no CC split. */
  codes: [string, number, number][]
  title: string
  surgical?: string
}

const DRG: Record<string, DrgRow> = {
  pneumonia: { title: "Simple pneumonia & pleurisy", codes: [["193", 1.3, 4.4], ["194", 0.89, 3.3], ["195", 0.66, 2.6]] },
  hf: { title: "Heart failure & shock", codes: [["291", 1.33, 3.9], ["292", 0.89, 3.0], ["293", 0.64, 2.2]] },
  nstemi: { title: "Acute myocardial infarction, discharged alive", codes: [["280", 1.66, 4.0], ["281", 1.02, 2.8], ["282", 0.78, 1.9]] },
  stroke: { title: "Intracranial hemorrhage or cerebral infarction", codes: [["064", 1.84, 4.4], ["065", 1.04, 3.0], ["066", 0.74, 2.1]] },
  sepsis: { title: "Septicemia or severe sepsis without MV > 96 hours", codes: [["871", 1.9, 4.6], ["872", 1.04, 3.4], ["872", 1.04, 3.4]] },
  "copd-ae": { title: "Chronic obstructive pulmonary disease", codes: [["190", 1.17, 3.6], ["191", 0.92, 2.9], ["192", 0.72, 2.3]] },
  uti: { title: "Kidney & urinary tract infections", codes: [["689", 1.1, 3.5], ["690", 0.79, 2.6], ["690", 0.79, 2.6]] },
  t2dm: { title: "Diabetes", codes: [["637", 1.37, 3.9], ["638", 0.85, 2.7], ["639", 0.58, 2.0]] },
  "t2dm-hyper": { title: "Diabetes", codes: [["637", 1.37, 3.9], ["638", 0.85, 2.7], ["639", 0.58, 2.0]] },
  aki: { title: "Renal failure", codes: [["682", 1.49, 4.3], ["683", 0.89, 3.1], ["684", 0.62, 2.2]] },
  esrd: { title: "Renal failure", codes: [["682", 1.49, 4.3], ["683", 0.89, 3.1], ["684", 0.62, 2.2]] },
  hyperkalemia: { title: "Misc disorders of nutrition, metabolism, fluids/electrolytes", codes: [["640", 1.17, 3.5], ["641", 0.75, 2.7], ["641", 0.75, 2.7]] },
  dehydration: { title: "Misc disorders of nutrition, metabolism, fluids/electrolytes", codes: [["640", 1.17, 3.5], ["641", 0.75, 2.7], ["641", 0.75, 2.7]] },
  syncope: { title: "Syncope & collapse", codes: [["312", 0.82, 2.3]] },
  "chest-pain": { title: "Chest pain", codes: [["313", 0.62, 1.6]] },
  cellulitis: { title: "Cellulitis", codes: [["602", 1.39, 4.2], ["603", 0.85, 3.0], ["603", 0.85, 3.0]] },
  gastroenteritis: { title: "Esophagitis, gastroenteritis & misc digestive disorders", codes: [["391", 1.17, 3.4], ["392", 0.75, 2.4], ["392", 0.75, 2.4]] },
  "abd-pain": { title: "Esophagitis, gastroenteritis & misc digestive disorders", codes: [["391", 1.17, 3.4], ["392", 0.75, 2.4], ["392", 0.75, 2.4]] },
  concussion: { title: "Concussion", codes: [["088", 1.6, 4.0], ["089", 1.0, 2.6], ["090", 0.75, 1.8]] },
  appendicitis: { title: "Appendectomy without complicated principal diagnosis", surgical: "appendectomy", codes: [["341", 2.06, 4.0], ["342", 1.36, 2.3], ["343", 1.03, 1.4]] },
  cholelithiasis: { title: "Laparoscopic cholecystectomy without C.D.E.", surgical: "lap-chole", codes: [["417", 2.2, 4.5], ["418", 1.58, 2.8], ["419", 1.17, 1.7]] },
  "hip-fx": { title: "Hip replacement with principal diagnosis of hip fracture", surgical: "hemiarthroplasty", codes: [["521", 3.0, 5.6], ["522", 2.05, 3.6], ["522", 2.05, 3.6]] },
  "prev-cs": { title: "Cesarean section without sterilization", surgical: "cesarean", codes: [["786", 1.27, 3.6], ["787", 0.98, 2.8], ["788", 0.85, 2.4]] },
}

/** Secondary diagnoses that act as complications/comorbidities in the subset above. */
const MCC = new Set(["severe-sepsis", "esrd"])
const CC = new Set(["aki", "copd-ae", "af", "hf", "t2dm-hyper"])

/** Illustrative blended base rate (operating + capital) before wage index. */
export const DRG_BASE_RATE = 6800

/** Payment relative to Medicare by payer (commercial contracts pay above Medicare). */
const PAYER_FACTOR: Partial<Record<PayerType, number>> = { medicare: 1, medicaid: 0.82, commercial: 1.65 }

export interface GroupResult {
  code: string
  name: string
  weight?: number
  gmlos?: number
  tariff: number
}

/**
 * Mock MS-DRG / HRG grouper. Real groupers (3M, Solventum, NHS Reference Costs grouper)
 * run server-side; this gives coders the shape of the result from the current coding.
 */
export function groupEncounter(enc: Encounter, region: Region): GroupResult | null {
  const primary = enc.diagnoses.find((d) => d.primary)
  if (!primary) return null
  const concept = dxByCode(region, primary.code)
  if (!concept) return null
  const secondary = enc.diagnoses.filter((d) => !d.primary).map((d) => dxByCode(region, d.code)?.key)
  if (region === "uk") return hrgFor(enc, concept.key, secondary.some((k) => k && (MCC.has(k) || CC.has(k))))
  const row = DRG[concept.key]
  if (!row) return null
  const tier = secondary.some((k) => k && MCC.has(k)) ? 0 : secondary.some((k) => k && CC.has(k)) ? 1 : 2
  const [code, weight, gmlos] = row.codes[Math.min(tier, row.codes.length - 1)]
  const split = row.codes.length === 1 ? "" : tier === 0 ? " with MCC" : tier === 1 ? " with CC" : " without CC/MCC"
  const factor = PAYER_FACTOR[enc.payer] ?? 1
  return { code, name: `${row.title}${split}`, weight, gmlos, tariff: Math.round(weight * DRG_BASE_RATE * factor) }
}

/** HRG4+ families for the subset (the final letter is the CC split, assigned by the grouper). */
const HRG: Record<string, [string, string, number]> = {
  pneumonia: ["DZ11", "Lobar, atypical or viral pneumonia", 3200],
  hf: ["EB03", "Heart failure or shock", 3400],
  nstemi: ["EB10", "Actual or suspected myocardial infarction", 2800],
  stroke: ["AA35", "Stroke", 5600],
  "copd-ae": ["DZ65", "Chronic obstructive pulmonary disease or bronchitis", 2600],
  sepsis: ["WJ06", "Sepsis", 3900],
  uti: ["LA04", "Kidney or urinary tract infections", 2100],
  cholelithiasis: ["GA10", "Laparoscopic cholecystectomy", 4800],
}

function hrgFor(enc: Encounter, key: string, complex: boolean): GroupResult | null {
  // Non-admitted activity has its own currencies: outpatient attendances (WF01A follow-up /
  // WF01B first) and emergency medicine (VB01Z–VB11Z, set by investigations & treatments).
  if (enc.kind === "outpatient") {
    const first = !enc.referralNumber
    return { code: first ? "WF01B" : "WF01A", name: `Non-admitted face-to-face attendance, ${first ? "first" : "follow-up"}`, tariff: first ? 180 : 95 }
  }
  if (enc.kind === "emergency") return { code: "VB", name: "Emergency medicine HRG (VB01Z–VB11Z by investigations & treatments)", tariff: enc.triage && enc.triage <= 2 ? 420 : 240 }
  const row = HRG[key]
  if (!row) {
    // Outside the local subset: indicative value from length of stay; SUS+ assigns the final HRG.
    const days = Math.max(1, Math.round(((enc.endedAt ? new Date(enc.endedAt).getTime() : Date.now()) - new Date(enc.startedAt ?? enc.createdAt).getTime()) / 86400000))
    return { code: "HRG4+", name: "Assigned by the NHS HRG4+ grouper on SUS+ (indicative value from spell length)", tariff: 900 + days * 450 }
  }
  const [family, title, tariff] = row
  return { code: family, name: `${title}${complex ? " (with CC)" : ""}`, tariff: Math.round(tariff * (complex ? 1.35 : 1)) }
}

/** Expected reimbursement for line-item (fee-for-service) claims, as a share of billed charges. */
export function expectedFfs(billed: number, payer: PayerType): number {
  const ratio: Partial<Record<PayerType, number>> = { medicare: 0.28, medicaid: 0.22, commercial: 0.46, private: 0.8 }
  return Math.round(billed * (ratio[payer] ?? 1))
}

/** Which payment model a finished encounter is claimed under. */
export function grouperFor(enc: Encounter, region: Region): Claim["grouper"] {
  if (region === "uk") return enc.payer === "nhs" ? "HRG" : "FFS"
  return enc.kind === "inpatient" && enc.admissionClass !== "observation" ? "MS-DRG" : "FFS"
}

/** Common denial reasons (X12 CARC) used by the demo and the appeal workflow. */
export const DENIAL_REASONS: Denial[] = [
  { carc: "CO-197", text: "Precertification/authorization/notification absent" },
  { carc: "CO-16", rarc: "MA130", text: "Claim lacks information needed for adjudication" },
  { carc: "CO-50", text: "Not deemed a medical necessity by the payer" },
  { carc: "CO-11", text: "Diagnosis is inconsistent with the procedure" },
  { carc: "CO-27", text: "Expenses incurred after coverage terminated" },
  { carc: "CO-29", text: "The time limit for filing has expired" },
  { carc: "CO-22", text: "May be covered by another payer (coordination of benefits)" },
]

/** Concept key of an encounter's principal diagnosis, if coded. */
export function primaryKey(enc: Encounter, region: Region): string | undefined {
  const p = enc.diagnoses.find((d) => d.primary)
  return p ? dxByCode(region, p.code)?.key : undefined
}
