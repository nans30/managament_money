import type {
  AllocationRule,
  Category,
  CategoryPriority,
  Debt,
  Goal,
  Invoice,
  Profile,
  Transaction,
  Wallet,
} from './types';
import { formatRupiah } from './format';

/**
 * ==============================================================================
 * FUNGSI MURNI PERHITUNGAN KEUANGAN (TANPA AKSES DB ATAU UI)
 * Semua nominal uang diproses sebagai bilangan bulat Rupiah (integer).
 * ==============================================================================
 */

export interface PeriodRange {
  start: Date;
  end: Date;
  totalDays: number;
  remainingDays: number;
}

/**
 * Menghitung rentang periode custom berdasarkan tanggal mulai gajian (misal 25 sampai 24).
 * Jika periodStartDay = 1, maka periode adalah tanggal 1 s/d akhir bulan.
 * remainingDays minimal 1 agar tidak pernah membagi dengan nol.
 */
export function getCustomPeriodRange(referenceDate: Date, periodStartDay: number): PeriodRange {
  const safeStartDay = Math.max(1, Math.min(31, Math.round(periodStartDay)));
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const day = referenceDate.getDate();

  let startYear = year;
  let startMonth = month;

  if (day < safeStartDay) {
    startMonth -= 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear -= 1;
    }
  }

  const daysInStartMonth = new Date(startYear, startMonth + 1, 0).getDate();
  const clampedStartDay = Math.min(safeStartDay, daysInStartMonth);
  const start = new Date(startYear, startMonth, clampedStartDay, 0, 0, 0, 0);

  let nextStartYear = startYear;
  let nextStartMonth = startMonth + 1;
  if (nextStartMonth > 11) {
    nextStartMonth = 0;
    nextStartYear += 1;
  }
  const daysInNextMonth = new Date(nextStartYear, nextStartMonth + 1, 0).getDate();
  const clampedNextStartDay = Math.min(safeStartDay, daysInNextMonth);
  const nextPeriodStart = new Date(nextStartYear, nextStartMonth, clampedNextStartDay, 0, 0, 0, 0);

  // Akhir periode adalah 1 milidetik sebelum periode berikutnya dimulai
  const end = new Date(nextPeriodStart.getTime() - 1);

  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.round((nextPeriodStart.getTime() - start.getTime()) / msPerDay));

  const todayStart = new Date(year, month, day, 0, 0, 0, 0);
  const diffDays = Math.ceil((nextPeriodStart.getTime() - todayStart.getTime()) / msPerDay);
  const remainingDays = Math.max(1, diffDays);

  return { start, end, totalDays, remainingDays };
}

/**
 * Menyaring transaksi aktif (belum di-soft-delete) yang berada dalam rentang tanggal tertentu.
 */
export function filterTransactionsInRange(
  transactions: Transaction[],
  start: Date,
  end: Date
): Transaction[] {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return transactions.filter((tx) => {
    if (tx.deleted_at !== null) return false;
    const txMs = new Date(tx.date).getTime();
    return txMs >= startMs && txMs <= endMs;
  });
}

/**
 * Menghitung saldo aktual masing-masing dompet secara deterministik.
 * Transfer antar dompet mengurangi dompet asal & menambah dompet tujuan,
 * sehingga total kekayaan tidak berubah dan transfer bukan pengeluaran.
 */
export function calculateWalletBalances(
  wallets: Wallet[],
  transactions: Transaction[]
): Record<string, number> {
  const balances: Record<string, number> = {};

  for (const w of wallets) {
    if (w.deleted_at !== null) continue;
    balances[w.id] = Math.round(w.initial_balance);
  }

  for (const tx of transactions) {
    if (tx.deleted_at !== null) continue;
    const amt = Math.round(tx.amount);

    if (tx.type === 'income') {
      if (balances[tx.wallet_id] !== undefined) {
        balances[tx.wallet_id] = (balances[tx.wallet_id] ?? 0) + amt;
      }
    } else if (tx.type === 'expense') {
      if (balances[tx.wallet_id] !== undefined) {
        balances[tx.wallet_id] = (balances[tx.wallet_id] ?? 0) - amt;
      }
    } else if (tx.type === 'transfer') {
      if (balances[tx.wallet_id] !== undefined) {
        balances[tx.wallet_id] = (balances[tx.wallet_id] ?? 0) - amt;
      }
      if (tx.to_wallet_id && balances[tx.to_wallet_id] !== undefined) {
        balances[tx.to_wallet_id] = (balances[tx.to_wallet_id] ?? 0) + amt;
      }
    }
  }

  return balances;
}

