'use client';

import { PaperCard } from '@/components/ui/PaperCard';
import { formatRupiah } from '@/lib/format';
import type { Category, Transaction, Wallet } from '@/lib/types';

interface TransactionListProps {
  transactions: Transaction[];
  wallets: Wallet[];
  categories: Category[];
  onDelete: (id: string) => Promise<void>;
}

export function TransactionList({
  transactions,
  wallets,
  categories,
  onDelete,
}: TransactionListProps) {
  const walletById = new Map(wallets.map((w) => [w.id, w.name]));
  const categoryById = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <PaperCard>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-obsidian">Semua Transaksi</h2>
        <span className="text-xs font-medium text-stone-500">{transactions.length} catatan</span>
      </div>

      {transactions.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">
          Belum ada transaksi tercatat. Mulai catat lewat kartu Catat Cepat di Beranda.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-stone-100">
          {transactions.map((tx) => (
            <li key={tx.id} className="flex items-center justify-between gap-2 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold text-obsidian">{tx.note}</p>
                <p className="text-xs text-stone-500">
                  {tx.date.slice(0, 10)} · {walletById.get(tx.wallet_id) ?? 'Dompet'}
                  {tx.type === 'transfer' && tx.to_wallet_id
                    ? ` → ${walletById.get(tx.to_wallet_id) ?? 'Dompet'}`
                    : ''}
                  {tx.category_id ? ` · ${categoryById.get(tx.category_id) ?? ''}` : ''}
                  {tx.need_or_want ? ` · ${tx.need_or_want}` : ''}
                  {tx.work_hours ? ` · ${tx.work_hours} jam` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`font-semibold ${
                    tx.type === 'income'
                      ? 'text-brand-600'
                      : tx.type === 'transfer'
                        ? 'text-stone-500'
                        : 'text-obsidian'
                  }`}
                >
                  {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                  {formatRupiah(tx.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => void onDelete(tx.id)}
                  aria-label={`Hapus transaksi ${tx.note}`}
                  className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-200"
                >
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PaperCard>
  );
}
