'use client';

import { useState } from 'react';
import { calculateDebtSummary, estimateGoalCompletionMonths } from '@/lib/calculations';
import { formatRupiah } from '@/lib/format';
import type { Debt, DebtCategory, Goal, RecurringBill } from '@/lib/types';

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
  // State Tagihan Berulang / Cicilan
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDue, setBillDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [billTotalInst, setBillTotalInst] = useState('');

  // State Utang / Piutang
  const [debtDirection, setDebtDirection] = useState<'utang' | 'piutang'>('utang');
  const [debtParty, setDebtParty] = useState('');
  const [debtCat, setDebtCat] = useState<DebtCategory>('warung');
  const [debtAmount, setDebtAmount] = useState('');
  const [partialInputs, setPartialInputs] = useState<Record<string, string>>({});

  // State Target Tabungan / Dana Darurat
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalPlan, setGoalPlan] = useState('');
  const [goalType, setGoalType] = useState<'tabungan' | 'dana_darurat'>('dana_darurat');
  const [goalAddInputs, setGoalAddInputs] = useState<Record<string, string>>({});

  const debtSummary = calculateDebtSummary(debts);

  const handleBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number.parseInt(billAmount.replace(/\D/g, ''), 10);
    if (!billName.trim() || !amt) return;
    const totalInst = billTotalInst ? Number.parseInt(billTotalInst, 10) : null;
    await onAddBill({
      name: billName.trim(),
      amount: amt,
      schedule: 'monthly',
      next_due_date: new Date(`${billDue}T12:00:00.000Z`).toISOString(),
      current_installment: 1,
      total_installments: totalInst && totalInst > 0 ? totalInst : null,
    });
    setBillName('');
    setBillAmount('');
    setBillTotalInst('');
  };

  const handleDebtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number.parseInt(debtAmount.replace(/\D/g, ''), 10);
    if (!debtParty.trim() || !amt) return;
    await onAddDebt({
      direction: debtDirection,
      counterparty: debtParty.trim(),
      category: debtCat,
      amount: amt,
      paid_amount: 0,
      due_date: null,
      status: 'belum_lunas',
      note: '',
    });
    setDebtParty('');
    setDebtAmount('');
  };

  const handleGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number.parseInt(goalTarget.replace(/\D/g, ''), 10);
    const plan = Number.parseInt(goalPlan.replace(/\D/g, ''), 10) || 0;
    if (!goalName.trim() || !target) return;
    await onAddGoal({
      name: goalName.trim(),
      target_amount: target,
      collected_amount: 0,
      type: goalType,
      monthly_saving_plan: plan,
    });
    setGoalName('');
    setGoalTarget('');
    setGoalPlan('');
  };

  return (
    <div className="space-y-5">
      {/* 1. TAGIHAN BERULANG & CICILAN / PAYLATER */}
      <section className="surface-paper rounded-[28px] p-5 shadow-sm">
        <h2 className="text-base font-bold text-stone-900">Tagihan Berulang & Cicilan / Paylater</h2>
        <form onSubmit={handleBillSubmit} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Nama tagihan (Kos / Listrik / Paylater)"
            value={billName}
            onChange={(e) => setBillName(e.target.value)}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
            required
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="Nominal (Rp)"
            value={billAmount}
            onChange={(e) => setBillAmount(e.target.value.replace(/\D/g, ''))}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
            required
          />
          <input
            type="date"
            value={billDue}
            onChange={(e) => setBillDue(e.target.value)}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={1}
            placeholder="Total cicilan (kosongkan jika rutin)"
            value={billTotalInst}
            onChange={(e) => setBillTotalInst(e.target.value)}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="sm:col-span-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
          >
            + Tambah Tagihan
          </button>
        </form>

        <ul className="mt-3 space-y-2">
          {recurringBills.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between rounded-xl border border-stone-200 p-3 text-sm"
            >
              <div>
                <p className="font-semibold text-stone-900">
                  {b.name}
                  {b.total_installments ? ` (${b.current_installment}/${b.total_installments})` : ''}
                </p>
                <p className="text-xs text-stone-500">
                  {formatRupiah(b.amount)} · Jatuh tempo {b.next_due_date.slice(0, 10)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onDeleteBill(b.id)}
                className="rounded-lg border border-stone-200 px-3 py-1 text-xs text-stone-600"
              >
                Hapus
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* 2. CATATAN UTANG & PIUTANG (TERMASUK UTANG WARUNG / INFORMAL) */}
      <section className="surface-paper rounded-[28px] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-stone-900">Utang & Piutang (Termasuk Warung/Teman)</h2>
          <span className="text-xs text-stone-600">
            Sisa Utang: <strong>{formatRupiah(debtSummary.totalUtangRemaining)}</strong> · Piutang:{' '}
            <strong>{formatRupiah(debtSummary.totalPiutangRemaining)}</strong>
          </span>
        </div>

        <form onSubmit={handleDebtSubmit} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            value={debtDirection}
            onChange={(e) => setDebtDirection(e.target.value as 'utang' | 'piutang')}
            className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
          >
            <option value="utang">Saya Berutang</option>
            <option value="piutang">Orang Lain Berutang (Piutang)</option>
          </select>
          <select
            value={debtCat}
            onChange={(e) => setDebtCat(e.target.value as DebtCategory)}
            className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
          >
            <option value="warung">Warung</option>
            <option value="teman">Teman</option>
            <option value="keluarga">Keluarga</option>
            <option value="lainnya">Lainnya</option>
          </select>
          <input
            type="text"
            placeholder="Nama pihak (contoh: Warung Bu Siti)"
            value={debtParty}
            onChange={(e) => setDebtParty(e.target.value)}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
            required
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="Nominal (Rp)"
            value={debtAmount}
            onChange={(e) => setDebtAmount(e.target.value.replace(/\D/g, ''))}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            className="sm:col-span-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
          >
            + Catat Utang / Piutang
          </button>
        </form>

        <div className="mt-3 space-y-2">
          {debts.map((d) => {
            const remaining = Math.max(0, d.amount - d.paid_amount);
            return (
              <div key={d.id} className="rounded-xl border border-stone-200 p-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-stone-900">
                      {d.direction === 'utang' ? 'Utang ke ' : 'Piutang dari '}
                      {d.counterparty}{' '}
                      <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-600">
                        {d.category}
                      </span>
                    </p>
                    <p className="text-xs text-stone-500">
                      Terbayar {formatRupiah(d.paid_amount)} / {formatRupiah(d.amount)} · Sisa{' '}
                      <strong>{formatRupiah(remaining)}</strong>
                    </p>
                  </div>
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
                    {d.status.replace('_', ' ')}
                  </span>
                </div>

                {d.status !== 'lunas' && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Nominal cicil/bayar..."
                      value={partialInputs[d.id] ?? ''}
                      onChange={(e) =>
                        setPartialInputs((prev) => ({
                          ...prev,
                          [d.id]: e.target.value.replace(/\D/g, ''),
                        }))
                      }
                      className="flex-1 rounded-xl border border-stone-300 px-3 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const pay = Number.parseInt(partialInputs[d.id] ?? '', 10) || remaining;
                        void onPayDebt(d.id, pay);
                        setPartialInputs((prev) => ({ ...prev, [d.id]: '' }));
                      }}
                      className="rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Bayar Sebagian / Lunas
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. TARGET TABUNGAN & DANA DARURAT */}
      <section className="surface-paper rounded-[28px] p-5 shadow-sm">
        <h2 className="text-base font-bold text-stone-900">Target Tabungan & Dana Darurat</h2>
        <form onSubmit={handleGoalSubmit} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Nama target (Dana Darurat Mini / Laptop)"
            value={goalName}
            onChange={(e) => setGoalName(e.target.value)}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
            required
          />
          <select
            value={goalType}
            onChange={(e) => setGoalType(e.target.value as 'tabungan' | 'dana_darurat')}
            className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
          >
            <option value="dana_darurat">Dana Darurat</option>
            <option value="tabungan">Tabungan Umum</option>
          </select>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Target nominal (Rp)"
            value={goalTarget}
            onChange={(e) => setGoalTarget(e.target.value.replace(/\D/g, ''))}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
            required
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="Rencana sisihkan / bulan (Rp)"
            value={goalPlan}
            onChange={(e) => setGoalPlan(e.target.value.replace(/\D/g, ''))}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="sm:col-span-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
          >
            + Tambah Target
          </button>
        </form>

        <div className="mt-3 space-y-3">
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.collected_amount / g.target_amount) * 100));
            const estMonths = estimateGoalCompletionMonths(g);
            return (
              <div key={g.id} className="rounded-xl border border-stone-200 p-3 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-stone-900">{g.name}</span>
                  <span className="text-xs font-semibold text-brand-600">{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-stone-500">
                  Terkumpul {formatRupiah(g.collected_amount)} dari {formatRupiah(g.target_amount)}
                  {estMonths !== null
                    ? estMonths === 0
                      ? ' · Target tercapai!'
                      : ` · Estimasi tercapai dalam ~${estMonths} bulan`
                    : ''}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Tambah tabungan (Rp)"
                    value={goalAddInputs[g.id] ?? ''}
                    onChange={(e) =>
                      setGoalAddInputs((prev) => ({
                        ...prev,
                        [g.id]: e.target.value.replace(/\D/g, ''),
                      }))
                    }
                    className="flex-1 rounded-xl border border-stone-300 px-3 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const addVal = Number.parseInt(goalAddInputs[g.id] ?? '', 10) || 0;
                      if (addVal > 0) {
                        void onAddGoalProgress(g.id, addVal);
                        setGoalAddInputs((prev) => ({ ...prev, [g.id]: '' }));
                      }
                    }}
                    className="rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    + Tabung
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
