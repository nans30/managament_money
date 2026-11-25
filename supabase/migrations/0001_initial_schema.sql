-- ==============================================================================
-- MIGRASI AWAL: APLIKASI CATATAN KEUANGAN PRIBADI (OFFLINE-FIRST)
-- ==============================================================================
-- Prinsip skema:
-- 1. Semua nominal uang menggunakan BIGINT (bilangan bulat Rupiah) agar tidak
--    pernah terjadi bug pembulatan floating-point dan aman untuk angka > 2 miliar.
-- 2. Semua tabel memiliki `id` (UUID dibuat di klien untuk offline-first),
--    `user_id` (UUID merujuk ke auth.users), `created_at`, `updated_at`, dan
--    `deleted_at` (soft delete agar penghapusan saat offline bisa disinkronkan).
-- 3. Konflik sinkronisasi diselesaikan dengan aturan Last-Write-Wins (LWW)
--    berdasarkan `updated_at`.
-- 4. Row Level Security (RLS) aktif di SEMUA tabel dengan kebijakan ketat:
--    user hanya bisa SELECT, INSERT, UPDATE, DELETE baris dengan `user_id = auth.uid()`.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. TABEL PROFILES
-- ------------------------------------------------------------------------------
-- Alasan desain:
-- Menyimpan profil finansial user. Meskipun `id` adalah primary key record,
-- kita tetap menyertakan `user_id` dengan constraint UNIQUE agar konsisten
-- dengan aturan sinkronisasi seluruh tabel (`user_id = auth.uid()`).
-- `allocation_rules` disimpan sebagai JSONB agar user bebas mengubah persentase
-- maupun nama pos alokasi otomatis (misal: 50% wajib, 20% tabungan, 10% pajak, 20% bebas).
-- `self_salary_amount` ditambahkan untuk fitur "Gaji Sendiri" pada profil Freelance.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_type TEXT NOT NULL DEFAULT 'freelance' CHECK (profile_type IN ('fixed', 'freelance', 'daily')),
  period_start_day INTEGER NOT NULL DEFAULT 1 CHECK (period_start_day BETWEEN 1 AND 31),
  mandatory_living_cost BIGINT NOT NULL DEFAULT 0 CHECK (mandatory_living_cost >= 0),
  self_salary_amount BIGINT NOT NULL DEFAULT 0 CHECK (self_salary_amount >= 0),
  allocation_rules JSONB NOT NULL DEFAULT '[
    {"label": "Kebutuhan Wajib", "percentage": 50},
    {"label": "Tabungan", "percentage": 20},
    {"label": "Dana Pajak / Cadangan", "percentage": 10},
    {"label": "Bebas", "percentage": 20}
  ]'::jsonb,
  emergency_mode BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT profiles_user_id_unique UNIQUE (user_id)
);

-- ------------------------------------------------------------------------------
-- 2. TABEL WALLETS (DOMPET)
-- ------------------------------------------------------------------------------
-- Alasan desain:
-- `initial_balance` adalah saldo awal saat dompet dibuat. Saldo aktual dihitung
-- secara deterministik dari `initial_balance + pemasukan - pengeluaran +- transfer`
-- di fungsi murni `lib/calculations.ts` agar tidak pernah terjadi ketidakcocokan
-- saldo saat sinkronisasi offline terjadi tidak berurutan.
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'cash' CHECK (type IN ('cash', 'bank', 'gopay', 'ovo', 'dana', 'shopeepay', 'custom')),
  initial_balance BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- ------------------------------------------------------------------------------
-- 3. TABEL CATEGORIES (KATEGORI)
-- ------------------------------------------------------------------------------
-- Alasan desain:
-- Setiap kategori memiliki `priority` ('wajib', 'penting', 'bisa_ditunda') yang
-- digunakan baik untuk tampilan prioritas bertingkat di profil Serabutan maupun
-- pemangkasan otomatis ketika "Mode Darurat/Hemat" diaktifkan.
-- Flag `is_job_search` dan `is_non_work_income` memudahkan pemisahan pos
-- "Biaya Cari Kerja" dan "Pemasukan Non-Kerja (Bansos/Kiriman/Prakerja)".
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'tag',
  priority TEXT NOT NULL DEFAULT 'penting' CHECK (priority IN ('wajib', 'penting', 'bisa_ditunda')),
  monthly_budget BIGINT NOT NULL DEFAULT 0 CHECK (monthly_budget >= 0),
  is_job_search BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- ------------------------------------------------------------------------------
