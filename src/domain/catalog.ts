/**
 * Reference catalogs: real code systems, trimmed to what the demo hospital uses.
 *
 * Every clinical concept carries the codes a real deployment would exchange:
 * - Diagnoses: ICD-10-CM (US) and WHO ICD-10 (UK/EU), plus SNOMED CT where stable.
 * - Procedures: CPT (US) and OPCS-4 (UK).
 * - Lab: LOINC (separate codes for mass vs molar units, as LOINC defines them), CPT for billing,
 *   conventional and SI reference ranges.
 * - Imaging: CPT with UB-04 revenue codes.
 *
 * Production imports the full licensed sets (CMS ICD-10-CM, NHS TRUD, LOINC, AMA CPT); the
 * structure here is the same, only shorter. Prices are illustrative chargemaster amounts.
 */
import type { Region } from "./region"
import type { ChargeCategory, ServiceOrder } from "./types"

// ---------------------------------------------------------------------------------------
// Diagnoses
// ---------------------------------------------------------------------------------------

export interface DxConcept {
  /** Stable internal key used by scenarios and order sets. */
  key: string
  us: { code: string; display: string }
  uk: { code: string; display: string }
  snomed?: string
}

const dx = (key: string, us: [string, string], uk: [string, string], snomed?: string): DxConcept => ({
  key,
  us: { code: us[0], display: us[1] },
  uk: { code: uk[0], display: uk[1] },
  snomed,
})

