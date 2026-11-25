'use client';

import { useState } from 'react';
import { MonitorIcon, MoonIcon, SunIcon } from '@/components/Icons';
import type { ThemeMode } from '@/hooks/useTheme';
import {
  exportTransactionsToCsv,
  parseBackupFromJson,
  serializeBackupToJson,
} from '@/lib/backup';
import {
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
} from '@/lib/supabase';
import type { AppBackup, Category, Profile, ProfileType, Transaction, Wallet } from '@/lib/types';

interface SettingsViewProps {
  profile: Profile;
  wallets: Wallet[];
  categories: Category[];
  transactions: Transaction[];
  supabaseReady: boolean;
  authEmail: string | null;
  syncing: boolean;
  syncMessage: string | null;
  theme: ThemeMode;
  onChangeTheme: (mode: ThemeMode) => void;
  onUpdateProfile: (patch: Partial<Profile>) => Promise<void>;
  onAddWallet: (name: string, type: Wallet['type'], initialBalance: number) => Promise<void>;
  onSaveCategory: (
    cat: Omit<Category, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'> & { id?: string }
  ) => Promise<void>;
  onTriggerSync: () => Promise<unknown>;
  onExportSnapshot: () => Promise<AppBackup>;
  onImportSnapshot: (backup: AppBackup) => Promise<void>;
}

