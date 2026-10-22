/**
 * Master data for the two demo facilities:
 * - US: Medisphere General Hospital, Columbus, Ohio (CMS-certified acute care hospital).
 * - UK: Northgate General Hospital, Medisphere University Hospitals NHS Foundation Trust, Leeds.
 *
 * Organisations and people are fictional. Identifiers follow the real formats and check
 * digits (NPI Luhn, NHS Modulus 11 in the reserved 999 test range, 555-01xx and Ofcom drama
 * phone ranges) so the data exercises real validation rules without pointing at real people.
 */
import { npiCheckDigit } from "@/domain/interop"
import type { Region } from "@/domain/region"
import type { BedType, DoctorSchedule, InventoryItem, RoleId, Staff, Unit } from "@/domain/types"
import type { FacilityProfile } from "@/store/schema"

// ---------------------------------------------------------------------------------------
// Facility
// ---------------------------------------------------------------------------------------

export const FACILITY: Record<Region, FacilityProfile> = {
  us: {
    region: "us",
    name: "Medisphere General Hospital",
    type: "general",
    city: "Columbus, OH",
    address: "1200 Riverbend Parkway, Columbus, OH 43215",
    code: "360999",
    orgId: `199999999${npiCheckDigit("199999999")}`,
  },
  uk: {
    region: "uk",
    name: "Northgate General Hospital",
    type: "general",
    city: "Leeds",
    address: "Northgate Road, Leeds LS7 4XX",
    code: "R0X",
    orgId: "Medisphere University Hospitals NHS Foundation Trust",
  },
}

// ---------------------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------------------

const unit = (id: string, kind: Unit["kind"], code: string, us: string, uk: string) => ({ id, kind, code, us, uk })

const UNIT_ROWS = [
  unit("clinic-fm", "clinic", "FM", "Family Medicine Clinic", "Urgent Treatment Centre"),
  unit("clinic-im", "clinic", "IM", "Internal Medicine Clinic", "General Medicine Outpatients"),
  unit("clinic-cardio", "clinic", "CAR", "Cardiology Clinic", "Cardiology Outpatients"),
  unit("clinic-peds", "clinic", "PED", "Pediatrics Clinic", "Paediatric Outpatients"),
  unit("clinic-ob", "clinic", "OB", "OB/GYN Clinic", "Antenatal Clinic"),
  unit("clinic-surg", "clinic", "GS", "General Surgery Clinic", "General Surgery Outpatients"),
  unit("clinic-neuro", "clinic", "NEU", "Neurology Clinic", "Neurology Outpatients"),
  unit("ed", "ed", "ED", "Emergency Department", "Emergency Department (A&E)"),
  unit("4w", "ward", "4W", "4 West · Medicine / Telemetry", "Ward 4 · Acute Medicine"),
  unit("5e", "ward", "5E", "5 East · Surgery & Orthopedics", "Ward 5 · Surgery & Trauma"),
  unit("mat", "ward", "MBU", "Mother-Baby Unit", "Maternity Ward"),
  unit("peds", "ward", "PEDS", "Pediatric Unit", "Children's Ward"),
  unit("icu", "icu", "ICU", "Medical-Surgical ICU", "Critical Care Unit"),
  unit("or", "or", "OR", "Surgical Services (OR)", "Main Theatres"),
  unit("lab", "lab", "LAB", "Clinical Laboratory", "Pathology"),
  unit("rad", "rad", "RAD", "Imaging Services", "Radiology"),
  unit("pharmacy", "pharmacy", "RX", "Inpatient Pharmacy", "Pharmacy"),
] as const

export const unitsFor = (region: Region): Unit[] => UNIT_ROWS.map((u) => ({ id: u.id, kind: u.kind, code: u.code, name: u[region] }))

export const WARD_LAYOUT: { unitId: string; prefix: string; count: number; bedType: BedType }[] = [
  { unitId: "4w", prefix: "4W", count: 10, bedType: "med-surg" },
  { unitId: "4w", prefix: "4T", count: 4, bedType: "telemetry" },
  { unitId: "5e", prefix: "5E", count: 10, bedType: "med-surg" },
  { unitId: "5e", prefix: "5I", count: 2, bedType: "isolation" },
  { unitId: "mat", prefix: "MB", count: 6, bedType: "private" },
  { unitId: "peds", prefix: "PD", count: 4, bedType: "private" },
  { unitId: "icu", prefix: "ICU", count: 8, bedType: "icu" },
]

