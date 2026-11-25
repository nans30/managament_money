'use client';

import { useState } from 'react';
import { DashboardView } from '@/components/DashboardView';
import {
  BriefcaseIcon,
  HomeIcon,
  ListIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  TargetIcon,
  WalletIcon,
  WifiIcon,
  WifiOffIcon,
} from '@/components/Icons';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { PlanningView } from '@/components/PlanningView';
import { ProfileFeaturesView } from '@/components/ProfileFeaturesView';
import { QuickAddForm } from '@/components/QuickAddForm';
import { SettingsView } from '@/components/SettingsView';
import { useFinanceStore } from '@/hooks/useFinanceStore';
import { useTheme } from '@/hooks/useTheme';
import { formatRupiah } from '@/lib/format';
import { t } from '@/lib/i18n';

type ActiveTab = 'dashboard' | 'transactions' | 'profile' | 'planning' | 'settings';

const TAB_TITLES: Record<ActiveTab, string> = {
  dashboard: 'DompetTenang',
  transactions: 'Riwayat',
  profile: 'Fitur Profil',
  planning: 'Rencana',
  settings: 'Pengaturan',
};

export default function HomePage() {
  const { state, actions } = useFinanceStore();
  const { theme, isDark, setTheme, toggleLightDark } = useTheme();
  const [tab, setTab] = useState<ActiveTab>('dashboard');
  const text = t('id');

  if (state.loading) {
    return (
      <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 rounded-2xl border-2 border-limecard/30 border-t-obsidian dark:border-t-limecard animate-spin" />
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-limecard text-obsidian shadow-sm animate-pulse">
            <WalletIcon className="h-6 w-6" />
          </span>
        </div>

        <p className="mt-5 text-base font-semibold tracking-tight text-obsidian dark:text-limecard">
          {text.appName}
        </p>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Menyiapkan catatan keuangan lokal...
        </p>

        {/* 5 batang animasi ritme senada dengan grafik dashboard */}
        <div className="mt-5 flex h-5 items-end gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-1.5 rounded-full bg-obsidian/70 dark:bg-limecard animate-bounce [animation-delay:-0.3s]" />
          <span className="h-4 w-1.5 rounded-full bg-obsidian/80 dark:bg-limecard animate-bounce [animation-delay:-0.2s]" />
          <span className="h-5 w-1.5 rounded-full bg-obsidian dark:bg-limecard animate-bounce [animation-delay:-0.1s]" />
          <span className="h-3.5 w-1.5 rounded-full bg-obsidian/80 dark:bg-limecard animate-bounce [animation-delay:-0.2s]" />
          <span className="h-2.5 w-1.5 rounded-full bg-obsidian/70 dark:bg-limecard animate-bounce [animation-delay:-0.3s]" />
        </div>
      </main>
    );
  }

  if (state.error) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="rounded-[24px] bg-coral p-6 text-obsidian">
          <p className="font-semibold">Ada kendala saat membuka penyimpanan lokal.</p>
          <p className="mt-1 text-sm">{state.error}</p>
        </div>
      </main>
    );
  }

  if (state.needsOnboarding || !state.profile) {
    return <OnboardingScreen onComplete={actions.completeOnboarding} />;
  }

  const walletById = new Map(state.wallets.map((w) => [w.id, w.name]));
  const categoryById = new Map(state.categories.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-md px-4 pt-5 pb-28">
      {/* Header Khas Referensi: Ikon kotak garis + Judul Ekspresif + Kontrol Kanan */}
      <header className="mb-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-obsidian/20 text-obsidian dark:border-limecard/60 dark:text-limecard">
            <WalletIcon className="h-5 w-5" />
          </span>

          <div className="flex items-center gap-2">
            <span
              title={state.isOnline ? 'Online' : 'Mode Offline'}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-stone-300/80 px-3 text-xs font-medium text-stone-700 dark:border-white/15 dark:text-stone-300"
            >
              {state.isOnline ? (
                <WifiIcon className="h-3.5 w-3.5 text-brand-500 dark:text-limecard" />
              ) : (
                <WifiOffIcon className="h-3.5 w-3.5 text-coral" />
              )}
              <span>{state.isOnline ? 'Online' : 'Offline'}</span>
            </span>

            <button
              type="button"
              onClick={toggleLightDark}
              aria-label={isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
              title={isDark ? 'Mode Terang' : 'Mode Gelap'}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-stone-300/80 bg-white text-obsidian hover:bg-stone-100 dark:border-white/15 dark:bg-obsidian-soft dark:text-limecard dark:hover:bg-obsidian-muted"
            >
              {isDark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-obsidian dark:text-limecard">
          {tab === 'dashboard' ? text.appName : TAB_TITLES[tab]}
        </h1>
      </header>

      {/* Konten Utama */}
      <main className="space-y-4">
        {tab === 'dashboard' && (
          <>
            <DashboardView
              profile={state.profile}
              wallets={state.wallets}
              categories={state.categories}
              transactions={state.transactions}
              recurringBills={state.recurringBills}
              onToggleEmergencyMode={() =>
                actions.updateProfile({ emergency_mode: !state.profile?.emergency_mode })
              }
            />
            <QuickAddForm
              wallets={state.wallets}
              categories={state.categories}
              onSave={actions.addTransaction}
            />
          </>
        )}

        {tab === 'transactions' && (
          <section className="surface-paper rounded-[28px] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-obsidian">Semua Transaksi</h2>
              <span className="text-xs font-medium text-stone-500">
                {state.transactions.length} catatan
              </span>
            </div>
            {state.transactions.length === 0 ? (
              <p className="mt-4 text-sm text-stone-500">
                Belum ada transaksi tercatat. Mulai catat lewat kartu Catat Cepat di Beranda.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-stone-100">
                {state.transactions.map((tx) => (
                  <li key={tx.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-obsidian">{tx.note}</p>
                      <p className="text-xs text-stone-500">
                        {tx.date.slice(0, 10)} · {walletById.get(tx.wallet_id) ?? 'Dompet'}
                        {tx.type === 'transfer' && tx.to_wallet_id
                          ? ` → ${walletById.get(tx.to_wallet_id) ?? 'Dompet'}`
                          : ''}
                        {tx.category_id ? ` · ${categoryById.get(tx.category_id) ?? ''}` : ''}
                        {tx.need_or_want ? ` · ${tx.need_or_want}` : ''}
                        {tx.work_hours ? ` · ${tx.work_hours} jam` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`font-semibold ${
                          tx.type === 'income'
                            ? 'text-brand-600'
                            : tx.type === 'transfer'
                              ? 'text-stone-500'
                              : 'text-obsidian'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                        {formatRupiah(tx.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => void actions.deleteTransaction(tx.id)}
                        aria-label={`Hapus transaksi ${tx.note}`}
                        className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-200"
                      >
                        Hapus
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === 'profile' && (
          <ProfileFeaturesView
            profile={state.profile}
            wallets={state.wallets}
            transactions={state.transactions}
            invoices={state.invoices}
            goals={state.goals}
            onUpdateProfile={actions.updateProfile}
            onAddInvoice={actions.addInvoice}
            onMarkInvoicePaid={actions.markInvoicePaid}
          />
        )}

        {tab === 'planning' && (
          <PlanningView
            recurringBills={state.recurringBills}
            debts={state.debts}
            goals={state.goals}
            onAddBill={actions.addRecurringBill}
            onDeleteBill={actions.deleteRecurringBill}
            onAddDebt={actions.addDebt}
            onPayDebt={actions.payDebtPartial}
            onAddGoal={actions.addGoal}
            onAddGoalProgress={actions.addGoalProgress}
          />
        )}

        {tab === 'settings' && (
          <SettingsView
            profile={state.profile}
            wallets={state.wallets}
            categories={state.categories}
            transactions={state.transactions}
            supabaseReady={state.supabaseReady}
            authEmail={state.authEmail}
            syncing={state.syncing}
            syncMessage={state.syncStatus?.message ?? null}
            theme={theme}
            onChangeTheme={setTheme}
            onUpdateProfile={actions.updateProfile}
            onAddWallet={actions.addWallet}
            onSaveCategory={actions.saveCategory}
            onTriggerSync={actions.triggerSync}
            onExportSnapshot={actions.exportSnapshot}
            onImportSnapshot={actions.importSnapshot}
          />
        )}
      </main>

      {/* Navigasi Bawah Mengambang Obsidian Pill (Aksen Lime saat aktif) */}
      <nav
        aria-label="Navigasi utama"
        className="fixed bottom-4 left-4 right-4 z-20 mx-auto max-w-md rounded-full border border-white/10 bg-obsidian/95 px-2 py-1.5 shadow-xl backdrop-blur-md"
      >
        <div className="grid grid-cols-5">
          {(
            [
              { id: 'dashboard', label: 'Beranda', Icon: HomeIcon },
              { id: 'transactions', label: 'Riwayat', Icon: ListIcon },
              { id: 'profile', label: 'Profil', Icon: BriefcaseIcon },
              { id: 'planning', label: 'Rencana', Icon: TargetIcon },
              { id: 'settings', label: 'Atur', Icon: SettingsIcon },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[10px] font-medium transition ${
                  active ? 'bg-limecard text-obsidian font-semibold' : 'text-stone-400 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
