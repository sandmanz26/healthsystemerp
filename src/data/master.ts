/**
 * Master data for the demo facility "RS Medisphere Bandung".
 */
import type { BedClass, DoctorSchedule, InventoryItem, Staff, Unit } from "@/domain/types"

export const UNITS: Unit[] = [
  { id: "poli-umum", name: "Poli Umum", kind: "poli", bpjsCode: "UMU" },
  { id: "poli-dalam", name: "Poli Penyakit Dalam", kind: "poli", bpjsCode: "INT" },
  { id: "poli-anak", name: "Poli Anak", kind: "poli", bpjsCode: "ANA" },
  { id: "poli-obgyn", name: "Poli Kebidanan & Kandungan", kind: "poli", bpjsCode: "OBG" },
  { id: "poli-bedah", name: "Poli Bedah", kind: "poli", bpjsCode: "BED" },
  { id: "poli-saraf", name: "Poli Saraf", kind: "poli", bpjsCode: "SAR" },
  { id: "poli-gigi", name: "Poli Gigi", kind: "poli", bpjsCode: "GIG" },
  { id: "igd", name: "IGD", kind: "er" },
  { id: "melati", name: "Ruang Melati (Penyakit Dalam)", kind: "ward" },
  { id: "mawar", name: "Ruang Mawar (Bedah & Anak)", kind: "ward" },
  { id: "anggrek", name: "Ruang Anggrek (VIP)", kind: "ward" },
  { id: "icu", name: "ICU", kind: "icu" },
  { id: "ok", name: "Instalasi Bedah Sentral", kind: "or" },
  { id: "lab", name: "Laboratorium", kind: "lab" },
  { id: "rad", name: "Radiologi", kind: "rad" },
  { id: "farmasi", name: "Instalasi Farmasi", kind: "pharmacy" },
]

const year = new Date().getFullYear()
const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d).toISOString()
/** A date `days` from today — used to make some licences expire soon. */
const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString()

