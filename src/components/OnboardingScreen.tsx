'use client';

import { useState } from 'react';
import { t } from '@/lib/i18n';
import type { ProfileType } from '@/lib/types';

interface OnboardingScreenProps {
  onComplete: (profileType: ProfileType, periodStartDay: number, mandatoryLivingCost: number) => Promise<void>;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const text = t('id');
  const [selected, setSelected] = useState<ProfileType>('freelance');
  const [periodStartDay, setPeriodStartDay] = useState<number>(1);
  const [mandatoryCost, setMandatoryCost] = useState<string>('2000000');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const parsedCost = Number.parseInt(mandatoryCost.replace(/\D/g, ''), 10) || 0;
    await onComplete(selected, periodStartDay, parsedCost);
    setSaving(false);
  };

  const options: Array<{ key: ProfileType; title: string; subtitle: string }> = [
    { key: 'fixed', ...text.profiles.fixed },
    { key: 'freelance', ...text.profiles.freelance },
    { key: 'daily', ...text.profiles.daily },
  ];

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-stone-200">
        <p className="text-sm font-medium text-brand-500">{text.appName}</p>
        <h1 className="mt-1 text-2xl font-bold text-stone-900">
          Selamat datang. Bagaimana ritme penghasilanmu saat ini?
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Tenang, semua profil memakai data yang sama dan bisa diganti kapan saja di Pengaturan.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-3" role="radiogroup" aria-label="Pilih profil penghasilan">
            {options.map((opt) => {
              const active = selected === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelected(opt.key)}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    active
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20'
                      : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <div className="font-semibold text-stone-900">{opt.title}</div>
                  <div className="mt-1 text-sm text-stone-600">{opt.subtitle}</div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-stone-700">Tanggal mulai periode (1-31)</span>
              <input
                type="number"
                min={1}
                max={31}
                value={periodStartDay}
                onChange={(e) => setPeriodStartDay(Number(e.target.value) || 1)}
                className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-base"
              />
              <span className="mt-1 block text-xs text-stone-500">
                Contoh: isi 25 kalau periode 25 s/d 24.
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-stone-700">Biaya hidup wajib / bulan (Rp)</span>
              <input
                type="text"
                inputMode="numeric"
                value={mandatoryCost}
                onChange={(e) => setMandatoryCost(e.target.value.replace(/\D/g, ''))}
                className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-base"
                placeholder="2000000"
              />
              <span className="mt-1 block text-xs text-stone-500">
                Untuk hitung runway & ketahanan hari.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-brand-500 px-4 py-3 text-base font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {saving ? 'Menyiapkan catatan...' : 'Mulai Catat Keuangan'}
          </button>
        </form>
      </div>
    </main>
  );
}
