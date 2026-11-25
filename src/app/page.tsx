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

export default function HomePage() {
  const { state, actions } = useFinanceStore();
  const { theme, isDark, setTheme, toggleLightDark } = useTheme();
  const [tab, setTab] = useState<ActiveTab>('dashboard');
  const text = t('id');

  if (state.loading) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-base font-medium text-stone-700 dark:text-stone-300">
          Memuat catatan keuangan lokal...
        </p>
      </main>
    );
  }

  if (state.error) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-2xl border border-warm-500/40 bg-warm-50 p-6 text-warm-700 dark:bg-amber-950/50 dark:text-amber-200">
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
    <div className="mx-auto max-w-2xl px-4 pt-4">
      {/* Header Status Offline-First & Toggle Tema */}
      <header className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100">{text.appName}</h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {state.isOnline ? 'Online · Tersimpan di perangkat' : 'Mode Offline · Tetap bisa mencatat'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLightDark}
            aria-label={isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
            title={isDark ? 'Mode Terang' : 'Mode Gelap'}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            {isDark ? <SunIcon className="h-4 w-4 text-amber-400" /> : <MoonIcon className="h-4 w-4 text-stone-700" />}
            <span>{isDark ? 'Terang' : 'Gelap'}</span>
          </button>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              state.isOnline
                ? 'bg-brand-100 text-brand-700 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-warm-100 text-warm-700 dark:bg-amber-950 dark:text-amber-300'
            }`}
          >
            {state.isOnline ? <WifiIcon className="h-3.5 w-3.5" /> : <WifiOffIcon className="h-3.5 w-3.5" />}
            {state.isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </header>

      {/* Konten Utama */}
      <main className="space-y-4">
        {tab === 'dashboard' && (
          <>
            <QuickAddForm
              wallets={state.wallets}
              categories={state.categories}
              onSave={actions.addTransaction}
            />
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
          </>
        )}

        {tab === 'transactions' && (
          <section className="rounded-2xl bg-white p-4 shadow-sm border border-stone-200 dark:bg-stone-900 dark:border-stone-800">
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Riwayat Transaksi ({state.transactions.length})
            </h2>
            {state.transactions.length === 0 ? (
              <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
                Belum ada transaksi tercatat. Mulai catat lewat form Catat Cepat di Beranda.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-stone-100 dark:divide-stone-800">
                {state.transactions.map((tx) => (
                  <li key={tx.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-stone-900 dark:text-stone-100">{tx.note}</p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {tx.date.slice(0, 10)} · {walletById.get(tx.wallet_id) ?? 'Dompet'}
                        {tx.type === 'transfer' && tx.to_wallet_id
                          ? ` → ${walletById.get(tx.to_wallet_id) ?? 'Dompet'}`
                          : ''}
                        {tx.category_id ? ` · ${categoryById.get(tx.category_id) ?? ''}` : ''}
                        {tx.need_or_want ? ` · ${tx.need_or_want}` : ''}
                        {tx.work_hours ? ` · ${tx.work_hours} jam` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold ${
                          tx.type === 'income'
                            ? 'text-brand-600 dark:text-emerald-400'
                            : tx.type === 'transfer'
                              ? 'text-stone-600 dark:text-stone-400'
                              : 'text-stone-900 dark:text-stone-100'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                        {formatRupiah(tx.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => void actions.deleteTransaction(tx.id)}
                        aria-label={`Hapus transaksi ${tx.note}`}
                        className="rounded-lg border border-stone-200 px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800"
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

      {/* Navigasi Bawah Ramah Satu Tangan (Target sentuh >= 44px) */}
      <nav
        aria-label="Navigasi utama"
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-stone-200 bg-white/95 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95"
      >
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {(
            [
              { id: 'dashboard', label: text.nav.dashboard, Icon: HomeIcon },
              { id: 'transactions', label: text.nav.transactions, Icon: ListIcon },
              { id: 'profile', label: text.nav.profileFeatures, Icon: BriefcaseIcon },
              { id: 'planning', label: text.nav.planning, Icon: TargetIcon },
              { id: 'settings', label: text.nav.settings, Icon: SettingsIcon },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold ${
                  active
                    ? 'text-brand-600 border-t-2 border-brand-500 dark:text-emerald-400 dark:border-emerald-400'
                    : 'text-stone-500 dark:text-stone-400'
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
