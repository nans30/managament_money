'use client';

import { useState } from 'react';
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
  onUpdateProfile,
  onAddWallet,
  onSaveCategory,
  onTriggerSync,
  onExportSnapshot,
  onImportSnapshot,
}: SettingsViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleAuth = async (mode: 'login' | 'register') => {
    setAuthFeedback(null);
    try {
      const res =
        mode === 'login'
          ? await signInWithEmail(email, password)
          : await signUpWithEmail(email, password);
      if (res.error) {
        setAuthFeedback(res.error.message);
      } else {
        setAuthFeedback(
          mode === 'register'
            ? 'Pendaftaran berhasil! Cek email jika perlu konfirmasi.'
            : 'Berhasil masuk. Sinkronisasi berjalan otomatis.'
        );
      }
    } catch (err) {
      setAuthFeedback(err instanceof Error ? err.message : 'Gagal memproses autentikasi.');
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
      {/* 1. PROFIL & PERIODE */}
      <section className="rounded-2xl bg-white p-4 shadow-sm border border-stone-200 space-y-3">
        <h2 className="text-base font-bold text-stone-900">Profil & Periode Custom</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-stone-600">Tipe Profil</span>
            <select
              value={profile.profile_type}
              onChange={(e) => void onUpdateProfile({ profile_type: e.target.value as ProfileType })}
              className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              <option value="fixed">Gaji Tetap</option>
              <option value="freelance">Freelance / Tidak Menentu</option>
              <option value="daily">Serabutan / Transisi</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-stone-600">Tanggal Mulai Periode (1-31)</span>
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
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-stone-600">Biaya Hidup Wajib / Bulan (Rp)</span>
            <input
              type="number"
              min={0}
              value={profile.mandatory_living_cost}
              onChange={(e) =>
                void onUpdateProfile({ mandatory_living_cost: Math.max(0, Number(e.target.value) || 0) })
              }
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      {/* 2. AKUN & SINKRONISASI SUPABASE */}
      <section className="rounded-2xl bg-white p-4 shadow-sm border border-stone-200 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900">Akun & Sinkronisasi Cloud (Supabase)</h2>
          <button
            type="button"
            disabled={syncing}
            onClick={() => void onTriggerSync()}
            className="rounded-xl border border-brand-500 px-3 py-1.5 text-xs font-semibold text-brand-600"
          >
            {syncing ? 'Menyinkronkan...' : 'Sync Sekarang'}
          </button>
        </div>

        {syncMessage && <p className="text-xs text-stone-600">{syncMessage}</p>}

        {!supabaseReady ? (
          <p className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
            Aplikasi saat ini berjalan 100% di mode lokal offline (IndexedDB). Isi{' '}
            <code>NEXT_PUBLIC_SUPABASE_URL</code> dan <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di{' '}
            <code>.env.local</code> untuk mengaktifkan login & sinkronisasi cloud.
          </p>
        ) : authEmail ? (
          <div className="flex items-center justify-between rounded-xl bg-brand-50 p-3 text-sm">
            <span>
              Masuk sebagai <strong>{authEmail}</strong>
            </span>
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1 text-xs font-semibold"
            >
              Keluar
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
              <input
                type="password"
                placeholder="Kata sandi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleAuth('login')}
                className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white"
              >
                Masuk Email
              </button>
              <button
                type="button"
                onClick={() => void handleAuth('register')}
                className="rounded-xl border border-brand-500 px-4 py-2 text-xs font-semibold text-brand-600"
              >
                Daftar Baru
              </button>
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="rounded-xl border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700"
              >
                Masuk dengan Google
              </button>
            </div>
            {authFeedback && <p className="text-xs text-warm-700">{authFeedback}</p>}
          </div>
        )}
      </section>

      {/* 3. TAMBAH DOMPET CUSTOM & KATEGORI CUSTOM */}
      <section className="rounded-2xl bg-white p-4 shadow-sm border border-stone-200 space-y-4">
        <h2 className="text-base font-bold text-stone-900">Dompet ({wallets.length}) & Kategori ({categories.length})</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            type="text"
            placeholder="Nama dompet baru (misal: SeaBank)"
            value={newWalletName}
            onChange={(e) => setNewWalletName(e.target.value)}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="Saldo awal (Rp)"
            value={newWalletBalance}
            onChange={(e) => setNewWalletBalance(e.target.value.replace(/\D/g, ''))}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
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
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
          >
            + Dompet Custom
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 border-t border-stone-100 pt-3">
          <input
            type="text"
            placeholder="Kategori baru"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <select
            value={newCatPriority}
            onChange={(e) => setNewCatPriority(e.target.value as Category['priority'])}
            className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
          >
            <option value="wajib">Wajib</option>
            <option value="penting">Penting</option>
            <option value="bisa_ditunda">Bisa Ditunda</option>
          </select>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Budget/bln"
            value={newCatBudget}
            onChange={(e) => setNewCatBudget(e.target.value.replace(/\D/g, ''))}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
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
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
          >
            + Kategori
          </button>
        </div>
      </section>

      {/* 4. BACKUP EXPORT / IMPORT CSV & JSON */}
      <section className="rounded-2xl bg-white p-4 shadow-sm border border-stone-200 space-y-3">
        <h2 className="text-base font-bold text-stone-900">Cadangan Data (Export & Import)</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleExportJson()}
            className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white"
          >
            Export Backup JSON Lengkap
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="rounded-xl border border-brand-500 px-4 py-2 text-xs font-semibold text-brand-600"
          >
            Export Transaksi CSV
          </button>
          <label className="inline-flex cursor-pointer items-center rounded-xl border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700">
            Import Backup JSON
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
            className="rounded-xl border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700"
          >
            Bersihkan Cache Aset (PWA)
          </button>
        </div>
        {backupMessage && <p className="text-xs text-brand-600">{backupMessage}</p>}
      </section>
    </div>
  );
}