export const DIAGNOSES: DxConcept[] = [
  dx("uri", ["J06.9", "Acute upper respiratory infection, unspecified"], ["J06.9", "Acute upper respiratory infection, unspecified"], "54150009"),
  dx("pharyngitis", ["J02.9", "Acute pharyngitis, unspecified"], ["J02.9", "Acute pharyngitis, unspecified"], "363746003"),
  dx("gastroenteritis", ["A09", "Infectious gastroenteritis and colitis, unspecified"], ["A09.9", "Gastroenteritis and colitis of unspecified origin"], "25374005"),
  dx("gastritis", ["K29.70", "Gastritis, unspecified, without bleeding"], ["K29.7", "Gastritis, unspecified"], "4556007"),
  dx("lbp", ["M54.50", "Low back pain, unspecified"], ["M54.5", "Low back pain"], "279039007"),
  dx("htn", ["I10", "Essential (primary) hypertension"], ["I10", "Essential (primary) hypertension"], "59621000"),
  dx("t2dm", ["E11.9", "Type 2 diabetes mellitus without complications"], ["E11.9", "Type 2 diabetes mellitus without complications"], "44054006"),
  dx("t2dm-hyper", ["E11.65", "Type 2 diabetes mellitus with hyperglycemia"], ["E11.6", "Type 2 diabetes mellitus with other specified complications"], "44054006"),
  dx("hld", ["E78.5", "Hyperlipidemia, unspecified"], ["E78.5", "Hyperlipidaemia, unspecified"], "55822004"),
  dx("af", ["I48.91", "Unspecified atrial fibrillation"], ["I48.9", "Atrial fibrillation and atrial flutter, unspecified"], "49436004"),
  dx("hf", ["I50.9", "Heart failure, unspecified"], ["I50.9", "Heart failure, unspecified"], "84114007"),
  dx("nstemi", ["I21.4", "Non-ST elevation (NSTEMI) myocardial infarction"], ["I21.4", "Acute subendocardial myocardial infarction"], "401314000"),
  dx("chest-pain", ["R07.9", "Chest pain, unspecified"], ["R07.4", "Chest pain, unspecified"], "29857009"),
  dx("stroke", ["I63.9", "Cerebral infarction, unspecified"], ["I63.9", "Cerebral infarction, unspecified"], "422504002"),
  dx("syncope", ["R55", "Syncope and collapse"], ["R55", "Syncope and collapse"], "271594007"),
  dx("pneumonia", ["J18.9", "Pneumonia, unspecified organism"], ["J18.9", "Pneumonia, unspecified"], "233604007"),
  dx("copd-ae", ["J44.1", "Chronic obstructive pulmonary disease with (acute) exacerbation"], ["J44.1", "Chronic obstructive pulmonary disease with acute exacerbation, unspecified"], "195951007"),
  dx("asthma", ["J45.901", "Unspecified asthma with (acute) exacerbation"], ["J45.9", "Asthma, unspecified"], "195967001"),
  dx("bronchiolitis", ["J21.9", "Acute bronchiolitis, unspecified"], ["J21.9", "Acute bronchiolitis, unspecified"], "4120002"),
  dx("sepsis", ["A41.9", "Sepsis, unspecified organism"], ["A41.9", "Sepsis, unspecified"], "91302008"),
  dx("severe-sepsis", ["R65.20", "Severe sepsis without septic shock"], ["R65.1", "Systemic inflammatory response syndrome of infectious origin with organ failure"], "76571007"),
  dx("uti", ["N39.0", "Urinary tract infection, site not specified"], ["N39.0", "Urinary tract infection, site not specified"], "68566005"),
  dx("aki", ["N17.9", "Acute kidney failure, unspecified"], ["N17.9", "Acute renal failure, unspecified"], "14669001"),
  dx("esrd", ["N18.6", "End stage renal disease"], ["N18.5", "Chronic kidney disease, stage 5"], "46177005"),
  dx("hyperkalemia", ["E87.5", "Hyperkalemia"], ["E87.5", "Hyperkalaemia"], "14140009"),
  dx("dehydration", ["E86.0", "Dehydration"], ["E86", "Volume depletion"], "34095006"),
  dx("appendicitis", ["K35.80", "Unspecified acute appendicitis"], ["K35.8", "Acute appendicitis, other and unspecified"], "85189001"),
  dx("cholelithiasis", ["K80.20", "Calculus of gallbladder without cholecystitis without obstruction"], ["K80.2", "Calculus of gallbladder without cholecystitis"], "235919008"),
  dx("inguinal-hernia", ["K40.90", "Unilateral inguinal hernia, without obstruction or gangrene, not specified as recurrent"], ["K40.9", "Unilateral or unspecified inguinal hernia, without obstruction or gangrene"], "396232000"),
  dx("abd-pain", ["R10.9", "Unspecified abdominal pain"], ["R10.4", "Other and unspecified abdominal pain"], "21522001"),
  dx("hip-fx", ["S72.001A", "Fracture of unspecified part of neck of right femur, initial encounter for closed fracture"], ["S72.0", "Fracture of neck of femur"], "5913000"),
  dx("wrist-fx", ["S52.501A", "Unspecified fracture of the lower end of right radius, initial encounter for closed fracture"], ["S52.5", "Fracture of lower end of radius"], "263102004"),
  dx("concussion", ["S06.0X0A", "Concussion without loss of consciousness, initial encounter"], ["S06.0", "Concussion"], "110030002"),
  dx("cellulitis", ["L03.115", "Cellulitis of right lower limb"], ["L03.1", "Cellulitis of other parts of limb"], "128045006"),
  dx("headache", ["R51.9", "Headache, unspecified"], ["R51", "Headache"], "25064002"),
  dx("fever", ["R50.9", "Fever, unspecified"], ["R50.9", "Fever, unspecified"], "386661006"),
  dx("prev-cs", ["O34.211", "Maternal care for low transverse scar from previous cesarean delivery"], ["O34.2", "Maternal care due to uterine scar from previous surgery"]),
  dx("prenatal", ["Z34.83", "Encounter for supervision of other normal pregnancy, third trimester"], ["Z34.8", "Supervision of other normal pregnancy"], "77386006"),
  dx("annual-exam", ["Z00.00", "Encounter for general adult medical examination without abnormal findings"], ["Z00.0", "General medical examination"]),
  dx("follow-up", ["Z09", "Encounter for follow-up examination after completed treatment"], ["Z09.8", "Follow-up examination after other treatment for other conditions"]),
]

export const DX_MAP: Record<string, DxConcept> = Object.fromEntries(DIAGNOSES.map((d) => [d.key, d]))

/** The diagnosis list in the region's code system, for pickers and coding. */
export function dxCodes(region: Region): { code: string; display: string; key: string; snomed?: string }[] {
  return DIAGNOSES.map((d) => ({ ...d[region], key: d.key, snomed: d.snomed }))
}

export function dxByCode(region: Region, code: string): DxConcept | undefined {
  return DIAGNOSES.find((d) => d[region].code === code)
}

// ---------------------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------------------

export interface PxConcept {
  key: string
  us: { code: string; display: string }
  uk?: { code: string; display: string }
}

