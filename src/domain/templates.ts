/**
 * SOAP templates. Doctors in a busy poli re-type the same structure 40+ times a day;
 * a template gives the skeleton, the doctor fills in the specifics.
 */
export interface SoapTemplate {
  id: string
  name: string
  subjective: string
  objective: string
  assessment: string
  plan: string
}

export const SOAP_TEMPLATES: SoapTemplate[] = [
  {
    id: "umum",
    name: "Pemeriksaan umum",
    subjective: "Keluhan utama: \nRiwayat penyakit sekarang: \nRiwayat penyakit dahulu: \nRiwayat obat: ",
    objective: "KU: baik, kesadaran CM\nKepala/leher: dbn\nThorax: cor & pulmo dbn\nAbdomen: dbn\nEkstremitas: akral hangat, CRT < 2 dtk",
    assessment: "",
    plan: "Terapi: \nEdukasi: \nKontrol: ",
  },
  {
    id: "kontrol",
    name: "Kontrol penyakit kronis",
    subjective: "Kontrol rutin. Keluhan saat ini: \nKepatuhan minum obat: \nEfek samping: ",
    objective: "TD: \nBB: \nPemeriksaan fisik: dbn",
    assessment: "Terkontrol / belum terkontrol",
    plan: "Lanjut terapi. Edukasi gaya hidup. Kontrol 1 bulan / rujuk balik FKTP.",
  },
  {
    id: "anak",
    name: "Anak",
    subjective: "Keluhan: \nAsupan & minum: \nBAK/BAB: \nImunisasi: lengkap / belum",
    objective: "KU: \nBB/TB: \nTanda dehidrasi: (-)\nTanda bahaya umum: (-)",
    assessment: "",
    plan: "Dosis obat sesuai BB. Edukasi tanda bahaya kepada orang tua.",
  },
  {
    id: "cppt-ranap",
    name: "CPPT harian rawat inap",
    subjective: "Keluhan hari ini: \nTidur/makan: ",
    objective: "TTV terlampir. Pemeriksaan fisik: \nHasil penunjang terbaru: ",
    assessment: "Hari rawat ke-: \nPerkembangan: membaik / tetap / memburuk",
    plan: "Lanjut terapi: \nRencana pemeriksaan: \nRencana pulang: ",
  },
  {
    id: "igd",
    name: "IGD (primary survey)",
    subjective: "Keluhan & onset: \nMekanisme (trauma): \nAMPLE: ",
    objective: "A: paten\nB: \nC: \nD: GCS \nE: ",
    assessment: "",
    plan: "Tatalaksana awal: \nPemeriksaan: \nDisposisi: ",
  },
]
