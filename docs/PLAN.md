# Medisphere — Plan → Roast → Plan v2

Sumber riset: [`RESEARCH.md`](RESEARCH.md).
Batasan: frontend only (React + HeroUI v3), tanpa backend, mock data, kualitas produksi.
Konsep utama: **SaaS modular** — faskes mulai dari sedikit modul dan menambah sesuai kondisi.
Versi ini sengaja **full feature**; nanti dikecilkan.

---

## 1. Plan v1 (draft pertama)

1. Satu menu besar berisi semua modul SIMRS (pendaftaran s.d. akuntansi).
2. Admin mencentang modul yang dibeli di halaman pengaturan.
3. Setiap modul = halaman CRUD (tabel + form).
4. Dashboard yang sama untuk semua pengguna.
5. Data di `localStorage`.

## 2. Roast v1 (sebelum membangun)

| # | Masalah di v1 | Kenapa fatal di rumah sakit | Perbaikan |
|---|---|---|---|
| 1 | **Modul = checkbox di pengaturan** | Mengaktifkan Klaim tanpa Billing/RME menghasilkan layar yang tidak bisa dipakai. Admin tidak tahu urutannya. | Katalog modul dengan **`requires` (wajib)** & **`enhances` (opsional)**. Mengaktifkan modul menampilkan dependensi yang ikut aktif; menonaktifkan diblokir bila masih dibutuhkan. |
| 2 | **Semua modul sejak awal** | Klinik pratama tenggelam dalam menu RS rujukan → menolak sistem. | **Onboarding 2 langkah**: jenis faskes → modul awal yang *secukupnya*. Modul nonaktif **tidak tampil sama sekali**. Pusat Modul menyarankan "tahap berikutnya". |
| 3 | **Halaman CRUD per modul** | Staf RS bekerja dari **antrean**, bukan dari form kosong. | Setiap modul klinis = **worklist** (siapa berikutnya, berapa lama menunggu, apa yang terlambat). |
| 4 | **Dashboard yang sama** | Dokter, perawat, kasir, koder punya pertanyaan yang berbeda. | **Beranda per peran** yang hanya berisi pekerjaan peran itu, dari modul yang aktif. |
| 5 | **Tidak ada keselamatan pasien** | Salah identifikasi & alergi adalah penyebab KTD utama. | **Banner pasien** (nama + No. RM + tgl lahir + alergi merah) di setiap layar pasien; telaah resep otomatis; NEWS2; nilai kritis; WHO surgical checklist; double check obat high-alert. |
| 6 | **Tagihan diinput kasir** | Biaya terlewat = kebocoran pendapatan. | Setiap layanan **otomatis** menambah item tagihan (admin, konsul, lab, radiologi, obat FEFO, kamar, operasi). |
| 7 | **Klaim BPJS diabaikan** | 60–80% pasien RS adalah JKN. | SEP saat pendaftaran, checklist kelengkapan berkas, grouper **iDRG** (+ INA-CBG lama), status pending/ditolak. |
| 8 | **Integrasi nasional diabaikan** | SATUSEHAT wajib; ada sanksi. | Antrean sinkron per resource, error yang bisa ditindaklanjuti, retry. |
| 9 | **Workstation bersama** | Nurse station & loket dipakai bergantian. | Kunci layar + ganti pengguna; draf tersimpan otomatis. |
| 10 | **localStorage** | Data demo beberapa MB melewati kuota. | IndexedDB, write debounce, sinkron antar-tab (layar antrean TV). |

## 3. Plan v2 (yang dibangun)

- **21 modul** (2 inti + 19 opsional) dalam 8 kategori; 5 preset faskes.
- **Onboarding** → **Pusat Modul** (aktif/nonaktif, dependensi, checklist persiapan, saran tahap berikutnya).
- **10 peran**, masing-masing dengan beranda worklist; navigasi = modul aktif ∩ peran.
- Alur klinis lengkap: pendaftaran → poli/IGD → CPPT/diagnosis/order/resep → lab/radiologi → farmasi → kasir/klaim → rawat inap → keperawatan → kamar operasi.
- Mutu (IKP + 13 INM), laporan (Barber-Johnson), integrasi (SATUSEHAT/BPJS), pengaturan (matriks akses, audit log).

---

## 4. Roast v2 — setelah dibangun & dicoba sebagai tiap peran

