'use client';

import { useMemo } from 'react';
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

  return (
    <div className="space-y-4">
      {/* Banner Mode Darurat (Warna Hangat Netral, Tidak Agresif) */}
      {profile.emergency_mode && (
        <div className="rounded-2xl border border-warm-500/40 bg-warm-50 p-4 text-sm text-warm-700">
          <div className="font-semibold">Mode Hemat Darurat Sedang Aktif</div>
          <p className="mt-1">
            Budget kategori &ldquo;Bisa Ditunda&rdquo; dipangkas sementara agar fokus ke kebutuhan Wajib dulu.
          </p>
        </div>
      )}

      {/* Kartu Utama Adaptif sesuai Profil */}
      <section className="rounded-2xl bg-brand-600 p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-brand-100">
              {profile.profile_type === 'daily'
                ? 'Mode Harian · Ketahanan Saldo'
                : profile.profile_type === 'freelance'
                  ? 'Mode Freelance · Saldo Riil Tersedia'
                  : 'Mode Gaji Tetap · Saldo Tersedia'}
            </p>
            <p className="mt-1 text-3xl font-bold">{formatRupiah(totalBalance)}</p>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
            Sisa {period.remainingDays} hari
          </span>
        </div>

        {/* Highlight Spesifik Profil */}
        {profile.profile_type === 'daily' ? (
          <div className="mt-4 rounded-xl bg-white/10 p-3">
            <p className="text-lg font-bold">Uang cukup untuk ~{survival.days} hari</p>
            <p className="mt-1 text-xs text-brand-50">{survival.adviceMessage}</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-white/10 p-3">
            <div>
              <p className="text-xs text-brand-100">Aman dipakai / hari</p>
              <p className="text-lg font-bold">{formatRupiah(safeDaily)}</p>
            </div>
            <div>
              <p className="text-xs text-brand-100">
                {profile.profile_type === 'freelance' ? 'Runway (pemasukan nol)' : 'Periode aktif'}
              </p>
              <p className="text-lg font-bold">
                {profile.profile_type === 'freelance'
                  ? `${runwayMonths} bulan`
                  : `Tgl ${profile.period_start_day}`}
              </p>
            </div>
          </div>
        )}

        {/* Satu Tombol Mode Darurat untuk profil Serabutan / semua profil */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/15 pt-3 text-xs">
          <span>
            Masuk periode: <strong>{formatRupiah(totals.totalIncome)}</strong> · Keluar:{' '}
            <strong>{formatRupiah(totals.totalExpense)}</strong>
          </span>
          <button
            type="button"
            onClick={() => void onToggleEmergencyMode()}
            className="rounded-lg bg-white/20 px-3 py-1 font-semibold text-white hover:bg-white/30"
          >
            {profile.emergency_mode ? 'Matikan Mode Hemat' : 'Mode Hemat'}
          </button>
        </div>
      </section>

      {/* Daftar Saldo Per Dompet */}
      <section className="rounded-2xl bg-white p-4 shadow-sm border border-stone-200">
        <h3 className="text-sm font-bold text-stone-800">Dompet</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {wallets.map((w) => (
            <div key={w.id} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
              <p className="text-xs text-stone-500">{w.name}</p>
              <p className="mt-1 text-sm font-bold text-stone-900">
                {formatRupiah(walletBalances[w.id] ?? 0)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pengingat Tagihan Jatuh Tempo */}
      {upcomingBills.length > 0 && (
        <section className="rounded-2xl border border-warm-500/30 bg-warm-50 p-4">
          <h3 className="text-sm font-bold text-warm-700">Tagihan Mendekati Jatuh Tempo</h3>
          <ul className="mt-2 space-y-1 text-sm text-stone-800">
            {upcomingBills.map((b) => (
              <li key={b.id} className="flex justify-between">
                <span>
                  {b.name}
                  {b.total_installments ? ` (Cicilan ${b.current_installment}/${b.total_installments})` : ''}
                </span>
                <strong>{formatRupiah(b.amount)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Ringkasan Perlu vs Pengen */}
      <section className="rounded-2xl bg-white p-4 shadow-sm border border-stone-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-800">Perlu vs Pengen (Periode Ini)</h3>
          <span className="text-xs text-stone-500">
            {needWant.needPercentage}% Perlu · {needWant.wantPercentage}% Pengen
          </span>
        </div>
        <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-stone-200">
          <div className="bg-brand-500" style={{ width: `${needWant.needPercentage}%` }} />
          <div className="bg-warm-500" style={{ width: `${needWant.wantPercentage}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-stone-600">
          <span>Perlu: {formatRupiah(needWant.needAmount)}</span>
          <span>Pengen: {formatRupiah(needWant.wantAmount)}</span>
        </div>
      </section>

      {/* Budget Per Kategori & Peringatan Lembut 80% */}
      <section className="rounded-2xl bg-white p-4 shadow-sm border border-stone-200">
        <h3 className="text-sm font-bold text-stone-800">Budget Kategori & Prioritas</h3>
        <div className="mt-3 space-y-3">
          {categoryBudgets
            .sort((a, b) => {
              const order = { wajib: 0, penting: 1, bisa_ditunda: 2 };
              return order[a.priority] - order[b.priority];
            })
            .map((item) => (
              <div key={item.categoryId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-stone-800">
                    {item.categoryName}{' '}
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-600">
                      {item.priority.replace('_', ' ')}
                    </span>
                  </span>
                  <span className="text-xs text-stone-600">
                    {formatRupiah(item.spent)} / {formatRupiah(item.effectiveBudget)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={`h-full ${
                      item.status === 'aman' ? 'bg-brand-500' : 'bg-warm-500'
                    }`}
                    style={{ width: `${Math.min(100, item.usagePercent)}%` }}
                  />
                </div>
                {item.gentleMessage && (
                  <p className="text-xs text-warm-700">{item.gentleMessage}</p>
                )}
              </div>
            ))}
        </div>
      </section>

      {/* Insight Otomatis */}
      {insights.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-sm border border-stone-200">
          <h3 className="text-sm font-bold text-stone-800">Catatan & Insight</h3>
          <ul className="mt-2 space-y-2 text-sm text-stone-700">
            {insights.map((msg, idx) => (
              <li key={idx} className="rounded-xl bg-stone-50 p-3">
                {msg}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
