'use client';

import { useEffect, useMemo, useState } from 'react';
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

export function QuickAddForm({ wallets, categories, onSave }: QuickAddFormProps) {
  const [naturalText, setNaturalText] = useState('');
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
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().slice(0, 10));
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

  // Otomatis isi field saat user mengetik kalimat natural, tapi user tetap bisa mengoreksi manual
  const handleNaturalChange = (val: string) => {
    setNaturalText(val);
    if (!val.trim()) return;
    const p = parseNaturalTransaction(val);
    setType(p.type);
    if (p.amount) setAmountStr(String(p.amount));
    if (p.needOrWant) setNeedOrWant(p.needOrWant);
    setIncomeNature(p.incomeNature);
    setIsJobSearchExpense(p.isJobSearchExpense);
    setNote(p.note);
    if (p.sourceOrClient) setSourceOrClient(p.sourceOrClient);
    if (p.workHours) setWorkHoursStr(String(p.workHours));

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
      setFeedback('Masukkan nominal Rupiah yang valid dulu ya.');
      return;
    }
    if (type === 'transfer' && walletId === toWalletId) {
      setFeedback('Dompet asal dan tujuan transfer perlu berbeda.');
      return;
    }

    setSaving(true);
    setFeedback(null);

    const parsedHours = workHoursStr ? Number.parseFloat(workHoursStr.replace(',', '.')) : null;
    const isoDate = new Date(`${dateStr}T${new Date().toISOString().slice(11)}`).toISOString();

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
      date: isoDate,
    });

    setNaturalText('');
    setAmountStr('');
    setSourceOrClient('');
    setWorkHoursStr('');
    setNote('');
    setIsJobSearchExpense(false);
    setSaving(false);
    setFeedback(`Tersimpan (${formatRupiah(amount)}).`);
  };

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm border border-stone-200">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-stone-900">Catat Cepat</h2>
        <span className="text-xs text-stone-500">Target &lt; 5 detik</span>
      </div>

      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        {/* Input Bahasa Natural */}
        <div>
          <label htmlFor="natural-input" className="sr-only">
            Ketik transaksi dalam bahasa natural
          </label>
          <input
            id="natural-input"
            type="text"
            value={naturalText}
            onChange={(e) => handleNaturalChange(e.target.value)}
            placeholder='Ketik cepat: "makan siang 25rb", "ngojek 85rb 5jam", "transfer ke gopay 100rb"'
            className="w-full rounded-xl border border-brand-500/40 bg-brand-50/40 px-3 py-3 text-base text-stone-900 placeholder:text-stone-500 focus:border-brand-500 focus:outline-none"
          />
          {parsedPreview && parsedPreview.amount && (
            <p className="mt-1 text-xs text-brand-600">
              Tebakan: <strong>{parsedPreview.type}</strong> · {formatRupiah(parsedPreview.amount)}
              {parsedPreview.guessedCategoryName ? ` · ${parsedPreview.guessedCategoryName}` : ''}
              {parsedPreview.workHours ? ` · ${parsedPreview.workHours} jam` : ''} (bisa dikoreksi di bawah)
            </p>
          )}
        </div>

        {/* Pilihan Tipe Transaksi */}
        <div className="grid grid-cols-3 gap-2">
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
              className={`rounded-xl px-3 py-2 text-sm font-semibold border ${
                type === tab.id
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-stone-200 bg-stone-50 text-stone-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Nominal & Tanggal */}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs font-medium text-stone-600">Nominal (Rp)</span>
            <input
              type="text"
              inputMode="numeric"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value.replace(/\D/g, ''))}
              placeholder="25000"
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-base font-semibold"
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-stone-600">Tanggal</span>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        {/* Dompet & Kategori / Dompet Tujuan */}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs font-medium text-stone-600">
              {type === 'transfer' ? 'Dari Dompet' : 'Dompet'}
            </span>
            <select
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
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
              <span className="text-xs font-medium text-stone-600">Ke Dompet</span>
              <select
                value={toWalletId}
                onChange={(e) => setToWalletId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
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
              <span className="text-xs font-medium text-stone-600">Kategori</span>
              <select
                value={categoryId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setCategoryId(nextId);
                  const found = categories.find((c) => c.id === nextId);
                  if (found) setIsJobSearchExpense(found.is_job_search);
                }}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
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
              <span className="text-xs font-medium text-stone-600">Jenis Pemasukan</span>
              <select
                value={incomeNature}
                onChange={(e) => setIncomeNature(e.target.value as IncomeNature)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
              >
                <option value="kerja">Hasil Kerja / Klien</option>
                <option value="non_kerja">Non-Kerja (Bansos/Kiriman/Prakerja)</option>
              </select>
            </label>
          )}
        </div>

        {/* Field Tambahan Pengeluaran: Perlu vs Pengen + Modal Cari Kerja */}
        {type === 'expense' && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNeedOrWant('perlu')}
                className={`rounded-lg px-3 py-1 text-xs font-semibold border ${
                  needOrWant === 'perlu'
                    ? 'border-brand-500 bg-brand-100 text-brand-700'
                    : 'border-stone-200 text-stone-600'
                }`}
              >
                Perlu
              </button>
              <button
                type="button"
                onClick={() => setNeedOrWant('pengen')}
                className={`rounded-lg px-3 py-1 text-xs font-semibold border ${
                  needOrWant === 'pengen'
                    ? 'border-warm-500 bg-warm-100 text-warm-700'
                    : 'border-stone-200 text-stone-600'
                }`}
              >
                Pengen
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs text-stone-700">
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

        {/* Field Tambahan Pemasukan: Sumber/Klien & Jam Kerja */}
        {type === 'income' && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-medium text-stone-600">Sumber / Jenis Kerja / Klien</span>
              <input
                type="text"
                value={sourceOrClient}
                onChange={(e) => setSourceOrClient(e.target.value)}
                placeholder="Ngojek / PT Maju"
                className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-stone-600">Lama Kerja (Jam, opsional)</span>
              <input
                type="text"
                inputMode="decimal"
                value={workHoursStr}
                onChange={(e) => setWorkHoursStr(e.target.value)}
                placeholder="Contoh: 5"
                className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        )}

        {/* Catatan Singkat */}
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan tambahan (opsional)"
          className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
        />

        {feedback && <p className="text-sm font-medium text-brand-600">{feedback}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-brand-500 px-4 py-3 text-base font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
        </button>
      </form>
    </section>
  );
}