export const PROCEDURES: PxConcept[] = [
  { key: "ecg", us: { code: "93000", display: "Electrocardiogram, routine, with interpretation and report" } },
  { key: "neb", us: { code: "94640", display: "Pressurized or nonpressurized inhalation treatment (nebulizer)" } },
  { key: "intubation", us: { code: "31500", display: "Intubation, endotracheal, emergency procedure" }, uk: { code: "E85.1", display: "Invasive ventilation" } },
  { key: "laceration", us: { code: "12002", display: "Simple repair of superficial wound, 2.6 cm to 7.5 cm" } },
  { key: "appendectomy", us: { code: "44970", display: "Laparoscopy, surgical, appendectomy" }, uk: { code: "H01.9", display: "Emergency excision of appendix, unspecified" } },
  { key: "lap-chole", us: { code: "47562", display: "Laparoscopy, surgical; cholecystectomy" }, uk: { code: "J18.9", display: "Excision of gall bladder, unspecified (+ Y75.2 laparoscopic approach)" } },
  { key: "cesarean", us: { code: "59514", display: "Cesarean delivery only" }, uk: { code: "R17.9", display: "Elective caesarean delivery, unspecified" } },
  { key: "hemiarthroplasty", us: { code: "27236", display: "Open treatment of femoral fracture, proximal end, neck; with prosthetic replacement" }, uk: { code: "W46.9", display: "Prosthetic replacement of head of femur using cement, unspecified" } },
  { key: "hemodialysis", us: { code: "90935", display: "Hemodialysis procedure with single evaluation" }, uk: { code: "X40.9", display: "Compensation for renal failure, unspecified" } },
  { key: "central-line", us: { code: "36556", display: "Insertion of non-tunneled centrally inserted CVC, age 5 years or older" } },
  { key: "hernia-repair", us: { code: "49650", display: "Laparoscopy, surgical; repair initial inguinal hernia" }, uk: { code: "T20.9", display: "Primary repair of inguinal hernia, unspecified" } },
]

export const PX_MAP: Record<string, PxConcept> = Object.fromEntries(PROCEDURES.map((p) => [p.key, p]))

export function pxCodes(region: Region): { code: string; display: string; key: string }[] {
  return PROCEDURES.flatMap((p) => {
    const c = region === "us" ? p.us : p.uk
    return c ? [{ ...c, key: p.key }] : []
  })
}

// ---------------------------------------------------------------------------------------
// Laboratory
// ---------------------------------------------------------------------------------------

export interface RefRange {
  unit: string
  low?: number
  high?: number
  /** Critical (panic) limits — must be phoned to a licensed caregiver with read-back. */
  criticalLow?: number
  criticalHigh?: number
  decimals?: number
}

export interface LabTest {
  code: string
  name: string
  panel: string
  loinc: string
  /** LOINC code when reported in SI (molar) units, where LOINC defines a separate term. */
  loincSI?: string
  conventional?: RefRange
  si?: RefRange
  /** Converts a conventional value into SI. */
  toSI?: (v: number) => number
  /** Qualitative tests: the expected (normal) answer. */
  normalText?: string
}

export interface LabPanel {
  code: string
  name: string
  loinc?: string
  /** CPT billed once per panel. */
  cpt: string
  price: Record<Region, number>
  /** Specimen container — drives the collection label and the phlebotomist's tube choice. */
  tube: string
}

