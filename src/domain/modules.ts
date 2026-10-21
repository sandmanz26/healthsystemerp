/**
 * Module catalog — the heart of the "start small, grow later" model.
 *
 * Rules the rest of the app relies on:
 * - `requires` is hard: a module cannot be on unless all of these are on.
 * - `enhances` is soft: the module works alone, but turning these on unlocks extra behaviour
 *   (shown as suggestions in the Module Center).
 * - Core modules are always on and never listed as toggleable.
 * - Turning a module off hides it; its data stays (re-enabling restores everything).
 */
import type { RoleId } from "./types"

export type ModuleId =
  | "patients"
  | "settings"
  | "registration"
  | "appointments"
  | "emr"
  | "outpatient"
  | "emergency"
  | "inpatient"
  | "nursing"
  | "surgery"
  | "laboratory"
  | "radiology"
  | "pharmacy"
  | "billing"
  | "claims"
  | "inventory"
  | "hr"
  | "quality"
  | "reports"
  | "bpjs"
  | "satusehat"

export type ModuleCategory = "core" | "front" | "clinical" | "support" | "finance" | "operations" | "quality" | "integration"

export interface ModuleDef {
  id: ModuleId
  name: string
  category: ModuleCategory
  /** One line, plain language: what problem it solves. */
  summary: string
  features: string[]
  core?: boolean
  requires: ModuleId[]
  enhances: { module: ModuleId; benefit: string }[]
  /** Roles that work inside this module (drives navigation visibility). */
  roles: RoleId[]
  /** Setup checklist shown after enabling. */
  setup: { id: string; label: string }[]
}

export const CATEGORY_LABEL: Record<ModuleCategory, string> = {
  core: "Inti",
  front: "Layanan Depan",
  clinical: "Klinis",
  support: "Penunjang",
  finance: "Keuangan",
  operations: "Operasional",
  quality: "Mutu & Laporan",
  integration: "Integrasi",
}

export const CATEGORY_ORDER: ModuleCategory[] = ["core", "front", "clinical", "support", "finance", "operations", "quality", "integration"]

const ALL_CLINICAL: RoleId[] = ["doctor", "nurse"]

