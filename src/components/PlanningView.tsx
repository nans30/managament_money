'use client';

import { BillsCard } from '@/components/planning/BillsCard';
import { DebtsCard } from '@/components/planning/DebtsCard';
import { GoalsCard } from '@/components/planning/GoalsCard';
import type { Debt, Goal, RecurringBill } from '@/lib/types';

interface PlanningViewProps {
  recurringBills: RecurringBill[];
  debts: Debt[];
  goals: Goal[];
  onAddBill: (
    bill: Omit<RecurringBill, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>
  ) => Promise<void>;
  onDeleteBill: (id: string) => Promise<void>;
  onAddDebt: (
    debt: Omit<Debt, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>
  ) => Promise<void>;
  onPayDebt: (debtId: string, amount: number) => Promise<void>;
  onAddGoal: (
    goal: Omit<Goal, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>
  ) => Promise<void>;
  onAddGoalProgress: (goalId: string, amount: number) => Promise<void>;
}

export function PlanningView({
  recurringBills,
  debts,
  goals,
  onAddBill,
  onDeleteBill,
  onAddDebt,
  onPayDebt,
  onAddGoal,
  onAddGoalProgress,
}: PlanningViewProps) {
  return (
    <div className="space-y-5">
      <BillsCard
        recurringBills={recurringBills}
        onAddBill={onAddBill}
        onDeleteBill={onDeleteBill}
      />
      <DebtsCard debts={debts} onAddDebt={onAddDebt} onPayDebt={onPayDebt} />
      <GoalsCard goals={goals} onAddGoal={onAddGoal} onAddGoalProgress={onAddGoalProgress} />
    </div>
  );
}
