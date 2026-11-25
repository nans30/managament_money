'use client';

import { useState } from 'react';
import { PaperCard } from '@/components/ui/PaperCard';
import { estimateGoalCompletionMonths } from '@/lib/calculations';
import { formatRupiah } from '@/lib/format';
import type { Goal } from '@/lib/types';

interface GoalsCardProps {
  goals: Goal[];
  onAddGoal: (
    goal: Omit<Goal, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>
  ) => Promise<void>;
  onAddGoalProgress: (goalId: string, amount: number) => Promise<void>;
}

export function GoalsCard({ goals, onAddGoal, onAddGoalProgress }: GoalsCardProps) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [plan, setPlan] = useState('');
  const [type, setType] = useState<'tabungan' | 'dana_darurat'>('dana_darurat');
  const [addInputs, setAddInputs] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetAmt = Number.parseInt(target.replace(/\D/g, ''), 10);
    const planAmt = Number.parseInt(plan.replace(/\D/g, ''), 10) || 0;
    if (!name.trim() || !targetAmt) return;
    await onAddGoal({
      name: name.trim(),
      target_amount: targetAmt,
      collected_amount: 0,
      type,
      monthly_saving_plan: planAmt,
    });
    setName('');
    setTarget('');
    setPlan('');
  };

  return (
    <PaperCard>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-obsidian">Target Tabungan & Dana Darurat</h2>
        <span className="text-xs font-medium text-stone-500">{goals.length} target</span>
      </div>

      <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          type="text"
          placeholder="Nama target (Dana Darurat Mini)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-2xl border px-3.5 py-2.5 text-sm"
          required
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'tabungan' | 'dana_darurat')}
          className="rounded-2xl border px-3.5 py-2.5 text-sm"
        >
          <option value="dana_darurat">Dana Darurat</option>
          <option value="tabungan">Tabungan Umum</option>
        </select>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Target nominal (Rp)"
          value={target}
          onChange={(e) => setTarget(e.target.value.replace(/\D/g, ''))}
          className="rounded-2xl border px-3.5 py-2.5 text-sm"
          required
        />
        <input
          type="text"
          inputMode="numeric"
          placeholder="Sisihkan / bulan (Rp)"
          value={plan}
          onChange={(e) => setPlan(e.target.value.replace(/\D/g, ''))}
          className="rounded-2xl border px-3.5 py-2.5 text-sm"
        />
        <button
          type="submit"
          className="sm:col-span-2 rounded-2xl bg-obsidian px-4 py-3 text-sm font-semibold text-white hover:bg-obsidian-soft"
        >
          + Tambah Target
        </button>
      </form>

      {goals.length > 0 && (
        <div className="mt-4 space-y-3">
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.collected_amount / g.target_amount) * 100));
            const estMonths = estimateGoalCompletionMonths(g);
            return (
              <div key={g.id} className="rounded-2xl bg-stone-100/80 p-3.5 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-obsidian">{g.name}</span>
                  <span className="text-xs font-semibold text-obsidian">{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                  <div className="h-full rounded-full bg-obsidian" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-stone-600">
                  Terkumpul {formatRupiah(g.collected_amount)} / {formatRupiah(g.target_amount)}
                  {estMonths !== null
                    ? estMonths === 0
                      ? ' · Tercapai!'
                      : ` · ~${estMonths} bulan lagi`
                    : ''}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Tambah tabungan (Rp)"
                    value={addInputs[g.id] ?? ''}
                    onChange={(e) =>
                      setAddInputs((prev) => ({
                        ...prev,
                        [g.id]: e.target.value.replace(/\D/g, ''),
                      }))
                    }
                    className="flex-1 rounded-xl border bg-white px-3 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const addVal = Number.parseInt(addInputs[g.id] ?? '', 10) || 0;
                      if (addVal > 0) {
                        void onAddGoalProgress(g.id, addVal);
                        setAddInputs((prev) => ({ ...prev, [g.id]: '' }));
                      }
                    }}
                    className="rounded-xl bg-obsidian px-3.5 py-1.5 text-xs font-semibold text-limecard"
                  >
                    + Tabung
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PaperCard>
  );
}