export const MODULES: ModuleDef[] = [
  {
    id: "patients",
    name: "Master Pasien",
    category: "core",
    core: true,
    summary: "Satu identitas pasien untuk semua layanan: No. RM, NIK, penjamin, alergi.",
    features: ["Pencarian No. RM / NIK / BPJS / nama", "Deteksi pasien ganda", "Riwayat kunjungan & alergi"],
    requires: [],
    enhances: [],
    roles: ["admin", "frontdesk", "doctor", "nurse", "pharmacist", "labtech", "radiographer", "cashier", "coder", "manager"],
    setup: [],
  },
  {
    id: "settings",
    name: "Pengaturan & Akses",
    category: "core",
    core: true,
    summary: "Profil faskes, unit layanan, pengguna & hak akses, jejak audit.",
    features: ["Unit & poli", "Matriks peran × modul", "Audit log (wajib RME)"],
    requires: [],
    enhances: [],
    roles: ["admin"],
    setup: [],
  },
  {
    id: "registration",
    name: "Pendaftaran & Antrean",
    category: "front",
    summary: "Daftarkan kunjungan dalam hitungan detik dan kelola antrean per poli.",
    features: ["Daftar kunjungan rawat jalan & IGD", "Nomor antrean per poli", "Layar antrean ruang tunggu", "Cetak gelang / label"],
    requires: [],
    enhances: [
      { module: "bpjs", benefit: "Cek kepesertaan & terbitkan SEP langsung dari loket" },
      { module: "appointments", benefit: "Check-in pasien yang sudah booking" },
      { module: "billing", benefit: "Biaya administrasi otomatis masuk tagihan" },
    ],
    roles: ["frontdesk", "admin"],
    setup: [
      { id: "units", label: "Pastikan daftar poli sesuai" },
      { id: "display", label: "Pasang layar antrean di ruang tunggu" },
    ],
  },
  {
    id: "appointments",
    name: "Jadwal & Janji Temu",
    category: "front",
    summary: "Jadwal praktik dokter dengan kuota, booking dari telepon, web, atau Mobile JKN.",
    features: ["Jadwal praktik mingguan & kuota", "Booking & check-in", "Tandai tidak hadir"],
    requires: ["registration"],
    enhances: [{ module: "bpjs", benefit: "Sinkron booking Mobile JKN (Antrean Online)" }],
    roles: ["frontdesk", "admin", "doctor"],
    setup: [{ id: "schedules", label: "Isi jadwal praktik dokter" }],
  },
  {
    id: "emr",
    name: "Rekam Medis Elektronik",
    category: "clinical",
    summary: "CPPT/SOAP, diagnosis ICD-10, tindakan, alergi — sesuai Permenkes 24/2022.",
    features: ["CPPT terintegrasi antarprofesi", "Diagnosis ICD-10 & tindakan ICD-9-CM", "Ringkasan pasien & riwayat", "Template SOAP"],
    requires: [],
    enhances: [
      { module: "satusehat", benefit: "Kirim kunjungan & diagnosis ke SATUSEHAT otomatis" },
      { module: "laboratory", benefit: "Order lab & hasil langsung di rekam medis" },
      { module: "pharmacy", benefit: "Resep elektronik dengan cek alergi" },
    ],
    roles: ALL_CLINICAL,
    setup: [{ id: "templates", label: "Tinjau template SOAP per poli" }],
  },
  {
    id: "outpatient",
    name: "Rawat Jalan",
    category: "clinical",
    summary: "Worklist poli: panggil pasien, periksa, dan selesaikan kunjungan dalam satu layar.",
    features: ["Worklist per poli & dokter", "Panggil pasien ke layar antrean", "Disposisi: pulang, kontrol, rujuk, rawat inap"],
    requires: ["registration", "emr"],
    enhances: [{ module: "appointments", benefit: "Lihat pasien booking hari ini" }],
    roles: ALL_CLINICAL,
    setup: [],
  },
  {
    id: "emergency",
    name: "Gawat Darurat (IGD)",
    category: "clinical",
    summary: "Triase 5 level, papan pantau IGD, dan target waktu tanggap.",
    features: ["Triase ATS 1–5", "Track board dengan waktu tunggu", "Disposisi & permintaan rawat inap"],
    requires: ["registration", "emr"],
    enhances: [{ module: "inpatient", benefit: "Admisi langsung dari IGD ke tempat tidur" }],
    roles: ALL_CLINICAL,
    setup: [{ id: "triage", label: "Sepakati target waktu tanggap per level triase" }],
  },
  {
    id: "inpatient",
    name: "Rawat Inap",
    category: "clinical",
    summary: "Bed board real-time, admisi, pindah ruang, pulang, dan sensus harian.",
    features: ["Bed board per ruangan (KRIS/VIP/ICU)", "Admisi, pindah, pulang", "Sensus harian untuk BOR/ALOS"],
    requires: ["emr"],
    enhances: [
      { module: "nursing", benefit: "Tanda vital, eMAR & serah terima per pasien rawat inap" },
      { module: "billing", benefit: "Tarif kamar per hari otomatis" },
    ],
    roles: [...ALL_CLINICAL, "frontdesk", "admin"],
    setup: [{ id: "beds", label: "Periksa master tempat tidur & kelas KRIS" }],
  },
  {
    id: "nursing",
    name: "Keperawatan",
    category: "clinical",
    summary: "Tanda vital dengan skor peringatan dini, pemberian obat (eMAR), serah terima SBAR.",
    features: ["Tanda vital + NEWS2 otomatis", "eMAR: jadwal & konfirmasi pemberian obat", "Serah terima shift (SBAR)"],
    requires: ["emr"],
    enhances: [{ module: "pharmacy", benefit: "Obat yang diserahkan farmasi otomatis masuk eMAR" }],
    roles: ALL_CLINICAL,
    setup: [],
  },
  {
    id: "surgery",
    name: "Kamar Operasi",
    category: "clinical",
    summary: "Jadwal kamar operasi dan WHO Surgical Safety Checklist.",
    features: ["Jadwal OK per kamar", "Checklist sign in / time out / sign out", "Tagihan operasi otomatis"],
    requires: ["emr"],
    enhances: [{ module: "inpatient", benefit: "Operasi terkait admisi rawat inap" }],
    roles: [...ALL_CLINICAL, "admin"],
    setup: [{ id: "rooms", label: "Daftarkan kamar operasi" }],
  },
  {
    id: "laboratory",
    name: "Laboratorium",
    category: "support",
    summary: "Order dari dokter → sampel → hasil → validasi, dengan nilai kritis.",
    features: ["Worklist & status sampel", "Input hasil dengan nilai rujukan", "Notifikasi nilai kritis"],
    requires: ["emr"],
    enhances: [{ module: "billing", benefit: "Tarif pemeriksaan otomatis ke tagihan" }],
    roles: ["labtech", "doctor", "nurse"],
    setup: [{ id: "catalog", label: "Tinjau katalog pemeriksaan & nilai rujukan" }],
  },
  {
    id: "radiology",
    name: "Radiologi",
    category: "support",
    summary: "Order pencitraan dan ekspertise radiolog.",
    features: ["Worklist pemeriksaan", "Ekspertise dengan template", "Status per order"],
    requires: ["emr"],
    enhances: [{ module: "billing", benefit: "Tarif pemeriksaan otomatis ke tagihan" }],
    roles: ["radiographer", "doctor"],
    setup: [],
  },
  {
    id: "pharmacy",
    name: "Farmasi",
    category: "support",
    summary: "Telaah resep (alergi, interaksi, Fornas), penyiapan, dan penyerahan obat.",
    features: ["Antrean resep", "Telaah otomatis: alergi, interaksi, high-alert, Fornas", "Penyerahan dengan pengurangan stok FEFO"],
    requires: ["emr"],
    enhances: [
      { module: "inventory", benefit: "Stok minimum & permintaan pembelian" },
      { module: "nursing", benefit: "Obat rawat inap langsung terjadwal di eMAR" },
    ],
    roles: ["pharmacist", "doctor"],
    setup: [{ id: "drugs", label: "Lengkapi master obat & harga" }],
  },
  {
    id: "billing",
    name: "Billing & Kasir",
    category: "finance",
    summary: "Tagihan terbentuk otomatis dari layanan; kasir tinggal menerima pembayaran.",
    features: ["Tagihan otomatis per kunjungan", "Tunai, debit, QRIS, transfer", "Kuitansi"],
    requires: ["registration"],
    enhances: [{ module: "claims", benefit: "Tagihan BPJS/asuransi diteruskan ke klaim" }],
    roles: ["cashier", "manager", "admin"],
    setup: [{ id: "tariffs", label: "Tetapkan tarif layanan" }],
  },
  {
    id: "claims",
    name: "Klaim & Casemix",
    category: "finance",
    summary: "Koding, grouper iDRG (dan INA-CBG lama), kelengkapan berkas, status klaim.",
    features: ["Cek kelengkapan berkas klaim", "Estimasi grup iDRG / INA-CBG", "Lacak status klaim & pending"],
    requires: ["billing", "emr"],
    enhances: [{ module: "bpjs", benefit: "SEP terhubung otomatis ke berkas klaim" }],
    roles: ["coder", "manager"],
    setup: [],
  },
  {
    id: "inventory",
    name: "Logistik & Inventori",
    category: "operations",
    summary: "Stok, kedaluwarsa, stok minimum, dan permintaan pembelian.",
    features: ["Stok per batch & kedaluwarsa", "Peringatan stok minimum", "Permintaan pembelian & penerimaan"],
    requires: [],
    enhances: [{ module: "pharmacy", benefit: "Stok obat berkurang otomatis saat penyerahan" }],
    roles: ["pharmacist", "admin", "manager"],
    setup: [{ id: "opname", label: "Lakukan stok opname awal" }],
  },
  {
    id: "hr",
    name: "SDM & Jadwal Jaga",
    category: "operations",
    summary: "Direktori staf, masa berlaku STR/SIP, dan jadwal shift.",
    features: ["Peringatan STR/SIP kedaluwarsa", "Roster mingguan P/S/M", "Direktori staf per unit"],
    requires: [],
    enhances: [],
    roles: ["admin", "manager", "nurse"],
    setup: [{ id: "staff", label: "Lengkapi data STR/SIP" }],
  },
  {
    id: "quality",
    name: "Mutu & Keselamatan Pasien",
    category: "quality",
    summary: "Pelaporan insiden (IKP) dengan grading risiko dan Indikator Mutu Nasional.",
    features: ["Lapor insiden, boleh anonim", "Matriks grading risiko otomatis", "13 Indikator Mutu Nasional"],
    requires: [],
    enhances: [],
    roles: ["admin", "manager", "nurse", "doctor", "frontdesk", "pharmacist", "labtech", "radiographer", "cashier", "coder"],
    setup: [{ id: "team", label: "Tetapkan tim KPRS" }],
  },
  {
    id: "reports",
    name: "Laporan & Analitik",
    category: "quality",
    summary: "Kunjungan, BOR/ALOS/TOI/BTO, pendapatan, dan top diagnosis.",
    features: ["Indikator rawat inap (Barber-Johnson)", "Pendapatan per penjamin", "Top 10 diagnosis"],
    requires: [],
    enhances: [
      { module: "inpatient", benefit: "BOR, ALOS, TOI, BTO" },
      { module: "billing", benefit: "Pendapatan per penjamin" },
    ],
    roles: ["manager", "admin"],
    setup: [],
  },
  {
    id: "bpjs",
    name: "Bridging BPJS",
    category: "integration",
    summary: "V-Claim (cek peserta, SEP, rujukan) dan Antrean Online Mobile JKN.",
    features: ["Cek kepesertaan & rujukan", "Terbitkan SEP", "Kirim task ID Antrean Online"],
    requires: ["registration"],
    enhances: [],
    roles: ["frontdesk", "coder", "admin"],
    setup: [{ id: "credentials", label: "Masukkan cons-id & secret key BPJS" }],
  },
  {
    id: "satusehat",
    name: "SATUSEHAT",
    category: "integration",
    summary: "Sinkron kunjungan, diagnosis, dan observasi ke platform SATUSEHAT (FHIR R4).",
    features: ["Antrean sinkron per resource", "Retry otomatis & manual", "Pemetaan lokasi & praktisi"],
    requires: ["emr"],
    enhances: [],
    roles: ["admin"],
    setup: [
      { id: "org", label: "Daftarkan Organization ID & client credential" },
      { id: "location", label: "Petakan unit ke Location SATUSEHAT" },
    ],
  },
]

