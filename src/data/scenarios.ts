/**
 * Clinical scenarios used to generate a believable demo dataset. Each one is a typical case
 * for its unit, written the way Indonesian clinicians chart (singkatan umum dipertahankan).
 */
import type { Gender, TriageLevel, Vitals } from "@/domain/types"

export interface Scenario {
  dx: string
  extraDx?: string[]
  complaint: string
  s: string
  o: string
  a: string
  p: string
  labs?: string[]
  rads?: string[]
  /** [itemId, dose, frequency, route, days, qty] */
  drugs?: [string, string, string, string, number, number][]
  procedures?: string[]
  vitals: Omit<Vitals, "id" | "at" | "by">
  triage?: TriageLevel
  /** Who this case can happen to. Default: aged 15+, any sex. */
  who?: { sex?: Gender; minAge?: number; maxAge?: number }
  /** DPJP for inpatient cases. */
  doctor?: string
}

export const OUTPATIENT_SCENARIOS: Record<string, Scenario[]> = {
  "poli-umum": [
    { dx: "J06.9", complaint: "Batuk pilek 3 hari", s: "Batuk berdahak, pilek, demam ringan 3 hari. Tidak sesak.", o: "KU baik, faring hiperemis, paru vesikuler, rhonki -/-.", a: "ISPA", p: "Simtomatik, banyak minum, kontrol bila demam > 3 hari.", drugs: [["obt-pct", "500 mg", "3x1", "Oral", 3, 10], ["obt-cet", "10 mg", "1x1", "Oral", 5, 5]], vitals: { systolic: 118, diastolic: 76, heartRate: 88, respRate: 18, temperature: 37.8, spo2: 98 } },
    { dx: "K29.7", complaint: "Nyeri ulu hati", s: "Nyeri ulu hati, mual, kembung sejak 1 minggu. Makan tidak teratur.", o: "Nyeri tekan epigastrium, BU normal.", a: "Gastritis", p: "PPI, antasida, edukasi pola makan.", drugs: [["obt-omz", "20 mg", "2x1", "Oral", 7, 14], ["obt-ant", "1 tab", "3x1", "Oral", 5, 15]], vitals: { systolic: 122, diastolic: 80, heartRate: 82, respRate: 18, temperature: 36.6, spo2: 99 } },
    { dx: "A09", complaint: "Diare sejak kemarin", s: "BAB cair 5x/hari, tanpa darah, mual. Minum masih bisa.", o: "Turgor baik, mukosa lembab, BU meningkat.", a: "Gastroenteritis akut tanpa dehidrasi", p: "Oralit, zinc, edukasi tanda dehidrasi.", drugs: [["obt-pct", "500 mg", "3x1", "Oral", 3, 10]], vitals: { systolic: 110, diastolic: 70, heartRate: 92, respRate: 20, temperature: 37.4, spo2: 98 } },
    { dx: "M54.5", complaint: "Nyeri pinggang", s: "Nyeri pinggang bawah setelah angkat galon, tidak menjalar.", o: "Spasme otot paravertebra lumbal, SLR -/-.", a: "Low back pain mekanik", p: "Analgesik, kompres hangat, edukasi ergonomi.", drugs: [["obt-ibu", "400 mg", "3x1", "Oral", 5, 15]], vitals: { systolic: 128, diastolic: 82, heartRate: 76, respRate: 16, temperature: 36.5, spo2: 99 } },
    { dx: "A01.0", complaint: "Demam 6 hari", s: "Demam naik turun terutama sore-malam 6 hari, lidah kotor, mual.", o: "Lidah kotor tepi hiperemis, nyeri tekan epigastrium.", a: "Suspek demam tifoid", p: "Cek Widal & darah rutin, antibiotik empiris.", labs: ["WIDAL", "HB", "LEU", "TROMBO"], drugs: [["obt-cip", "500 mg", "2x1", "Oral", 7, 14], ["obt-pct", "500 mg", "3x1", "Oral", 5, 15]], vitals: { systolic: 112, diastolic: 72, heartRate: 96, respRate: 20, temperature: 38.6, spo2: 98 } },
  ],
  "poli-dalam": [
    { dx: "I10", complaint: "Kontrol hipertensi", s: "Kontrol rutin, kadang pusing tengkuk, obat habis 3 hari.", o: "TD 162/96, jantung & paru dbn.", a: "Hipertensi esensial belum terkontrol", p: "Lanjut amlodipin, diet rendah garam, kontrol 1 bulan.", labs: ["CR", "CHOL"], drugs: [["obt-aml", "10 mg", "1x1", "Oral", 30, 30]], vitals: { systolic: 162, diastolic: 96, heartRate: 84, respRate: 18, temperature: 36.7, spo2: 98, weight: 74 } },
    { dx: "E11.9", extraDx: ["I10"], complaint: "Kontrol DM", s: "Kontrol DM, sering haus, kesemutan kaki.", o: "Status gizi obesitas I, sensibilitas kaki menurun.", a: "DM tipe 2 + hipertensi", p: "Metformin + glimepirid, cek HbA1c, edukasi diet.", labs: ["GDP", "HBA1C", "CR"], drugs: [["obt-mtf", "500 mg", "3x1", "Oral", 30, 90], ["obt-glm", "2 mg", "1x1", "Oral", 30, 30]], vitals: { systolic: 138, diastolic: 86, heartRate: 80, respRate: 18, temperature: 36.6, spo2: 98, weight: 82 } },
    { dx: "E78.5", complaint: "Kolesterol tinggi", s: "Hasil MCU kolesterol tinggi, tidak ada keluhan.", o: "Dbn.", a: "Dislipidemia", p: "Statin, diet, olahraga, cek ulang 3 bulan.", labs: ["CHOL", "SGPT"], drugs: [["obt-sim", "20 mg", "1x1", "Oral", 30, 30]], vitals: { systolic: 126, diastolic: 80, heartRate: 72, respRate: 16, temperature: 36.5, spo2: 99 } },
  ],
  "poli-anak": [
    { dx: "J06.9", complaint: "Anak batuk pilek", s: "Batuk pilek 2 hari, demam, nafsu makan turun.", o: "Faring hiperemis, paru bersih, tidak ada retraksi.", a: "ISPA pada anak", p: "Simtomatik, edukasi tanda bahaya.", drugs: [["obt-pct", "250 mg", "3x1", "Oral", 3, 9]], who: { maxAge: 12 }, vitals: { heartRate: 110, respRate: 26, temperature: 38.1, spo2: 98, weight: 14 } },
    { dx: "A90", complaint: "Demam 3 hari", s: "Demam tinggi mendadak 3 hari, nyeri otot, ruam.", o: "Ptekie (+) lengan, tidak ada tanda syok.", a: "Suspek dengue", p: "Cek NS1 & darah rutin, minum banyak, kontrol besok.", labs: ["NS1", "HB", "HT", "TROMBO"], drugs: [["obt-pct", "250 mg", "4x1", "Oral", 3, 12]], who: { maxAge: 12 }, vitals: { heartRate: 118, respRate: 24, temperature: 39.0, spo2: 98, weight: 22 } },
  ],
  "poli-obgyn": [
    { dx: "Z00.0", complaint: "Kontrol kehamilan 28 minggu", s: "G2P1A0 hamil 28 mgg, gerak janin aktif, tidak ada keluhan.", o: "TFU 26 cm, DJJ 142x/mnt, edema -/-.", a: "Kehamilan normal", p: "USG, suplemen, kontrol 2 minggu.", rads: ["US-OBS"], who: { sex: "female", minAge: 20, maxAge: 40 }, vitals: { systolic: 116, diastolic: 74, heartRate: 86, respRate: 18, temperature: 36.7, spo2: 99, weight: 63 } },
  ],
  "poli-bedah": [
    { dx: "K80.2", complaint: "Nyeri perut kanan atas", s: "Nyeri perut kanan atas setelah makan berlemak, berulang 2 bulan.", o: "Murphy sign (-), nyeri tekan kuadran kanan atas.", a: "Kolelitiasis simtomatik", p: "USG abdomen, rencana kolesistektomi laparoskopik.", rads: ["US-ABD"], labs: ["SGOT", "SGPT"], vitals: { systolic: 124, diastolic: 78, heartRate: 78, respRate: 16, temperature: 36.6, spo2: 99 } },
  ],
  "poli-saraf": [
    { dx: "R51", complaint: "Sakit kepala berulang", s: "Sakit kepala tegang di dahi & tengkuk, memberat saat stres.", o: "Pemeriksaan neurologis dbn.", a: "Tension type headache", p: "Analgesik, manajemen stres.", drugs: [["obt-pct", "500 mg", "3x1", "Oral", 5, 15]], vitals: { systolic: 130, diastolic: 84, heartRate: 78, respRate: 16, temperature: 36.6, spo2: 99 } },
  ],
  "poli-gigi": [
    { dx: "K30", complaint: "Gigi berlubang nyeri", s: "Gigi geraham kanan bawah berlubang, nyeri saat makan.", o: "Karies profunda 46.", a: "Pulpitis reversibel 46", p: "Tumpatan sementara, analgesik.", drugs: [["obt-ibu", "400 mg", "3x1", "Oral", 3, 9]], vitals: { systolic: 120, diastolic: 78, heartRate: 76, respRate: 16, temperature: 36.6, spo2: 99 } },
  ],
}