export const STAFF: Staff[] = [
  { id: "d1", name: "dr. Andi Pratama", role: "doctor", title: "Dokter Umum", unitId: "poli-umum", phone: "0812-2201-1001", strExpires: iso(year + 3, 5, 1), sipExpires: iso(year + 1, 8, 12) },
  { id: "d2", name: "dr. Sari Wulandari", role: "doctor", title: "Dokter Jaga IGD", unitId: "igd", phone: "0812-2201-1002", strExpires: iso(year + 2, 1, 9), sipExpires: inDays(24) },
  { id: "d3", name: "dr. Bambang Hadi, Sp.PD", role: "doctor", title: "Dokter Spesialis", specialty: "Penyakit Dalam", unitId: "poli-dalam", phone: "0812-2201-1003", strExpires: iso(year + 4, 2, 2), sipExpires: iso(year + 2, 3, 3) },
  { id: "d4", name: "dr. Ratna Kusuma, Sp.A", role: "doctor", title: "Dokter Spesialis", specialty: "Anak", unitId: "poli-anak", phone: "0812-2201-1004", strExpires: iso(year + 1, 11, 20), sipExpires: iso(year + 1, 11, 20) },
  { id: "d5", name: "dr. Hendra Gunawan, Sp.OG", role: "doctor", title: "Dokter Spesialis", specialty: "Obstetri & Ginekologi", unitId: "poli-obgyn", phone: "0812-2201-1005", strExpires: iso(year + 2, 7, 7), sipExpires: iso(year + 2, 7, 7) },
  { id: "d6", name: "dr. Yusuf Maulana, Sp.B", role: "doctor", title: "Dokter Spesialis", specialty: "Bedah", unitId: "poli-bedah", phone: "0812-2201-1006", strExpires: iso(year + 3, 4, 4), sipExpires: iso(year + 1, 4, 4) },
  { id: "d7", name: "dr. Lestari Anggraini, Sp.N", role: "doctor", title: "Dokter Spesialis", specialty: "Saraf", unitId: "poli-saraf", phone: "0812-2201-1007", strExpires: iso(year + 2, 9, 9), sipExpires: inDays(-3) },
  { id: "d8", name: "drg. Fitri Handayani", role: "doctor", title: "Dokter Gigi", unitId: "poli-gigi", phone: "0812-2201-1008", strExpires: iso(year + 1, 6, 6), sipExpires: iso(year + 1, 6, 6) },
  { id: "d9", name: "dr. Rudi Santoso, Sp.An", role: "doctor", title: "Dokter Spesialis", specialty: "Anestesi", unitId: "ok", phone: "0812-2201-1009", strExpires: iso(year + 3, 3, 3), sipExpires: iso(year + 2, 3, 3) },
  { id: "d10", name: "dr. Maya Purnama, Sp.Rad", role: "doctor", title: "Dokter Spesialis", specialty: "Radiologi", unitId: "rad", phone: "0812-2201-1010", strExpires: iso(year + 2, 10, 10), sipExpires: iso(year + 2, 10, 10) },
  { id: "d11", name: "dr. Agus Setiawan, Sp.PK", role: "doctor", title: "Dokter Spesialis", specialty: "Patologi Klinik", unitId: "lab", phone: "0812-2201-1011", strExpires: iso(year + 3, 1, 15), sipExpires: iso(year + 1, 1, 15) },
  { id: "d12", name: "dr. Dimas Arya", role: "doctor", title: "Dokter Jaga IGD", unitId: "igd", phone: "0812-2201-1012", strExpires: iso(year + 4, 12, 1), sipExpires: iso(year + 2, 12, 1) },
  { id: "d13", name: "dr. Rina Oktaviani, Sp.PD", role: "doctor", title: "Dokter Spesialis", specialty: "Penyakit Dalam", unitId: "poli-dalam", phone: "0812-2201-1013", strExpires: iso(year + 3, 6, 6), sipExpires: iso(year + 2, 6, 6) },
  { id: "d14", name: "dr. Fadli Rahman, Sp.JP", role: "doctor", title: "Dokter Spesialis", specialty: "Jantung & Pembuluh Darah", unitId: "icu", phone: "0812-2201-1014", strExpires: iso(year + 3, 8, 8), sipExpires: iso(year + 2, 8, 8) },
  { id: "n1", name: "Ns. Dewi Lestari, S.Kep", role: "nurse", title: "Kepala Ruang", unitId: "melati", phone: "0813-3301-2001", strExpires: iso(year + 2, 2, 2), sipExpires: iso(year + 2, 2, 2) },
  { id: "n2", name: "Ns. Rina Marlina, S.Kep", role: "nurse", title: "Perawat Pelaksana", unitId: "mawar", phone: "0813-3301-2002", strExpires: inDays(40), sipExpires: inDays(40) },
  { id: "n3", name: "Ns. Joko Susilo, S.Kep", role: "nurse", title: "Perawat IGD", unitId: "igd", phone: "0813-3301-2003", strExpires: iso(year + 3, 3, 3), sipExpires: iso(year + 3, 3, 3) },
  { id: "n4", name: "Ns. Putri Ayu, S.Kep", role: "nurse", title: "Perawat ICU", unitId: "icu", phone: "0813-3301-2004", strExpires: iso(year + 1, 5, 5), sipExpires: iso(year + 1, 5, 5) },
  { id: "n5", name: "Wahyu Hidayat, A.Md.Kep", role: "nurse", title: "Perawat Poli", unitId: "poli-umum", phone: "0813-3301-2005", strExpires: iso(year + 2, 6, 6), sipExpires: iso(year + 2, 6, 6) },
  { id: "n6", name: "Ns. Siti Nurhaliza, S.Kep", role: "nurse", title: "Perawat Pelaksana", unitId: "anggrek", phone: "0813-3301-2006", strExpires: iso(year + 2, 8, 8), sipExpires: iso(year + 2, 8, 8) },
  { id: "n7", name: "Ns. Fajar Ramadhan, S.Kep", role: "nurse", title: "Perawat Bedah", unitId: "ok", phone: "0813-3301-2007", strExpires: iso(year + 2, 1, 1), sipExpires: iso(year + 2, 1, 1) },
  { id: "f1", name: "Intan Permata", role: "frontdesk", title: "Petugas Pendaftaran", unitId: "poli-umum", phone: "0814-4401-3001" },
  { id: "f2", name: "Bayu Saputra", role: "frontdesk", title: "Petugas Admisi", unitId: "igd", phone: "0814-4401-3002" },
  { id: "p1", name: "apt. Nadia Rahma, S.Farm", role: "pharmacist", title: "Apoteker Penanggung Jawab", unitId: "farmasi", phone: "0815-5501-4001", strExpires: iso(year + 2, 4, 4), sipExpires: iso(year + 2, 4, 4) },
  { id: "p2", name: "apt. Galih Prakoso, S.Farm", role: "pharmacist", title: "Apoteker", unitId: "farmasi", phone: "0815-5501-4002", strExpires: iso(year + 1, 9, 9), sipExpires: inDays(18) },
  { id: "l1", name: "Eka Saputri, A.Md.AK", role: "labtech", title: "Analis Laboratorium", unitId: "lab", phone: "0816-6601-5001", strExpires: iso(year + 2, 2, 2), sipExpires: iso(year + 2, 2, 2) },
  { id: "l2", name: "Rizky Firmansyah, A.Md.AK", role: "labtech", title: "Analis Laboratorium", unitId: "lab", phone: "0816-6601-5002", strExpires: iso(year + 3, 3, 3), sipExpires: iso(year + 3, 3, 3) },
  { id: "r1", name: "Teguh Wibowo, A.Md.Rad", role: "radiographer", title: "Radiografer", unitId: "rad", phone: "0817-7701-6001", strExpires: iso(year + 2, 2, 2), sipExpires: iso(year + 2, 2, 2) },
  { id: "c1", name: "Melati Sukma", role: "cashier", title: "Kasir", unitId: "poli-umum", phone: "0818-8801-7001" },
  { id: "k1", name: "Ayu Kartika, A.Md.RMIK", role: "coder", title: "Koder Casemix", phone: "0819-9901-8001" },
  { id: "m1", name: "dr. Hartono Wijaya, MARS", role: "manager", title: "Direktur", phone: "0811-1101-9001" },
  { id: "a1", name: "Arif Budiman", role: "admin", title: "Admin SIMRS", phone: "0811-1101-9002" },
]