export const MODULE_MAP: Record<ModuleId, ModuleDef> = Object.fromEntries(MODULES.map((m) => [m.id, m])) as Record<ModuleId, ModuleDef>

export const CORE_MODULES: ModuleId[] = MODULES.filter((m) => m.core).map((m) => m.id)

// ---------------------------------------------------------------------------------------
// Dependency resolution
// ---------------------------------------------------------------------------------------

/** Everything `id` needs, transitively, excluding `id` itself. */
export function requiredClosure(id: ModuleId): ModuleId[] {
  const seen = new Set<ModuleId>()
  const visit = (m: ModuleId) => {
    for (const dep of MODULE_MAP[m].requires) {
      if (!seen.has(dep)) {
        seen.add(dep)
        visit(dep)
      }
    }
  }
  visit(id)
  return [...seen]
}

/** Modules that must also be switched on to enable `id` given the current set. */
export function missingForEnable(id: ModuleId, enabled: ReadonlySet<ModuleId>): ModuleId[] {
  return requiredClosure(id).filter((m) => !enabled.has(m))
}

/** Enabled modules that would break if `id` were switched off. */
export function blockersForDisable(id: ModuleId, enabled: ReadonlySet<ModuleId>): ModuleId[] {
  return MODULES.filter((m) => enabled.has(m.id) && m.id !== id && requiredClosure(m.id).includes(id)).map((m) => m.id)
}