export function SettingsView({
  profile,
  wallets,
  categories,
  transactions,
  supabaseReady,
  authEmail,
  syncing,
  syncMessage,
  theme,
  onChangeTheme,
  onUpdateProfile,
  onAddWallet,
  onSaveCategory,
  onTriggerSync,
  onExportSnapshot,
  onImportSnapshot,
}: SettingsViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<string | null>(null);

  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletBalance, setNewWalletBalance] = useState('');

  const [newCatName, setNewCatName] = useState('');
  const [newCatBudget, setNewCatBudget] = useState('300000');
  const [newCatPriority, setNewCatPriority] = useState<Category['priority']>('penting');

  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const handleClearAppCache = async () => {
    if (typeof window === 'undefined' || !('caches' in window)) {
      setBackupMessage('Browser ini tidak menggunakan Cache Storage.');
      return;
    }
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    setBackupMessage(
      `Cache aplikasi dibersihkan (${keys.length} cache). Data catatan keuangan kamu tetap aman di IndexedDB.`
    );
  };

  const formatAuthError = (msg: string): string => {
    const lower = msg.toLowerCase();
    if (lower.includes('invalid login credentials')) {
      return 'Email atau kata sandi belum cocok. Kalau belum punya akun, klik "Daftar Baru" dulu ya.';
    }
    if (lower.includes('email not confirmed')) {
      return 'Email belum dikonfirmasi. Cek inbox/spam kamu, atau matikan "Confirm email" di Supabase → Authentication → Providers → Email.';
    }
    if (lower.includes('password should be at least')) {
      return 'Kata sandi minimal 6 karakter ya.';
    }
    if (lower.includes('user already registered')) {
      return 'Email ini sudah terdaftar. Langsung klik "Masuk Email" saja.';
    }
    if (lower.includes('provider is not enabled')) {
      return 'Login Google belum diaktifkan di dashboard Supabase (Authentication → Providers → Google).';
    }
    if (lower.includes('rate limit')) {
      return 'Terlalu banyak percobaan dalam waktu singkat. Tunggu sebentar lalu coba lagi.';
    }
    return msg;
  };

  const handleAuth = async (mode: 'login' | 'register') => {
    setAuthFeedback(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAuthFeedback('Masukkan alamat email yang valid dulu ya.');
      return;
    }
    if (password.length < 6) {
      setAuthFeedback('Kata sandi minimal 6 karakter ya.');
      return;
    }

    setAuthLoading(true);
    try {
      const res =
        mode === 'login'
          ? await signInWithEmail(cleanEmail, password)
          : await signUpWithEmail(cleanEmail, password);
      if (res.error) {
        setAuthFeedback(formatAuthError(res.error.message));
      } else if (mode === 'register' && !res.data.session) {
        setAuthFeedback(
          'Pendaftaran berhasil! Cek inbox/spam email kamu untuk klik tautan konfirmasi (atau matikan "Confirm email" di Supabase agar langsung masuk).'
        );
      } else {
        setAuthFeedback('Berhasil masuk! Sinkronisasi cloud berjalan otomatis.');
      }
    } catch (err) {
      setAuthFeedback(
        err instanceof Error ? formatAuthError(err.message) : 'Gagal memproses autentikasi.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthFeedback(null);
    setAuthLoading(true);
    try {
      const res = await signInWithGoogle();
      if (res.error) {
        setAuthFeedback(formatAuthError(res.error.message));
      }
    } catch (err) {
      setAuthFeedback(
        err instanceof Error ? formatAuthError(err.message) : 'Login Google belum aktif di Supabase.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleExportJson = async () => {
    const snap = await onExportSnapshot();
    const json = serializeBackupToJson(snap);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dompet-tenang-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupMessage('Backup JSON berhasil diunduh.');
  };

  const handleExportCsv = () => {
    const csv = exportTransactionsToCsv(transactions);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dompet-tenang-transaksi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupMessage('Export CSV transaksi berhasil diunduh.');
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseBackupFromJson(text);
      await onImportSnapshot(parsed);
      setBackupMessage('Data berhasil dipulihkan dari file backup JSON.');
    } catch (err) {
      setBackupMessage(err instanceof Error ? err.message : 'Gagal membaca file backup.');
    }
  };

  return (
    <div className="space-y-5">
      {/* 0. TAMPILAN LIGHT / DARK MODE */}
      <section className="surface-paper rounded-[28px] p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-obsidian">Tampilan (Tema)</h2>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'system', label: 'Sistem', Icon: MonitorIcon },
              { id: 'light', label: 'Terang', Icon: SunIcon },
              { id: 'dark', label: 'Gelap', Icon: MoonIcon },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onChangeTheme(id)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-xs font-semibold transition ${
                theme === id
                  ? 'bg-obsidian text-limecard'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 1. AKUN & SINKRONISASI CLOUD (Acid Lime Folder-Tab Card) */}
      <section className="overflow-hidden rounded-[28px] bg-obsidian-muted shadow-sm">
        <div className="flex items-stretch">
          <div className="rounded-tr-[22px] bg-limecard px-5 pt-3.5 pb-1.5 text-xs font-semibold text-obsidian">
            Cloud & Sinkronisasi
          </div>
          <div className="flex flex-1 items-center justify-end px-4 py-2">
            <button
              type="button"
              disabled={syncing}
              onClick={() => void onTriggerSync()}
              className="min-h-0 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white hover:bg-white/20"
            >
              {syncing ? 'Sync...' : 'Sync sekarang'}
            </button>
          </div>
        </div>

        <div className="rounded-tr-[24px] bg-limecard px-5 pt-3 pb-5 text-obsidian space-y-3">
          {syncMessage && <p className="text-xs font-medium text-obsidian/80">{syncMessage}</p>}

          {!supabaseReady ? (
            <p className="rounded-2xl bg-white/80 p-3.5 text-xs text-stone-700">
              Mode lokal offline (IndexedDB) aktif. Hubungkan Supabase di Vercel atau{' '}
              <code>.env.local</code> untuk mengaktifkan login & sync cloud.
            </p>
          ) : authEmail ? (
            <div className="flex items-center justify-between rounded-2xl bg-white/85 p-3.5 text-sm">
              <span className="truncate font-medium">{authEmail}</span>
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="rounded-full bg-obsidian px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                Keluar
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-2xl border-0 bg-white/85 px-3.5 py-2.5 text-sm text-obsidian"
                />
                <input
                  type="password"
                  placeholder="Kata sandi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-2xl border-0 bg-white/85 px-3.5 py-2.5 text-sm text-obsidian"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={() => void handleAuth('login')}
                  className="rounded-2xl bg-obsidian px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {authLoading ? 'Memproses...' : 'Masuk Email'}
                </button>
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={() => void handleAuth('register')}
                  className="rounded-2xl bg-white/85 px-4 py-2.5 text-xs font-semibold text-obsidian disabled:opacity-60"
                >
                  {authLoading ? '...' : 'Daftar Baru'}
                </button>
              </div>
              <button
                type="button"
                disabled={authLoading}
                onClick={() => void handleGoogleAuth()}
                className="w-full rounded-2xl bg-white px-4 py-2.5 text-xs font-semibold text-obsidian disabled:opacity-60"
              >
                Masuk dengan Google
              </button>
              {authFeedback && (
                <p className="rounded-xl bg-white/80 px-3 py-2 text-xs font-medium text-obsidian">
                  {authFeedback}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 2. PROFIL & PERIODE CUSTOM */}
      <section className="surface-paper rounded-[28px] p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-obsidian">Profil & Periode Custom</h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <label className="block">
            <span className="text-[11px] font-medium text-stone-500">Tipe Profil</span>
            <select
              value={profile.profile_type}
              onChange={(e) => void onUpdateProfile({ profile_type: e.target.value as ProfileType })}
              className="mt-1 w-full rounded-2xl border px-3 py-2.5 text-sm"
            >
              <option value="fixed">Gaji Tetap</option>
              <option value="freelance">Freelance</option>
              <option value="daily">Serabutan</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-stone-500">Tgl Mulai Periode</span>
            <input
              type="number"
              min={1}
              max={31}
              value={profile.period_start_day}
              onChange={(e) =>
                void onUpdateProfile({
                  period_start_day: Math.max(1, Math.min(31, Number(e.target.value) || 1)),
                })
              }
              className="mt-1 w-full rounded-2xl border px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-stone-500">Biaya Wajib / Bln</span>
            <input
              type="number"
              min={0}
              value={profile.mandatory_living_cost}
              onChange={(e) =>
                void onUpdateProfile({ mandatory_living_cost: Math.max(0, Number(e.target.value) || 0) })
              }
              className="mt-1 w-full rounded-2xl border px-3 py-2.5 text-sm"
            />
          </label>
        </div>
      </section>

      {/* 3. TAMBAH DOMPET CUSTOM & KATEGORI CUSTOM */}
      <section className="surface-paper rounded-[28px] p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-obsidian">
          Custom Dompet ({wallets.length}) & Kategori ({categories.length})
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Dompet baru (SeaBank / Jago)"
            value={newWalletName}
            onChange={(e) => setNewWalletName(e.target.value)}
            className="rounded-2xl border px-3.5 py-2.5 text-sm"
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="Saldo awal (Rp)"
            value={newWalletBalance}
            onChange={(e) => setNewWalletBalance(e.target.value.replace(/\D/g, ''))}
            className="rounded-2xl border px-3.5 py-2.5 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              if (!newWalletName.trim()) return;
              void onAddWallet(
                newWalletName.trim(),
                'custom',
                Number.parseInt(newWalletBalance || '0', 10)
              );
              setNewWalletName('');
              setNewWalletBalance('');
            }}
            className="sm:col-span-2 rounded-2xl bg-obsidian px-4 py-3 text-sm font-semibold text-white hover:bg-obsidian-soft"
          >
            + Tambah Dompet Custom
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 border-t border-stone-100 pt-4 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Kategori pengeluaran baru"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            className="rounded-2xl border px-3.5 py-2.5 text-sm"
          />
          <select
            value={newCatPriority}
            onChange={(e) => setNewCatPriority(e.target.value as Category['priority'])}
            className="rounded-2xl border px-3.5 py-2.5 text-sm"
          >
            <option value="wajib">Prioritas: Wajib</option>
            <option value="penting">Prioritas: Penting</option>
            <option value="bisa_ditunda">Prioritas: Bisa Ditunda</option>
          </select>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Budget bulanan (Rp)"
            value={newCatBudget}
            onChange={(e) => setNewCatBudget(e.target.value.replace(/\D/g, ''))}
            className="sm:col-span-2 rounded-2xl border px-3.5 py-2.5 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              if (!newCatName.trim()) return;
              void onSaveCategory({
                name: newCatName.trim(),
                icon: 'tag',
                priority: newCatPriority,
                monthly_budget: Number.parseInt(newCatBudget || '0', 10),
                is_job_search: false,
              });
              setNewCatName('');
            }}
            className="sm:col-span-2 rounded-2xl bg-obsidian px-4 py-3 text-sm font-semibold text-white hover:bg-obsidian-soft"
          >
            + Tambah Kategori Custom
          </button>
        </div>
      </section>

      {/* 4. BACKUP EXPORT / IMPORT CSV & JSON */}
      <section className="surface-paper rounded-[28px] p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-obsidian">Cadangan Data & Cache</h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void handleExportJson()}
            className="rounded-2xl bg-obsidian px-3 py-2.5 text-xs font-semibold text-white"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="rounded-2xl bg-limecard px-3 py-2.5 text-xs font-semibold text-obsidian"
          >
            Export CSV
          </button>
          <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-stone-100 px-3 py-2.5 text-xs font-semibold text-obsidian hover:bg-stone-200">
            Import JSON
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => void handleImportJsonFile(e)}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleClearAppCache()}
            className="rounded-2xl bg-stone-100 px-3 py-2.5 text-xs font-semibold text-obsidian hover:bg-stone-200"
          >
            Bersihkan Cache
          </button>
        </div>
        {backupMessage && <p className="text-xs font-medium text-stone-700">{backupMessage}</p>}
      </section>
    </div>
  );
}