/** Operating rooms / theatres. */
export const OR_ROOMS: Record<Region, string[]> = { us: ["OR 1", "OR 2", "OR 3"], uk: ["Theatre 1", "Theatre 2", "Theatre 3"] }

// ---------------------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------------------

const year = new Date().getFullYear()
const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d).toISOString()
/** A date `days` from today — used to make some licences expire soon. */
const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString()

interface StaffRow {
  id: string
  role: RoleId
  unitId?: string
  specialty?: string
  us: [name: string, title: string]
  uk: [name: string, title: string]
  /** Licence expiry: a date, or days from today for the ones that should raise alerts. */
  expires?: string
  resus?: string
}

const STAFF_ROWS: StaffRow[] = [
  { id: "d1", role: "doctor", unitId: "clinic-fm", specialty: "Family Medicine", us: ["Dr. Michael Chen, MD", "Family Medicine Physician"], uk: ["Dr James Whitfield", "GP, UTC Clinical Lead"] },
  { id: "d2", role: "doctor", unitId: "ed", specialty: "Emergency Medicine", us: ["Dr. Emily Rodriguez, MD", "Emergency Physician"], uk: ["Dr Sophie Turner", "Consultant in Emergency Medicine"], expires: inDays(24) },
  { id: "d3", role: "doctor", unitId: "clinic-im", specialty: "Internal Medicine", us: ["Dr. Robert Kim, MD", "Internal Medicine Physician"], uk: ["Dr Anil Gupta", "Consultant in Acute Medicine"] },
  { id: "d4", role: "doctor", unitId: "clinic-peds", specialty: "Pediatrics", us: ["Dr. Laura Bennett, MD", "Pediatrician"], uk: ["Dr Hannah Clarke", "Consultant Paediatrician"] },
  { id: "d5", role: "doctor", unitId: "clinic-ob", specialty: "Obstetrics & Gynecology", us: ["Dr. Angela Brooks, MD", "Obstetrician-Gynecologist"], uk: ["Miss Rachel Evans", "Consultant Obstetrician"] },
  { id: "d6", role: "doctor", unitId: "clinic-surg", specialty: "General Surgery", us: ["Dr. David Thompson, MD, FACS", "General Surgeon"], uk: ["Mr Thomas Wright", "Consultant General Surgeon"] },
  { id: "d7", role: "doctor", unitId: "clinic-neuro", specialty: "Neurology", us: ["Dr. Priya Patel, MD", "Neurologist"], uk: ["Dr Fiona MacLeod", "Consultant Neurologist"], expires: inDays(-3) },
  { id: "d8", role: "doctor", unitId: "clinic-cardio", specialty: "Cardiology", us: ["Dr. Marcus Johnson, MD, FACC", "Cardiologist"], uk: ["Dr Oliver Bennett", "Consultant Cardiologist"] },
  { id: "d9", role: "doctor", unitId: "or", specialty: "Anesthesiology", us: ["Dr. Steven Wallace, MD", "Anesthesiologist"], uk: ["Dr Catherine Hughes", "Consultant Anaesthetist"] },
  { id: "d10", role: "doctor", unitId: "rad", specialty: "Radiology", us: ["Dr. Jennifer Lee, MD", "Diagnostic Radiologist"], uk: ["Dr Mohammed Iqbal", "Consultant Radiologist"] },
  { id: "d11", role: "doctor", unitId: "lab", specialty: "Pathology", us: ["Dr. William Foster, MD", "Pathologist, Lab Medical Director"], uk: ["Dr Eleanor Price", "Consultant Chemical Pathologist"] },
  { id: "d12", role: "doctor", unitId: "ed", specialty: "Emergency Medicine", us: ["Dr. Kevin O'Brien, DO", "Emergency Physician"], uk: ["Dr Daniel Okafor", "Emergency Medicine Registrar (ST5)"] },
  { id: "d13", role: "doctor", unitId: "clinic-im", specialty: "Internal Medicine", us: ["Dr. Rachel Green, MD", "Hospitalist"], uk: ["Dr Laura Simpson", "Consultant Physician"] },
  { id: "d14", role: "doctor", unitId: "icu", specialty: "Critical Care", us: ["Dr. Ahmed Hassan, MD", "Intensivist"], uk: ["Dr Richard Moore", "Consultant Intensivist"] },
  { id: "d15", role: "doctor", unitId: "5e", specialty: "Orthopedic Surgery", us: ["Dr. Brian Walsh, MD", "Orthopedic Surgeon"], uk: ["Mr Andrew Collins", "Consultant Trauma & Orthopaedic Surgeon"] },
  { id: "n1", role: "nurse", unitId: "4w", us: ["Jessica Turner, RN, BSN", "Charge Nurse"], uk: ["Grace O'Neill, RN", "Ward Sister (Band 7)"] },
  { id: "n2", role: "nurse", unitId: "5e", us: ["Maria Gonzalez, RN", "Staff Nurse"], uk: ["Amy Robinson, RN", "Staff Nurse (Band 5)"], expires: inDays(40) },
  { id: "n3", role: "nurse", unitId: "ed", us: ["Tyler Brooks, RN, CEN", "Emergency Nurse"], uk: ["Liam Walsh, RN", "Senior Staff Nurse (Band 6)"] },
  { id: "n4", role: "nurse", unitId: "icu", us: ["Ashley Nguyen, RN, CCRN", "Critical Care Nurse"], uk: ["Chloe Martin, RN", "Critical Care Nurse (Band 6)"], resus: inDays(12) },
  { id: "n5", role: "nurse", unitId: "clinic-fm", us: ["Brandon Lewis, LPN", "Clinic Nurse"], uk: ["Megan Hall, RN", "Staff Nurse, UTC"] },
  { id: "n6", role: "nurse", unitId: "mat", us: ["Stephanie Price, RN", "Mother-Baby Nurse"], uk: ["Hollie Ward, RM", "Midwife (Band 6)"] },
  { id: "n7", role: "nurse", unitId: "or", us: ["Daniel Kim, RN, CNOR", "Perioperative Nurse"], uk: ["Ryan Scott, ODP", "Operating Department Practitioner"] },
  { id: "n8", role: "nurse", unitId: "peds", us: ["Olivia Carter, RN, CPN", "Pediatric Nurse"], uk: ["Lucy Edwards, RN (Child)", "Children's Nurse (Band 5)"] },
  { id: "f1", role: "frontdesk", unitId: "clinic-fm", us: ["Ana Morales", "Patient Access Representative"], uk: ["Karen Lewis", "Outpatient Receptionist"] },
  { id: "f2", role: "frontdesk", unitId: "ed", us: ["Marcus Reed", "ED Registration Specialist"], uk: ["Paul Jenkins", "ED Receptionist"] },
  { id: "p1", role: "pharmacist", unitId: "pharmacy", us: ["Linda Park, PharmD, BCPS", "Clinical Pharmacist"], uk: ["Aisha Rahman, MPharm", "Lead Clinical Pharmacist"] },
  { id: "p2", role: "pharmacist", unitId: "pharmacy", us: ["Gregory Hall, PharmD", "Staff Pharmacist"], uk: ["Ben Taylor, MPharm", "Rotational Pharmacist"], expires: inDays(18) },
  { id: "l1", role: "labtech", unitId: "lab", us: ["Nicole Adams, MLS(ASCP)", "Medical Laboratory Scientist"], uk: ["Joanne Baker", "Biomedical Scientist"] },
  { id: "l2", role: "labtech", unitId: "lab", us: ["Jason Rivera, MLT(ASCP)", "Medical Laboratory Technician"], uk: ["Sam Patel", "Biomedical Scientist"] },
  { id: "r1", role: "radiographer", unitId: "rad", us: ["Chris Morgan, RT(R)(CT)", "Radiologic Technologist"], uk: ["Emma Wilson", "Diagnostic Radiographer"] },
  { id: "c1", role: "cashier", unitId: "clinic-fm", us: ["Patricia Young", "Patient Financial Services Rep"], uk: ["Helen Murphy", "Private Patients Officer"] },
  { id: "k1", role: "coder", us: ["Denise Carter, RHIT, CCS", "Inpatient Coding Specialist"], uk: ["Gemma Wood, ACC", "Senior Clinical Coder"] },
  { id: "m1", role: "manager", us: ["Richard Allen, MBA", "Chief Operating Officer"], uk: ["Dr Susan Fletcher", "Medical Director"] },
  { id: "a1", role: "admin", us: ["Kevin Shaw", "EHR Systems Administrator"], uk: ["Mark Davies", "Clinical Systems Manager"] },
]