export const LAB_PANELS: LabPanel[] = [
  { code: "CBC", name: "Complete blood count", loinc: "58410-2", cpt: "85025", price: { us: 68, uk: 18 }, tube: "Lavender (EDTA)" },
  { code: "BMP", name: "Basic metabolic panel", loinc: "51990-0", cpt: "80048", price: { us: 112, uk: 24 }, tube: "Gold (SST)" },
  { code: "LFT", name: "Hepatic function panel", loinc: "24325-3", cpt: "80076", price: { us: 96, uk: 22 }, tube: "Gold (SST)" },
  { code: "LIPID", name: "Lipid panel", loinc: "57698-3", cpt: "80061", price: { us: 84, uk: 20 }, tube: "Gold (SST)" },
  { code: "A1C", name: "Hemoglobin A1c", loinc: "4548-4", cpt: "83036", price: { us: 58, uk: 15 }, tube: "Lavender (EDTA)" },
  { code: "TROP", name: "Troponin I, high-sensitivity", loinc: "89579-7", cpt: "84484", price: { us: 145, uk: 32 }, tube: "Light green (PST)" },
  { code: "LACT", name: "Lactate", loinc: "2524-7", cpt: "83605", price: { us: 92, uk: 18 }, tube: "Grey (fluoride) on ice" },
  { code: "BCX", name: "Blood culture × 2 sets", loinc: "600-7", cpt: "87040", price: { us: 210, uk: 45 }, tube: "Aerobic + anaerobic bottles" },
  { code: "PCT", name: "Procalcitonin", loinc: "33959-8", cpt: "84145", price: { us: 168, uk: 38 }, tube: "Gold (SST)" },
  { code: "BNP", name: "NT-proBNP", loinc: "33762-6", cpt: "83880", price: { us: 186, uk: 40 }, tube: "Gold (SST)" },
  { code: "COAG", name: "Prothrombin time / INR", loinc: "34714-6", cpt: "85610", price: { us: 46, uk: 12 }, tube: "Light blue (citrate)" },
  { code: "LIPASE", name: "Lipase", loinc: "3040-3", cpt: "83690", price: { us: 74, uk: 16 }, tube: "Gold (SST)" },
  { code: "UA", name: "Urinalysis with microscopy", loinc: "24356-8", cpt: "81001", price: { us: 42, uk: 10 }, tube: "Urine cup" },
  { code: "HCG", name: "hCG, urine qualitative", loinc: "2106-3", cpt: "81025", price: { us: 38, uk: 9 }, tube: "Urine cup" },
]

export const PANEL_MAP: Record<string, LabPanel> = Object.fromEntries(LAB_PANELS.map((p) => [p.code, p]))

const same = (r: RefRange): RefRange => r

