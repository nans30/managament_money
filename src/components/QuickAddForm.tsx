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
      setFeedback('Masukkan nominal dulu (contoh: "makan 25rb").');
      return;
    }
    if (type === 'transfer' && walletId === toWalletId) {
      setShowDetails(true);
      setFeedback('Dompet asal & tujuan transfer perlu berbeda.');
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
    <section className="overflow-hidden rounded-[28px] bg-obsidian-muted shadow-sm">
      {/* Baris Folder-Tab khas referensi: tab lime di kiri + bahu gelap di kanan */}
      <div className="flex items-stretch">
        <div className="flex items-center gap-2 rounded-tr-[22px] bg-limecard px-5 pt-3.5 pb-1.5 text-xs font-semibold text-obsidian">
          <ZapIcon className="h-3.5 w-3.5" />
          <span>Catat cepat</span>
        </div>
        <div className="flex flex-1 items-center justify-end gap-2 px-4 py-2">
          <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] font-medium text-stone-300">
            &lt; 5 dtk
          </span>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="min-h-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/20"
          >
            {showDetails ? 'Tutup' : 'Detail'}
          </button>
        </div>
      </div>

      {/* Isi Kartu Acid Lime */}
      <form onSubmit={handleSubmit} className="rounded-tr-[24px] bg-limecard px-5 pt-3 pb-5 text-obsidian space-y-3">
        <div>
          <label htmlFor="natural-input" className="sr-only">
            Ketik transaksi dalam bahasa natural
          </label>
          <input
            id="natural-input"
            type="text"
            value={naturalText}
            onChange={(e) => handleNaturalChange(e.target.value)}
            placeholder='Ketik: "makan 25rb", "ngojek 85rb 5jam"...'
            className="w-full rounded-2xl border-0 bg-white/85 px-4 py-3 text-sm font-medium text-obsidian placeholder:text-stone-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-obsidian/20"
          />
          <div className="mt-1.5 min-h-[18px] px-1 text-xs font-medium text-obsidian/80">
            {parsedPreview && parsedPreview.amount ? (
              <span>
                {typeLabel} · <strong>{formatRupiah(parsedPreview.amount)}</strong> ·{' '}
                {type === 'expense' ? activeCatName : activeWalletName}
                {parsedPreview.workHours ? ` · ${parsedPreview.workHours} jam` : ''}
              </span>
            ) : feedback ? (
              <span>{feedback}</span>
            ) : (
              <span className="text-obsidian/65">Otomatis tebak nominal, kategori & dompet</span>
            )}
          </div>
        </div>

        {/* Panel Detail Manual (jika tombol Detail diklik) */}
        {showDetails && (
          <div className="space-y-2.5 rounded-2xl bg-white/75 p-3.5 text-obsidian">
            <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-obsidian/10 p-1">
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
                  className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                    type === tab.id ? 'bg-obsidian text-white' : 'text-obsidian/70'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] font-medium text-obsidian/70">Nominal (Rp)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value.replace(/\D/g, ''))}
                  placeholder="25000"
                  className="mt-1 w-full rounded-xl border border-obsidian/15 bg-white px-3 py-2 text-sm font-semibold text-obsidian"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-obsidian/70">Tanggal</span>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-obsidian/15 bg-white px-3 py-2 text-sm text-obsidian"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] font-medium text-obsidian/70">
                  {type === 'transfer' ? 'Dari Dompet' : 'Dompet'}
                </span>
                <select
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-obsidian/15 bg-white px-3 py-2 text-sm text-obsidian"
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
                  <span className="text-[11px] font-medium text-obsidian/70">Ke Dompet</span>
                  <select
                    value={toWalletId}
                    onChange={(e) => setToWalletId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-obsidian/15 bg-white px-3 py-2 text-sm text-obsidian"
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
                  <span className="text-[11px] font-medium text-obsidian/70">Kategori</span>
                  <select
                    value={categoryId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setCategoryId(nextId);
                      const found = categories.find((c) => c.id === nextId);
                      if (found) setIsJobSearchExpense(found.is_job_search);
                    }}
                    className="mt-1 w-full rounded-xl border border-obsidian/15 bg-white px-3 py-2 text-sm text-obsidian"
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
                  <span className="text-[11px] font-medium text-obsidian/70">Jenis Pemasukan</span>
                  <select
                    value={incomeNature}
                    onChange={(e) => setIncomeNature(e.target.value as IncomeNature)}
                    className="mt-1 w-full rounded-xl border border-obsidian/15 bg-white px-3 py-2 text-sm text-obsidian"
                  >
                    <option value="kerja">Hasil Kerja / Klien</option>
                    <option value="non_kerja">Non-Kerja (Bansos/Kiriman)</option>
                  </select>
                </label>
              )}
            </div>

            {type === 'expense' && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNeedOrWant('perlu')}
                    className={`rounded-full px-3.5 py-1 text-xs font-semibold ${
                      needOrWant === 'perlu'
                        ? 'bg-obsidian text-white'
                        : 'bg-white text-obsidian/70'
                    }`}
                  >
                    Perlu
                  </button>
                  <button
                    type="button"
                    onClick={() => setNeedOrWant('pengen')}
                    className={`rounded-full px-3.5 py-1 text-xs font-semibold ${
                      needOrWant === 'pengen'
                        ? 'bg-coral text-obsidian'
                        : 'bg-white text-obsidian/70'
                    }`}
                  >
                    Pengen
                  </button>
                </div>

                <label className="flex items-center gap-2 text-xs font-medium text-obsidian/80">
                  <input
                    type="checkbox"
                    checked={isJobSearchExpense}
                    onChange={(e) => setIsJobSearchExpense(e.target.checked)}
                    className="h-4 w-4 rounded border-obsidian/30"
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
                  className="rounded-xl border border-obsidian/15 bg-white px-3 py-2 text-sm text-obsidian"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={workHoursStr}
                  onChange={(e) => setWorkHoursStr(e.target.value)}
                  placeholder="Jam kerja (opsional)"
                  className="rounded-xl border border-obsidian/15 bg-white px-3 py-2 text-sm text-obsidian"
                />
              </div>
            )}

            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan tambahan (opsional)"
              className="w-full rounded-xl border border-obsidian/15 bg-white px-3 py-2 text-sm text-obsidian"
            />
          </div>
        )}

        {/* Tombol CTA Hitam Pekat khas Referensi */}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-2xl bg-obsidian px-4 py-3 text-sm font-semibold text-white transition hover:bg-obsidian-soft disabled:opacity-60"
        >
          {saving ? 'Menyimpan...' : 'Simpan transaksi'}
        </button>
      </form>
    </section>
  );
}
