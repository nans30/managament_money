import { describe, it, expect } from 'vitest';
import {
  calculateCategoryBudgets,
  calculateClientAndInvoiceSummary,
  calculateDebtSummary,
  calculateIncomeAllocation,
  calculateIncomeHistoryStats,
  calculateNeedVsWantSummary,
  calculatePeriodTotals,
  calculateRunwayMonths,
  calculateSafeDailySpend,
  calculateSurvivalDays,
  calculateTotalBalance,
  calculateWalletBalances,
  calculateWorkSourceStats,
  estimateGoalCompletionMonths,
  generateAutomaticInsights,
  getCustomPeriodRange,
  getEmergencyMiniMilestones,
} from '@/lib/calculations';
import type { Category, Debt, Goal, Invoice, Profile, Transaction, Wallet } from '@/lib/types';

const now = '2026-11-25T08:00:00.000Z';
const userId = '11111111-1111-4111-8111-111111111111';

const walletCash: Wallet = {
  id: '00000000-0000-4000-8000-000000000001',
  user_id: userId,
  name: 'Cash',
  type: 'cash',
  initial_balance: 500000,
  created_at: now,
  updated_at: now,
  deleted_at: null,
};

const walletGopay: Wallet = {
  id: '00000000-0000-4000-8000-000000000002',
  user_id: userId,
  name: 'GoPay',
  type: 'gopay',
  initial_balance: 200000,
  created_at: now,
  updated_at: now,
  deleted_at: null,
};

const catMakan: Category = {
  id: '00000000-0000-4000-8000-000000000011',
  user_id: userId,
  name: 'Makan',
  icon: 'utensils',
  priority: 'wajib',
  monthly_budget: 100000,
  is_job_search: false,
  created_at: now,
  updated_at: now,
  deleted_at: null,
};

const catHiburan: Category = {
  id: '00000000-0000-4000-8000-000000000012',
  user_id: userId,
  name: 'Hiburan',
  icon: 'film',
  priority: 'bisa_ditunda',
  monthly_budget: 100000,
  is_job_search: false,
  created_at: now,
  updated_at: now,
  deleted_at: null,
};

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: '00000000-0000-4000-8000-000000000100',
    user_id: userId,
    type: 'expense',
    amount: 25000,
    wallet_id: walletCash.id,
    to_wallet_id: null,
    category_id: catMakan.id,
    source_or_client: null,
    need_or_want: 'perlu',
    work_hours: null,
    income_nature: 'kerja',
    is_job_search_expense: false,
    note: 'tes',
    date: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...overrides,
  };
}

describe('Perhitungan Periode Custom', () => {
  it('menghitung periode gajian tanggal 25 sampai 24 dengan tepat', () => {
    // Tanggal referensi 10 November -> periode aktif adalah 25 Oktober s/d 24 November
    const ref = new Date(2026, 10, 10); // Nov 10, 2026
    const range = getCustomPeriodRange(ref, 25);
    expect(range.start.getMonth()).toBe(9); // Oktober
    expect(range.start.getDate()).toBe(25);
    expect(range.end.getMonth()).toBe(10); // November
    expect(range.end.getDate()).toBe(24);
    expect(range.remainingDays).toBe(15); // 10 Nov -> 25 Nov = 15 hari
  });

  it('menghitung periode saat tanggal referensi tepat di tanggal gajian', () => {
    const ref = new Date(2026, 10, 25); // Nov 25, 2026
    const range = getCustomPeriodRange(ref, 25);
    expect(range.start.getMonth()).toBe(10); // November
    expect(range.start.getDate()).toBe(25);
    expect(range.end.getMonth()).toBe(11); // Desember
    expect(range.end.getDate()).toBe(24);
    expect(range.remainingDays).toBe(30);
  });
});

describe('Saldo Dompet & Transfer Bukan Pengeluaran', () => {
  it('menghitung saldo per dompet dan mengabaikan transfer pada laporan pengeluaran', () => {
    const txs: Transaction[] = [
      makeTx({ id: '00000000-0000-4000-8000-000000000101', type: 'income', amount: 300000, wallet_id: walletCash.id }),
      makeTx({ id: '00000000-0000-4000-8000-000000000102', type: 'expense', amount: 50000, wallet_id: walletCash.id }),
      makeTx({
        id: '00000000-0000-4000-8000-000000000103',
        type: 'transfer',
        amount: 100000,
        wallet_id: walletCash.id,
        to_wallet_id: walletGopay.id,
      }),
    ];

    const balances = calculateWalletBalances([walletCash, walletGopay], txs);
    // Cash: 500rb + 300rb - 50rb - 100rb = 650rb
    expect(balances[walletCash.id]).toBe(650000);
    // GoPay: 200rb + 100rb = 300rb
    expect(balances[walletGopay.id]).toBe(300000);
    expect(calculateTotalBalance([walletCash, walletGopay], txs)).toBe(950000);

    const totals = calculatePeriodTotals(txs);
    expect(totals.totalIncome).toBe(300000);
    expect(totals.totalExpense).toBe(50000); // Transfer 100rb TIDAK masuk pengeluaran
  });
});

