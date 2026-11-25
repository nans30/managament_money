'use client';

import { useState } from 'react';
import { FolderCard } from '@/components/ui/FolderCard';
import { formatRupiah } from '@/lib/format';
import type { RecurringBill } from '@/lib/types';

interface BillsCardProps {
  recurringBills: RecurringBill[];
  onAddBill: (
    bill: Omit<RecurringBill, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>
  ) => Promise<void>;
  onDeleteBill: (id: string) => Promise<void>;
}

export function BillsCard({ recurringBills, onAddBill, onDeleteBill }: BillsCardProps) {
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDue, setBillDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [billTotalInst, setBillTotalInst] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
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

  return (
    <FolderCard
      title="Tagihan & Cicilan"
      variant="coral"
      shoulder={
        <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] font-medium text-stone-300">
          {recurringBills.length} aktif
        </span>
      }
    >
      <p className="text-xs font-medium text-obsidian/75">
        Kos, listrik, kuota, atau cicilan paylater dengan pengingat jatuh tempo.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
    </FolderCard>
  );
}
