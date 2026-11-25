'use client';

import { useState } from 'react';
import {
  calculateClientAndInvoiceSummary,
  calculateIncomeAllocation,
  calculateIncomeHistoryStats,
  calculatePeriodTotals,
  calculateRunwayMonths,
  calculateSurvivalDays,
  calculateTotalBalance,
  calculateWorkSourceStats,
  getEmergencyMiniMilestones,
} from '@/lib/calculations';
import { formatRupiah } from '@/lib/format';
import type { Goal, Invoice, Profile, Transaction, Wallet } from '@/lib/types';

interface ProfileFeaturesViewProps {
  profile: Profile;
  wallets: Wallet[];
  transactions: Transaction[];
  invoices: Invoice[];
  goals: Goal[];
  onUpdateProfile: (patch: Partial<Profile>) => Promise<void>;
  onAddInvoice: (
    inv: Omit<Invoice, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>
  ) => Promise<void>;
  onMarkInvoicePaid: (id: string) => Promise<void>;
}

export function ProfileFeaturesView({
  profile,
  wallets,
  transactions,
  invoices,
  goals,
  onUpdateProfile,
  onAddInvoice,
  onMarkInvoicePaid,
}: ProfileFeaturesViewProps) {
  const [simIncome, setSimIncome] = useState('3000000');
  const [invClient, setInvClient] = useState('');
  const [invAmount, setInvAmount] = useState('');
  const [invDue, setInvDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [selfSalaryInput, setSelfSalaryInput] = useState(String(profile.self_salary_amount));

  const totalBalance = calculateTotalBalance(wallets, transactions);
  const runway = calculateRunwayMonths(totalBalance, profile.mandatory_living_cost);
  const incomeHistory = calculateIncomeHistoryStats(transactions, new Date());
  const clientSummary = calculateClientAndInvoiceSummary(transactions, invoices);
  const workStats = calculateWorkSourceStats(transactions);
  const totalsAll = calculatePeriodTotals(transactions);

  const parsedSimIncome = Number.parseInt(simIncome.replace(/\D/g, ''), 10) || 0;
  const allocationPreview = calculateIncomeAllocation(parsedSimIncome, profile.allocation_rules);

  const emergencyGoal = goals.find((g) => g.type === 'dana_darurat');
  const emergencyMilestones = getEmergencyMiniMilestones(emergencyGoal?.collected_amount ?? 0);

  const dailyBaseline =
    profile.mandatory_living_cost > 0 ? Math.max(20000, Math.round(profile.mandatory_living_cost / 30)) : 50000;
  const survival = calculateSurvivalDays({
    availableBalance: totalBalance,
    dailyBaselineCost: dailyBaseline,
    emergencyMode: profile.emergency_mode,
  });

  const handleSaveSelfSalary = async () => {
    const val = Number.parseInt(selfSalaryInput.replace(/\D/g, ''), 10) || 0;
    await onUpdateProfile({ self_salary_amount: val });
  };

  const handleAddInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number.parseInt(invAmount.replace(/\D/g, ''), 10);
    if (!invClient.trim() || !amt || amt <= 0) return;
    await onAddInvoice({
      client_name: invClient.trim(),
      amount: amt,
      issued_date: new Date().toISOString(),
      due_date: new Date(`${invDue}T12:00:00.000Z`).toISOString(),
      status: 'unpaid',
      note: '',
    });
    setInvClient('');
    setInvAmount('');
  };

  return (
    <div className="space-y-4">
      {/* BAGIAN FREELANCE / PENGHASILAN TIDAK MENENTU */}
      <section className="surface-paper rounded-[28px] p-5 shadow-sm space-y-4">
        <div>
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600">
            Fitur Freelance & Penghasilan Tidak Menentu
          </span>
          <h2 className="mt-2 text-lg font-bold text-stone-900">Gaji Sendiri, Runway & Alokasi</h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-stone-50 p-3">
            <p className="text-xs text-stone-500">Runway (Nol Pemasukan)</p>
            <p className="mt-1 text-lg font-bold text-stone-900">{runway} bulan</p>
          </div>
          <div className="rounded-xl bg-stone-50 p-3">
            <p className="text-xs text-stone-500">Rata-rata 3 Bulan</p>
            <p className="mt-1 text-base font-bold text-stone-900">
              {formatRupiah(incomeHistory.avg3Months)}
            </p>
          </div>
          <div className="rounded-xl bg-stone-50 p-3">
            <p className="text-xs text-stone-500">Rata-rata 6 Bulan</p>
            <p className="mt-1 text-base font-bold text-stone-900">
              {formatRupiah(incomeHistory.avg6Months)}
            </p>
          </div>
          <div className="rounded-xl bg-warm-50 p-3">
            <p className="text-xs text-warm-700">Bulan Terendah (Patokan Aman)</p>
            <p className="mt-1 text-base font-bold text-warm-700">
              {formatRupiah(incomeHistory.lowestMonth6)}
            </p>
          </div>
        </div>

        {/* Gaji Sendiri */}
        <div className="rounded-xl border border-stone-200 p-3">
          <p className="text-sm font-semibold text-stone-800">Gaji ke Diri Sendiri (Bulanan)</p>
          <p className="text-xs text-stone-500">
            Kumpulkan semua pemasukan di kolam utama, lalu ambil nominal tetap tiap bulan agar hidup lebih tenang.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={selfSalaryInput}
              onChange={(e) => setSelfSalaryInput(e.target.value.replace(/\D/g, ''))}
              className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void handleSaveSelfSalary()}
              className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Simpan
            </button>
          </div>
          {profile.self_salary_amount > 0 && (
            <p className="mt-2 text-xs text-stone-600">
              Saldo saat ini cukup untuk membayar gaji sendiri sebanyak{' '}
              <strong>{(totalBalance / profile.self_salary_amount).toFixed(1)} kali</strong>.
            </p>
          )}
        </div>

        {/* Simulasi Alokasi Otomatis */}
        <div className="rounded-xl border border-stone-200 p-3">
          <p className="text-sm font-semibold text-stone-800">Kalkulator Alokasi Otomatis Pemasukan</p>
          <input
            type="text"
            inputMode="numeric"
            value={simIncome}
            onChange={(e) => setSimIncome(e.target.value.replace(/\D/g, ''))}
            placeholder="Nominal pemasukan masuk..."
            className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {allocationPreview.map((item) => (
              <div key={item.label} className="rounded-lg bg-stone-50 p-2.5">
                <p className="text-xs text-stone-500">
                  {item.label} ({item.percentage}%)
                </p>
                <p className="text-sm font-bold text-stone-900">{formatRupiah(item.amount)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Piutang Invoice Klien */}
        <div className="rounded-xl border border-stone-200 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-stone-800">Piutang Invoice Belum Dibayar</p>
            <span className="text-sm font-bold text-warm-700">
              {formatRupiah(clientSummary.unpaidInvoiceTotal)}
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500">
            Catatan: Invoice yang belum cair TIDAK dimasukkan ke hitungan &ldquo;aman dipakai per hari&rdquo;.
          </p>

          <form onSubmit={handleAddInvoiceSubmit} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
            <input
              type="text"
              placeholder="Nama klien"
              value={invClient}
              onChange={(e) => setInvClient(e.target.value)}
              className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
              required
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="Nominal (Rp)"
              value={invAmount}
              onChange={(e) => setInvAmount(e.target.value.replace(/\D/g, ''))}
              className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
              required
            />
            <input
              type="date"
              value={invDue}
              onChange={(e) => setInvDue(e.target.value)}
              className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white"
            >
              + Invoice
            </button>
          </form>

          {invoices.length > 0 && (
            <ul className="mt-3 space-y-2">
              {invoices.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-stone-900">{inv.client_name}</p>
                    <p className="text-xs text-stone-500">
                      {formatRupiah(inv.amount)} · Jatuh tempo {inv.due_date.slice(0, 10)}
                    </p>
                  </div>
                  {inv.status === 'paid' ? (
                    <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-700">
                      Lunas
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void onMarkInvoicePaid(inv.id)}
                      className="rounded-lg border border-brand-500 px-2.5 py-1 text-xs font-semibold text-brand-600"
                    >
                      Tandai Cair
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* BAGIAN SERABUTAN / TRANSISI HARIAN */}
      <section className="surface-paper rounded-[28px] p-5 shadow-sm space-y-4">
        <div>
          <span className="rounded-full bg-warm-100 px-2.5 py-1 text-xs font-semibold text-warm-700">
            Fitur Serabutan & Transisi Harian
          </span>
          <h2 className="mt-2 text-lg font-bold text-stone-900">
            Ketahanan Hari, Hasil Per Jam & Dana Darurat Mini
          </h2>
        </div>

        <div className="rounded-xl bg-stone-50 p-3 text-sm text-stone-800">
          <p className="font-semibold">Estimasi Bertahan: {survival.days} hari</p>
          <p className="mt-1 text-stone-600">{survival.adviceMessage}</p>
        </div>

        {/* Pemisahan Penghasilan Kerja vs Non-Kerja + Pos Biaya Cari Kerja */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-stone-200 p-3">
            <p className="text-xs text-stone-500">Total Penghasilan Kerja</p>
            <p className="mt-1 text-base font-bold text-brand-600">{formatRupiah(totalsAll.workIncome)}</p>
          </div>
          <div className="rounded-xl border border-stone-200 p-3">
            <p className="text-xs text-stone-500">Non-Kerja (Bansos/Kiriman)</p>
            <p className="mt-1 text-base font-bold text-stone-800">
              {formatRupiah(totalsAll.nonWorkIncome)}
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 p-3">
            <p className="text-xs text-stone-500">Modal Cari Kerja (CV/Ongkos)</p>
            <p className="mt-1 text-base font-bold text-warm-700">
              {formatRupiah(totalsAll.jobSearchExpense)}
            </p>
          </div>
        </div>

        {/* Statistik Sumber Kerja & Pendapatan Per Jam */}
        <div>
          <h3 className="text-sm font-bold text-stone-800">Perbandingan Hasil Kerja & Upah Per Jam</h3>
          {workStats.length === 0 ? (
            <p className="mt-1 text-xs text-stone-500">
              Catat pemasukan kerja beserta jam kerjanya (contoh: &ldquo;ngojek 85rb 5 jam&rdquo;) untuk melihat
              pekerjaan paling menguntungkan per jam.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {workStats.map((st) => (
                <div
                  key={st.source}
                  className="flex items-center justify-between rounded-xl border border-stone-200 p-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-stone-900">{st.source}</p>
                    <p className="text-xs text-stone-500">
                      {st.sessions}x kerja · Total {formatRupiah(st.totalIncome)}
                      {st.totalHours > 0 ? ` · ${st.totalHours} jam` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-brand-600">
                      {st.hourlyRate ? `${formatRupiah(st.hourlyRate)}/jam` : '-'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dana Darurat Mini Bertahap */}
        <div className="rounded-xl border border-stone-200 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-stone-800">Dana Darurat Mini Bertahap</p>
            <span className="text-xs font-semibold text-brand-600">
              Target berikutnya: {formatRupiah(emergencyMilestones.nextMilestone)}
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full bg-brand-500"
              style={{ width: `${emergencyMilestones.progressPercent}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-stone-500">
            Tahapan: Rp200rb → Rp500rb → Rp1jt → Rp2jt → Rp5jt. Buat target bertipe &ldquo;Dana Darurat&rdquo; di menu
            Tagihan & Target untuk mulai menabung bertahap.
          </p>
        </div>
      </section>
    </div>
  );
}