Dilakukan dengan menjalankan aplikasi, memotret setiap halaman per peran, dan menguji alur
end-to-end (pendaftaran → dokter → farmasi → lab → admin). Temuan yang nyata, bukan teoritis:

### Data & kepercayaan

| Temuan | Dampak | Perbaikan |
|---|---|---|
| Pasien laki-laki dengan *seksio sesarea*, anak 3 th di bangsal dewasa dengan fraktur femur | Demo langsung kehilangan kredibilitas di mata klinisi | Skenario punya batas jenis kelamin/usia; pasien dipilih yang cocok. Ada test-nya. |
| Separuh pasien rawat inap NEWS2 ≥ 8 | **Alarm fatigue** — daftar "pasien berisiko" jadi tidak berarti | Tren tanda vital realistis: mayoritas membaik, tepat 2 pasien memburuk. Test memastikan prevalensi 1–5. |
| Nadi "84,3 x/mnt", TD "104,5/66,3" | Tidak ada alat yang menampilkan itu | Pembulatan per parameter. |
| BOR laporan 23% vs bed board 75% | Manajemen melihat dua angka yang bertentangan | Riwayat 30 hari dibangun konsisten dengan okupansi hari ini. |
| 72 klaim pending | Tidak realistis, menutupi pekerjaan yang benar | Distribusi status per umur klaim (±10% pending). |
| Klaim asuransi swasta di-grouping INA-CBG | Proses bisnis salah | Asuransi = **fee-for-service** (tagihan rinci); iDRG hanya untuk JKN. |
| Semua pasien rawat inap DPJP-nya satu dokter | Beranda dokter tidak representatif | DPJP sesuai kasus (Sp.PD, Sp.JP, Sp.N, Sp.A, Sp.OG, Sp.B). |
| Satu pasien muncul di dua poli sekaligus | Masalah identifikasi | Satu kunjungan aktif per pasien (diuji). |
| Nomor SEP nyaris sama semua | Petugas tidak bisa membedakan | Format SEP realistis. |

### Alur

| Temuan | Perbaikan |
|---|---|
| Setelah dokter selesai, harus kembali ke daftar → Panggil → Periksa (3 klik + navigasi) × 40 pasien | Toast "Kunjungan selesai" berisi tombol **Panggil A010**: panggil + buka rekam medis berikutnya dalam satu ketukan. |
| Kasir melihat tagihan pasien yang masih antre di poli | Kasir hanya melihat kunjungan **selesai**; pasien umum yang masih dilayani ditampilkan sebagai angka terpisah. |
| Menonaktifkan modul saat masih ada pekerjaan (resep belum diserahkan) — staf kehilangan layar di tengah shift | Dialog menampilkan **pekerjaan yang masih berjalan** per modul sebelum konfirmasi. |
| Tidak ada resume medis — padahal wajib di RME & lampiran klaim | **Cetak resume medis** dari data yang sudah dicatat. |
| Worklist klaim 77 baris tanpa batas | Tabel memuat 25 baris + "tampilkan lebih banyak". |
| Selector store yang mengembalikan array baru → render loop (crash) di panel disposisi | Pola selector stabil + filter di komponen. |
| Pusat Modul "19/19" vs sidebar "21/21" | Hitungan sama: modul opsional saja. |
| Tabel menyempit & chip patah baris di 1440px | Lebar minimum tabel (scroll horizontal), chip `nowrap`, SEP disingkat. |

### Sengaja belum dibuat (nanti, saat dikecilkan)

Login/SSO & otorisasi server, multi-faskes (tenant), akuntansi/GL, gizi, CSSD, bank darah,
telemedisin, portal pasien, tanda tangan elektronik tersertifikasi (BSrE), integrasi alat lab
(HL7 v2/ASTM), PACS/DICOM, penggajian, aset.

---

## 5. Langkah "mengecilkan" yang disarankan

Konsep modular sudah memungkinkan ini tanpa refactor besar:

1. **Paket Klinik** (Pratama): Pendaftaran, RME, Rawat Jalan, Farmasi, Billing (+ BPJS & SATUSEHAT).
2. **Paket RS Dasar**: + IGD, Rawat Inap, Keperawatan, Lab.
3. **Add-on**: Klaim & Casemix, Radiologi, OK, Logistik, SDM, Mutu, Laporan.

Yang perlu diputuskan: modul mana yang benar-benar dijual terpisah vs digabung (mis. RME
selalu dibundel dengan Rawat Jalan), dan apakah Laporan/Mutu menjadi bagian inti.
