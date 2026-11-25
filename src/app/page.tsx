'use client';

import { useState } from 'react';
import { DashboardView } from '@/components/DashboardView';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { PlanningView } from '@/components/PlanningView';
import { ProfileFeaturesView } from '@/components/ProfileFeaturesView';
import { QuickAddForm } from '@/components/QuickAddForm';
import { SettingsView } from '@/components/SettingsView';
import { useFinanceStore } from '@/hooks/useFinanceStore';
import { formatRupiah } from '@/lib/format';
import { t } from '@/lib/i18n';

type ActiveTab = 'dashboard' | 'transactions' | 'profile' | 'planning' | 'settings';

export default function HomePage() {
  const { state, actions } = useFinanceStore();
  const [tab, setTab] = useState<ActiveTab>('dashboard');
  const text = t('id');

  if (state.loading) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-base font-medium text-stone-700">Memuat catatan keuangan lokal...</p>
      </main>
    );
  }

  if (state.error) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-2xl border border-warm-500/40 bg-warm-50 p-6 text-warm-700">
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
      {/* Header Status Offline-First */}
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-stone-900">{text.appName}</h1>
          <p className="text-xs text-stone-500">
            {state.isOnline ? 'Online · Tersimpan di perangkat' : 'Mode Offline · Tetap bisa mencatat'}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            state.isOnline ? 'bg-brand-100 text-brand-700' : 'bg-warm-100 text-warm-700'
          }`}
        >
          {state.isOnline ? 'Online' : 'Offline'}
        </span>
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
          <section className="rounded-2xl bg-white p-4 shadow-sm border border-stone-200">
            <h2 className="text-base font-bold text-stone-900">
              Riwayat Transaksi ({state.transactions.length})
            </h2>
            {state.transactions.length === 0 ? (
              <p className="mt-3 text-sm text-stone-500">
                Belum ada transaksi tercatat. Mulai catat lewat form Catat Cepat di Beranda.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-stone-100">
                {state.transactions.map((tx) => (
                  <li key={tx.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-stone-900">{tx.note}</p>
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
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold ${
                          tx.type === 'income'
                            ? 'text-brand-600'
                            : tx.type === 'transfer'
                              ? 'text-stone-600'
                              : 'text-stone-900'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                        {formatRupiah(tx.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => void actions.deleteTransaction(tx.id)}
                        aria-label={`Hapus transaksi ${tx.note}`}
                        className="rounded-lg border border-stone-200 px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
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
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-stone-200 bg-white/95 backdrop-blur"
      >
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {(
            [
              { id: 'dashboard', label: text.nav.dashboard },
              { id: 'transactions', label: text.nav.transactions },
              { id: 'profile', label: text.nav.profileFeatures },
              { id: 'planning', label: text.nav.planning },
              { id: 'settings', label: text.nav.settings },
            ] as const
          ).map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex flex-col items-center justify-center py-2.5 text-[11px] font-semibold ${
                  active ? 'text-brand-600 border-t-2 border-brand-500' : 'text-stone-500'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