/** Who is "logged in" when the demo switches to a role. */
export const DEFAULT_USER_FOR_ROLE = {
  admin: "a1",
  doctor: "d1",
  nurse: "n1",
  frontdesk: "f1",
  pharmacist: "p1",
  labtech: "l1",
  radiographer: "r1",
  cashier: "c1",
  coder: "k1",
  manager: "m1",
} as const

export const WARD_LAYOUT: { unitId: string; prefix: string; count: number; bedClass: BedClass }[] = [
  { unitId: "melati", prefix: "MLT", count: 12, bedClass: "KRIS" },
  { unitId: "mawar", prefix: "MWR", count: 10, bedClass: "KRIS" },
  { unitId: "mawar", prefix: "ISO", count: 2, bedClass: "Isolasi" },
  { unitId: "anggrek", prefix: "AGR", count: 5, bedClass: "VIP" },
  { unitId: "anggrek", prefix: "VV", count: 1, bedClass: "VVIP" },
  { unitId: "icu", prefix: "ICU", count: 6, bedClass: "ICU" },
]

export const SCHEDULE_TEMPLATE: Omit<DoctorSchedule, "id">[] = [
  ...[1, 2, 3, 4, 5, 6].map((weekday) => ({ practitionerId: "d1", unitId: "poli-umum", weekday, start: "08:00", end: "14:00", quota: 40 })),
  ...[1, 3, 5].map((weekday) => ({ practitionerId: "d3", unitId: "poli-dalam", weekday, start: "09:00", end: "13:00", quota: 30 })),
  ...[2, 4, 6].map((weekday) => ({ practitionerId: "d3", unitId: "poli-dalam", weekday, start: "14:00", end: "17:00", quota: 20 })),
  ...[1, 2, 4].map((weekday) => ({ practitionerId: "d4", unitId: "poli-anak", weekday, start: "10:00", end: "14:00", quota: 25 })),
  ...[2, 3, 5].map((weekday) => ({ practitionerId: "d5", unitId: "poli-obgyn", weekday, start: "13:00", end: "17:00", quota: 20 })),
  ...[1, 3, 4].map((weekday) => ({ practitionerId: "d6", unitId: "poli-bedah", weekday, start: "08:00", end: "11:00", quota: 15 })),
  ...[2, 5].map((weekday) => ({ practitionerId: "d7", unitId: "poli-saraf", weekday, start: "09:00", end: "12:00", quota: 15 })),
  ...[1, 2, 3, 4, 5].map((weekday) => ({ practitionerId: "d8", unitId: "poli-gigi", weekday, start: "08:00", end: "15:00", quota: 16 })),
]

const exp = (months: number) => new Date(Date.now() + months * 30 * 86400000).toISOString()

