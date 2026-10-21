/**
 * Reference catalogs (master data that ships with the product and is tuned per facility).
 * Kept small but realistic; a real deployment imports the full ICD-10 / LOINC sets.
 */
import type { ChargeCategory, ServiceOrder } from "./types"

export interface IcdCode {
  code: string
  display: string
}

/** Common primary-care & hospital ICD-10 codes (Indonesian display names). */
export const ICD10: IcdCode[] = [
  { code: "A09", display: "Diare dan gastroenteritis infeksi" },
  { code: "A01.0", display: "Demam tifoid" },
  { code: "A90", display: "Demam dengue" },
  { code: "A91", display: "Demam berdarah dengue" },
  { code: "A15.0", display: "Tuberkulosis paru, terkonfirmasi bakteriologis" },
  { code: "B34.9", display: "Infeksi virus, tidak spesifik" },
  { code: "E11.9", display: "Diabetes melitus tipe 2 tanpa komplikasi" },
  { code: "E11.65", display: "Diabetes melitus tipe 2 dengan hiperglikemia" },
  { code: "E78.5", display: "Hiperlipidemia" },
  { code: "I10", display: "Hipertensi esensial (primer)" },
  { code: "I11.9", display: "Penyakit jantung hipertensi tanpa gagal jantung" },
  { code: "I20.9", display: "Angina pektoris" },
  { code: "I21.9", display: "Infark miokard akut" },
  { code: "I50.9", display: "Gagal jantung" },
  { code: "I63.9", display: "Infark serebral (stroke iskemik)" },
  { code: "J00", display: "Nasofaringitis akut (common cold)" },
  { code: "J02.9", display: "Faringitis akut" },
  { code: "J06.9", display: "ISPA, tidak spesifik" },
  { code: "J18.9", display: "Pneumonia, tidak spesifik" },
  { code: "J44.1", display: "PPOK dengan eksaserbasi akut" },
  { code: "J45.9", display: "Asma" },
  { code: "K29.7", display: "Gastritis" },
  { code: "K30", display: "Dispepsia fungsional" },
  { code: "K35.8", display: "Apendisitis akut" },
  { code: "K80.2", display: "Kolelitiasis tanpa kolesistitis" },
  { code: "M54.5", display: "Nyeri punggung bawah" },
  { code: "M79.1", display: "Mialgia" },
  { code: "N18.5", display: "Penyakit ginjal kronik stadium 5" },
  { code: "N39.0", display: "Infeksi saluran kemih" },
  { code: "O80", display: "Persalinan spontan tunggal" },
  { code: "O82", display: "Persalinan dengan seksio sesarea" },
  { code: "R50.9", display: "Demam, tidak spesifik" },
  { code: "R51", display: "Sakit kepala" },
  { code: "R10.4", display: "Nyeri perut lainnya" },
  { code: "S06.0", display: "Gegar otak" },
  { code: "S52.5", display: "Fraktur radius distal" },
  { code: "S72.0", display: "Fraktur collum femur" },
  { code: "T78.4", display: "Alergi, tidak spesifik" },
  { code: "Z00.0", display: "Pemeriksaan kesehatan umum" },
  { code: "Z09", display: "Kontrol setelah pengobatan" },
]

export const ICD9CM: IcdCode[] = [
  { code: "89.03", display: "Anamnesis & pemeriksaan menyeluruh" },
  { code: "89.52", display: "Elektrokardiogram (EKG)" },
  { code: "93.94", display: "Nebulisasi" },
  { code: "96.04", display: "Intubasi endotrakeal" },
  { code: "99.18", display: "Injeksi elektrolit" },
  { code: "86.59", display: "Penjahitan luka kulit" },
  { code: "47.09", display: "Apendektomi" },
  { code: "74.1", display: "Seksio sesarea transperitoneal rendah" },
  { code: "79.35", display: "Reduksi terbuka fraktur femur dengan fiksasi interna" },
  { code: "51.23", display: "Kolesistektomi laparoskopik" },
  { code: "39.95", display: "Hemodialisis" },
]

export interface LabTest {
  code: string
  name: string
  panel: string
  unit: string
  /** Normal range; values outside get L/H. */
  low?: number
  high?: number
  /** Critical limits; values outside get LL/HH and raise an alert. */
  criticalLow?: number
  criticalHigh?: number
  price: number
}

