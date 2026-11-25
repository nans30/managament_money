'use client';

import { useMemo } from 'react';
import { LightbulbIcon, ShieldIcon, WalletIcon } from '@/components/Icons';
import {
  calculateCategoryBudgets,
  calculateNeedVsWantSummary,
  calculatePeriodTotals,
  calculateRunwayMonths,
  calculateSafeDailySpend,
  calculateSurvivalDays,
  calculateTotalBalance,
  calculateWalletBalances,
  filterTransactionsInRange,
  generateAutomaticInsights,
  getCustomPeriodRange,
} from '@/lib/calculations';
import { formatRupiah } from '@/lib/format';
import type { Category, Profile, RecurringBill, Transaction, Wallet } from '@/lib/types';

interface DashboardViewProps {
  profile: Profile;
  wallets: Wallet[];
  categories: Category[];
  transactions: Transaction[];
  recurringBills: RecurringBill[];
  onToggleEmergencyMode: () => Promise<void>;
}

export function DashboardView({
  profile,
  wallets,
  categories,
  transactions,
  recurringBills,
  onToggleEmergencyMode,
}: DashboardViewProps) {
  const {
    period,
    walletBalances,
    totalBalance,
    totals,
    needWant,
    safeDaily,
    survival,
    runwayMonths,
    categoryBudgets,
    insights,
    upcomingBills,
  } = useMemo(() => {
    const now = new Date();
    const p = getCustomPeriodRange(now, profile.period_start_day);
    const pTx = filterTransactionsInRange(transactions, p.start, p.end);

    const wBalances = calculateWalletBalances(wallets, transactions);
    const tBalance = calculateTotalBalance(wallets, transactions);
    const pTotals = calculatePeriodTotals(pTx);
    const nWant = calculateNeedVsWantSummary(pTx);

    const mandatoryDailyCap =
      profile.mandatory_living_cost > 0 ? Math.floor(profile.mandatory_living_cost / 30) : undefined;

    const sDaily = calculateSafeDailySpend({
      availableBalance: tBalance,
      remainingDays: p.remainingDays,
      emergencyMode: profile.emergency_mode,
      mandatoryDailyCap,
    });

    const dailyBaseline =
      profile.mandatory_living_cost > 0
        ? Math.max(20000, Math.round(profile.mandatory_living_cost / 30))
        : 50000;

    const surv = calculateSurvivalDays({
      availableBalance: tBalance,
      dailyBaselineCost: dailyBaseline,
      emergencyMode: profile.emergency_mode,
    });

    const rMonths = calculateRunwayMonths(tBalance, profile.mandatory_living_cost);
    const cBudgets = calculateCategoryBudgets(categories, pTx, profile.emergency_mode);
    const ins = generateAutomaticInsights({
      transactions,
      categories,
      profile,
      referenceDate: now,
    });

    const upBills = recurringBills.filter((bill) => {
      const dueMs = new Date(bill.next_due_date).getTime();
      const diffDays = (dueMs - now.getTime()) / (24 * 60 * 60 * 1000);
      return diffDays <= 7 && diffDays >= -2;
    });

    return {
      period: p,
      walletBalances: wBalances,
      totalBalance: tBalance,
      totals: pTotals,
      needWant: nWant,
      safeDaily: sDaily,
      survival: surv,
      runwayMonths: rMonths,
      categoryBudgets: cBudgets,
      insights: ins,
      upcomingBills: upBills,
    };
  }, [profile, wallets, categories, transactions, recurringBills]);

  const sortedBudgets = useMemo(() => {
    const order = { wajib: 0, penting: 1, bisa_ditunda: 2 };
    return [...categoryBudgets].sort((a, b) => order[a.priority] - order[b.priority]);
  }, [categoryBudgets]);

  return (
    <div className="space-y-4">
      {/* Kartu Saldo Minimalis & Lega */}
      <section className="rounded-2xl bg-white p-5 border border-stone-200/80 dark:border-stone-800 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-stone-500">
              {profile.profile_type === 'daily'
                ? 'Saldo tersedia · Mode Harian'
                : profile.profile_type === 'freelance'
                  ? 'Saldo riil · Freelance'
                  : 'Saldo tersedia'}
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">
              {formatRupiah(totalBalance)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onToggleEmergencyMode()}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition ${
              profile.emergency_mode
                ? 'border-warm-500/50 bg-warm-50 text-warm-700'
                : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
            }`}
          >
            <ShieldIcon className="h-3.5 w-3.5" />
            <span>{profile.emergency_mode ? 'Hemat Aktif' : 'Mode Hemat'}</span>
          </button>
        </div>

        {/* Highlight Adaptif Sesuai Profil */}
        {profile.profile_type === 'daily' ? (
          <div className="rounded-xl bg-stone-50 px-3.5 py-3">
            <p className="text-sm font-semibold text-stone-900">
              Uang cukup untuk ~{survival.days} hari
            </p>
            <p className="mt-0.5 text-xs text-stone-500">{survival.adviceMessage}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 border-t border-stone-100 pt-3.5">
            <div>
              <p className="text-[11px] text-stone-500">Aman dipakai / hari</p>
              <p className="mt-0.5 text-base font-semibold text-brand-600">
                {formatRupiah(safeDaily)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-stone-500">
                {profile.profile_type === 'freelance'
                  ? 'Runway (pemasukan nol)'
                  : `Sisa ${period.remainingDays} hari`}
              </p>
              <p className="mt-0.5 text-base font-semibold text-stone-900">
                {profile.profile_type === 'freelance'
                  ? `${runwayMonths} bulan`
                  : `Tgl ${profile.period_start_day}`}
              </p>
            </div>
          </div>
        )}

        {/* Arus Kas Singkat Periode */}
        <div className="flex items-center justify-between border-t border-stone-100 pt-3 text-xs text-stone-500">
          <span>
            Masuk <strong className="font-medium text-brand-600">{formatRupiah(totals.totalIncome)}</strong>
          </span>
          <span>
            Keluar <strong className="font-medium text-stone-800">{formatRupiah(totals.totalExpense)}</strong>
          </span>
          <span>Sisa {period.remainingDays}h</span>
        </div>
      </section>

      {/* Dompet: Chip Ringkas */}
      <section className="space-y-2">
        <h3 className="inline-flex items-center gap-1.5 px-1 text-xs font-medium text-stone-500">
          <WalletIcon className="h-3.5 w-3.5" />
          <span>Dompet</span>
        </h3>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {wallets.map((w) => (
            <div
              key={w.id}
              className="min-w-[112px] shrink-0 rounded-xl border border-stone-200/80 bg-white px-3 py-2.5 dark:border-stone-800"
            >
              <p className="text-[11px] text-stone-500">{w.name}</p>
              <p className="mt-0.5 text-sm font-semibold text-stone-900">
                {formatRupiah(walletBalances[w.id] ?? 0)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pengingat Tagihan Jatuh Tempo (Hanya muncul bila ada) */}
      {upcomingBills.length > 0 && (
        <section className="rounded-2xl border border-warm-500/30 bg-warm-50 p-4">
          <h3 className="text-xs font-semibold text-warm-700">Tagihan Mendekati Jatuh Tempo</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-stone-800">
            {upcomingBills.map((b) => (
              <li key={b.id} className="flex justify-between">
                <span>
                  {b.name}
                  {b.total_installments ? ` (${b.current_installment}/${b.total_installments})` : ''}
                </span>
                <strong className="font-medium">{formatRupiah(b.amount)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Perlu vs Pengen (Ringkas) */}
      {(needWant.needAmount > 0 || needWant.wantAmount > 0) && (
        <section className="rounded-2xl bg-white p-4 border border-stone-200/80 dark:border-stone-800">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-stone-700">Perlu vs Pengen</span>
            <span className="text-stone-500">
              {needWant.needPercentage}% Perlu · {needWant.wantPercentage}% Pengen
            </span>
          </div>
          <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div className="bg-brand-500" style={{ width: `${needWant.needPercentage}%` }} />
            <div className="bg-warm-500" style={{ width: `${needWant.wantPercentage}%` }} />
          </div>
        </section>
      )}

      {/* Budget Kategori Minimalis */}
      <section className="rounded-2xl bg-white p-4 border border-stone-200/80 dark:border-stone-800">
        <h3 className="text-xs font-medium text-stone-500">Budget Periode Ini</h3>
        <div className="mt-3 space-y-3">
          {sortedBudgets.map((item) => (
            <div key={item.categoryId} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-stone-800">{item.categoryName}</span>
                <span className="text-stone-500">
                  {formatRupiah(item.spent)} / {formatRupiah(item.effectiveBudget)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div
                  className={`h-full rounded-full ${
                    item.status === 'aman' ? 'bg-brand-500' : 'bg-warm-500'
                  }`}
                  style={{ width: `${Math.min(100, item.usagePercent)}%` }}
                />
              </div>
              {item.gentleMessage && (
                <p className="text-[11px] text-warm-700">{item.gentleMessage}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Insight Otomatis */}
      {insights.length > 0 && (
        <section className="rounded-2xl bg-white p-4 border border-stone-200/80 dark:border-stone-800">
          <h3 className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500">
            <LightbulbIcon className="h-3.5 w-3.5 text-warm-500" />
            <span>Insight</span>
          </h3>
          <ul className="mt-2 space-y-2 text-xs leading-relaxed text-stone-600">
            {insights.map((msg, idx) => (
              <li key={idx}>{msg}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