describe('Aman Dipakai Per Hari & Budget Kategori', () => {
  it('menghitung aman dipakai per hari dari saldo riil dibagi sisa hari', () => {
    expect(
      calculateSafeDailySpend({ availableBalance: 600000, remainingDays: 10 })
    ).toBe(60000);

    // Saldo negatif atau 0 tidak pernah mengembalikan angka negatif
    expect(
      calculateSafeDailySpend({ availableBalance: -50000, remainingDays: 10 })
    ).toBe(0);

    // Mode darurat membatasi pengeluaran harian ke mandatoryDailyCap
    expect(
      calculateSafeDailySpend({
        availableBalance: 1000000,
        remainingDays: 10,
        emergencyMode: true,
        mandatoryDailyCap: 45000,
      })
    ).toBe(45000);
  });

  it('memberikan peringatan lembut saat budget mencapai 80% dan memangkas budget saat mode darurat', () => {
    const txs = [
      makeTx({ amount: 85000, category_id: catMakan.id }),
    ];
    const normalBudgets = calculateCategoryBudgets([catMakan, catHiburan], txs, false);
    const makanNormal = normalBudgets.find((b) => b.categoryId === catMakan.id)!;
    expect(makanNormal.usagePercent).toBe(85);
    expect(makanNormal.status).toBe('peringatan_80');
    expect(makanNormal.gentleMessage).toContain('85%');

    const emergencyBudgets = calculateCategoryBudgets([catMakan, catHiburan], txs, true);
    const hiburanEmergency = emergencyBudgets.find((b) => b.categoryId === catHiburan.id)!;
    expect(hiburanEmergency.effectiveBudget).toBe(0);
  });

  it('menghitung persentase Perlu vs Pengen', () => {
    const txs = [
      makeTx({ amount: 75000, need_or_want: 'perlu' }),
      makeTx({ amount: 25000, need_or_want: 'pengen' }),
    ];
    const summary = calculateNeedVsWantSummary(txs);
    expect(summary.needPercentage).toBe(75);
    expect(summary.wantPercentage).toBe(25);
  });
});

describe('Fitur Freelance: Runway, Rata-rata 3/6 Bulan, Alokasi Otomatis, Invoice', () => {
  it('menghitung runway dalam bulan', () => {
    expect(calculateRunwayMonths(9000000, 3000000)).toBe(3);
    expect(calculateRunwayMonths(4500000, 3000000)).toBe(1.5);
  });

  it('menghitung alokasi otomatis dengan total persis sama tanpa hilang pembulatan', () => {
    const allocated = calculateIncomeAllocation(1000001, [
      { label: 'Wajib', percentage: 50 },
      { label: 'Tabungan', percentage: 20 },
      { label: 'Pajak', percentage: 10 },
      { label: 'Bebas', percentage: 20 },
    ]);
    const total = allocated.reduce((sum, a) => sum + a.amount, 0);
    expect(total).toBe(1000001);
  });

  it('menghitung rata-rata pemasukan 3 & 6 bulan serta bulan terendah', () => {
    const ref = new Date(2026, 10, 25); // Nov 2026
    const txs: Transaction[] = [
      makeTx({ type: 'income', amount: 3000000, date: new Date(2026, 10, 5).toISOString() }), // Nov
      makeTx({ type: 'income', amount: 6000000, date: new Date(2026, 9, 5).toISOString() }),  // Okt
      makeTx({ type: 'income', amount: 3000000, date: new Date(2026, 8, 5).toISOString() }),  // Sep
      makeTx({ type: 'income', amount: 2000000, date: new Date(2026, 7, 5).toISOString() }),  // Agu
    ];
    const stats = calculateIncomeHistoryStats(txs, ref);
    expect(stats.avg3Months).toBe(4000000); // (3+6+3)/3
    expect(stats.lowestMonth6).toBe(2000000);
  });

  it('merekap pemasukan per klien dan piutang invoice belum dibayar', () => {
    const txs = [
      makeTx({ type: 'income', amount: 2500000, source_or_client: 'PT Maju', income_nature: 'kerja' }),
    ];
    const invoices: Invoice[] = [
      {
        id: '00000000-0000-4000-8000-000000000201',
        user_id: userId,
        client_name: 'PT Maju',
        amount: 1500000,
        issued_date: now,
        due_date: now,
        status: 'unpaid',
        note: '',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      },
    ];
    const res = calculateClientAndInvoiceSummary(txs, invoices);
    expect(res.unpaidInvoiceTotal).toBe(1500000);
    expect(res.byClient[0]?.client).toBe('PT Maju');
  });
});

