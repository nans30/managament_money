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
    <div className="space-y-5">
      {/* 1. FREELANCE: ACID LIME FOLDER-TAB CARD */}
      <section className="overflow-hidden rounded-[28px] bg-obsidian-muted shadow-sm">
        <div className="flex items-stretch">
          <div className="rounded-tr-[22px] bg-limecard px-5 pt-3.5 pb-1.5 text-xs font-semibold text-obsidian">
            Mode Freelance
          </div>
          <div className="flex flex-1 items-center justify-end px-4 py-2">
            <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] font-medium text-stone-300">
              Runway {runway} bln
            </span>
          </div>
        </div>

        <div className="rounded-tr-[24px] bg-limecard px-5 pt-3 pb-5 text-obsidian space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-white/80 p-3">
              <p className="text-[11px] text-stone-600">Rata-rata 3 Bulan</p>
              <p className="mt-0.5 text-sm font-bold">{formatRupiah(incomeHistory.avg3Months)}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-3">
              <p className="text-[11px] text-stone-600">Rata-rata 6 Bulan</p>
              <p className="mt-0.5 text-sm font-bold">{formatRupiah(incomeHistory.avg6Months)}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-3">
              <p className="text-[11px] text-stone-600">Bulan Terendah</p>
              <p className="mt-0.5 text-sm font-bold">{formatRupiah(incomeHistory.lowestMonth6)}</p>
            </div>
            <div className="rounded-2xl bg-obsidian p-3 text-white">
              <p className="text-[11px] text-stone-300">Runway Nol Masuk</p>
              <p className="mt-0.5 text-sm font-bold text-limecard">{runway} bulan</p>
            </div>
          </div>

          {/* Gaji Sendiri */}
          <div className="rounded-2xl bg-white/80 p-3.5 space-y-2">
            <p className="text-xs font-semibold text-obsidian">Gaji ke Diri Sendiri / Bulan</p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={selfSalaryInput}
                onChange={(e) => setSelfSalaryInput(e.target.value.replace(/\D/g, ''))}
                className="flex-1 rounded-xl border-0 bg-white px-3 py-2 text-sm font-semibold text-obsidian"
              />
              <button
                type="button"
                onClick={() => void handleSaveSelfSalary()}
                className="rounded-xl bg-obsidian px-4 py-2 text-xs font-semibold text-white hover:bg-obsidian-soft"
              >
                Simpan
              </button>
            </div>
            {profile.self_salary_amount > 0 && (
              <p className="text-[11px] text-stone-700">
                Saldo cukup untuk bayar gaji sendiri{' '}
                <strong>{(totalBalance / profile.self_salary_amount).toFixed(1)}x</strong>.
              </p>
            )}
          </div>

          {/* Kalkulator Alokasi Otomatis */}
          <div className="rounded-2xl bg-white/80 p-3.5 space-y-2.5">
            <p className="text-xs font-semibold text-obsidian">Alokasi Otomatis Pemasukan</p>
            <input
              type="text"
              inputMode="numeric"
              value={simIncome}
              onChange={(e) => setSimIncome(e.target.value.replace(/\D/g, ''))}
              placeholder="Nominal pemasukan..."
              className="w-full rounded-xl border-0 bg-white px-3 py-2 text-sm font-semibold text-obsidian"
            />
            <div className="grid grid-cols-2 gap-2">
              {allocationPreview.map((item) => (
                <div key={item.label} className="rounded-xl bg-obsidian/5 p-2.5">
                  <p className="text-[11px] text-stone-600">
                    {item.label} ({item.percentage}%)
                  </p>
                  <p className="text-sm font-bold text-obsidian">{formatRupiah(item.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PIUTANG INVOICE KLIEN (Kartu Putih Bersih) */}
      <section className="surface-paper rounded-[28px] p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-obsidian">Piutang Invoice Belum Cair</h2>
          <span className="rounded-full bg-coral/25 px-2.5 py-0.5 text-xs font-semibold text-obsidian">
            {formatRupiah(clientSummary.unpaidInvoiceTotal)}
          </span>
        </div>
        <p className="text-xs text-stone-500">
          Invoice belum dibayar tidak dimasukkan ke saldo riil &ldquo;aman dipakai per hari&rdquo;.
        </p>

        <form onSubmit={handleAddInvoiceSubmit} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Nama klien"
            value={invClient}
            onChange={(e) => setInvClient(e.target.value)}
            className="rounded-2xl border px-3.5 py-2.5 text-sm"
            required
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="Nominal (Rp)"
            value={invAmount}
            onChange={(e) => setInvAmount(e.target.value.replace(/\D/g, ''))}
            className="rounded-2xl border px-3.5 py-2.5 text-sm"
            required
          />
          <input
            type="date"
            value={invDue}
            onChange={(e) => setInvDue(e.target.value)}
            className="rounded-2xl border px-3.5 py-2.5 text-sm"
          />
          <button
            type="submit"
            className="rounded-2xl bg-obsidian px-4 py-2.5 text-sm font-semibold text-white hover:bg-obsidian-soft"
          >
            + Tambah Invoice
          </button>
        </form>

        {invoices.length > 0 && (
          <ul className="space-y-2 pt-1">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded-2xl bg-stone-100/80 px-3.5 py-2.5 text-sm"
              >
                <div>
                  <p className="font-semibold text-obsidian">{inv.client_name}</p>
                  <p className="text-xs text-stone-500">
                    {formatRupiah(inv.amount)} · Tempo {inv.due_date.slice(0, 10)}
                  </p>
                </div>
                {inv.status === 'paid' ? (
                  <span className="rounded-full bg-limecard px-3 py-1 text-xs font-semibold text-obsidian">
                    Lunas
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void onMarkInvoicePaid(inv.id)}
                    className="rounded-full bg-obsidian px-3 py-1 text-xs font-semibold text-white"
                  >
                    Tandai Cair
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 2. SERABUTAN: CORAL FOLDER-TAB CARD */}
      <section className="overflow-hidden rounded-[28px] bg-obsidian-muted shadow-sm">
        <div className="flex items-stretch">
          <div className="rounded-tr-[22px] bg-coral px-5 pt-3.5 pb-1.5 text-xs font-semibold text-obsidian">
            Mode Serabutan
          </div>
          <div className="flex flex-1 items-center justify-end px-4 py-2">
            <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] font-medium text-stone-300">
              ~{survival.days} hari
            </span>
          </div>
        </div>

        <div className="rounded-tr-[24px] bg-coral px-5 pt-3 pb-5 text-obsidian space-y-3">
          <div className="rounded-2xl bg-white/85 p-3.5">
            <p className="text-sm font-bold text-obsidian">Estimasi Bertahan: {survival.days} hari</p>
            <p className="mt-1 text-xs text-stone-700">{survival.adviceMessage}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/85 p-2.5">
              <p className="text-[10px] text-stone-600">Hasil Kerja</p>
              <p className="mt-0.5 text-xs font-bold">{formatRupiah(totalsAll.workIncome)}</p>
            </div>
            <div className="rounded-2xl bg-white/85 p-2.5">
              <p className="text-[10px] text-stone-600">Non-Kerja</p>
              <p className="mt-0.5 text-xs font-bold">{formatRupiah(totalsAll.nonWorkIncome)}</p>
            </div>
            <div className="rounded-2xl bg-obsidian p-2.5 text-white">
              <p className="text-[10px] text-stone-300">Modal Cari Kerja</p>
              <p className="mt-0.5 text-xs font-bold text-limecard">
                {formatRupiah(totalsAll.jobSearchExpense)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* UPAH PER JAM & DANA DARURAT MINI (Kartu Putih Bersih) */}
      <section className="surface-paper rounded-[28px] p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-obsidian">Upah Per Jam Kerja</h3>
          {workStats.length === 0 ? (
            <p className="mt-1 text-xs text-stone-500">
              Catat pemasukan + jam kerja (contoh: &ldquo;ngojek 85rb 5 jam&rdquo;) untuk melihat sumber kerja
              paling menguntungkan per jam.
            </p>
          ) : (
            <div className="mt-2.5 space-y-2">
              {workStats.map((st) => (
                <div
                  key={st.source}
                  className="flex items-center justify-between rounded-2xl bg-stone-100/80 px-3.5 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-semibold text-obsidian">{st.source}</p>
                    <p className="text-xs text-stone-500">
                      {st.sessions}x · {formatRupiah(st.totalIncome)}
                      {st.totalHours > 0 ? ` · ${st.totalHours}j` : ''}
                    </p>
                  </div>
                  <span className="rounded-full bg-obsidian px-3 py-1 text-xs font-semibold text-limecard">
                    {st.hourlyRate ? `${formatRupiah(st.hourlyRate)}/jam` : '-'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-stone-100 pt-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-obsidian">Dana Darurat Mini Bertahap</span>
            <span className="font-medium text-stone-600">
              Target: {formatRupiah(emergencyMilestones.nextMilestone)}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-obsidian"
              style={{ width: `${emergencyMilestones.progressPercent}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-stone-500">
            Tahapan: Rp200rb → Rp500rb → Rp1jt → Rp2jt → Rp5jt.
          </p>
        </div>
      </section>
    </div>
  );
}