/**
 * Menghitung total saldo riil yang benar-benar ada di seluruh dompet aktif.
 */
export function calculateTotalBalance(wallets: Wallet[], transactions: Transaction[]): number {
  const map = calculateWalletBalances(wallets, transactions);
  return Object.values(map).reduce((sum, val) => sum + val, 0);
}

/**
 * Menghitung ringkasan pemasukan & pengeluaran dalam daftar transaksi.
 * Transfer SENGAJA diabaikan agar tidak menggelembungkan laporan.
 */
export function calculatePeriodTotals(transactions: Transaction[]): {
  totalIncome: number;
  workIncome: number;
  nonWorkIncome: number;
  totalExpense: number;
  jobSearchExpense: number;
  netCashflow: number;
} {
  let workIncome = 0;
  let nonWorkIncome = 0;
  let totalExpense = 0;
  let jobSearchExpense = 0;

  for (const tx of transactions) {
    if (tx.deleted_at !== null) continue;
    if (tx.type === 'income') {
      if (tx.income_nature === 'non_kerja') {
        nonWorkIncome += tx.amount;
      } else {
        workIncome += tx.amount;
      }
    } else if (tx.type === 'expense') {
      totalExpense += tx.amount;
      if (tx.is_job_search_expense) {
        jobSearchExpense += tx.amount;
      }
    }
  }

  const totalIncome = workIncome + nonWorkIncome;
  return {
    totalIncome,
    workIncome,
    nonWorkIncome,
    totalExpense,
    jobSearchExpense,
    netCashflow: totalIncome - totalExpense,
  };
}

/**
 * "Aman dipakai per hari":
 * Dihitung dari saldo riil yang benar-benar tersedia dibagi sisa hari di periode.
 * Jika saldo <= 0, mengembalikan 0 (tidak negatif).
 * Jika mode darurat aktif, batas harian dipangkas maksimal ke budget kebutuhan Wajib per hari.
 */
export function calculateSafeDailySpend(params: {
  availableBalance: number;
  remainingDays: number;
  reservedUpcomingBills?: number;
  emergencyMode?: boolean;
  mandatoryDailyCap?: number;
}): number {
  const {
    availableBalance,
    remainingDays,
    reservedUpcomingBills = 0,
    emergencyMode = false,
    mandatoryDailyCap,
  } = params;

  const usable = Math.max(0, Math.round(availableBalance) - Math.round(reservedUpcomingBills));
  const safeDays = Math.max(1, Math.round(remainingDays));
  const rawDaily = Math.floor(usable / safeDays);

  if (emergencyMode && mandatoryDailyCap !== undefined && mandatoryDailyCap > 0) {
    return Math.min(rawDaily, Math.round(mandatoryDailyCap));
  }

  return rawDaily;
}

/**
 * Ringkasan tag "Perlu vs Pengen" (dalam Rupiah & persentase bulat).
 */
export function calculateNeedVsWantSummary(transactions: Transaction[]): {
  needAmount: number;
  wantAmount: number;
  needPercentage: number;
  wantPercentage: number;
} {
  let needAmount = 0;
  let wantAmount = 0;

  for (const tx of transactions) {
    if (tx.deleted_at !== null || tx.type !== 'expense') continue;
    if (tx.need_or_want === 'pengen') {
      wantAmount += tx.amount;
    } else {
      needAmount += tx.amount;
    }
  }

  const total = needAmount + wantAmount;
  if (total === 0) {
    return { needAmount: 0, wantAmount: 0, needPercentage: 0, wantPercentage: 0 };
  }

  const needPercentage = Math.round((needAmount / total) * 100);
  const wantPercentage = 100 - needPercentage;

  return { needAmount, wantAmount, needPercentage, wantPercentage };
}