export const LAB_TESTS: LabTest[] = [
  { code: "WBC", name: "White blood cell count", panel: "CBC", loinc: "6690-2", conventional: { unit: "10³/µL", low: 4.5, high: 11, criticalLow: 2, criticalHigh: 30, decimals: 1 }, si: { unit: "10⁹/L", low: 4.5, high: 11, criticalLow: 2, criticalHigh: 30, decimals: 1 }, toSI: (v) => v },
  { code: "HGB", name: "Hemoglobin", panel: "CBC", loinc: "718-7", conventional: { unit: "g/dL", low: 12, high: 17.5, criticalLow: 7, criticalHigh: 20, decimals: 1 }, si: { unit: "g/L", low: 120, high: 175, criticalLow: 70, criticalHigh: 200 }, toSI: (v) => v * 10 },
  { code: "HCT", name: "Hematocrit", panel: "CBC", loinc: "4544-3", conventional: { unit: "%", low: 36, high: 50, decimals: 0 }, si: { unit: "L/L", low: 0.36, high: 0.5, decimals: 2 }, toSI: (v) => v / 100 },
  { code: "PLT", name: "Platelet count", panel: "CBC", loinc: "777-3", conventional: { unit: "10³/µL", low: 150, high: 400, criticalLow: 50, criticalHigh: 1000 }, si: { unit: "10⁹/L", low: 150, high: 400, criticalLow: 50, criticalHigh: 1000 }, toSI: (v) => v },
  { code: "NA", name: "Sodium", panel: "BMP", loinc: "2951-2", conventional: same({ unit: "mmol/L", low: 135, high: 145, criticalLow: 120, criticalHigh: 160 }), si: { unit: "mmol/L", low: 133, high: 146, criticalLow: 120, criticalHigh: 160 }, toSI: (v) => v },
  { code: "K", name: "Potassium", panel: "BMP", loinc: "2823-3", conventional: { unit: "mmol/L", low: 3.5, high: 5.1, criticalLow: 2.5, criticalHigh: 6.5, decimals: 1 }, si: { unit: "mmol/L", low: 3.5, high: 5.3, criticalLow: 2.5, criticalHigh: 6.5, decimals: 1 }, toSI: (v) => v },
  { code: "BUN", name: "Urea nitrogen (BUN) / Urea", panel: "BMP", loinc: "3094-0", loincSI: "22664-7", conventional: { unit: "mg/dL", low: 7, high: 20, criticalHigh: 100 }, si: { unit: "mmol/L", low: 2.5, high: 7.8, criticalHigh: 36, decimals: 1 }, toSI: (v) => v * 0.357 },
  { code: "CREAT", name: "Creatinine", panel: "BMP", loinc: "2160-0", loincSI: "14682-9", conventional: { unit: "mg/dL", low: 0.6, high: 1.2, decimals: 2 }, si: { unit: "µmol/L", low: 59, high: 104 }, toSI: (v) => v * 88.4 },
  { code: "GLU", name: "Glucose", panel: "BMP", loinc: "2345-7", loincSI: "14749-6", conventional: { unit: "mg/dL", low: 70, high: 140, criticalLow: 40, criticalHigh: 450 }, si: { unit: "mmol/L", low: 3.9, high: 7.8, criticalLow: 2.2, criticalHigh: 25, decimals: 1 }, toSI: (v) => v * 0.0555 },
  { code: "ALT", name: "Alanine aminotransferase (ALT)", panel: "LFT", loinc: "1742-6", conventional: { unit: "U/L", low: 7, high: 56 }, si: { unit: "U/L", low: 0, high: 41 }, toSI: (v) => v },
  { code: "AST", name: "Aspartate aminotransferase (AST)", panel: "LFT", loinc: "1920-8", conventional: { unit: "U/L", low: 10, high: 40 }, si: { unit: "U/L", low: 0, high: 40 }, toSI: (v) => v },
  { code: "TBIL", name: "Bilirubin, total", panel: "LFT", loinc: "1975-2", loincSI: "14631-6", conventional: { unit: "mg/dL", low: 0.1, high: 1.2, decimals: 1 }, si: { unit: "µmol/L", low: 0, high: 21 }, toSI: (v) => v * 17.1 },
  { code: "CHOL", name: "Cholesterol, total", panel: "LIPID", loinc: "2093-3", loincSI: "14647-2", conventional: { unit: "mg/dL", high: 200 }, si: { unit: "mmol/L", high: 5, decimals: 1 }, toSI: (v) => v * 0.02586 },
  { code: "A1C", name: "Hemoglobin A1c", panel: "A1C", loinc: "4548-4", loincSI: "59261-8", conventional: { unit: "%", low: 4, high: 5.6, decimals: 1 }, si: { unit: "mmol/mol", low: 20, high: 41 }, toSI: (v) => (v - 2.15) * 10.929 },
  { code: "TROP", name: "Troponin I, high-sensitivity", panel: "TROP", loinc: "89579-7", conventional: { unit: "ng/L", high: 34, criticalHigh: 100 }, si: { unit: "ng/L", high: 34, criticalHigh: 100 }, toSI: (v) => v },
  { code: "LACT", name: "Lactate", panel: "LACT", loinc: "2524-7", conventional: { unit: "mmol/L", low: 0.5, high: 2, criticalHigh: 4, decimals: 1 }, si: { unit: "mmol/L", low: 0.5, high: 2, criticalHigh: 4, decimals: 1 }, toSI: (v) => v },
  { code: "PCT", name: "Procalcitonin", panel: "PCT", loinc: "33959-8", conventional: { unit: "ng/mL", high: 0.5, decimals: 2 }, si: { unit: "µg/L", high: 0.5, decimals: 2 }, toSI: (v) => v },
  { code: "BNP", name: "NT-proBNP", panel: "BNP", loinc: "33762-6", conventional: { unit: "pg/mL", high: 125 }, si: { unit: "ng/L", high: 400 }, toSI: (v) => v },
  { code: "INR", name: "INR", panel: "COAG", loinc: "6301-6", conventional: { unit: "", low: 0.8, high: 1.2, criticalHigh: 5, decimals: 1 }, si: { unit: "", low: 0.8, high: 1.2, criticalHigh: 5, decimals: 1 }, toSI: (v) => v },
  { code: "LIPASE", name: "Lipase", panel: "LIPASE", loinc: "3040-3", conventional: { unit: "U/L", high: 60 }, si: { unit: "U/L", high: 60 }, toSI: (v) => v },
  { code: "BCX", name: "Blood culture", panel: "BCX", loinc: "600-7", normalText: "No growth to date" },
  { code: "UA", name: "Urinalysis", panel: "UA", loinc: "24356-8", normalText: "Negative" },
  { code: "HCG", name: "hCG, urine", panel: "HCG", loinc: "2106-3", normalText: "Negative" },
]

export const LAB_MAP: Record<string, LabTest> = Object.fromEntries(LAB_TESTS.map((t) => [t.code, t]))

