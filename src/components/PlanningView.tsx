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
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDue, setBillDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [billTotalInst, setBillTotalInst] = useState('');

  const [debtDirection, setDebtDirection] = useState<'utang' | 'piutang'>('utang');
  const [debtParty, setDebtParty] = useState('');
  const [debtCat, setDebtCat] = useState<DebtCategory>('warung');
  const [debtAmount, setDebtAmount] = useState('');
  const [partialInputs, setPartialInputs] = useState<Record<string, string>>({});

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
      {/* 1. TAGIHAN BERULANG & CICILAN (Coral Folder-Tab Card) */}
      <section className="overflow-hidden rounded-[28px] bg-obsidian-muted shadow-sm">
        <div className="flex items-stretch">
          <div className="rounded-tr-[22px] bg-coral px-5 pt-3.5 pb-1.5 text-xs font-semibold text-obsidian">
            Tagihan & Cicilan
          </div>
          <div className="flex flex-1 items-center justify-end px-4 py-2">
            <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] font-medium text-stone-300">
              {recurringBills.length} aktif
            </span>
          </div>
        </div>

        <div className="rounded-tr-[24px] bg-coral px-5 pt-3 pb-5 text-obsidian">
          <p className="text-xs font-medium text-obsidian/75">
            Kos, listrik, kuota, atau cicilan paylater dengan pengingat jatuh tempo.
          </p>
          <form onSubmit={handleBillSubmit} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Nama tagihan (Kos / Listrik)"
              value={billName}
              onChange={(e) => setBillName(e.target.value)}
              className="rounded-2xl border-0 bg-white/85 px-3.5 py-2.5 text-sm text-obsidian placeholder:text-stone-500"
              required
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="Nominal (Rp)"
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value.replace(/\D/g, ''))}
              className="rounded-2xl border-0 bg-white/85 px-3.5 py-2.5 text-sm text-obsidian placeholder:text-stone-500"
              required
            />
            <input
              type="date"
              value={billDue}
              onChange={(e) => setBillDue(e.target.value)}
              className="rounded-2xl border-0 bg-white/85 px-3.5 py-2.5 text-sm text-obsidian [color-scheme:light]"
            />
            <input
              type="number"
              min={1}
              placeholder="Total cicilan (opsional)"
              value={billTotalInst}
              onChange={(e) => setBillTotalInst(e.target.value)}
              className="rounded-2xl border-0 bg-white/85 px-3.5 py-2.5 text-sm text-obsidian placeholder:text-stone-500"
            />
            <button
              type="submit"
              className="sm:col-span-2 rounded-2xl bg-obsidian px-4 py-3 text-sm font-semibold text-white hover:bg-obsidian-soft"
            >
              + Tambah Tagihan
            </button>
          </form>

          {recurringBills.length > 0 && (
            <ul className="mt-3 space-y-2">
              {recurringBills.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between rounded-2xl bg-white/85 px-3.5 py-2.5 text-sm text-obsidian"
                >
                  <div>
                    <p className="font-semibold">
                      {b.name}
                      {b.total_installments ? ` (${b.current_installment}/${b.total_installments})` : ''}
                    </p>
                    <p className="text-xs text-stone-600">
                      {formatRupiah(b.amount)} · Jatuh tempo {b.next_due_date.slice(0, 10)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onDeleteBill(b.id)}
                    className="rounded-full bg-obsidian/10 px-3 py-1 text-xs font-semibold text-obsidian hover:bg-obsidian/20"
                  >
                    Hapus
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 2. UTANG & PIUTANG (Acid Lime Folder-Tab Card) */}
      <section className="overflow-hidden rounded-[28px] bg-obsidian-muted shadow-sm">
        <div className="flex items-stretch">
          <div className="rounded-tr-[22px] bg-limecard px-5 pt-3.5 pb-1.5 text-xs font-semibold text-obsidian">
            Utang & Piutang
          </div>
          <div className="flex flex-1 items-center justify-end px-4 py-2">
            <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] font-medium text-stone-300">
              Utang {formatRupiah(debtSummary.totalUtangRemaining)}
            </span>
          </div>
        </div>

        <div className="rounded-tr-[24px] bg-limecard px-5 pt-3 pb-5 text-obsidian">
          <p className="text-xs font-medium text-obsidian/75">
            Catat utang warung, teman, atau keluarga. Mendukung pelunasan sebagian.
          </p>

          <form onSubmit={handleDebtSubmit} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select
              value={debtDirection}
              onChange={(e) => setDebtDirection(e.target.value as 'utang' | 'piutang')}
              className="rounded-2xl border-0 bg-white/85 px-3.5 py-2.5 text-sm text-obsidian [color-scheme:light]"
            >
              <option value="utang">Saya Berutang</option>
              <option value="piutang">Piutang (Orang Berutang)</option>
            </select>
            <select
              value={debtCat}
              onChange={(e) => setDebtCat(e.target.value as DebtCategory)}
              className="rounded-2xl border-0 bg-white/85 px-3.5 py-2.5 text-sm text-obsidian [color-scheme:light]"
            >
              <option value="warung">Warung</option>
              <option value="teman">Teman</option>
              <option value="keluarga">Keluarga</option>
              <option value="lainnya">Lainnya</option>
            </select>
            <input
              type="text"
              placeholder="Nama pihak (Warung Bu Siti)"
              value={debtParty}
              onChange={(e) => setDebtParty(e.target.value)}
              className="rounded-2xl border-0 bg-white/85 px-3.5 py-2.5 text-sm text-obsidian placeholder:text-stone-500"
              required
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="Nominal (Rp)"
              value={debtAmount}
              onChange={(e) => setDebtAmount(e.target.value.replace(/\D/g, ''))}
              className="rounded-2xl border-0 bg-white/85 px-3.5 py-2.5 text-sm text-obsidian placeholder:text-stone-500"
              required
            />
            <button
              type="submit"
              className="sm:col-span-2 rounded-2xl bg-obsidian px-4 py-3 text-sm font-semibold text-white hover:bg-obsidian-soft"
            >
              + Catat Utang / Piutang
            </button>
          </form>

          {debts.length > 0 && (
            <div className="mt-3 space-y-2">
              {debts.map((d) => {
                const remaining = Math.max(0, d.amount - d.paid_amount);
                return (
                  <div key={d.id} className="rounded-2xl bg-white/85 p-3.5 text-sm text-obsidian space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {d.direction === 'utang' ? 'Utang ke ' : 'Piutang dari '}
                          {d.counterparty}
                        </p>
                        <p className="text-xs text-stone-600">
                          Terbayar {formatRupiah(d.paid_amount)} / {formatRupiah(d.amount)} · Sisa{' '}
                          <strong>{formatRupiah(remaining)}</strong>
                        </p>
                      </div>
                      <span className="rounded-full bg-obsidian px-2.5 py-1 text-[10px] font-semibold text-limecard">
                        {d.status.replace('_', ' ')}
                      </span>
                    </div>

                    {d.status !== 'lunas' && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Nominal bayar..."
                          value={partialInputs[d.id] ?? ''}
                          onChange={(e) =>
                            setPartialInputs((prev) => ({
                              ...prev,
                              [d.id]: e.target.value.replace(/\D/g, ''),
                            }))
                          }
                          className="flex-1 rounded-xl border border-obsidian/15 bg-white px-3 py-1.5 text-sm text-obsidian"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const pay = Number.parseInt(partialInputs[d.id] ?? '', 10) || remaining;
                            void onPayDebt(d.id, pay);
                            setPartialInputs((prev) => ({ ...prev, [d.id]: '' }));
                          }}
                          className="rounded-xl bg-obsidian px-3.5 py-1.5 text-xs font-semibold text-white"
                        >
                          Bayar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 3. TARGET TABUNGAN & DANA DARURAT (Kartu Putih Bersih) */}
      <section className="surface-paper rounded-[28px] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-obsidian">Target Tabungan & Dana Darurat</h2>
          <span className="text-xs font-medium text-stone-500">{goals.length} target</span>
        </div>

        <form onSubmit={handleGoalSubmit} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Nama target (Dana Darurat Mini)"
            value={goalName}
            onChange={(e) => setGoalName(e.target.value)}
            className="rounded-2xl border px-3.5 py-2.5 text-sm"
            required
          />
          <select
            value={goalType}
            onChange={(e) => setGoalType(e.target.value as 'tabungan' | 'dana_darurat')}
            className="rounded-2xl border px-3.5 py-2.5 text-sm"
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
            className="rounded-2xl border px-3.5 py-2.5 text-sm"
            required
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="Sisihkan / bulan (Rp)"
            value={goalPlan}
            onChange={(e) => setGoalPlan(e.target.value.replace(/\D/g, ''))}
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
                      value={goalAddInputs[g.id] ?? ''}
                      onChange={(e) =>
                        setGoalAddInputs((prev) => ({
                          ...prev,
                          [g.id]: e.target.value.replace(/\D/g, ''),
                        }))
                      }
                      className="flex-1 rounded-xl border bg-white px-3 py-1.5 text-sm"
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
      </section>
    </div>
  );
}