export const LAB_TESTS: LabTest[] = [
  { code: "HB", name: "Hemoglobin", panel: "Hematologi", unit: "g/dL", low: 12, high: 16, criticalLow: 7, criticalHigh: 20, price: 35000 },
  { code: "LEU", name: "Leukosit", panel: "Hematologi", unit: "10³/µL", low: 4, high: 10, criticalLow: 2, criticalHigh: 30, price: 35000 },
  { code: "TROMBO", name: "Trombosit", panel: "Hematologi", unit: "10³/µL", low: 150, high: 400, criticalLow: 50, criticalHigh: 1000, price: 35000 },
  { code: "HT", name: "Hematokrit", panel: "Hematologi", unit: "%", low: 37, high: 48, price: 30000 },
  { code: "GDS", name: "Gula darah sewaktu", panel: "Kimia klinik", unit: "mg/dL", low: 70, high: 200, criticalLow: 40, criticalHigh: 450, price: 30000 },
  { code: "GDP", name: "Gula darah puasa", panel: "Kimia klinik", unit: "mg/dL", low: 70, high: 100, criticalLow: 40, criticalHigh: 450, price: 30000 },
  { code: "HBA1C", name: "HbA1c", panel: "Kimia klinik", unit: "%", low: 4, high: 5.7, price: 150000 },
  { code: "UR", name: "Ureum", panel: "Fungsi ginjal", unit: "mg/dL", low: 10, high: 50, criticalHigh: 200, price: 45000 },
  { code: "CR", name: "Kreatinin", panel: "Fungsi ginjal", unit: "mg/dL", low: 0.6, high: 1.2, criticalHigh: 7, price: 45000 },
  { code: "SGOT", name: "SGOT", panel: "Fungsi hati", unit: "U/L", low: 0, high: 40, price: 45000 },
  { code: "SGPT", name: "SGPT", panel: "Fungsi hati", unit: "U/L", low: 0, high: 41, price: 45000 },
  { code: "NA", name: "Natrium", panel: "Elektrolit", unit: "mmol/L", low: 135, high: 145, criticalLow: 120, criticalHigh: 160, price: 55000 },
  { code: "K", name: "Kalium", panel: "Elektrolit", unit: "mmol/L", low: 3.5, high: 5.1, criticalLow: 2.5, criticalHigh: 6.5, price: 55000 },
  { code: "CHOL", name: "Kolesterol total", panel: "Profil lipid", unit: "mg/dL", low: 0, high: 200, price: 50000 },
  { code: "NS1", name: "NS1 Antigen Dengue", panel: "Imunoserologi", unit: "", price: 180000 },
  { code: "WIDAL", name: "Widal", panel: "Imunoserologi", unit: "", price: 60000 },
  { code: "TROP", name: "Troponin I", panel: "Jantung", unit: "ng/mL", low: 0, high: 0.04, criticalHigh: 0.4, price: 250000 },
  { code: "UL", name: "Urinalisis lengkap", panel: "Urin", unit: "", price: 40000 },
]

export const LAB_MAP: Record<string, LabTest> = Object.fromEntries(LAB_TESTS.map((t) => [t.code, t]))

export interface RadExam {
  code: string
  name: string
  modality: "X-Ray" | "USG" | "CT" | "MRI"
  price: number
}

export const RAD_EXAMS: RadExam[] = [
  { code: "XR-THX", name: "Foto thorax PA", modality: "X-Ray", price: 150000 },
  { code: "XR-ABD", name: "Foto BNO 3 posisi", modality: "X-Ray", price: 250000 },
  { code: "XR-EXT", name: "Foto ekstremitas", modality: "X-Ray", price: 175000 },
  { code: "US-ABD", name: "USG abdomen", modality: "USG", price: 350000 },
  { code: "US-OBS", name: "USG obstetri", modality: "USG", price: 300000 },
  { code: "CT-HEAD", name: "CT scan kepala non kontras", modality: "CT", price: 900000 },
  { code: "CT-THX", name: "CT scan thorax kontras", modality: "CT", price: 1500000 },
  { code: "MR-BRAIN", name: "MRI kepala", modality: "MRI", price: 2500000 },
]

export const RAD_MAP: Record<string, RadExam> = Object.fromEntries(RAD_EXAMS.map((t) => [t.code, t]))

/** Standard service tariffs (Rupiah). Facilities override these in Settings. */
export const TARIFFS: Record<string, { category: ChargeCategory; description: string; price: number }> = {
  admin: { category: "administrasi", description: "Administrasi pendaftaran", price: 25000 },
  "konsul-umum": { category: "konsultasi", description: "Konsultasi dokter umum", price: 75000 },
  "konsul-spesialis": { category: "konsultasi", description: "Konsultasi dokter spesialis", price: 175000 },
  "igd": { category: "konsultasi", description: "Pemeriksaan dokter IGD", price: 150000 },
  "kamar-KRIS": { category: "kamar", description: "Kamar rawat inap KRIS / hari", price: 350000 },
  "kamar-VIP": { category: "kamar", description: "Kamar rawat inap VIP / hari", price: 900000 },
  "kamar-VVIP": { category: "kamar", description: "Kamar rawat inap VVIP / hari", price: 1500000 },
  "kamar-ICU": { category: "kamar", description: "ICU / hari", price: 2500000 },
  "kamar-Isolasi": { category: "kamar", description: "Kamar isolasi / hari", price: 750000 },
  operasi: { category: "operasi", description: "Jasa operasi (sedang)", price: 6500000 },
}

export const ROUTES_OF_ADMIN = ["Oral", "IV", "IM", "SC", "Inhalasi", "Topikal", "Rektal", "Sublingual"]
export const FREQUENCIES = ["1x1", "2x1", "3x1", "4x1", "Tiap 8 jam", "Tiap 12 jam", "Jika perlu"]

/** Human-readable list of what an order contains. */
export function orderTitle(order: ServiceOrder): string {
  return order.testCodes.map((c) => (order.kind === "lab" ? LAB_MAP[c]?.name : RAD_MAP[c]?.name) ?? c).join(", ")
}