/** Analytes ordered together when a panel is selected. */
export const panelTests = (panel: string) => LAB_TESTS.filter((t) => t.panel === panel).map((t) => t.code)

/** Reference range in the region's unit system. */
export function rangeFor(test: LabTest, region: Region): RefRange | undefined {
  return region === "uk" ? test.si : test.conventional
}

export function loincFor(test: LabTest, region: Region): string {
  return region === "uk" && test.loincSI ? test.loincSI : test.loinc
}

// ---------------------------------------------------------------------------------------
// Imaging
// ---------------------------------------------------------------------------------------

export interface RadExam {
  code: string
  name: string
  modality: "XR" | "US" | "CT" | "MR" | "Echo"
  cpt: string
  revCode: string
  price: Record<Region, number>
  /** Advanced imaging that commercial payers pre-authorise (outpatient). */
  priorAuth?: boolean
  /** Pregnancy status must be documented first (ionising radiation / contrast). */
  pregnancyCheck?: boolean
}

export const RAD_EXAMS: RadExam[] = [
  { code: "XR-CHEST", name: "XR chest, 2 views", modality: "XR", cpt: "71046", revCode: "0324", price: { us: 420, uk: 120 }, pregnancyCheck: true },
  { code: "XR-HIP", name: "XR hip, unilateral, 2–3 views", modality: "XR", cpt: "73502", revCode: "0320", price: { us: 380, uk: 110 }, pregnancyCheck: true },
  { code: "XR-WRIST", name: "XR wrist, minimum 3 views", modality: "XR", cpt: "73110", revCode: "0320", price: { us: 340, uk: 95 } },
  { code: "CT-HEAD", name: "CT head without contrast", modality: "CT", cpt: "70450", revCode: "0351", price: { us: 2850, uk: 450 } },
  { code: "CT-AP", name: "CT abdomen & pelvis with contrast", modality: "CT", cpt: "74177", revCode: "0352", price: { us: 4200, uk: 650 }, priorAuth: true, pregnancyCheck: true },
  { code: "CTA-CHEST", name: "CT angiography chest (PE protocol)", modality: "CT", cpt: "71275", revCode: "0352", price: { us: 4800, uk: 700 }, pregnancyCheck: true },
  { code: "US-RUQ", name: "US abdomen, limited (RUQ)", modality: "US", cpt: "76705", revCode: "0402", price: { us: 780, uk: 180 } },
  { code: "US-OB", name: "US pregnant uterus > 14 weeks, single fetus", modality: "US", cpt: "76805", revCode: "0402", price: { us: 650, uk: 160 } },
  { code: "MR-BRAIN", name: "MRI brain without contrast", modality: "MR", cpt: "70551", revCode: "0610", price: { us: 3900, uk: 550 }, priorAuth: true },
  { code: "ECHO", name: "Transthoracic echo, complete with Doppler", modality: "Echo", cpt: "93306", revCode: "0483", price: { us: 2300, uk: 350 } },
]

export const RAD_MAP: Record<string, RadExam> = Object.fromEntries(RAD_EXAMS.map((t) => [t.code, t]))

// ---------------------------------------------------------------------------------------
// Chargemaster (US) / private patient tariff (UK)
// ---------------------------------------------------------------------------------------

export interface Tariff {
  category: ChargeCategory
  description: string
  /** CPT / HCPCS (US) — UK private tariffs use local codes. */
  code?: string
  revCode?: string
  price: Record<Region, number>
}

/**
 * Facility charges. UK amounts apply to private patients and chargeable overseas visitors
 * only — NHS-funded care produces no patient bill.
 */
