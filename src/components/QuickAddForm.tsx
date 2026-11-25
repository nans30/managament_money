'use client';

import { useEffect, useMemo, useState } from 'react';
import { ZapIcon } from '@/components/Icons';
import { formatRupiah } from '@/lib/format';
import { parseNaturalTransaction } from '@/lib/natural-parser';
import type { Category, IncomeNature, NeedOrWant, Transaction, TransactionType, Wallet } from '@/lib/types';

interface QuickAddFormProps {
  wallets: Wallet[];
  categories: Category[];
  onSave: (
    tx: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>
  ) => Promise<unknown>;
}

function getLocalDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function QuickAddForm({ wallets, categories, onSave }: QuickAddFormProps) {
  const [naturalText, setNaturalText] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [type, setType] = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? '');
  const [toWalletId, setToWalletId] = useState(wallets[1]?.id ?? wallets[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [needOrWant, setNeedOrWant] = useState<NeedOrWant>('perlu');
  const [sourceOrClient, setSourceOrClient] = useState('');
  const [workHoursStr, setWorkHoursStr] = useState('');
  const [incomeNature, setIncomeNature] = useState<IncomeNature>('kerja');
  const [isJobSearchExpense, setIsJobSearchExpense] = useState(false);
  const [note, setNote] = useState('');
  const [dateStr, setDateStr] = useState(() => getLocalDateString());
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!walletId && wallets[0]) setWalletId(wallets[0].id);
    if (!toWalletId && wallets[1]) setToWalletId(wallets[1].id);
    if (!categoryId && categories[0]) setCategoryId(categories[0].id);
  }, [wallets, categories, walletId, toWalletId, categoryId]);

  const parsedPreview = useMemo(() => {
    if (!naturalText.trim()) return null;
    return parseNaturalTransaction(naturalText);
  }, [naturalText]);

  const handleNaturalChange = (val: string) => {
    setNaturalText(val);
    setFeedback(null);
    if (!val.trim()) return;
    const p = parseNaturalTransaction(val);
    setType(p.type);
    if (p.amount) setAmountStr(String(p.amount));
    if (p.needOrWant) setNeedOrWant(p.needOrWant);
    setIncomeNature(p.incomeNature);
    setIsJobSearchExpense(p.isJobSearchExpense);
    setNote(p.note);
    setSourceOrClient(p.sourceOrClient ?? '');
    setWorkHoursStr(p.workHours ? String(p.workHours) : '');

    if (p.guessedWalletName) {
      const matchedWallet = wallets.find(
        (w) => w.name.toLowerCase() === p.guessedWalletName?.toLowerCase()
      );
      if (matchedWallet) setWalletId(matchedWallet.id);
    }
    if (p.guessedToWalletName) {
      const matchedTo = wallets.find(
        (w) => w.name.toLowerCase() === p.guessedToWalletName?.toLowerCase()
      );
      if (matchedTo) setToWalletId(matchedTo.id);
    }
    if (p.guessedCategoryName) {
      const matchedCat = categories.find(
        (c) => c.name.toLowerCase() === p.guessedCategoryName?.toLowerCase()
      );
      if (matchedCat) setCategoryId(matchedCat.id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number.parseInt(amountStr.replace(/\D/g, ''), 10);
    if (!amount || amount <= 0 || !walletId) {
      setShowDetails(true);
      setFeedback('Masukkan nominal Rupiah dulu (contoh: "makan 25rb").');
      return;
    }
    if (type === 'transfer' && walletId === toWalletId) {
      setShowDetails(true);
      setFeedback('Dompet asal dan tujuan transfer perlu berbeda.');
      return;
    }

    setSaving(true);
    setFeedback(null);

    const parsedHours = workHoursStr ? Number.parseFloat(workHoursStr.replace(',', '.')) : null;
    const nowTime = new Date();
    const [yearStr, monthStr, dayStr] = dateStr.split('-');
    const localDate = new Date(
      Number(yearStr) || nowTime.getFullYear(),
      (Number(monthStr) || nowTime.getMonth() + 1) - 1,
      Number(dayStr) || nowTime.getDate(),
      nowTime.getHours(),
      nowTime.getMinutes(),
      nowTime.getSeconds()
    );

    await onSave({
      type,
      amount,
      wallet_id: walletId,
      to_wallet_id: type === 'transfer' ? toWalletId : null,
      category_id: type === 'expense' ? categoryId || null : null,
      source_or_client: type === 'income' ? sourceOrClient.trim() || 'Pemasukan' : null,
      need_or_want: type === 'expense' ? needOrWant : null,
      work_hours: type === 'income' && parsedHours && parsedHours > 0 ? parsedHours : null,
      income_nature: type === 'income' ? incomeNature : 'kerja',
      is_job_search_expense: type === 'expense' ? isJobSearchExpense : false,
      note: note.trim() || naturalText.trim() || '-',
      date: localDate.toISOString(),
    });

    setNaturalText('');
    setAmountStr('');
    setSourceOrClient('');
    setWorkHoursStr('');
    setNote('');
    setIsJobSearchExpense(false);
    setSaving(false);
    setFeedback(`Tersimpan · ${formatRupiah(amount)}`);
  };

  const activeWalletName = wallets.find((w) => w.id === walletId)?.name ?? 'Dompet';
  const activeCatName = categories.find((c) => c.id === categoryId)?.name ?? 'Kategori';
  const typeLabel = type === 'income' ? 'Masuk' : type === 'transfer' ? 'Transfer' : 'Keluar';

  return (
    <section className="rounded-2xl bg-white p-4 border border-stone-200/80 dark:border-stone-800">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Baris Utama Minimalis: Ketik Natural + Simpan */}
        <div className="flex gap-2">
          <label htmlFor="natural-input" className="sr-only">
            Catat cepat transaksi
          </label>
          <input
            id="natural-input"
            type="text"
            value={naturalText}
            onChange={(e) => handleNaturalChange(e.target.value)}
            placeholder='Catat cepat: "makan 25rb", "ngojek 85rb 5jam"...'
            className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            <ZapIcon className="h-4 w-4" />
            <span>{saving ? '...' : 'Simpan'}</span>
          </button>
        </div>

        {/* Ringkasan Tebakan + Tombol Toggle Detail */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="truncate text-stone-500">
            {parsedPreview && parsedPreview.amount ? (
              <span className="text-brand-600 font-medium">
                {typeLabel} · {formatRupiah(parsedPreview.amount)} ·{' '}
                {type === 'expense' ? activeCatName : activeWalletName}
                {parsedPreview.workHours ? ` · ${parsedPreview.workHours}j` : ''}
              </span>
            ) : feedback ? (
              <span className="text-brand-600 font-medium">{feedback}</span>
            ) : (
              <span>Otomatis tebak nominal & kategori</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="shrink-0 px-2 py-1 text-xs font-medium text-stone-500 hover:text-stone-900"
          >
            {showDetails ? 'Tutup detail' : 'Atur detail'}
          </button>
        </div>

        {/* Panel Detail Manual (Tersembunyi secara default agar layar tetap lega) */}
        {showDetails && (
          <div className="space-y-3 border-t border-stone-100 pt-3">
            <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-stone-100 p-1">
              {(
                [
                  { id: 'expense', label: 'Keluar' },
                  { id: 'income', label: 'Masuk' },
                  { id: 'transfer', label: 'Transfer' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setType(tab.id)}
                  className={`rounded-lg py-1.5 text-xs font-medium transition ${
                    type === tab.id
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] text-stone-500">Nominal (Rp)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value.replace(/\D/g, ''))}
                  placeholder="25000"
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm font-semibold"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-stone-500">Tanggal</span>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] text-stone-500">
                  {type === 'transfer' ? 'Dari Dompet' : 'Dompet'}
                </span>
                <select
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>

              {type === 'transfer' ? (
                <label className="block">
                  <span className="text-[11px] text-stone-500">Ke Dompet</span>
                  <select
                    value={toWalletId}
                    onChange={(e) => setToWalletId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : type === 'expense' ? (
                <label className="block">
                  <span className="text-[11px] text-stone-500">Kategori</span>
                  <select
                    value={categoryId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setCategoryId(nextId);
                      const found = categories.find((c) => c.id === nextId);
                      if (found) setIsJobSearchExpense(found.is_job_search);
                    }}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="block">
                  <span className="text-[11px] text-stone-500">Jenis Pemasukan</span>
                  <select
                    value={incomeNature}
                    onChange={(e) => setIncomeNature(e.target.value as IncomeNature)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="kerja">Hasil Kerja / Klien</option>
                    <option value="non_kerja">Non-Kerja (Bansos/Kiriman)</option>
                  </select>
                </label>
              )}
            </div>

            {type === 'expense' && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNeedOrWant('perlu')}
                    className={`rounded-lg px-3 py-1 text-xs font-medium border ${
                      needOrWant === 'perlu'
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-stone-200 text-stone-500'
                    }`}
                  >
                    Perlu
                  </button>
                  <button
                    type="button"
                    onClick={() => setNeedOrWant('pengen')}
                    className={`rounded-lg px-3 py-1 text-xs font-medium border ${
                      needOrWant === 'pengen'
                        ? 'border-warm-500 bg-warm-50 text-warm-700'
                        : 'border-stone-200 text-stone-500'
                    }`}
                  >
                    Pengen
                  </button>
                </div>

                <label className="flex items-center gap-2 text-xs text-stone-600">
                  <input
                    type="checkbox"
                    checked={isJobSearchExpense}
                    onChange={(e) => setIsJobSearchExpense(e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300"
                  />
                  Modal cari kerja
                </label>
              </div>
            )}

            {type === 'income' && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={sourceOrClient}
                  onChange={(e) => setSourceOrClient(e.target.value)}
                  placeholder="Sumber / Klien"
                  className="rounded-xl border border-stone-200 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={workHoursStr}
                  onChange={(e) => setWorkHoursStr(e.target.value)}
                  placeholder="Jam kerja (opsional)"
                  className="rounded-xl border border-stone-200 px-3 py-2 text-sm"
                />
              </div>
            )}

            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan tambahan (opsional)"
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
            />
          </div>
        )}
      </form>
    </section>
  );
}
