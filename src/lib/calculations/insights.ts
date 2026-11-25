import { formatRupiah } from '../format';
import type { Category, Profile, Transaction } from '../types';
import { calculateNeedVsWantSummary, filterTransactionsInRange } from './core';
import { calculateWorkSourceStats } from './daily';

/**
 * Insight otomatis dengan nada netral, praktis, dan tidak menghakimi.
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

  const workStats = calculateWorkSourceStats(transactions).filter((w) => w.hourlyRate !== null);
  if (workStats.length > 0 && workStats[0]?.hourlyRate) {
    insights.push(
      `Sumber kerja paling menguntungkan per jam saat ini: ${workStats[0].source} (${formatRupiah(workStats[0].hourlyRate)}/jam).`
    );
  }

  const recentTx = filterTransactionsInRange(transactions, startCurrentWeek, endCurrentWeek);
  const needWant = calculateNeedVsWantSummary(recentTx);
  if (needWant.needAmount + needWant.wantAmount > 0) {
    insights.push(
      `7 hari terakhir: ${needWant.needPercentage}% pengeluaran masuk kategori Perlu dan ${needWant.wantPercentage}% kategori Pengen.`
    );
  }

  return insights;
}