export const TARIFFS = {
  "clinic-new": { category: "professional", description: "New patient office visit, moderate MDM", code: "99204", revCode: "0510", price: { us: 385, uk: 250 } },
  "clinic-est": { category: "professional", description: "Established patient office visit, moderate MDM", code: "99214", revCode: "0510", price: { us: 245, uk: 160 } },
  "ed-1": { category: "emergency", description: "ED visit, level 5 (high MDM)", code: "99285", revCode: "0450", price: { us: 3150, uk: 520 } },
  "ed-2": { category: "emergency", description: "ED visit, level 5 (high MDM)", code: "99285", revCode: "0450", price: { us: 3150, uk: 520 } },
  "ed-3": { category: "emergency", description: "ED visit, level 4 (moderate MDM)", code: "99284", revCode: "0450", price: { us: 1980, uk: 380 } },
  "ed-4": { category: "emergency", description: "ED visit, level 3 (low MDM)", code: "99283", revCode: "0450", price: { us: 1250, uk: 260 } },
  "ed-5": { category: "emergency", description: "ED visit, level 2 (straightforward MDM)", code: "99282", revCode: "0450", price: { us: 640, uk: 180 } },
  "critical-care": { category: "professional", description: "Critical care, first 30–74 minutes", code: "99291", revCode: "0450", price: { us: 1450, uk: 600 } },
  "ip-initial": { category: "professional", description: "Initial hospital inpatient care, high MDM", code: "99223", price: { us: 520, uk: 300 } },
  "ip-subsequent": { category: "professional", description: "Subsequent hospital inpatient care, moderate MDM", code: "99232", price: { us: 230, uk: 150 } },
  "room-med-surg": { category: "room", description: "Room & board, semi-private (med/surg) / day", revCode: "0120", price: { us: 2850, uk: 1100 } },
  "room-telemetry": { category: "room", description: "Room & board, intermediate care (telemetry) / day", revCode: "0206", price: { us: 4100, uk: 1600 } },
  "room-icu": { category: "room", description: "Intensive care unit / day", revCode: "0200", price: { us: 6800, uk: 3500 } },
  "room-isolation": { category: "room", description: "Room & board, private (isolation) / day", revCode: "0110", price: { us: 3300, uk: 1400 } },
  "room-private": { category: "room", description: "Room & board, private / day", revCode: "0110", price: { us: 3300, uk: 1400 } },
  observation: { category: "room", description: "Observation services, per hour", code: "G0378", revCode: "0762", price: { us: 95, uk: 60 } },
  "or-case": { category: "surgery", description: "Operating room services, per case", revCode: "0360", price: { us: 9500, uk: 4200 } },
  anesthesia: { category: "surgery", description: "Anesthesia services", revCode: "0370", price: { us: 2400, uk: 1100 } },
} satisfies Record<string, Tariff>

export type TariffKey = keyof typeof TARIFFS

// ---------------------------------------------------------------------------------------
// Medication administration
// ---------------------------------------------------------------------------------------

export const ROUTES_OF_ADMIN = ["PO", "IV", "IM", "SC", "Inhaled", "Topical", "PR", "SL"]

/**
 * Frequencies. Stored by id; labelled in the abbreviations each market writes on charts
 * (US "BID", UK "BD"). `hours` is the default administration schedule on the eMAR.
 */
export const FREQUENCIES: { id: string; us: string; uk: string; hours: number[] }[] = [
  { id: "daily", us: "Daily", uk: "OD", hours: [9] },
  { id: "bid", us: "BID", uk: "BD", hours: [9, 21] },
  { id: "tid", us: "TID", uk: "TDS", hours: [8, 14, 22] },
  { id: "qid", us: "QID", uk: "QDS", hours: [6, 12, 18, 22] },
  { id: "q6h", us: "q6h", uk: "6-hourly", hours: [0, 6, 12, 18] },
  { id: "q8h", us: "q8h", uk: "8-hourly", hours: [6, 14, 22] },
  { id: "q12h", us: "q12h", uk: "12-hourly", hours: [9, 21] },
  { id: "nightly", us: "QHS", uk: "ON", hours: [22] },
  { id: "prn", us: "PRN", uk: "PRN", hours: [] },
  { id: "once", us: "Once (STAT)", uk: "STAT", hours: [] },
]

export const FREQ_MAP: Record<string, (typeof FREQUENCIES)[number]> = Object.fromEntries(FREQUENCIES.map((f) => [f.id, f]))

export const frequencyLabel = (id: string, region: Region) => FREQ_MAP[id]?.[region] ?? id

/** Human-readable list of what an order contains. */
export function orderTitle(order: ServiceOrder): string {
  if (order.kind === "rad") return order.testCodes.map((c) => RAD_MAP[c]?.name ?? c).join(", ")
  // Show panels, not every analyte: "CBC, BMP" is how clinicians say it.
  const panels = [...new Set(order.testCodes.map((c) => LAB_MAP[c]?.panel ?? c))]
  return panels.map((p) => PANEL_MAP[p]?.code ?? p).join(", ")
}