export interface CategoryBudgetStatus {
  categoryId: string;
  categoryName: string;
  priority: CategoryPriority;
  budget: number;
  effectiveBudget: number; // Berubah jika Mode Darurat aktif
  spent: number;
  remaining: number;
  usagePercent: number;
  status: 'aman' | 'peringatan_80' | 'terlampaui';
  gentleMessage: string | null;
}

/**
 * Menghitung pemakaian budget per kategori dengan peringatan lembut di >= 80%.
 * Jika Mode Darurat aktif: kategori 'bisa_ditunda' dipangkas ke 0, 'penting' dipangkas 50%.
 */
export function calculateCategoryBudgets(
  categories: Category[],
  periodTransactions: Transaction[],
  emergencyMode = false
): CategoryBudgetStatus[] {
  const spentMap = new Map<string, number>();
  for (const tx of periodTransactions) {
    if (tx.deleted_at !== null || tx.type !== 'expense' || !tx.category_id) continue;
    spentMap.set(tx.category_id, (spentMap.get(tx.category_id) ?? 0) + tx.amount);
  }

  return categories
    .filter((c) => c.deleted_at === null)
    .map((cat) => {
      let effectiveBudget = cat.monthly_budget;
      if (emergencyMode) {
        if (cat.priority === 'bisa_ditunda') {
          effectiveBudget = 0;
        } else if (cat.priority === 'penting') {
          effectiveBudget = Math.floor(cat.monthly_budget / 2);
        }
      }

      const spent = spentMap.get(cat.id) ?? 0;
      const remaining = Math.max(0, effectiveBudget - spent);
      const usagePercent =
        effectiveBudget > 0 ? Math.round((spent / effectiveBudget) * 100) : spent > 0 ? 100 : 0;

      let status: CategoryBudgetStatus['status'] = 'aman';
      let gentleMessage: string | null = null;

      if (effectiveBudget > 0 && usagePercent >= 100) {
        status = 'terlampaui';
        gentleMessage = `Pos ${cat.name} sudah melewati rencana awal. Tidak apa-apa, kita sesuaikan di hari berikutnya.`;
      } else if (effectiveBudget > 0 && usagePercent >= 80) {
        status = 'peringatan_80';
        gentleMessage = `Info tenang: Pos ${cat.name} sudah terpakai ${usagePercent}% dari rencana periode ini.`;
      }

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        priority: cat.priority,
        budget: cat.monthly_budget,
        effectiveBudget,
        spent,
        remaining,
        usagePercent,
        status,
        gentleMessage,
      };
    });
}

/**
 * ==============================================================================
 * FITUR KHUSUS PROFIL FREELANCE / PENGHASILAN TIDAK MENENTU
 * ==============================================================================
 */

/**
 * Menghitung Runway (uang cukup untuk berapa bulan jika pemasukan 0).
 */
export function calculateRunwayMonths(
  availableBalance: number,
  mandatoryMonthlyLivingCost: number
): number {
  if (availableBalance <= 0 || mandatoryMonthlyLivingCost <= 0) return 0;
  return Number((availableBalance / mandatoryMonthlyLivingCost).toFixed(1));
}

/**
 * Menghitung rata-rata pemasukan 3 bulan, 6 bulan, dan bulan terendah (sebagai dasar budget realistis).
 */
