# DompetTenang — Aplikasi Catatan Keuangan Pribadi (Offline-First)

Aplikasi web catatan keuangan pribadi (Next.js App Router + TypeScript strict + Tailwind CSS + Supabase + IndexedDB PWA) yang dirancang khusus untuk pengguna Indonesia dengan ritme penghasilan beragam: **Gaji Tetap**, **Freelance / Penghasilan Tidak Menentu**, maupun **Serabutan / Transisi Harian**.

## Prinsip Utama
- **Offline-first & Ringan**: Setiap transaksi ditulis dulu ke IndexedDB di perangkat, lalu disinkronkan dua arah (Last-Write-Wins) ke Supabase saat online.
- **Rupiah Bilangan Bulat (`integer` / `BIGINT`)**: Tidak ada float untuk uang agar bebas dari bug pembulatan.
- **Nada Tenang & Tidak Menghakimi**: Tidak ada label "boros" atau warna merah agresif saat uang tipis; fokus pada langkah praktis.
- **Tanpa Streak / Gamifikasi**: Fokus ke kejelasan arus kas dan ketenangan finansial.
- **Keamanan Data Ketat (RLS)**: Row Level Security aktif di seluruh 8 tabel Postgres (`user_id = auth.uid()`).

---

## Ringkasan Library & Alasan Pemilihan
- `next`, `react`, `react-dom`: Framework React App Router untuk web app ringan dan mudah di-deploy ke Vercel.
- `tailwindcss`: Utility CSS ringan untuk tampilan mobile-first ramah satu tangan.
- `@supabase/supabase-js`: Klien resmi Supabase untuk Auth (Email & Google) dan sinkronisasi Postgres dengan RLS.
- `idb`: Wrapper super ringan (~1.5KB) di atas IndexedDB untuk penyimpanan offline-first dan antrean sync.
- `zod`: Validasi skema data TypeScript yang ketat termasuk validasi file backup JSON.
- `lucide-react`: Ikon ringan yang tree-shakeable (opsional untuk pengembangan UI lanjut).
- `vitest`: Runner unit test cepat untuk seluruh fungsi murni di `src/lib/` dan verifikasi RLS.

---

## Fitur Lengkap (Versi 1)

### 1. Fitur Inti (Semua Profil)
- **Catat Transaksi Cepat (< 5 detik)** + **Parser Bahasa Natural Indonesia**: Ketik `"makan siang 25rb"`, `"gaji 5jt"`, `"bensin 20.000"`, `"ngojek 85rb 5 jam"`, `"transfer ke gopay 100rb"`.
- **Multi-Dompet**: Cash, Bank, GoPay, OVO, Dana, ShopeePay, dan dompet custom. Transfer antar dompet tidak masuk pengeluaran.
- **Kategori & Prioritas Bertingkat**: Wajib, Penting, Bisa Ditunda, plus budget bulanan dengan peringatan lembut saat mencapai 80%.
- **Tag Perlu vs Pengen** dengan ringkasan persentase per periode.
- **Periode Custom** sesuai tanggal gajian (misal tanggal 25 s/d 24).
- **"Aman Dipakai Per Hari"** dihitung dari saldo riil tersedia dibagi sisa hari periode.
- **Tagihan Berulang & Cicilan/Paylater** dengan pengingat jatuh tempo.
- **Catatan Utang & Piutang** termasuk utang warung/teman/keluarga & pelunasan sebagian.
- **Target Tabungan & Dana Darurat** dengan estimasi bulan tercapai.
- **Insight Otomatis** (contoh perbandingan pengeluaran mingguan dan upah per jam tertinggi).
- **Export & Import JSON (identik 100%) dan CSV** sebagai cadangan kedua.
- **PWA** (`manifest.json` + Service Worker `sw.js`) agar bisa di-install ke layar HP.

### 2. Fitur Profil Freelance / Penghasilan Tidak Menentu
- **Gaji ke Diri Sendiri**: Tentukan nominal gaji bulanan tetap dari kolam saldo pemasukan.
- **Runway**: Hitung berapa bulan saldo mampu bertahan jika pemasukan nol berdasarkan biaya hidup wajib.
- **Rata-rata Pemasukan 3 & 6 Bulan + Bulan Terendah** sebagai patokan budget realistis.
- **Kalkulator Alokasi Otomatis**: Bagi pemasukan sesuai aturan persentase (default 50% Wajib, 20% Tabungan, 10% Pajak/Cadangan, 20% Bebas).
- **Rekap Klien & Piutang Invoice** (invoice belum cair tidak dimasukkan ke hitungan "aman dipakai per hari").

### 3. Fitur Profil Serabutan / Transisi Harian
- **Mode Harian**: Menampilkan langsung *"uang cukup untuk berapa hari"* + simulasi penghematan tenang.
- **Pemasukan Per Jenis Kerja & Pendapatan Per Jam**: Membandingkan upah/jam (misal ngojek vs kuli).
- **Pemisahan Pemasukan Non-Kerja**: Bansos, kiriman keluarga, Prakerja dipisah dari hasil kerja.
- **Pos Biaya Cari Kerja**: Melacak total modal cari kerja (cetak CV, ongkos wawancara, kuota).
- **Mode Hemat Darurat (Satu Tombol)**: Memangkas budget kategori *Bisa Ditunda* dan menghitung ulang ketahanan hari.
- **Dana Darurat Mini Bertahap**: Milestone Rp200rb → Rp500rb → Rp1jt → Rp2jt → Rp5jt.

---

## Menjalankan Secara Lokal

```bash
npm install
npm run typecheck   # Cek TypeScript strict (tsc --noEmit)
npm run test        # Jalankan seluruh 37 unit test + verifikasi RLS
npm run dev         # Jalankan server lokal di http://localhost:3000
```

---

## Panduan Langkah Manual: Menyiapkan Supabase & Deploy ke Vercel

### Bagian A: Menyiapkan Supabase
1. Daftar atau masuk ke [Supabase Dashboard](https://supabase.com/dashboard) lalu klik **New Project**.
2. Buka menu **SQL Editor** → **New Query**, salin seluruh isi file [`supabase/migrations/0001_initial_schema.sql`](./supabase/migrations/0001_initial_schema.sql), lalu klik **Run**.
   - Ini akan membuat 8 tabel lengkap dengan tipe `BIGINT` dan mengaktifkan **Row Level Security (RLS)** di semua tabel.
3. Buka **Authentication** → **Providers**:
   - Pastikan **Email** aktif.
   - (Opsional) Aktifkan **Google** jika ingin tombol Login Google berfungsi.
4. Buka **Project Settings** → **API**:
   - Salin **Project URL** ke `NEXT_PUBLIC_SUPABASE_URL`.
   - Salin **anon public key** ke `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - **PENTING**: Jangan pernah menaruh `service_role` key ke variabel `NEXT_PUBLIC_*`.
5. Untuk menjalankan secara lokal, salin `.env.example` menjadi `.env.local` lalu isi kedua nilai di atas.

### Bagian B: Deploy ke Vercel
1. Pastikan kode sudah di-push ke repository GitHub `nans30/managament_money`.
2. Buka [Vercel](https://vercel.com), klik **Add New Project**, lalu pilih repository `nans30/managament_money`.
3. Di bagian **Environment Variables**, tambahkan:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Klik **Deploy**.
5. Setelah mendapatkan URL Vercel (misal `https://managament-money.vercel.app`), kembali ke **Supabase Dashboard** → **Authentication** → **URL Configuration**, lalu tambahkan URL Vercel tersebut ke **Site URL** dan **Redirect URLs**.
