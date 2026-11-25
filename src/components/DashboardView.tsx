'use client';

import { useMemo } from 'react';
import { LightbulbIcon, ShieldIcon } from '@/components/Icons';
import { WalletLogo } from '@/components/ui/WalletLogo';
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
    dailyBars,
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

    // 14 bar ritme pengeluaran 14 hari terakhir (visualisasi ringan seperti referensi)
    const bars: number[] = [];
    const msDay = 24 * 60 * 60 * 1000;
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
    for (let i = 13; i >= 0; i--) {
      const dayEnd = todayEnd - i * msDay;
      const dayStart = dayEnd - msDay + 1;
      let sum = 0;
      for (const tx of transactions) {
        if (tx.deleted_at !== null || tx.type !== 'expense') continue;
        const ms = new Date(tx.date).getTime();
        if (ms >= dayStart && ms <= dayEnd) sum += tx.amount;
      }
      bars.push(sum);
    }
    const maxBar = Math.max(1, ...bars);
    const normalizedBars = bars.map((v, idx) => ({
      heightPct: v > 0 ? Math.max(22, Math.round((v / maxBar) * 100)) : 14 + ((idx * 7) % 18),
      hasSpend: v > 0,
    }));

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
      dailyBars: normalizedBars,
    };
  }, [profile, wallets, categories, transactions, recurringBills]);

  const sortedBudgets = useMemo(() => {
    const order = { wajib: 0, penting: 1, bisa_ditunda: 2 };
    return [...categoryBudgets].sort((a, b) => order[a.priority] - order[b.priority]);
  }, [categoryBudgets]);

  return (
    <div className="space-y-4">
      {/* HERO METRIC LANGSUNG DI ATAS KANVAS (Seperti layar tengah referensi) */}
      <section className="px-1 pt-1 pb-2 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
              {profile.profile_type === 'daily'
                ? 'Saldo tersedia · Mode Harian'
                : profile.profile_type === 'freelance'
                  ? 'Saldo riil · Freelance'
                  : 'Saldo tersedia'}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-3xl font-semibold tracking-tight text-obsidian dark:text-white">
                {formatRupiah(totalBalance)}
              </p>
            </div>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              {profile.profile_type === 'daily' ? (
                <>
                  Cukup untuk <strong className="text-obsidian dark:text-limecard">~{survival.days} hari</strong>
                </>
              ) : (
                <>
                  Aman dipakai{' '}
                  <strong className="text-obsidian dark:text-limecard">{formatRupiah(safeDaily)}/hari</strong>
                  {profile.profile_type === 'freelance' ? ` · Runway ${runwayMonths} bln` : ''}
                </>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void onToggleEmergencyMode()}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              profile.emergency_mode
                ? 'bg-coral text-obsidian'
                : 'border border-stone-300 text-stone-700 hover:bg-stone-200/60 dark:border-white/15 dark:text-stone-300 dark:hover:bg-white/10'
            }`}
          >
            <ShieldIcon className="h-3.5 w-3.5" />
            <span>{profile.emergency_mode ? 'Hemat Aktif' : `${period.remainingDays}h lagi`}</span>
          </button>
        </div>

        {/* Mini Vertical Bar Visualizer (14 hari terakhir, ringan tanpa library chart) */}
        <div className="flex h-12 items-end gap-1.5 px-0.5" aria-hidden="true">
          {dailyBars.map((bar, idx) => (
            <div
              key={idx}
              className={`flex-1 rounded-full transition-all ${
                bar.hasSpend
                  ? profile.emergency_mode
                    ? 'bg-coral'
                    : 'bg-obsidian dark:bg-limecard'
                  : 'bg-stone-300/70 dark:bg-white/15'
              }`}
              style={{ height: `${bar.heightPct}%` }}
            />
          ))}
        </div>

        {/* Ringkasan Arus Kas 1 Baris */}
        <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400">
          <span>
            Masuk <strong className="font-semibold text-obsidian dark:text-limecard">{formatRupiah(totals.totalIncome)}</strong>
          </span>
          <span>
            Keluar <strong className="font-semibold text-obsidian dark:text-white">{formatRupiah(totals.totalExpense)}</strong>
          </span>
          {profile.profile_type === 'daily' && (
            <span className="truncate max-w-[140px]">{survival.days} hari</span>
          )}
        </div>
      </section>

      {/* Banner Saran Tenang untuk Mode Harian / Mode Hemat (Coral Card ala referensi) */}
      {(profile.emergency_mode || profile.profile_type === 'daily') && (
        <section className="rounded-[24px] bg-coral p-4 text-obsidian shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-obsidian/70">
            {profile.emergency_mode ? 'Mode Hemat Darurat Aktif' : 'Panduan Ketahanan Hari'}
          </p>
          <p className="mt-1 text-sm font-medium leading-relaxed text-obsidian">
            {survival.adviceMessage}
          </p>
        </section>
      )}

      {/* KARTU PUTIH BERSIH: DOMPET */}
      <section className="surface-paper rounded-[28px] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-obsidian">Dompet</h3>
          <span className="text-xs font-medium text-stone-500">{wallets.length} aktif</span>
        </div>
        <div className="mt-3.5 space-y-2.5">
          {wallets.map((w) => (
            <div key={w.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-obsidian text-limecard">
                  <WalletLogo type={w.type} name={w.name} className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-obsidian">{w.name}</p>
                  <p className="text-[11px] capitalize text-stone-500">{w.type}</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-obsidian">
                {formatRupiah(walletBalances[w.id] ?? 0)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pengingat Tagihan Jatuh Tempo */}
      {upcomingBills.length > 0 && (
        <section className="rounded-[24px] bg-coral/90 p-4 text-obsidian shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-obsidian/75">
            Tagihan Mendekati Jatuh Tempo
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {upcomingBills.map((b) => (
              <li key={b.id} className="flex justify-between font-medium">
                <span>
                  {b.name}
                  {b.total_installments ? ` (${b.current_installment}/${b.total_installments})` : ''}
                </span>
                <strong>{formatRupiah(b.amount)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* KARTU PUTIH BERSIH: BUDGET & PERLU VS PENGEN */}
      <section className="surface-paper rounded-[28px] p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-obsidian">Budget Periode Ini</h3>
          {(needWant.needAmount > 0 || needWant.wantAmount > 0) && (
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-700">
              {needWant.needPercentage}% Perlu · {needWant.wantPercentage}% Pengen
            </span>
          )}
        </div>

        <div className="space-y-3">
          {sortedBudgets.map((item) => (
            <div key={item.categoryId} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-obsidian">{item.categoryName}</span>
                <span className="text-stone-500">
                  {formatRupiah(item.spent)} / {formatRupiah(item.effectiveBudget)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                <div
                  className={`h-full rounded-full ${
                    item.status === 'aman' ? 'bg-obsidian' : 'bg-coral'
                  }`}
                  style={{ width: `${Math.min(100, item.usagePercent)}%` }}
                />
              </div>
              {item.gentleMessage && (
                <p className="text-[11px] font-medium text-warm-700">{item.gentleMessage}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* KARTU PUTIH BERSIH: INSIGHT OTOMATIS */}
      {insights.length > 0 && (
        <section className="surface-paper rounded-[28px] p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-limecard text-obsidian">
              <LightbulbIcon className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold text-obsidian">Catatan & Insight</h3>
          </div>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-stone-700">
            {insights.map((msg, idx) => (
              <li key={idx} className="rounded-xl bg-stone-100/80 px-3 py-2.5">
                {msg}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