/** Licensing body per role and region. */
const LICENSE_BODY: Partial<Record<RoleId, Record<Region, [body: string, prefix: string]>>> = {
  doctor: { us: ["State Medical Board of Ohio", "35."], uk: ["GMC", ""] },
  nurse: { us: ["Ohio Board of Nursing", "RN."], uk: ["NMC", ""] },
  pharmacist: { us: ["Ohio Board of Pharmacy", "03-1-"], uk: ["GPhC", ""] },
  labtech: { us: ["ASCP Board of Certification", "MLS-"], uk: ["HCPC", "BS"] },
  radiographer: { us: ["ARRT", "ARRT-"], uk: ["HCPC", "RA"] },
}

function licenseNumber(row: StaffRow, region: Region, i: number): string {
  const body = LICENSE_BODY[row.role]?.[region]
  if (!body) return ""
  const n = String(4_102_000 + i * 7_919).slice(-6)
  if (region === "uk" && body[0] === "GMC") return `7${n}`
  // NMC PIN: 2 digits, a letter, 4 digits, a letter (e.g. 09I1234E).
  if (region === "uk" && body[0] === "NMC") return `${n.slice(0, 2)}${"ABCDEFGHI"[i % 9]}${n.slice(2, 6)}${"EOS"[i % 3]}`
  if (region === "uk" && body[0] === "GPhC") return `20${n.slice(1)}`
  return `${body[1]}${n}`
}