// ---------------------------------------------------------------------------------------
// Facility presets
// ---------------------------------------------------------------------------------------

export type FacilityType = "klinik-pratama" | "klinik-utama" | "rs-dasar" | "rs-madya" | "rs-rujukan"

export interface FacilityPreset {
  id: FacilityType
  name: string
  description: string
  /** Modules recommended to start with — deliberately small. */
  start: ModuleId[]
  /** Modules worth adding once the start set runs smoothly. */
  next: ModuleId[]
}

export const FACILITY_PRESETS: FacilityPreset[] = [
  {
    id: "klinik-pratama",
    name: "Klinik Pratama",
    description: "Pelayanan dasar, dokter umum/gigi, apotek kecil.",
    start: ["registration", "emr", "outpatient", "pharmacy", "billing"],
    next: ["appointments", "bpjs", "satusehat", "inventory"],
  },
  {
    id: "klinik-utama",
    name: "Klinik Utama",
    description: "Pelayanan spesialistik rawat jalan, lab & radiologi sederhana.",
    start: ["registration", "appointments", "emr", "outpatient", "laboratory", "pharmacy", "billing"],
    next: ["radiology", "bpjs", "satusehat", "inventory", "reports"],
  },
  {
    id: "rs-dasar",
    name: "RS Kelas Dasar",
    description: "RS kecil dengan IGD, rawat inap, dan penunjang dasar.",
    start: ["registration", "emr", "outpatient", "emergency", "inpatient", "nursing", "laboratory", "pharmacy", "billing", "bpjs", "satusehat"],
    next: ["claims", "radiology", "inventory", "quality", "reports"],
  },
  {
    id: "rs-madya",
    name: "RS Kelas Madya",
    description: "RS menengah dengan spesialis, kamar operasi, dan casemix.",
    start: [
      "registration", "appointments", "emr", "outpatient", "emergency", "inpatient", "nursing", "surgery", "laboratory",
      "radiology", "pharmacy", "billing", "claims", "bpjs", "satusehat", "inventory",
    ],
    next: ["hr", "quality", "reports"],
  },
  {
    id: "rs-rujukan",
    name: "RS Utama / Paripurna",
    description: "RS rujukan dengan seluruh layanan.",
    start: MODULES.filter((m) => !m.core).map((m) => m.id),
    next: [],
  },
]

/** Adds every module required by the ones in `set` (used by the onboarding picker). */
export function withDependencies(set: Iterable<ModuleId>): Set<ModuleId> {
  const out = new Set(set)
  for (const id of [...out]) for (const dep of requiredClosure(id)) out.add(dep)
  return out
}

/** Removes `id` and every module that (transitively) requires it. */
export function withoutDependents(id: ModuleId, set: Iterable<ModuleId>): Set<ModuleId> {
  const out = new Set(set)
  out.delete(id)
  for (const m of [...out]) if (requiredClosure(m).includes(id)) out.delete(m)
  return out
}
