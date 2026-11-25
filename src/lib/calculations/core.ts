import type {
  Category,
  CategoryPriority,
  Transaction,
  Wallet,
} from '../types';

export interface PeriodRange {
  start: Date;
  end: Date;
  totalDays: number;
  remainingDays: number;
}

/**
 * Menghitung rentang periode custom berdasarkan tanggal mulai gajian (misal 25 sampai 24).
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

  const end = new Date(nextPeriodStart.getTime() - 1);

  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.round((nextPeriodStart.getTime() - start.getTime()) / msPerDay));

  const todayStart = new Date(year, month, day, 0, 0, 0, 0);
  const diffDays = Math.ceil((nextPeriodStart.getTime() - todayStart.getTime()) / msPerDay);
  const remainingDays = Math.max(1, diffDays);

  return { start, end, totalDays, remainingDays };
}

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

export function calculateTotalBalance(wallets: Wallet[], transactions: Transaction[]): number {
  const map = calculateWalletBalances(wallets, transactions);
  return Object.values(map).reduce((sum, val) => sum + val, 0);
}

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
  effectiveBudget: number;
  spent: number;
  remaining: number;
  usagePercent: number;
  status: 'aman' | 'peringatan_80' | 'terlampaui';
  gentleMessage: string | null;
}

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