-- 4. TABEL TRANSACTIONS (TRANSAKSI)
-- ------------------------------------------------------------------------------
-- Alasan desain:
-- - `type = 'transfer'` menggunakan `wallet_id` sebagai dompet asal dan
--   `to_wallet_id` sebagai dompet tujuan. Transfer tidak pernah dihitung sebagai
--   pengeluaran atau pemasukan laporan.
-- - `need_or_want` menyimpan tag 'perlu' vs 'pengen' untuk transaksi pengeluaran.
-- - `work_hours` menggunakan NUMERIC(6,2) karena jam kerja bisa berupa setengah jam
--   (misal 4.5 jam ngojek), sedangkan `amount` tetap wajib BIGINT Rupiah.
-- - `income_nature` membedakan penghasilan 'kerja' vs 'non_kerja' (bantuan sosial,
--   kiriman keluarga, Prakerja) agar statistik pendapatan kerja per jam/sumber tetap jujur.
-- - `is_job_search_expense` menandai pengeluaran modal cari kerja (cetak CV, ongkos interview).
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount BIGINT NOT NULL CHECK (amount > 0),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  to_wallet_id UUID NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  category_id UUID NULL REFERENCES public.categories(id) ON DELETE SET NULL,
  source_or_client TEXT NULL,
  need_or_want TEXT NULL CHECK (need_or_want IN ('perlu', 'pengen')),
  work_hours NUMERIC(6,2) NULL CHECK (work_hours IS NULL OR work_hours > 0),
  income_nature TEXT NOT NULL DEFAULT 'kerja' CHECK (income_nature IN ('kerja', 'non_kerja')),
  is_job_search_expense BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT NOT NULL DEFAULT '',
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- ------------------------------------------------------------------------------
-- 5. TABEL RECURRING_BILLS (TAGIHAN BERULANG & CICILAN / PAYLATER)
-- ------------------------------------------------------------------------------
-- Alasan desain:
-- Menggabungkan tagihan rutin (listrik, kos, kuota) dengan cicilan/paylater.
-- Jika `total_installments` diisi (misal 6x cicilan), maka `current_installment`
-- melacak sudah cicilan ke berapa.
CREATE TABLE IF NOT EXISTS public.recurring_bills (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  schedule TEXT NOT NULL DEFAULT 'monthly' CHECK (schedule IN ('weekly', 'monthly', 'yearly')),
  next_due_date TIMESTAMPTZ NOT NULL,
  current_installment INTEGER NOT NULL DEFAULT 1 CHECK (current_installment >= 1),
  total_installments INTEGER NULL CHECK (total_installments IS NULL OR total_installments >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- ------------------------------------------------------------------------------
-- 6. TABEL DEBTS (UTANG & PIUTANG, TERMASUK UTANG WARUNG/INFORMAL)
-- ------------------------------------------------------------------------------
-- Alasan desain:
-- Mendukung pelunasan sebagian melalui kolom `paid_amount`.
-- `category` membedakan pinjaman informal ('warung', 'teman', 'keluarga', 'lainnya')
-- yang sangat penting bagi pengguna profil Serabutan.
CREATE TABLE IF NOT EXISTS public.debts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('utang', 'piutang')),
  counterparty TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'lainnya' CHECK (category IN ('warung', 'teman', 'keluarga', 'lainnya')),
  amount BIGINT NOT NULL CHECK (amount > 0),
  paid_amount BIGINT NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  due_date TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'belum_lunas' CHECK (status IN ('belum_lunas', 'sebagian', 'lunas')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- ------------------------------------------------------------------------------
-- 7. TABEL GOALS (TARGET TABUNGAN & DANA DARURAT MINI BERTAHAP)
-- ------------------------------------------------------------------------------
-- Alasan desain:
-- Menyimpan target tabungan umum (`tabungan`) maupun `dana_darurat` (yang pada
-- profil Serabutan memiliki milestone bertahap Rp200rb -> Rp500rb -> Rp1jt dst.).
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount BIGINT NOT NULL CHECK (target_amount > 0),
  collected_amount BIGINT NOT NULL DEFAULT 0 CHECK (collected_amount >= 0),
  type TEXT NOT NULL DEFAULT 'tabungan' CHECK (type IN ('tabungan', 'dana_darurat')),
  monthly_saving_plan BIGINT NOT NULL DEFAULT 0 CHECK (monthly_saving_plan >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- ------------------------------------------------------------------------------
-- 8. TABEL INVOICES (PIUTANG INVOICE KLIEN FREELANCE)
-- ------------------------------------------------------------------------------
-- Alasan desain:
-- Dipisahkan dari transaksi pemasukan riil karena prinsip utama aplikasi ini:
-- "Aman dipakai per hari dihitung dari saldo yang benar-benar ada, bukan dari
-- penghasilan/invoice yang masih ditunggu pembayarannya."
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  issued_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'overdue')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- ------------------------------------------------------------------------------
-- INDEXES UNTUK PERFORMA SINKRONISASI DAN QUERY
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_user_updated ON public.profiles(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_wallets_user_updated ON public.wallets(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_categories_user_updated ON public.categories(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_updated ON public.transactions(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_recurring_bills_user_updated ON public.recurring_bills(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_debts_user_updated ON public.debts(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_goals_user_updated ON public.goals(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_invoices_user_updated ON public.invoices(user_id, updated_at);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) - WAJIB AKTIF DI SEMUA TABEL
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Kebijakan untuk PROFILES
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (user_id = auth.uid());

-- Kebijakan untuk WALLETS
CREATE POLICY "wallets_select_own" ON public.wallets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "wallets_insert_own" ON public.wallets FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "wallets_update_own" ON public.wallets FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "wallets_delete_own" ON public.wallets FOR DELETE USING (user_id = auth.uid());

-- Kebijakan untuk CATEGORIES
CREATE POLICY "categories_select_own" ON public.categories FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "categories_insert_own" ON public.categories FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "categories_update_own" ON public.categories FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "categories_delete_own" ON public.categories FOR DELETE USING (user_id = auth.uid());

-- Kebijakan untuk TRANSACTIONS
CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "transactions_insert_own" ON public.transactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "transactions_update_own" ON public.transactions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "transactions_delete_own" ON public.transactions FOR DELETE USING (user_id = auth.uid());

-- Kebijakan untuk RECURRING_BILLS
CREATE POLICY "recurring_bills_select_own" ON public.recurring_bills FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "recurring_bills_insert_own" ON public.recurring_bills FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "recurring_bills_update_own" ON public.recurring_bills FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "recurring_bills_delete_own" ON public.recurring_bills FOR DELETE USING (user_id = auth.uid());

-- Kebijakan untuk DEBTS
CREATE POLICY "debts_select_own" ON public.debts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "debts_insert_own" ON public.debts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "debts_update_own" ON public.debts FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "debts_delete_own" ON public.debts FOR DELETE USING (user_id = auth.uid());

-- Kebijakan untuk GOALS
CREATE POLICY "goals_select_own" ON public.goals FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "goals_insert_own" ON public.goals FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "goals_update_own" ON public.goals FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "goals_delete_own" ON public.goals FOR DELETE USING (user_id = auth.uid());

-- Kebijakan untuk INVOICES
CREATE POLICY "invoices_select_own" ON public.invoices FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "invoices_insert_own" ON public.invoices FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "invoices_update_own" ON public.invoices FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "invoices_delete_own" ON public.invoices FOR DELETE USING (user_id = auth.uid());
