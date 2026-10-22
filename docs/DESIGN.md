# Bahasa desain — "Bedside Chart"

> Peran: senior product designer. Tujuan: Medisphere tidak terlihat seperti template dashboard
> SaaS. Identitasnya diambil dari **benda yang dibaca staf RS setiap hari** — sehingga unik
> sekaligus langsung dipahami.

## 1. Prinsip

1. **Pinjam dari bangsal, bukan dari template.** Setiap elemen khas punya padanan fisik:
   kertas grafik, gelang pasien, monitor bedside, tag triase, tiket antrean, pembatas map rekam medis.
2. **Warna adalah informasi klinis, bukan dekorasi.** Warna kuat hanya dipakai untuk
   konvensi yang sudah ada di RS (warna gelang, warna parameter monitor, warna triase ATS).
   Selebihnya tinta di atas kertas.
3. **Angka dibaca seperti instrumen.** No. RM, jam, nilai vital, dan durasi memakai font mono
   tabular — sejajar dan tidak bisa salah baca (0/O, 1/l).
4. **Status selalu teks + warna.** Tidak ada makna yang hanya disampaikan oleh warna.
5. **Jaga malam itu nyata.** Mode gelap dirancang khusus untuk shift malam (silau rendah),
   bukan sekadar invers.

## 2. Fondasi

| Token | Terang ("Kertas") | Gelap ("Jaga malam") | Catatan |
|---|---|---|---|
| Latar | kertas hangat `oklch(0.958 0.011 85)` | biru-hijau gelap `oklch(0.175 0.02 215)` | |
| Tinta | hijau-tua `oklch(0.24 0.028 200)` | kertas `oklch(0.93 0.012 90)` | |
| Aksen "scrub" | `oklch(0.44 0.085 172)` | mint `oklch(0.78 0.12 168)` | tombol utama, fokus |
| Chrome (sidebar) | hijau scrub tua | hampir hitam | map rekam medis |

**Tipografi** — tiga peran, tiga huruf:
- *Bricolage Grotesque* — judul & nama pasien (berkarakter, editorial).
- *Plus Jakarta Sans* — teks antarmuka (karya desainer Indonesia, sangat terbaca).
- *JetBrains Mono* — angka klinis & label kapital (`label-caps`) seperti kop formulir medis.

**Permukaan** — kartu kertas dengan garis rambut 1px, tanpa bayangan; tabel bergaya buku
besar (header mono kapital, garis tipis); chip status seperti stempel tinta.

## 3. Komponen khas

| Komponen | Padanan fisik | Aturan |
|---|---|---|
| **Gelang pasien** (`Wristband`) | Gelang identitas | Strip biru (L) / merah muda (P) + barcode dari No. RM; nama + No. RM + tanggal lahir selalu tampil; gelang penanda **merah alergi, kuning risiko jatuh, ungu DNR** (standar akreditasi). |
| **Monitor** (`VitalsMonitor`) | Monitor bedside | Panel selalu gelap; HR hijau, SpO₂ cyan, NIBP merah, RR kuning, suhu oranye; tren per parameter; nilai abnormal = ubin terbalik (bukan berkedip); NEWS2 sebagai ubin ke-6 beserta respons protokol. |
| **Strip vital** (`VitalsStrip`) | Layar monitor ringkas | Untuk kartu padat (keperawatan). |
| **Tiket antrean** (`QueueTicket`) | Tiket thermal | Sisi bertakik; dipakai di worklist, dialog pendaftaran, dan layar TV. |
| **Tag triase** (`TriageTag`) | Tag triase berlubang | Warna ATS 1–5 + nomor + label. |
| **Tempat tidur** (bed board) | Denah bangsal | Ranjang tampak atas: sandaran, bantal, selimut; selimut = status, arsiran = tidak bisa dipakai. |
| **Map rekam medis** (sidebar) | Binder dengan pembatas berwarna | Kategori modul = warna pembatas; halaman aktif = tab yang menyatu dengan kertas halaman. |
| **Slot modul** | Slot cartridge | Konsep modular dibuat terlihat: 19 slot berwarna kategori di sidebar & onboarding. |
| **Kartu modul** | Pembatas map | Tab kategori menonjol di atas kartu. |
| **Indikator dinas** | Papan jaga | Dinas Pagi/Sore/Malam, jam, dan sisa waktu sampai serah terima. |
| **Readout** (`Stat`) | Papan tulis ruang perawat | Label kapital mono, angka besar, garis nada di kiri. |
| **Kertas grafik** (`bg-grid`) | Kertas EKG/grafik | Hanya di area "kanvas": papan dinas, pasien berikutnya, keadaan kosong, layar TV. |

## 4. Pola layar

- **Worklist = antrean.** Rawat jalan menampilkan *pasien berikutnya* sebagai pahlawan layar
  dengan satu tombol besar (Panggil → Mulai periksa); sisanya deretan tiket (subgrid, kolom sejajar).
- **IGD = papan jalur triase.** Satu jalur per level ATS (+ "menunggu triase" di paling atas),
  kartu pasien dengan penghitung waktu dan bilah target tanggap.
- **Rawat inap = denah bangsal.** Ranjang per ruangan; NEWS2 tinggi membingkai ranjang.
- **Beranda = papan dinas.** Sapaan, peran, jam & sisa dinas, lalu worklist peran.

## 5. Aksesibilitas

- Pasangan warna dipilih untuk kontras tinggi (tinta gelap di kertas, warna monitor di panel gelap); **audit kontras formal dengan alat belum dilakukan** — lakukan sebelum produksi.
- Semua penanda warna (gelang, triase, status ranjang) disertai teks/label/`aria-label`.
- Animasi hanya titik "live" pada monitor, dan dimatikan oleh `prefers-reduced-motion`.
- Target sentuh ≥ 32px; layout diuji tanpa scroll horizontal di 390px.

## 6. Di mana kode berada

- Token & override global: `src/index.css`
- Komponen khas: `src/components/clinical/*`
- Shell: `src/app/sidebar.tsx`, `src/app/topbar.tsx`, `src/app/shift-indicator.tsx`, `src/app/logo.tsx`
- Primitif halaman: `src/components/ui/{page,panel,stat,empty}.tsx`
