# Riset: SaaS modular untuk Health Center / Rumah Sakit

Tujuan dokumen ini: memetakan **apa saja yang harus ada** di sistem informasi rumah sakit
(SIMRS) di Indonesia, **bagaimana user di rumah sakit benar-benar bekerja**, dan bagaimana
semua itu dipecah menjadi **modul yang bisa diaktifkan bertahap**.

> Status: riset desk (pengetahuan domain + pencarian publik, Oktober 2026). Butir regulasi
> yang ditandai *(verifikasi)* bersumber dari blog vendor/jurnal, bukan teks resmi; cek ke
> JDIH Kemenkes / BPJS Kesehatan sebelum dipakai untuk keputusan bisnis.

---

## 1. Konteks regulasi & ekosistem (Indonesia)

| Topik | Dampak ke produk |
|---|---|
| **Rekam Medis Elektronik wajib** (Permenkes 24/2022) | RME bukan modul opsional untuk faskes. Harus ada CPPT/SOAP, diagnosis ICD-10, tindakan ICD-9-CM, *audit trail* (siapa mengubah apa & kapan), dan akses berbasis peran. |
| **SATUSEHAT** (platform interoperabilitas Kemenkes, HL7 FHIR R4) | Encounter, Condition, Observation, MedicationRequest, dll. dikirim ke SATUSEHAT. Faskes butuh **status sinkron per kunjungan** dan antrean retry. Sanksi administratif bagi RS yang belum terintegrasi penuh *(verifikasi: SE 2026)*. |
| **JKN / BPJS Kesehatan** | Mayoritas pasien RS adalah peserta JKN. Alur: cek kepesertaan → rujukan → **SEP** (V-Claim) → layanan → koding → klaim (E-Klaim). **Antrean Online** (Mobile JKN) wajib melaporkan waktu tunggu (task ID 1–7). |
| **iDRG menggantikan INA-CBG** (mulai Okt 2025) | Modul klaim harus mendukung grouper iDRG (ICD-10-IM / ICD-9-CM-IM) dan tetap bisa membaca INA-CBG untuk klaim lama — koder bekerja dengan dua sistem di masa transisi. |
| **KRIS** — Kelas Rawat Inap Standar (Perpres 59/2024) | Kelas 1/2/3 bergeser ke satu kelas standar dengan 12 kriteria ruangan. Master tempat tidur harus menyimpan **kelas KRIS** di samping kelas non-JKN (VIP/VVIP). |
| **Klasifikasi RS baru** (Permenkes 6/2026: dasar, madya, utama, paripurna) *(verifikasi)* | Preset modul disesuaikan dengan kelas layanan, bukan "Tipe A/B/C/D" lama. |
| **Akreditasi** (STARKES/KARS) & **Indikator Mutu Nasional (INM)** | Butuh pelaporan Insiden Keselamatan Pasien (IKP: KTD, KNC, KTC, KPC, sentinel) dengan grading risiko, dan 13 INM bulanan (kepatuhan cuci tangan, waktu tunggu rawat jalan, dll). |
| **Pelaporan RL / SIRS online** | Indikator rawat inap BOR, ALOS, TOI, BTO, NDR, GDR dihitung dari data sensus harian. |
| **STR/SIP tenaga kesehatan** | Dokter/perawat tanpa SIP aktif tidak boleh praktik → SDM perlu peringatan kedaluwarsa. |
| **Fornas & e-Katalog** | Obat ditandai Formularium Nasional; resep JKN di luar Fornas perlu justifikasi. |

## 2. Peta modul lengkap (versi "full", nanti dikecilkan)