describe('Fitur Serabutan: Ketahanan Hari, Pendapatan Per Jam, Dana Darurat Mini, Utang, Insight', () => {
  it('menghitung jumlah hari bertahan dengan saran penghematan yang tenang', () => {
    const res = calculateSurvivalDays({ availableBalance: 300000, dailyBaselineCost: 50000 });
    expect(res.days).toBe(6);
    expect(res.adviceMessage).toContain('6 hari');
    expect(res.adviceMessage).toContain('Rp15.000');
    expect(res.adviceMessage).toContain('8 hari'); // 300rb / 35rb = 8 hari
  });

  it('menghitung pendapatan per jam kerja dan memisahkan pemasukan non-kerja', () => {
    const txs: Transaction[] = [
      makeTx({ type: 'income', amount: 85000, source_or_client: 'Ngojek', work_hours: 5, income_nature: 'kerja' }),
      makeTx({ type: 'income', amount: 120000, source_or_client: 'Kuli', work_hours: 6, income_nature: 'kerja' }),
      makeTx({ type: 'income', amount: 500000, source_or_client: 'Bansos', work_hours: null, income_nature: 'non_kerja' }),
    ];
    const stats = calculateWorkSourceStats(txs);
    expect(stats).toHaveLength(2); // Bansos tidak masuk statistik kerja
    expect(stats[0]?.source).toBe('Kuli');
    expect(stats[0]?.hourlyRate).toBe(20000);
    expect(stats[1]?.source).toBe('Ngojek');
    expect(stats[1]?.hourlyRate).toBe(17000);
  });

  it('menghitung milestone dana darurat mini bertahap', () => {
    const m1 = getEmergencyMiniMilestones(250000);
    expect(m1.completedMilestones).toEqual([200000]);
    expect(m1.nextMilestone).toBe(500000);
    expect(m1.progressPercent).toBe(50);
  });

  it('menghitung estimasi bulan tercapai target tabungan & sisa utang warung', () => {
    const goal: Goal = {
      id: '00000000-0000-4000-8000-000000000301',
      user_id: userId,
      name: 'Dana Darurat',
      target_amount: 1000000,
      collected_amount: 200000,
      type: 'dana_darurat',
      monthly_saving_plan: 200000,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    expect(estimateGoalCompletionMonths(goal)).toBe(4);

    const debts: Debt[] = [
      {
        id: '00000000-0000-4000-8000-000000000401',
        user_id: userId,
        direction: 'utang',
        counterparty: 'Warung Bu Siti',
        category: 'warung',
        amount: 100000,
        paid_amount: 40000,
        due_date: null,
        status: 'sebagian',
        note: '',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      },
    ];
    const debtSum = calculateDebtSummary(debts);
    expect(debtSum.warungUtangRemaining).toBe(60000);
  });

  it('menghasilkan insight kenaikan pengeluaran mingguan dengan nada netral', () => {
    const ref = new Date('2026-11-25T12:00:00.000Z');
    const profile: Profile = {
      id: '00000000-0000-4000-8000-000000000501',
      user_id: userId,
      profile_type: 'daily',
      period_start_day: 1,
      mandatory_living_cost: 1500000,
      self_salary_amount: 0,
      allocation_rules: [],
      emergency_mode: false,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    const txs: Transaction[] = [
      makeTx({ amount: 130000, category_id: catMakan.id, date: '2026-11-23T10:00:00.000Z' }),
      makeTx({ amount: 100000, category_id: catMakan.id, date: '2026-11-15T10:00:00.000Z' }),
    ];
    const insights = generateAutomaticInsights({
      transactions: txs,
      categories: [catMakan],
      profile,
      referenceDate: ref,
    });
    expect(insights.some((i) => i.includes('naik 30%'))).toBe(true);
    // Pastikan tidak pernah ada kata menghakimi "boros"
    expect(insights.some((i) => i.toLowerCase().includes('boros'))).toBe(false);
  });
});