export function staffFor(region: Region): Staff[] {
  return STAFF_ROWS.map((row, i) => {
    const [name, title] = row[region]
    const body = LICENSE_BODY[row.role]?.[region]
    const base = String(123_450_000 + i * 104_729).slice(0, 9)
    return {
      id: row.id,
      name,
      role: row.role,
      title,
      specialty: row.specialty,
      unitId: row.unitId,
      phone: region === "us" ? `(614) 555-01${String(10 + i).slice(-2)}` : `07700 900${String(100 + i)}`,
      license: body ? { body: body[0], number: licenseNumber(row, region, i), expires: row.expires ?? iso(year + 1 + (i % 3), 1 + (i % 12), 1 + (i % 27)) } : undefined,
      npi: region === "us" && (row.role === "doctor" || row.role === "pharmacist") ? `1${base.slice(1)}${npiCheckDigit(`1${base.slice(1)}`)}` : undefined,
      deaExpires: region === "us" && row.role === "doctor" ? iso(year + 1 + (i % 2), 3 + (i % 9), 1) : undefined,
      resusCertExpires: row.role === "doctor" || row.role === "nurse" ? row.resus ?? iso(year + 1, 1 + ((i * 5) % 12), 15) : undefined,
    }
  })
}

/** Who is "logged in" when the demo switches to a role. */
export const DEFAULT_USER_FOR_ROLE = {
  admin: "a1",
  doctor: "d3",
  nurse: "n1",
  frontdesk: "f1",
  pharmacist: "p1",
  labtech: "l1",
  radiographer: "r1",
  cashier: "c1",
  coder: "k1",
  manager: "m1",
} as const

// ---------------------------------------------------------------------------------------
// Provider schedules (clinic templates)
// ---------------------------------------------------------------------------------------

export const SCHEDULE_TEMPLATE: Omit<DoctorSchedule, "id">[] = [
  ...[1, 2, 3, 4, 5].map((weekday) => ({ practitionerId: "d1", unitId: "clinic-fm", weekday, start: "08:00", end: "17:00", quota: 24 })),
  ...[1, 3, 5].map((weekday) => ({ practitionerId: "d13", unitId: "clinic-im", weekday, start: "08:30", end: "12:30", quota: 14 })),
  ...[2, 4].map((weekday) => ({ practitionerId: "d13", unitId: "clinic-im", weekday, start: "13:00", end: "17:00", quota: 14 })),
  ...[1, 2, 4].map((weekday) => ({ practitionerId: "d4", unitId: "clinic-peds", weekday, start: "09:00", end: "16:00", quota: 18 })),
  ...[2, 3, 5].map((weekday) => ({ practitionerId: "d5", unitId: "clinic-ob", weekday, start: "08:00", end: "12:00", quota: 12 })),
  ...[1, 3].map((weekday) => ({ practitionerId: "d6", unitId: "clinic-surg", weekday, start: "13:00", end: "17:00", quota: 10 })),
  ...[2, 5].map((weekday) => ({ practitionerId: "d7", unitId: "clinic-neuro", weekday, start: "09:00", end: "12:00", quota: 8 })),
  ...[1, 2, 3, 4].map((weekday) => ({ practitionerId: "d8", unitId: "clinic-cardio", weekday, start: "08:00", end: "12:00", quota: 12 })),
]

