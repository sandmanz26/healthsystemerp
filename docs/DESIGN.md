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
5. **Netral dulu, warna untuk makna.** Antarmuka putih/biru atau hitam/putih; warna kuat hanya
   untuk informasi klinis. Mode gelap dirancang khusus untuk shift malam (silau rendah).

## 2. Fondasi

Palet sengaja netral dan modern — putih bersih dengan satu warna aksen — agar tidak terasa
"tua". Pengguna bisa memilih skema warna dari menu **Tampilan** (ikon matahari/bulan di top bar).

| Token | Biru-putih (default) | Hitam-putih | Gelap (jaga malam) |
|---|---|---|---|
| Latar | `oklch(0.982 0.004 255)` hampir putih | `oklch(0.982 0 0)` | navy `oklch(0.165 0.014 262)` |
| Kartu & sidebar | putih murni | putih murni | `oklch(0.2 0.016 262)` |
| Tinta | navy-hitam `oklch(0.22 0.025 262)` | hitam `oklch(0.18 0 0)` | `oklch(0.95 0.005 255)` |
| Aksen | biru medis `oklch(0.55 0.2 260)` | hitam | biru muda `oklch(0.68 0.17 258)` |

Di mode hitam-putih, warna pembatas kategori modul ikut menjadi abu-abu. **Warna klinis tetap
berwarna** di semua skema (gelang penanda, triase, monitor, status) karena membawa makna
keselamatan pasien.

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
| **Map rekam medis** (sidebar) | Binder dengan pembatas | Sidebar putih; kategori modul ditandai garis kecil berwarna; halaman aktif disorot warna aksen. |
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
