import type { AllocationRule, Invoice, Transaction } from '../types';

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
 * Menghitung rata-rata pemasukan 3 bulan, 6 bulan, dan bulan terendah.
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