export const ER_SCENARIOS: Scenario[] = [
  { dx: "I20.9", complaint: "Nyeri dada kiri 1 jam", s: "Nyeri dada kiri seperti ditindih, menjalar ke lengan kiri, keringat dingin.", o: "Akral dingin, EKG: ST depresi V4-V6.", a: "Suspek sindrom koroner akut", p: "Oksigen, EKG serial, troponin, konsul jantung.", labs: ["TROP", "K", "NA"], procedures: ["89.52"], triage: 2, who: { minAge: 40 }, vitals: { systolic: 150, diastolic: 95, heartRate: 108, respRate: 22, temperature: 36.8, spo2: 94, onOxygen: true } },
  { dx: "S52.5", complaint: "Jatuh dari motor, nyeri pergelangan tangan", s: "Jatuh dari motor, tangan kanan menumpu, nyeri & bengkak.", o: "Deformitas distal radius dekstra, NVD baik.", a: "Fraktur radius distal tertutup", p: "Bidai, foto, konsul bedah ortopedi.", rads: ["XR-EXT"], triage: 3, vitals: { systolic: 132, diastolic: 84, heartRate: 98, respRate: 20, temperature: 36.7, spo2: 99, painScore: 7 } },
  { dx: "J45.9", complaint: "Sesak napas", s: "Sesak sejak 3 jam, mengi, riwayat asma.", o: "Wheezing (+) bilateral, retraksi ringan.", a: "Asma eksaserbasi sedang", p: "Nebulisasi salbutamol 3x, evaluasi ulang.", procedures: ["93.94"], drugs: [["obt-sal", "2,5 mg", "Tiap 20 menit", "Inhalasi", 1, 3]], triage: 2, vitals: { systolic: 128, diastolic: 82, heartRate: 112, respRate: 28, temperature: 36.9, spo2: 92 } },
  { dx: "A91", complaint: "Demam 4 hari, lemas", s: "Demam 4 hari, nyeri perut, muntah 3x, mimisan.", o: "Akral hangat, ptekie (+), hepar teraba 2 jari.", a: "DBD dengan tanda bahaya", p: "Cairan kristaloid, cek DL serial, rawat inap.", labs: ["HB", "HT", "TROMBO", "NS1"], triage: 3, vitals: { systolic: 100, diastolic: 70, heartRate: 112, respRate: 22, temperature: 38.4, spo2: 97 } },
  { dx: "R10.4", complaint: "Nyeri perut kanan bawah", s: "Nyeri perut mulai di ulu hati pindah ke kanan bawah, mual.", o: "Nyeri tekan McBurney (+), rebound (+).", a: "Suspek apendisitis akut", p: "Lab, USG, konsul bedah.", labs: ["LEU", "HB"], rads: ["US-ABD"], triage: 3, vitals: { systolic: 122, diastolic: 78, heartRate: 102, respRate: 20, temperature: 38.2, spo2: 98, painScore: 6 } },
  { dx: "S06.0", complaint: "Kepala terbentur", s: "Terpeleset di kamar mandi, kepala terbentur, sempat pusing.", o: "GCS 15, vulnus laceratum frontal 2 cm.", a: "Cedera kepala ringan", p: "Hecting, observasi 6 jam.", procedures: ["86.59"], triage: 4, vitals: { systolic: 126, diastolic: 80, heartRate: 84, respRate: 18, temperature: 36.6, spo2: 99 } },
  { dx: "B34.9", complaint: "Demam & pegal", s: "Demam 1 hari, pegal-pegal, masih makan minum.", o: "KU baik, tanda vital stabil.", a: "Infeksi virus", p: "Simtomatik, pulang.", drugs: [["obt-pct", "500 mg", "3x1", "Oral", 3, 10]], triage: 5, vitals: { systolic: 118, diastolic: 76, heartRate: 90, respRate: 18, temperature: 38.0, spo2: 99 } },
  { dx: "I63.9", complaint: "Lemah separuh badan", s: "Tiba-tiba lemah tubuh kanan & bicara pelo sejak 2 jam.", o: "Hemiparesis dekstra, parese N.VII sentral.", a: "Suspek stroke iskemik akut (onset < 4,5 jam)", p: "CT kepala segera, konsul saraf, pertimbangkan trombolisis.", rads: ["CT-HEAD"], labs: ["GDS", "NA", "K"], triage: 2, who: { minAge: 45 }, vitals: { systolic: 186, diastolic: 104, heartRate: 92, respRate: 20, temperature: 36.8, spo2: 96 } },
]

