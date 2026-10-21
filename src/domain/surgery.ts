/** WHO Surgical Safety Checklist (2009), adapted wording as used in Indonesian hospitals. */
export const WHO_CHECKLIST: { phase: "sign-in" | "time-out" | "sign-out"; title: string; when: string; items: { id: string; label: string }[] }[] = [
  {
    phase: "sign-in",
    title: "Sign in",
    when: "Sebelum induksi anestesi",
    items: [
      { id: "si-identity", label: "Identitas, lokasi, prosedur, dan persetujuan dikonfirmasi pasien" },
      { id: "si-site", label: "Lokasi operasi sudah ditandai" },
      { id: "si-consent", label: "Informed consent lengkap" },
      { id: "si-anesthesia", label: "Pemeriksaan mesin & obat anestesi lengkap, pulse oximeter berfungsi" },
      { id: "si-allergy", label: "Riwayat alergi sudah dicek" },
      { id: "si-airway", label: "Risiko jalan napas sulit / aspirasi dinilai" },
      { id: "si-blood", label: "Risiko perdarahan > 500 mL (anak 7 mL/kg) diantisipasi" },
    ],
  },
  {
    phase: "time-out",
    title: "Time out",
    when: "Sebelum insisi kulit",
    items: [
      { id: "to-team", label: "Semua anggota tim memperkenalkan nama & peran" },
      { id: "to-confirm", label: "Konfirmasi nama pasien, prosedur, dan lokasi insisi" },
      { id: "to-antibiotic", label: "Antibiotik profilaksis diberikan ≤ 60 menit sebelumnya" },
      { id: "to-imaging", label: "Hasil pencitraan penting ditampilkan" },
    ],
  },
  {
    phase: "sign-out",
    title: "Sign out",
    when: "Sebelum pasien keluar kamar operasi",
    items: [
      { id: "so-procedure", label: "Nama prosedur dicatat" },
      { id: "so-count", label: "Hitung instrumen, kasa, dan jarum lengkap" },
      { id: "so-specimen", label: "Spesimen diberi label (termasuk nama pasien)" },
      { id: "so-concerns", label: "Masalah alat & perhatian pemulihan disampaikan" },
    ],
  },
]
