'use client';

import { useState } from 'react';
import { DashboardView } from '@/components/DashboardView';
import { MoonIcon, SunIcon, WalletIcon, WifiIcon, WifiOffIcon } from '@/components/Icons';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { PlanningView } from '@/components/PlanningView';
import { ProfileFeaturesView } from '@/components/ProfileFeaturesView';
import { QuickAddForm } from '@/components/QuickAddForm';
import { SettingsView } from '@/components/SettingsView';
import { TransactionList } from '@/components/transactions/TransactionList';
import { BottomNav, type ActiveTab } from '@/components/ui/BottomNav';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useFinanceStore } from '@/hooks/useFinanceStore';
import { useTheme } from '@/hooks/useTheme';
import { t } from '@/lib/i18n';

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
    return <LoadingScreen appName={text.appName} />;
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

  return (
    <div className="mx-auto max-w-md px-4 pt-5 pb-28">
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
          <TransactionList
            transactions={state.transactions}
            wallets={state.wallets}
            categories={state.categories}
            onDelete={actions.deleteTransaction}
          />
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

      <BottomNav activeTab={tab} onSelect={setTab} />
    </div>
  );
}
