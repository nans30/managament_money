'use client';

import { useState } from 'react';
import { FolderCard } from '@/components/ui/FolderCard';
import { calculateDebtSummary } from '@/lib/calculations';
import { formatRupiah } from '@/lib/format';
import type { Debt, DebtCategory } from '@/lib/types';

interface DebtsCardProps {
  debts: Debt[];
  onAddDebt: (
    debt: Omit<Debt, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>
  ) => Promise<void>;
  onPayDebt: (debtId: string, amount: number) => Promise<void>;
}

export function DebtsCard({ debts, onAddDebt, onPayDebt }: DebtsCardProps) {
  const [direction, setDirection] = useState<'utang' | 'piutang'>('utang');
  const [party, setParty] = useState('');
  const [category, setCategory] = useState<DebtCategory>('warung');
  const [amount, setAmount] = useState('');
  const [partialInputs, setPartialInputs] = useState<Record<string, string>>({});

  const debtSummary = calculateDebtSummary(debts);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number.parseInt(amount.replace(/\D/g, ''), 10);
    if (!party.trim() || !amt) return;
    await onAddDebt({
      direction,
      counterparty: party.trim(),
      category,
      amount: amt,
      paid_amount: 0,
      due_date: null,
      status: 'belum_lunas',
      note: '',
    });
    setParty('');
    setAmount('');
  };

  return (
    <FolderCard
      title="Utang & Piutang"
      variant="lime"
      shoulder={
        <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] font-medium text-stone-300">
          Utang {formatRupiah(debtSummary.totalUtangRemaining)}
        </span>
      }
    >
      <p className="text-xs font-medium text-obsidian/75">
        Catat utang warung, teman, atau keluarga. Mendukung pelunasan sebagian.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as 'utang' | 'piutang')}
          className="rounded-2xl border-0 bg-white/85 px-3.5 py-2.5 text-sm text-obsidian [color-scheme:light]"
        >
          <option value="utang">Saya Berutang</option>
          <option value="piutang">Piutang (Orang Berutang)</option>
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as DebtCategory)}
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
          value={party}
          onChange={(e) => setParty(e.target.value)}
          className="rounded-2xl border-0 bg-white/85 px-3.5 py-2.5 text-sm text-obsidian placeholder:text-stone-500"
          required
        />
        <input
          type="text"
          inputMode="numeric"
          placeholder="Nominal (Rp)"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
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
    </FolderCard>
  );
}