export const INPATIENT_SCENARIOS: (Scenario & { unitHint: string })[] = [
  { unitHint: "melati", dx: "A91", complaint: "DBD hari ke-5", s: "Demam turun, lemas, nafsu makan membaik.", o: "Ptekie berkurang, akral hangat.", a: "DBD fase kritis terlewati", p: "Cek DL tiap 12 jam, infus RL.", labs: ["HB", "HT", "TROMBO"], drugs: [["obt-rl", "500 mL", "Tiap 8 jam", "IV", 3, 9], ["obt-pct", "500 mg", "3x1", "Oral", 3, 9]], doctor: "d13", vitals: { systolic: 110, diastolic: 70, heartRate: 92, respRate: 20, temperature: 37.2, spo2: 98 } },
  { unitHint: "melati", dx: "J18.9", complaint: "Pneumonia", s: "Batuk berdahak kuning, sesak berkurang.", o: "Ronki basah kasar paru kanan bawah.", a: "Pneumonia komunitas, perbaikan", p: "Seftriakson IV, nebul bila sesak, foto thorax ulang.", rads: ["XR-THX"], drugs: [["obt-cft", "1 g", "2x1", "IV", 5, 10], ["obt-sal", "2,5 mg", "3x1", "Inhalasi", 3, 9]], doctor: "d3", who: { minAge: 40 }, vitals: { systolic: 118, diastolic: 74, heartRate: 98, respRate: 24, temperature: 38.1, spo2: 93, onOxygen: true } },
  { unitHint: "melati", dx: "E11.65", extraDx: ["I10"], complaint: "Hiperglikemia", s: "Lemas, sering BAK, GDS saat masuk 420.", o: "Dehidrasi ringan.", a: "DM tipe 2 dengan hiperglikemia", p: "Insulin basal, cek GDS 4x/hari.", labs: ["GDS", "K", "NA", "CR"], drugs: [["obt-ins", "10 IU", "1x1", "SC", 3, 1], ["obt-nacl", "500 mL", "Tiap 8 jam", "IV", 2, 6]], doctor: "d3", who: { minAge: 35 }, vitals: { systolic: 134, diastolic: 82, heartRate: 96, respRate: 20, temperature: 36.8, spo2: 97 } },
  { unitHint: "melati", dx: "I50.9", extraDx: ["I10"], complaint: "Sesak, kaki bengkak", s: "Sesak saat berbaring, kaki bengkak, sesak berkurang hari ini.", o: "JVP meningkat, ronki basah halus basal, edema tungkai.", a: "Gagal jantung dekompensasi akut", p: "Furosemid, spironolakton, restriksi cairan, timbang harian.", labs: ["K", "NA", "CR"], drugs: [["obt-fur", "40 mg", "2x1", "Oral", 5, 10], ["obt-spi", "25 mg", "1x1", "Oral", 5, 5], ["obt-cap", "25 mg", "2x1", "Oral", 5, 10]], doctor: "d14", who: { minAge: 50 }, vitals: { systolic: 104, diastolic: 66, heartRate: 112, respRate: 26, temperature: 36.6, spo2: 91, onOxygen: true } },
  { unitHint: "melati", dx: "A09", complaint: "Diare dehidrasi", s: "BAB cair berkurang 2x/hari.", o: "Turgor kembali cepat.", a: "Gastroenteritis akut dengan dehidrasi sedang, perbaikan", p: "Infus RL, diet lunak.", drugs: [["obt-rl", "500 mL", "Tiap 8 jam", "IV", 2, 6], ["obt-ond", "4 mg", "Jika perlu", "IV", 2, 2]], doctor: "d13", vitals: { systolic: 112, diastolic: 72, heartRate: 88, respRate: 18, temperature: 36.9, spo2: 98 } },
  { unitHint: "melati", dx: "N18.5", complaint: "CKD, jadwal HD", s: "Lemas, sesak ringan, jadwal HD hari ini.", o: "Konjungtiva anemis, edema pretibial.", a: "CKD stage 5 on HD", p: "Hemodialisis, koreksi kalium.", labs: ["UR", "CR", "K", "HB"], procedures: ["39.95"], doctor: "d3", who: { minAge: 35 }, vitals: { systolic: 168, diastolic: 98, heartRate: 90, respRate: 22, temperature: 36.7, spo2: 95 } },
  { unitHint: "mawar", dx: "K35.8", complaint: "Post apendektomi H1", s: "Nyeri luka operasi, sudah flatus.", o: "Luka operasi kering, BU (+).", a: "Post apendektomi hari ke-1", p: "Mobilisasi, diet bertahap, analgesik.", procedures: ["47.09"], drugs: [["obt-cft", "1 g", "2x1", "IV", 3, 6], ["obt-pct", "500 mg", "3x1", "Oral", 3, 9]], doctor: "d6", vitals: { systolic: 120, diastolic: 76, heartRate: 86, respRate: 18, temperature: 37.3, spo2: 98, painScore: 4 } },
  { unitHint: "mawar", dx: "S72.0", complaint: "Fraktur collum femur", s: "Nyeri panggul kanan setelah jatuh, rencana ORIF.", o: "Pemendekan & eksorotasi tungkai kanan.", a: "Fraktur collum femur dekstra pre-operasi", p: "Puasa, persiapan ORIF besok, analgesik.", rads: ["XR-EXT"], labs: ["HB", "LEU", "TROMBO"], procedures: ["79.35"], drugs: [["obt-mor", "2 mg", "Jika perlu", "IV", 2, 2]], doctor: "d6", who: { minAge: 55 }, vitals: { systolic: 142, diastolic: 88, heartRate: 94, respRate: 20, temperature: 36.8, spo2: 97, painScore: 6 } },
  { unitHint: "mawar", dx: "J18.9", complaint: "Pneumonia anak", s: "Anak batuk, sesak berkurang, mau minum.", o: "Ronki basah halus bilateral, retraksi (-).", a: "Bronkopneumonia, perbaikan", p: "Antibiotik IV, nebul.", drugs: [["obt-amx", "250 mg", "3x1", "Oral", 5, 15]], doctor: "d4", who: { maxAge: 5 }, vitals: { heartRate: 128, respRate: 34, temperature: 37.9, spo2: 95, weight: 12 } },
  { unitHint: "anggrek", dx: "O82", complaint: "Post SC H2", s: "Nyeri luka operasi berkurang, ASI keluar.", o: "Kontraksi uterus baik, luka kering.", a: "Post SC hari ke-2", p: "Mobilisasi, rawat gabung, rencana pulang besok.", procedures: ["74.1"], drugs: [["obt-pct", "500 mg", "3x1", "Oral", 3, 9]], doctor: "d5", who: { sex: "female", minAge: 20, maxAge: 40 }, vitals: { systolic: 118, diastolic: 74, heartRate: 84, respRate: 18, temperature: 36.8, spo2: 99 } },
  { unitHint: "anggrek", dx: "K80.2", complaint: "Post kolesistektomi", s: "Nyeri port operasi minimal.", o: "Luka port kering.", a: "Post kolesistektomi laparoskopik H1", p: "Rencana pulang besok.", procedures: ["51.23"], doctor: "d6", who: { minAge: 30 }, vitals: { systolic: 122, diastolic: 78, heartRate: 78, respRate: 16, temperature: 36.7, spo2: 99 } },
  { unitHint: "icu", dx: "I21.9", complaint: "Infark miokard akut", s: "Nyeri dada berkurang, masih lemas.", o: "Monitor: sinus takikardia, ronki basal minimal.", a: "STEMI anterior post fibrinolitik", p: "Monitor ketat, antikoagulan, konsul kardiologi.", labs: ["TROP", "K", "CR"], drugs: [["obt-war", "2 mg", "1x1", "Oral", 3, 3], ["obt-sim", "20 mg", "1x1", "Oral", 3, 3], ["obt-kcl", "25 mL", "1x1", "IV", 1, 1]], doctor: "d14", who: { minAge: 45 }, vitals: { systolic: 96, diastolic: 60, heartRate: 118, respRate: 26, temperature: 37.0, spo2: 90, onOxygen: true, consciousness: "A" } },
  { unitHint: "icu", dx: "I63.9", complaint: "Stroke iskemik", s: "Keluarga: belum bisa bicara jelas.", o: "GCS E3M5V3, hemiparesis kanan.", a: "Stroke iskemik akut hari ke-2", p: "Head up 30°, posisi miring tiap 2 jam, NGT.", rads: ["CT-HEAD"], labs: ["GDS", "NA"], doctor: "d7", who: { minAge: 50 }, vitals: { systolic: 172, diastolic: 100, heartRate: 88, respRate: 22, temperature: 38.2, spo2: 94, onOxygen: true, consciousness: "V" } },
]
