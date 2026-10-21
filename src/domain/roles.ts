import type { RoleId } from "./types"

export interface RoleInfo {
  id: RoleId
  label: string
  /** What this person mostly does all day — shown on the role picker. */
  description: string
}

export const ROLES: Record<RoleId, RoleInfo> = {
  admin: { id: "admin", label: "Admin Sistem", description: "Mengatur modul, pengguna, dan konfigurasi faskes" },
  doctor: { id: "doctor", label: "Dokter", description: "Memeriksa pasien, menulis CPPT, order penunjang, resep" },
  nurse: { id: "nurse", label: "Perawat", description: "Tanda vital, pemberian obat, asuhan & serah terima" },
  frontdesk: { id: "frontdesk", label: "Pendaftaran", description: "Mendaftarkan pasien, antrean, SEP BPJS" },
  pharmacist: { id: "pharmacist", label: "Apoteker", description: "Telaah resep, penyiapan & penyerahan obat" },
  labtech: { id: "labtech", label: "Analis Lab", description: "Sampel, hasil, dan validasi laboratorium" },
  radiographer: { id: "radiographer", label: "Radiografer", description: "Pemeriksaan & ekspertise radiologi" },
  cashier: { id: "cashier", label: "Kasir", description: "Tagihan dan pembayaran pasien" },
  coder: { id: "coder", label: "Casemix / Koder", description: "Koding diagnosis & klaim BPJS/asuransi" },
  manager: { id: "manager", label: "Manajemen", description: "Indikator kinerja, mutu, dan keuangan" },
}

export const ROLE_ORDER: RoleId[] = [
  "frontdesk",
  "doctor",
  "nurse",
  "pharmacist",
  "labtech",
  "radiographer",
  "cashier",
  "coder",
  "manager",
  "admin",
]