| Kelompok | Modul | Inti fungsinya |
|---|---|---|
| **Inti (selalu aktif)** | Master Pasien (MPI) | Identitas tunggal, No. RM, NIK, penjamin, alergi, riwayat kunjungan |
| | Pengaturan & Akses | Profil faskes, unit/poli, pengguna & peran, audit log |
| **Layanan depan** | Pendaftaran & Antrean | Daftar kunjungan, penjamin, SEP, nomor antrean, layar display ruang tunggu |
| | Jadwal & Janji Temu | Jadwal praktik dokter + kuota, booking (telepon, Mobile JKN, walk-in) |
| **Klinis** | Rekam Medis Elektronik | CPPT/SOAP, diagnosis ICD-10, tindakan, alergi, ringkasan pasien |
| | Rawat Jalan (Poli) | Worklist dokter per poli, panggil pasien, pemeriksaan, disposisi |
| | Gawat Darurat (IGD) | Triase 5 level, track board, waktu tunggu, disposisi (pulang/rawat/rujuk) |
| | Rawat Inap | Bed board, admisi, pindah ruang, pulang, sensus harian |
| | Keperawatan | Tanda vital + skor peringatan dini (NEWS2), eMAR (pemberian obat), serah terima SBAR |
| | Kamar Operasi | Jadwal OK, WHO Surgical Safety Checklist (sign in / time out / sign out) |
| **Penunjang** | Laboratorium | Order → sampel → hasil → validasi, nilai rujukan, nilai kritis |
| | Radiologi | Order → pemeriksaan → ekspertise |
| | Farmasi | Telaah resep (alergi, interaksi, Fornas), penyiapan, penyerahan, stok FEFO |
| **Keuangan** | Billing & Kasir | Tagihan otomatis dari layanan, pembayaran, kuitansi |
| | Klaim & Casemix | Koding, grouper iDRG/INA-CBG, kelengkapan berkas, status klaim |
| **Operasional** | Logistik & Inventori | Stok, kedaluwarsa, stok minimum, permintaan pembelian |
| | SDM & Jadwal Jaga | Direktori staf, STR/SIP, roster shift |
| **Mutu** | Mutu & Keselamatan Pasien | Laporan IKP, grading risiko, INM |
| | Laporan & Analitik | Kunjungan, BOR/ALOS/TOI/BTO, pendapatan per penjamin, top diagnosis |
| **Integrasi** | Bridging BPJS | V-Claim (SEP), Antrean Online, status koneksi |
| | SATUSEHAT | Antrean sinkron FHIR, retry, error per resource |

## 3. Perilaku user di rumah sakit (yang membentuk desain)

| Pengamatan | Konsekuensi desain |
|---|---|
| **Orang bekerja dari antrean, bukan dari menu.** Perawat poli melihat "siapa berikutnya", analis lab melihat "sampel mana yang belum diproses". | Setiap peran punya **Beranda = worklist** sendiri. Menu adalah jalur kedua. |
| **Workstation dipakai bergantian** (nurse station, loket). | Kunci layar cepat, ganti pengguna tanpa kehilangan konteks, sesi per peran. |
| **Interupsi konstan** (telepon, pasien datang, code blue). | Draf tersimpan otomatis; form tidak hilang saat pindah halaman. |
| **Salah identifikasi pasien adalah risiko utama.** | Banner pasien selalu menampilkan **2 identitas** (nama + No. RM + tanggal lahir), alergi dengan warna merah, penjamin. |
| **Dokter sangat terbatas waktunya** (poli 40–80 pasien/hari). | Template SOAP, diagnosis favorit, order set, keyboard-first, satu layar per kunjungan. |
| **Perawat bekerja berdiri / berpindah, sering di tablet.** | Target sentuh besar, layout responsif, input vital numerik cepat. |
| **Loket pendaftaran kebanyakan pakai keyboard** dan pasien BPJS mendominasi. | Pencarian pasien by No. RM/NIK/No. BPJS/nama, Enter untuk lanjut, SEP satu klik. |
| **Serah terima shift** (pagi/sore/malam) adalah titik rawan informasi hilang. | Catatan SBAR terstruktur per pasien, ringkasan pasien berisiko (NEWS2 tinggi). |
| **Status harus terbaca tanpa warna** (buta warna, monitor murah, cahaya ruangan). | Chip status selalu berisi teks + warna; ikon pendukung. |
| **Faskes kecil kewalahan dengan fitur RS besar.** | Modul diaktifkan bertahap, preset per jenis faskes, modul nonaktif **tidak tampil sama sekali**. |
| **Manajemen ingin angka, bukan form.** | Dashboard manajemen: BOR, kunjungan, pendapatan, klaim tertunda, INM. |

## 4. Model "scalable modules"

- Setiap modul punya **dependensi wajib** (`requires`) dan **peningkat opsional** (`enhances`).
  Contoh: *Klaim & Casemix* wajib *Billing* + *RME*; *Logistik* meningkatkan *Farmasi* (stok
  otomatis berkurang & bisa diajukan pembelian).
- Mengaktifkan modul → sistem menunjukkan modul lain yang ikut aktif (dependensi) sebelum konfirmasi.
- Menonaktifkan modul → diblokir jika masih dibutuhkan modul aktif lain; **data tidak dihapus**.
- Setiap modul punya **checklist kesiapan** (mis. Farmasi: "isi master obat", "atur harga").
- **Preset faskes**: Klinik Pratama, Klinik Utama, RS kelas dasar, RS kelas madya, RS rujukan.
  Preset hanya titik awal — bisa diubah kapan saja di *Pusat Modul*.