// ---------------------------------------------------------------------------------------
// Formulary & supplies
// ---------------------------------------------------------------------------------------

const exp = (months: number) => new Date(Date.now() + months * 30 * 86400000).toISOString()

interface DrugRow {
  id: string
  us: string
  uk?: string
  atc?: string
  drugClass?: string
  category?: InventoryItem["category"]
  form: string
  unit: string
  /** [USD, GBP] per unit. */
  price: [number, number]
  minStock: number
  stock: [lot: string, months: number, qty: number][]
  highAlert?: boolean
  /** [DEA schedule, UK CD schedule] */
  controlled?: [string, string]
  formulary?: boolean
}

const DRUGS: DrugRow[] = [
  { id: "apap", us: "Acetaminophen 500 mg tablet", uk: "Paracetamol 500 mg tablet", atc: "N02BE01", drugClass: "analgesic", form: "Tablet", unit: "tab", price: [0.4, 0.05], minStock: 600, stock: [["APA2603", 14, 1800], ["APA2512", 4, 260]] },
  { id: "apap-susp", us: "Acetaminophen 160 mg/5 mL oral suspension", uk: "Paracetamol 120 mg/5 mL oral suspension", atc: "N02BE01", drugClass: "analgesic", form: "Oral suspension", unit: "bottle", price: [6, 1.8], minStock: 30, stock: [["APS2601", 11, 46]] },
  { id: "ibu", us: "Ibuprofen 400 mg tablet", atc: "M01AE01", drugClass: "nsaid", form: "Tablet", unit: "tab", price: [0.5, 0.06], minStock: 300, stock: [["IBU2604", 18, 640]] },
  { id: "oxy", us: "Oxycodone 5 mg tablet", atc: "N02AA05", drugClass: "opioid", form: "Tablet", unit: "tab", price: [1.2, 0.3], minStock: 100, stock: [["OXY2602", 15, 140]], highAlert: true, controlled: ["II", "2"] },
  { id: "morphine", us: "Morphine 4 mg/mL injection", uk: "Morphine 10 mg/mL injection", atc: "N02AA01", drugClass: "opioid", form: "Injection", unit: "vial", price: [9, 1.5], minStock: 40, stock: [["MOR2603", 15, 52]], highAlert: true, controlled: ["II", "2"] },
  { id: "lorazepam", us: "Lorazepam 2 mg/mL injection", uk: "Lorazepam 4 mg/mL injection", atc: "N05BA06", drugClass: "benzodiazepine", form: "Injection", unit: "vial", price: [12, 2.2], minStock: 20, stock: [["LOR2601", 9, 26]], controlled: ["IV", "4"] },
  { id: "amox-clav", us: "Amoxicillin-clavulanate 875/125 mg tablet", uk: "Co-amoxiclav 500/125 mg tablet", atc: "J01CR02", drugClass: "penicillin", form: "Tablet", unit: "tab", price: [2.1, 0.3], minStock: 200, stock: [["AMC2602", 16, 420]] },
  { id: "ceftriaxone", us: "Ceftriaxone 1 g injection", atc: "J01DD04", drugClass: "cephalosporin", form: "Vial", unit: "vial", price: [14, 2.4], minStock: 100, stock: [["CRO2603", 16, 210]] },
  { id: "cefazolin", us: "Cefazolin 2 g injection", atc: "J01DB04", drugClass: "cephalosporin", form: "Vial", unit: "vial", price: [11, 2], minStock: 80, stock: [["CFZ2601", 12, 120]] },
  { id: "piptazo", us: "Piperacillin-tazobactam 4.5 g injection", uk: "Piperacillin with tazobactam 4.5 g injection", atc: "J01CR05", drugClass: "penicillin", form: "Vial", unit: "vial", price: [24, 8], minStock: 60, stock: [["TZP2602", 10, 74]] },
  { id: "vanc", us: "Vancomycin 1 g injection", atc: "J01XA01", drugClass: "glycopeptide", form: "Vial", unit: "vial", price: [18, 6], minStock: 40, stock: [["VAN2601", 14, 55]] },
  { id: "azithro", us: "Azithromycin 500 mg tablet", atc: "J01FA10", drugClass: "macrolide", form: "Tablet", unit: "tab", price: [3.2, 0.5], minStock: 100, stock: [["AZM2511", 2, 60]] },
  { id: "clarithro", us: "Clarithromycin 500 mg tablet", atc: "J01FA09", drugClass: "macrolide", form: "Tablet", unit: "tab", price: [2.8, 0.4], minStock: 100, stock: [["CLR2604", 18, 240]] },
  { id: "nitrofurantoin", us: "Nitrofurantoin monohydrate/macrocrystals 100 mg capsule", uk: "Nitrofurantoin 100 mg MR capsule", atc: "J01XE01", drugClass: "nitrofuran", form: "Capsule", unit: "cap", price: [1.6, 0.4], minStock: 150, stock: [["NIT2602", 14, 320]] },
  { id: "metformin", us: "Metformin 500 mg tablet", atc: "A10BA02", drugClass: "biguanide", form: "Tablet", unit: "tab", price: [0.2, 0.03], minStock: 600, stock: [["MET2604", 19, 2400]] },
  { id: "glargine", us: "Insulin glargine 100 units/mL pen", atc: "A10AE04", drugClass: "insulin-basal", form: "Pen", unit: "pen", price: [92, 9], minStock: 20, stock: [["GLA2602", 8, 34]], highAlert: true },
  { id: "lispro", us: "Insulin lispro 100 units/mL (correction scale)", atc: "A10AB04", drugClass: "insulin-rapid", form: "Vial", unit: "vial", price: [74, 14], minStock: 15, stock: [["LIS2603", 7, 22]], highAlert: true },
  { id: "insulin-reg", us: "Insulin regular (human) 100 units/mL", uk: "Soluble insulin (Actrapid) 100 units/mL", atc: "A10AB01", drugClass: "insulin-iv", form: "Vial", unit: "vial", price: [38, 7.5], minStock: 10, stock: [["REG2602", 7, 12]], highAlert: true },
  { id: "amlodipine", us: "Amlodipine 10 mg tablet", atc: "C08CA01", drugClass: "ccb", form: "Tablet", unit: "tab", price: [0.2, 0.03], minStock: 500, stock: [["AML2605", 24, 1600]] },
  { id: "lisinopril", us: "Lisinopril 10 mg tablet", atc: "C09AA03", drugClass: "ace-inhibitor", form: "Tablet", unit: "tab", price: [0.15, 0.03], minStock: 300, stock: [["LIS2601", 15, 700]] },
  { id: "spironolactone", us: "Spironolactone 25 mg tablet", atc: "C03DA01", drugClass: "potassium-sparing", form: "Tablet", unit: "tab", price: [0.3, 0.05], minStock: 150, stock: [["SPI2602", 17, 120]] },
  { id: "furosemide-iv", us: "Furosemide 10 mg/mL injection", atc: "C03CA01", drugClass: "loop-diuretic", form: "Injection", unit: "vial", price: [4, 0.6], minStock: 80, stock: [["FUI2603", 21, 140]] },
  { id: "furosemide", us: "Furosemide 40 mg tablet", atc: "C03CA01", drugClass: "loop-diuretic", form: "Tablet", unit: "tab", price: [0.15, 0.02], minStock: 300, stock: [["FUR2603", 21, 820]] },
  { id: "atorvastatin", us: "Atorvastatin 40 mg tablet", atc: "C10AA05", drugClass: "statin", form: "Tablet", unit: "tab", price: [0.25, 0.04], minStock: 400, stock: [["ATV2602", 18, 1100]] },
  { id: "apixaban", us: "Apixaban 5 mg tablet", atc: "B01AF02", drugClass: "anticoagulant", form: "Tablet", unit: "tab", price: [8.5, 0.9], minStock: 120, stock: [["APX2602", 16, 280]], highAlert: true },
  { id: "enoxaparin", us: "Enoxaparin 40 mg/0.4 mL syringe", atc: "B01AB05", drugClass: "anticoagulant", form: "Prefilled syringe", unit: "syringe", price: [22, 2.6], minStock: 100, stock: [["ENX2604", 14, 180]], highAlert: true },
  { id: "heparin", us: "Heparin 5,000 units/mL injection", atc: "B01AB01", drugClass: "anticoagulant", form: "Vial", unit: "vial", price: [3.5, 1.2], minStock: 60, stock: [["HEP2601", 12, 90]], highAlert: true },
  { id: "aspirin", us: "Aspirin 81 mg chewable tablet", uk: "Aspirin 75 mg dispersible tablet", atc: "B01AC06", drugClass: "antiplatelet", form: "Tablet", unit: "tab", price: [0.05, 0.02], minStock: 400, stock: [["ASA2604", 22, 900]] },
  { id: "clopidogrel", us: "Clopidogrel 75 mg tablet", atc: "B01AC04", drugClass: "antiplatelet-p2y12", form: "Tablet", unit: "tab", price: [0.6, 0.05], minStock: 200, stock: [["CLO2602", 15, 320]] },
  { id: "ntg", us: "Nitroglycerin 0.4 mg sublingual tablet", uk: "Glyceryl trinitrate 400 micrograms/dose spray", atc: "C01DA02", drugClass: "nitrate", form: "SL", unit: "dose", price: [0.9, 0.2], minStock: 100, stock: [["NTG2601", 9, 150]] },
  { id: "alteplase", us: "Alteplase 100 mg injection (tPA)", atc: "B01AD02", drugClass: "thrombolytic", form: "Vial", unit: "vial", price: [9800, 1200], minStock: 2, stock: [["ALT2603", 18, 3]], highAlert: true },
  { id: "norepinephrine", us: "Norepinephrine 4 mg/4 mL injection", uk: "Noradrenaline 4 mg/4 mL injection", atc: "C01CA03", drugClass: "vasopressor", form: "Ampule", unit: "amp", price: [28, 4], minStock: 20, stock: [["NOR2602", 10, 24]], highAlert: true },
  { id: "pantoprazole", us: "Pantoprazole 40 mg tablet", atc: "A02BC02", drugClass: "ppi", form: "Tablet", unit: "tab", price: [0.3, 0.05], minStock: 400, stock: [["PAN2604", 23, 380]] },
  { id: "esomeprazole-brand", us: "Nexium (esomeprazole) 40 mg capsule", atc: "A02BC05", drugClass: "ppi", form: "Capsule", unit: "cap", price: [9, 1.1], minStock: 50, stock: [["NEX2601", 6, 90]], formulary: false },
  { id: "ondansetron", us: "Ondansetron 4 mg/2 mL injection", atc: "A04AA01", drugClass: "antiemetic", form: "Injection", unit: "vial", price: [2.5, 0.6], minStock: 80, stock: [["OND2601", 10, 95]] },
  { id: "albuterol", us: "Albuterol 2.5 mg/3 mL nebulizer solution", uk: "Salbutamol 2.5 mg/2.5 mL nebuliser liquid", atc: "R03AC02", drugClass: "saba", form: "Nebule", unit: "neb", price: [0.8, 0.2], minStock: 100, stock: [["ALB2602", 14, 70]] },
  { id: "ipratropium", us: "Ipratropium 0.5 mg/2.5 mL nebulizer solution", uk: "Ipratropium 500 micrograms/2 mL nebuliser liquid", atc: "R03BB01", drugClass: "sama", form: "Nebule", unit: "neb", price: [0.9, 0.3], minStock: 80, stock: [["IPR2601", 12, 110]] },
  { id: "steroid", us: "Prednisone 20 mg tablet", uk: "Prednisolone 5 mg tablet", atc: "H02AB07", drugClass: "corticosteroid", form: "Tablet", unit: "tab", price: [0.2, 0.04], minStock: 300, stock: [["PRD2603", 20, 500]] },
  { id: "kcl", us: "Potassium chloride 20 mEq/100 mL IV", uk: "Potassium chloride 0.3% / sodium chloride 0.9% 1 L (40 mmol)", atc: "B05XA01", drugClass: "electrolyte", form: "IV bag", unit: "bag", price: [9, 2.5], minStock: 30, stock: [["KCL2601", 12, 40]], highAlert: true },
  { id: "ca-gluconate", us: "Calcium gluconate 10% 10 mL injection", atc: "A12AA03", drugClass: "electrolyte", form: "Vial", unit: "vial", price: [6, 1.5], minStock: 20, stock: [["CAG2602", 16, 32]] },
  { id: "oxytocin", us: "Oxytocin 10 units/mL injection", uk: "Oxytocin 10 units/mL injection (Syntocinon)", atc: "H01BB02", drugClass: "oxytocic", form: "Ampule", unit: "amp", price: [3, 0.9], minStock: 30, stock: [["OXT2603", 8, 46]], highAlert: true },
  { id: "cetirizine", us: "Cetirizine 10 mg tablet", atc: "R06AE07", drugClass: "antihistamine", form: "Tablet", unit: "tab", price: [0.1, 0.03], minStock: 300, stock: [["CET2604", 20, 520]] },
  { id: "ns", us: "Sodium chloride 0.9% 1,000 mL", atc: "B05BB01", drugClass: "fluid", form: "IV bag", unit: "bag", price: [6, 1.1], minStock: 200, stock: [["NS2604", 25, 150]] },
  { id: "lr", us: "Lactated Ringer's 1,000 mL", uk: "Compound sodium lactate (Hartmann's) 1,000 mL", atc: "B05BB01", drugClass: "fluid", form: "IV bag", unit: "bag", price: [7, 1.2], minStock: 200, stock: [["LR2605", 26, 340]] },
  { id: "sup-syringe", us: "Syringe 3 mL Luer-Lock", category: "supply", form: "", unit: "ea", price: [0.3, 0.08], minStock: 500, stock: [["SYR2601", 36, 2200]] },
  { id: "sup-iv", us: "IV catheter 20 G safety", uk: "IV cannula 20 G safety", category: "supply", form: "", unit: "ea", price: [2.4, 0.9], minStock: 200, stock: [["IVC2602", 30, 180]] },
  { id: "sup-gloves", us: "Sterile surgical gloves, size 7", category: "supply", form: "", unit: "pair", price: [1.1, 0.5], minStock: 300, stock: [["GLV2603", 30, 760]] },
  { id: "sup-bcx", us: "Blood culture bottle set (aerobic + anaerobic)", category: "supply", form: "", unit: "set", price: [9, 4], minStock: 60, stock: [["BCX2602", 8, 48]] },
  { id: "rgt-trop", us: "Troponin I hs reagent pack (200 tests)", category: "reagent", form: "", unit: "pack", price: [1450, 620], minStock: 2, stock: [["TRP2602", 5, 3]] },
  { id: "rgt-lactate", us: "Lactate POC cartridges (25)", category: "reagent", form: "", unit: "box", price: [210, 95], minStock: 4, stock: [["LAC2511", 1, 3]] },
]

/** 5-4-2 NDC-style package code (fictional labeler 70000) or a GTIN in the UK. */
const barcodeFor = (i: number, region: Region) =>
  region === "us" ? `70000-${String(1000 + i * 37).slice(-4)}-${String(10 + (i % 90))}` : `0${50_00000_00000 + i * 7919}`.slice(0, 13)

export function inventoryFor(region: Region): InventoryItem[] {
  return DRUGS.map((d, i) => ({
    id: d.id,
    name: region === "uk" ? d.uk ?? d.us : d.us,
    category: d.category ?? "drug",
    form: d.form || undefined,
    unit: d.unit,
    price: d.price[region === "us" ? 0 : 1],
    minStock: d.minStock,
    atc: d.atc,
    barcode: (d.category ?? "drug") === "drug" ? barcodeFor(i, region) : undefined,
    formulary: (d.category ?? "drug") === "drug" ? d.formulary ?? true : undefined,
    highAlert: d.highAlert,
    controlled: d.controlled?.[region === "us" ? 0 : 1],
    drugClass: d.drugClass,
    batches: d.stock.map(([batch, months, qty]) => ({ batch, expiry: exp(months), qty })),
  }))
}
