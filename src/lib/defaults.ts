import type { Category, Wallet, Profile, ProfileType } from './types';

/**
 * Helper pembuat UUID v4 di sisi klien (offline-first).
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback standar RFC4122 v4 untuk environment non-browser lama
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createDefaultProfile(userId: string, profileType: ProfileType = 'freelance'): Profile {
  const now = nowIso();
  return {
    id: generateUUID(),
    user_id: userId,
    profile_type: profileType,
    period_start_day: 1,
    mandatory_living_cost: 2000000,
    self_salary_amount: 3000000,
    allocation_rules: [
      { label: 'Kebutuhan Wajib', percentage: 50 },
      { label: 'Tabungan', percentage: 20 },
      { label: 'Dana Pajak / Cadangan', percentage: 10 },
      { label: 'Bebas', percentage: 20 },
    ],
    emergency_mode: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

export function createDefaultWallets(userId: string): Wallet[] {
  const now = nowIso();
  const base: Array<{ name: string; type: Wallet['type'] }> = [
    { name: 'Cash', type: 'cash' },
    { name: 'Bank', type: 'bank' },
    { name: 'GoPay', type: 'gopay' },
    { name: 'OVO', type: 'ovo' },
    { name: 'Dana', type: 'dana' },
    { name: 'ShopeePay', type: 'shopeepay' },
  ];

  return base.map((item) => ({
    id: generateUUID(),
    user_id: userId,
    name: item.name,
    type: item.type,
    initial_balance: 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }));
}

export function createDefaultCategories(userId: string): Category[] {
  const now = nowIso();
  const base: Array<{
    name: string;
    icon: string;
    priority: Category['priority'];
    monthly_budget: number;
    is_job_search?: boolean;
  }> = [
    { name: 'Makan', icon: 'utensils', priority: 'wajib', monthly_budget: 900000 },
    { name: 'Transport', icon: 'bike', priority: 'wajib', monthly_budget: 300000 },
    { name: 'Tagihan', icon: 'receipt', priority: 'wajib', monthly_budget: 500000 },
    { name: 'Kebutuhan Rumah', icon: 'home', priority: 'wajib', monthly_budget: 400000 },
    { name: 'Kesehatan', icon: 'heart-pulse', priority: 'penting', monthly_budget: 200000 },
    { name: 'Pulsa/Kuota', icon: 'wifi', priority: 'wajib', monthly_budget: 150000 },
    { name: 'Cari Kerja', icon: 'briefcase', priority: 'penting', monthly_budget: 150000, is_job_search: true },
    { name: 'Hiburan', icon: 'film', priority: 'bisa_ditunda', monthly_budget: 200000 },
    { name: 'Lain-lain', icon: 'tag', priority: 'bisa_ditunda', monthly_budget: 200000 },
  ];

  return base.map((item) => ({
    id: generateUUID(),
    user_id: userId,
    name: item.name,
    icon: item.icon,
    priority: item.priority,
    monthly_budget: item.monthly_budget,
    is_job_search: Boolean(item.is_job_search),
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }));
}
