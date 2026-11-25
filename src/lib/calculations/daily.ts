import { formatRupiah } from '../format';
import type { Debt, Goal, Transaction } from '../types';

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

  const saveStep =
    effectiveDailyCost >= 40000 ? 15000 : Math.max(5000, Math.round(effectiveDailyCost * 0.25));
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
  hourlyRate: number | null;
}

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

export function estimateGoalCompletionMonths(goal: Goal): number | null {
  const remaining = Math.max(0, goal.target_amount - goal.collected_amount);
  if (remaining === 0) return 0;
  if (goal.monthly_saving_plan <= 0) return null;
  return Math.ceil(remaining / goal.monthly_saving_plan);
}

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