export const INVENTORY: InventoryItem[] = [
  { id: "obt-pct", name: "Paracetamol 500 mg", category: "obat", form: "Tablet", strength: "500 mg", unit: "tablet", price: 500, minStock: 500, fornas: true, drugClass: "analgesic", batches: [{ batch: "PCT2401", expiry: exp(14), qty: 1800 }, { batch: "PCT2312", expiry: exp(3), qty: 240 }] },
  { id: "obt-ibu", name: "Ibuprofen 400 mg", category: "obat", form: "Tablet", strength: "400 mg", unit: "tablet", price: 900, minStock: 300, fornas: true, drugClass: "nsaid", batches: [{ batch: "IBU2402", expiry: exp(18), qty: 640 }] },
  { id: "obt-amx", name: "Amoksisilin 500 mg", category: "obat", form: "Kapsul", strength: "500 mg", unit: "kapsul", price: 1200, minStock: 400, fornas: true, drugClass: "penicillin", batches: [{ batch: "AMX2403", expiry: exp(20), qty: 900 }] },
  { id: "obt-cfx", name: "Sefiksim 100 mg", category: "obat", form: "Kapsul", strength: "100 mg", unit: "kapsul", price: 4500, minStock: 200, fornas: true, drugClass: "cephalosporin", batches: [{ batch: "CFX2401", expiry: exp(11), qty: 160 }] },
  { id: "obt-cft", name: "Seftriakson 1 g inj", category: "obat", form: "Vial", strength: "1 g", unit: "vial", price: 18000, minStock: 100, fornas: true, drugClass: "cephalosporin", batches: [{ batch: "CFT2402", expiry: exp(16), qty: 210 }] },
  { id: "obt-azt", name: "Azitromisin 500 mg", category: "obat", form: "Tablet", strength: "500 mg", unit: "tablet", price: 6500, minStock: 100, fornas: true, drugClass: "macrolide", batches: [{ batch: "AZT2311", expiry: exp(2), qty: 60 }] },
  { id: "obt-cip", name: "Siprofloksasin 500 mg", category: "obat", form: "Tablet", strength: "500 mg", unit: "tablet", price: 1500, minStock: 200, fornas: true, drugClass: "quinolone", batches: [{ batch: "CIP2403", expiry: exp(22), qty: 480 }] },
  { id: "obt-mtf", name: "Metformin 500 mg", category: "obat", form: "Tablet", strength: "500 mg", unit: "tablet", price: 400, minStock: 600, fornas: true, drugClass: "biguanide", batches: [{ batch: "MTF2402", expiry: exp(19), qty: 2400 }] },
  { id: "obt-glm", name: "Glimepirid 2 mg", category: "obat", form: "Tablet", strength: "2 mg", unit: "tablet", price: 800, minStock: 300, fornas: true, drugClass: "sulfonylurea", batches: [{ batch: "GLM2401", expiry: exp(13), qty: 260 }] },
  { id: "obt-ins", name: "Insulin glargine 100 IU/mL", category: "obat", form: "Pen", strength: "100 IU/mL", unit: "pen", price: 145000, minStock: 20, fornas: true, highAlert: true, drugClass: "insulin", batches: [{ batch: "INS2402", expiry: exp(8), qty: 34 }] },
  { id: "obt-aml", name: "Amlodipin 10 mg", category: "obat", form: "Tablet", strength: "10 mg", unit: "tablet", price: 600, minStock: 500, fornas: true, drugClass: "ccb", batches: [{ batch: "AML2403", expiry: exp(24), qty: 1600 }] },
  { id: "obt-cap", name: "Kaptopril 25 mg", category: "obat", form: "Tablet", strength: "25 mg", unit: "tablet", price: 300, minStock: 300, fornas: true, drugClass: "ace-inhibitor", batches: [{ batch: "CAP2401", expiry: exp(15), qty: 700 }] },
  { id: "obt-spi", name: "Spironolakton 25 mg", category: "obat", form: "Tablet", strength: "25 mg", unit: "tablet", price: 1100, minStock: 150, fornas: true, drugClass: "potassium-sparing", batches: [{ batch: "SPI2402", expiry: exp(17), qty: 120 }] },
  { id: "obt-fur", name: "Furosemid 40 mg", category: "obat", form: "Tablet", strength: "40 mg", unit: "tablet", price: 350, minStock: 300, fornas: true, drugClass: "loop-diuretic", batches: [{ batch: "FUR2403", expiry: exp(21), qty: 820 }] },
  { id: "obt-sim", name: "Simvastatin 20 mg", category: "obat", form: "Tablet", strength: "20 mg", unit: "tablet", price: 500, minStock: 400, fornas: true, drugClass: "statin", batches: [{ batch: "SIM2402", expiry: exp(18), qty: 1100 }] },
  { id: "obt-war", name: "Warfarin 2 mg", category: "obat", form: "Tablet", strength: "2 mg", unit: "tablet", price: 2200, minStock: 100, fornas: true, highAlert: true, drugClass: "warfarin", batches: [{ batch: "WAR2401", expiry: exp(9), qty: 140 }] },
  { id: "obt-omz", name: "Omeprazol 20 mg", category: "obat", form: "Kapsul", strength: "20 mg", unit: "kapsul", price: 700, minStock: 400, fornas: true, drugClass: "ppi", batches: [{ batch: "OMZ2403", expiry: exp(23), qty: 380 }] },
  { id: "obt-ant", name: "Antasida doen", category: "obat", form: "Tablet kunyah", strength: "", unit: "tablet", price: 250, minStock: 400, fornas: true, drugClass: "antacid", batches: [{ batch: "ANT2402", expiry: exp(12), qty: 900 }] },
  { id: "obt-ond", name: "Ondansetron 4 mg inj", category: "obat", form: "Ampul", strength: "4 mg/2 mL", unit: "ampul", price: 9000, minStock: 80, fornas: true, drugClass: "antiemetic", batches: [{ batch: "OND2401", expiry: exp(10), qty: 95 }] },
  { id: "obt-sal", name: "Salbutamol nebul 2,5 mg", category: "obat", form: "Nebul", strength: "2,5 mg", unit: "nebul", price: 6000, minStock: 100, fornas: true, drugClass: "saba", batches: [{ batch: "SAL2402", expiry: exp(14), qty: 70 }] },
  { id: "obt-kcl", name: "KCl 7,46% inj (25 mL)", category: "obat", form: "Flakon", strength: "7,46%", unit: "flakon", price: 12000, minStock: 30, fornas: true, highAlert: true, drugClass: "electrolyte", batches: [{ batch: "KCL2401", expiry: exp(12), qty: 40 }] },
  { id: "obt-mor", name: "Morfin 10 mg inj", category: "obat", form: "Ampul", strength: "10 mg/mL", unit: "ampul", price: 15000, minStock: 20, fornas: true, highAlert: true, drugClass: "opioid", batches: [{ batch: "MOR2402", expiry: exp(15), qty: 26 }] },
  { id: "obt-cet", name: "Cetirizin 10 mg", category: "obat", form: "Tablet", strength: "10 mg", unit: "tablet", price: 450, minStock: 300, fornas: true, drugClass: "antihistamine", batches: [{ batch: "CET2403", expiry: exp(20), qty: 520 }] },
  { id: "obt-vtc", name: "Vitamin C 500 mg (branded)", category: "obat", form: "Tablet", strength: "500 mg", unit: "tablet", price: 3500, minStock: 100, fornas: false, drugClass: "vitamin", batches: [{ batch: "VTC2402", expiry: exp(6), qty: 300 }] },
  { id: "obt-rl", name: "Ringer Laktat 500 mL", category: "obat", form: "Infus", strength: "500 mL", unit: "kolf", price: 14000, minStock: 200, fornas: true, drugClass: "fluid", batches: [{ batch: "RL2403", expiry: exp(26), qty: 340 }] },
  { id: "obt-nacl", name: "NaCl 0,9% 500 mL", category: "obat", form: "Infus", strength: "500 mL", unit: "kolf", price: 12000, minStock: 200, fornas: true, drugClass: "fluid", batches: [{ batch: "NACL2402", expiry: exp(25), qty: 150 }] },
  { id: "bhp-spuit3", name: "Spuit 3 mL", category: "bmhp", unit: "pcs", price: 2500, minStock: 500, batches: [{ batch: "SP2401", expiry: exp(36), qty: 2200 }] },
  { id: "bhp-iv", name: "IV catheter 20G", category: "bmhp", unit: "pcs", price: 9500, minStock: 200, batches: [{ batch: "IVC2402", expiry: exp(30), qty: 180 }] },
  { id: "bhp-glove", name: "Sarung tangan steril 7", category: "bmhp", unit: "pasang", price: 6000, minStock: 300, batches: [{ batch: "GLV2403", expiry: exp(30), qty: 760 }] },
  { id: "bhp-mask", name: "Masker bedah", category: "bmhp", unit: "box", price: 35000, minStock: 40, batches: [{ batch: "MSK2402", expiry: exp(40), qty: 55 }] },
  { id: "rgn-hb", name: "Reagen hematologi 5-diff", category: "reagen", unit: "kit", price: 2850000, minStock: 2, batches: [{ batch: "RHB2402", expiry: exp(5), qty: 3 }] },
  { id: "rgn-ns1", name: "Rapid test NS1", category: "reagen", unit: "test", price: 95000, minStock: 50, batches: [{ batch: "NS12401", expiry: exp(1), qty: 22 }] },
]