export function calculateIncomeHistoryStats(
  transactions: Transaction[],
  referenceDate: Date
): {
  avg3Months: number;
  avg6Months: number;
  lowestMonth6: number;
  monthlyTotals: Array<{ monthKey: string; total: number }>;
} {
  const monthBuckets: Array<{ monthKey: string; total: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthBuckets.push({ monthKey: key, total: 0 });
  }

  const bucketMap = new Map(monthBuckets.map((b) => [b.monthKey, b]));

  for (const tx of transactions) {
    if (tx.deleted_at !== null || tx.type !== 'income') continue;
    const d = new Date(tx.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = bucketMap.get(key);
    if (bucket) {
      bucket.total += tx.amount;
    }
  }

  const last6 = monthBuckets.map((b) => b.total);
  const last3 = last6.slice(-3);

  const avg6Months = Math.round(last6.reduce((a, b) => a + b, 0) / 6);
  const avg3Months = Math.round(last3.reduce((a, b) => a + b, 0) / 3);
  const nonZeroMonths = last6.filter((v) => v > 0);
  const lowestMonth6 = nonZeroMonths.length > 0 ? Math.min(...nonZeroMonths) : 0;

  return {
    avg3Months,
    avg6Months,
    lowestMonth6,
    monthlyTotals: monthBuckets,
  };
}

/**
 * Alokasi otomatis pemasukan berdasarkan aturan persentase user.
 * Sisa pembulatan (jika ada) dimasukkan ke pos pertama agar total alokasi = nominal pemasukan persis.
 */
export function calculateIncomeAllocation(
  incomeAmount: number,
  rules: AllocationRule[]
): Array<{ label: string; percentage: number; amount: number }> {
  const cleanAmount = Math.max(0, Math.round(incomeAmount));
  if (rules.length === 0 || cleanAmount === 0) {
    return rules.map((r) => ({ ...r, amount: 0 }));
  }

  const results = rules.map((r) => ({
    label: r.label,
    percentage: r.percentage,
    amount: Math.floor((cleanAmount * r.percentage) / 100),
  }));

  const totalPct = rules.reduce((sum, r) => sum + r.percentage, 0);
  if (totalPct === 100 && results[0]) {
    const allocatedSum = results.reduce((sum, r) => sum + r.amount, 0);
    const remainder = cleanAmount - allocatedSum;
    results[0].amount += remainder;
  }

  return results;
}

/**
 * Rekap pemasukan per sumber/klien dan total piutang invoice yang belum dibayar.
 */
export function calculateClientAndInvoiceSummary(
  transactions: Transaction[],
  invoices: Invoice[]
): {
  byClient: Array<{ client: string; totalIncome: number; count: number }>;
  unpaidInvoiceTotal: number;
  unpaidInvoiceCount: number;
} {
  const clientMap = new Map<string, { totalIncome: number; count: number }>();

  for (const tx of transactions) {
    if (tx.deleted_at !== null || tx.type !== 'income' || tx.income_nature !== 'kerja') continue;
    const name = (tx.source_or_client ?? 'Sumber Umum').trim() || 'Sumber Umum';
    const current = clientMap.get(name) ?? { totalIncome: 0, count: 0 };
    current.totalIncome += tx.amount;
    current.count += 1;
    clientMap.set(name, current);
  }

  const byClient = Array.from(clientMap.entries())
    .map(([client, stats]) => ({ client, ...stats }))
    .sort((a, b) => b.totalIncome - a.totalIncome);

  let unpaidInvoiceTotal = 0;
  let unpaidInvoiceCount = 0;
  for (const inv of invoices) {
    if (inv.deleted_at !== null || inv.status === 'paid') continue;
    unpaidInvoiceTotal += inv.amount;
    unpaidInvoiceCount += 1;
  }

  return { byClient, unpaidInvoiceTotal, unpaidInvoiceCount };
}

/**
 * ==============================================================================
 * FITUR KHUSUS PROFIL SERABUTAN / TRANSISI HARIAN
 * ==============================================================================
 */

/**
 * Menghitung "uang cukup untuk berapa hari" dan simulasi penghematan tenang:
 * Contoh pesan: "Uang cukup untuk 6 hari. Kalau hemat Rp15.000 per hari, bisa jadi 9 hari."
 */
export function calculateSurvivalDays(params: {
  availableBalance: number;
  dailyBaselineCost: number;
  emergencyMode?: boolean;
}): {
  days: number;
  effectiveDailyCost: number;
  adviceMessage: string;
} {
  const { availableBalance, dailyBaselineCost, emergencyMode = false } = params;
  const safeBalance = Math.max(0, Math.round(availableBalance));
  // Saat mode darurat aktif, asumsikan kebutuhan harian ditekan 25% ke kebutuhan inti
  const effectiveDailyCost = Math.max(
    1,
    Math.round(emergencyMode ? dailyBaselineCost * 0.75 : dailyBaselineCost)
  );

  const days = Math.floor(safeBalance / effectiveDailyCost);

  if (safeBalance === 0) {
    return {
      days: 0,
      effectiveDailyCost,
      adviceMessage:
        'Saldo tercatat masih Rp0. Fokus amankan pos Wajib dulu (makan & tempat tinggal) sambil catat pemasukan berikutnya.',
    };
  }

  const saveStep = effectiveDailyCost >= 40000 ? 15000 : Math.max(5000, Math.round(effectiveDailyCost * 0.25));
  const tighterDaily = Math.max(10000, effectiveDailyCost - saveStep);
  const extendedDays = Math.floor(safeBalance / tighterDaily);

  const adviceMessage =
    extendedDays > days
      ? `Uang cukup untuk ${days} hari. Kalau hemat ${formatRupiah(saveStep)} per hari, bisa jadi ${extendedDays} hari.`
      : `Uang cukup untuk sekitar ${days} hari dengan pola pengeluaran saat ini.`;

  return {
    days,
    effectiveDailyCost,
    adviceMessage,
  };
}

export interface WorkSourceStat {
  source: string;
  totalIncome: number;
  sessions: number;
  totalHours: number;
  hourlyRate: number | null; // Rupiah bulat per jam
}

/**
 * Statistik sumber kerja harian (contoh: ngojek, kuli, dagang) + pendapatan per jam kerja.
 * Hanya menghitung transaksi pemasukan dengan income_nature === 'kerja'
 * agar bantuan sosial / kiriman keluarga tidak mendistorsi produktivitas kerja.
 */
export function calculateWorkSourceStats(transactions: Transaction[]): WorkSourceStat[] {
  const map = new Map<string, { totalIncome: number; sessions: number; totalHours: number }>();

  for (const tx of transactions) {
    if (tx.deleted_at !== null || tx.type !== 'income' || tx.income_nature !== 'kerja') continue;
    const key = (tx.source_or_client ?? 'Kerja Harian').trim() || 'Kerja Harian';
    const curr = map.get(key) ?? { totalIncome: 0, sessions: 0, totalHours: 0 };
    curr.totalIncome += tx.amount;
    curr.sessions += 1;
    if (tx.work_hours && tx.work_hours > 0) {
      curr.totalHours += tx.work_hours;
    }
    map.set(key, curr);
  }

  return Array.from(map.entries())
    .map(([source, v]) => ({
      source,
      totalIncome: v.totalIncome,
      sessions: v.sessions,
      totalHours: Number(v.totalHours.toFixed(2)),
      hourlyRate: v.totalHours > 0 ? Math.round(v.totalIncome / v.totalHours) : null,
    }))
    .sort((a, b) => (b.hourlyRate ?? 0) - (a.hourlyRate ?? 0) || b.totalIncome - a.totalIncome);
}

/**
 * Milestone Dana Darurat Mini bertahap untuk profil Serabutan (Rp200rb, Rp500rb, Rp1jt, Rp2jt, Rp5jt).
 */
export function getEmergencyMiniMilestones(currentCollected: number): {
  currentMilestone: number;
  nextMilestone: number;
  progressPercent: number;
  completedMilestones: number[];
} {
  const steps = [200_000, 500_000, 1_000_000, 2_000_000, 5_000_000];
  const collected = Math.max(0, Math.round(currentCollected));
  const completedMilestones = steps.filter((s) => collected >= s);
  const nextMilestone = steps.find((s) => collected < s) ?? steps[steps.length - 1]!;
  const currentMilestone = completedMilestones[completedMilestones.length - 1] ?? 0;

  const progressPercent = Math.min(100, Math.round((collected / nextMilestone) * 100));
  return { currentMilestone, nextMilestone, progressPercent, completedMilestones };
}

/**
 * Estimasi kapan target tabungan tercapai (dalam bulan).
 */
export function estimateGoalCompletionMonths(goal: Goal): number | null {
  const remaining = Math.max(0, goal.target_amount - goal.collected_amount);
  if (remaining === 0) return 0;
  if (goal.monthly_saving_plan <= 0) return null;
  return Math.ceil(remaining / goal.monthly_saving_plan);
}

/**
 * Ringkasan total utang & piutang yang masih berjalan.
 */
export function calculateDebtSummary(debts: Debt[]): {
  totalUtangRemaining: number;
  totalPiutangRemaining: number;
  warungUtangRemaining: number;
} {
  let totalUtangRemaining = 0;
  let totalPiutangRemaining = 0;
  let warungUtangRemaining = 0;

  for (const d of debts) {
    if (d.deleted_at !== null || d.status === 'lunas') continue;
    const remaining = Math.max(0, d.amount - d.paid_amount);
    if (d.direction === 'utang') {
      totalUtangRemaining += remaining;
      if (d.category === 'warung') {
        warungUtangRemaining += remaining;
      }
    } else {
      totalPiutangRemaining += remaining;
    }
  }

  return { totalUtangRemaining, totalPiutangRemaining, warungUtangRemaining };
}

/**
 * ==============================================================================
 * INSIGHT OTOMATIS (NADA NETRAL, PRAKTIS, TIDAK MENGHAKIMI)
 * ==============================================================================
 */
export function generateAutomaticInsights(params: {
  transactions: Transaction[];
  categories: Category[];
  profile: Profile;
  referenceDate: Date;
}): string[] {
  const { transactions, categories, referenceDate } = params;
  const insights: string[] = [];

  const msPerDay = 24 * 60 * 60 * 1000;
  const endCurrentWeek = new Date(referenceDate.getTime());
  const startCurrentWeek = new Date(referenceDate.getTime() - 7 * msPerDay);
  const startPrevWeek = new Date(referenceDate.getTime() - 14 * msPerDay);

  const catNameById = new Map(categories.map((c) => [c.id, c.name]));

  const currentWeekByCat = new Map<string, number>();
  const prevWeekByCat = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.deleted_at !== null || tx.type !== 'expense' || !tx.category_id) continue;
    const ms = new Date(tx.date).getTime();
    if (ms > startCurrentWeek.getTime() && ms <= endCurrentWeek.getTime()) {
      currentWeekByCat.set(tx.category_id, (currentWeekByCat.get(tx.category_id) ?? 0) + tx.amount);
    } else if (ms > startPrevWeek.getTime() && ms <= startCurrentWeek.getTime()) {
      prevWeekByCat.set(tx.category_id, (prevWeekByCat.get(tx.category_id) ?? 0) + tx.amount);
    }
  }

  for (const [catId, currAmt] of currentWeekByCat.entries()) {
    const prevAmt = prevWeekByCat.get(catId) ?? 0;
    const catName = catNameById.get(catId) ?? 'Kategori';
    if (prevAmt > 0 && currAmt > prevAmt) {
      const pctIncrease = Math.round(((currAmt - prevAmt) / prevAmt) * 100);
      if (pctIncrease >= 15) {
        insights.push(
          `Pengeluaran ${catName.toLowerCase()} naik ${pctIncrease}% dari minggu lalu (${formatRupiah(currAmt)} vs ${formatRupiah(prevAmt)}).`
        );
      }
    } else if (prevAmt > 0 && currAmt < prevAmt) {
      const pctDecrease = Math.round(((prevAmt - currAmt) / prevAmt) * 100);
      if (pctDecrease >= 15) {
        insights.push(
          `Pengeluaran ${catName.toLowerCase()} turun ${pctDecrease}% dari minggu lalu. Lumayan untuk menambah cadangan.`
        );
      }
    }
  }

  // Insight pendapatan per jam terbaik jika ada data jam kerja
  const workStats = calculateWorkSourceStats(transactions).filter((w) => w.hourlyRate !== null);
  if (workStats.length > 0 && workStats[0]?.hourlyRate) {
    insights.push(
      `Sumber kerja paling menguntungkan per jam saat ini: ${workStats[0].source} (${formatRupiah(workStats[0].hourlyRate)}/jam).`
    );
  }

  // Insight proporsi perlu vs pengen
  const recentTx = filterTransactionsInRange(transactions, startCurrentWeek, endCurrentWeek);
  const needWant = calculateNeedVsWantSummary(recentTx);
  if (needWant.needAmount + needWant.wantAmount > 0) {
    insights.push(
      `7 hari terakhir: ${needWant.needPercentage}% pengeluaran masuk kategori Perlu dan ${needWant.wantPercentage}% kategori Pengen.`
    );
  }

  return insights;
}
