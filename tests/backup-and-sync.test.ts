import { describe, it, expect } from 'vitest';
import {
  exportTransactionsToCsv,
  importTransactionsFromCsv,
  parseBackupFromJson,
  serializeBackupToJson,
} from '@/lib/backup';
import { resolveLWWConflict, sortSyncQueueByDependency } from '@/lib/sync';
import type { AppBackup, Transaction } from '@/lib/types';

const userId = '11111111-1111-4111-8111-111111111111';
const now = '2026-11-25T08:00:00.000Z';

const sampleTx: Transaction = {
  id: '00000000-0000-4000-8000-000000000901',
  user_id: userId,
  type: 'expense',
  amount: 35000,
  wallet_id: '00000000-0000-4000-8000-000000000001',
  to_wallet_id: null,
  category_id: '00000000-0000-4000-8000-000000000011',
  source_or_client: null,
  need_or_want: 'perlu',
  work_hours: null,
  income_nature: 'kerja',
  is_job_search_expense: false,
  note: 'Makan siang, nasi padang "rendang"',
  date: now,
  created_at: now,
  updated_at: now,
  deleted_at: null,
};

describe('Export & Import JSON / CSV (Round-trip Identik)', () => {
  it('Export JSON lalu Import ulang menghasilkan data yang 100% identik', () => {
    const backup: AppBackup = {
      version: 1,
      exported_at: now,
      profiles: [
        {
          id: '00000000-0000-4000-8000-000000000501',
          user_id: userId,
          profile_type: 'freelance',
          period_start_day: 25,
          mandatory_living_cost: 2500000,
          self_salary_amount: 3500000,
          allocation_rules: [{ label: 'Wajib', percentage: 100 }],
          emergency_mode: false,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        },
      ],
      wallets: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          user_id: userId,
          name: 'Cash',
          type: 'cash',
          initial_balance: 500000,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        },
      ],
      categories: [
        {
          id: '00000000-0000-4000-8000-000000000011',
          user_id: userId,
          name: 'Makan',
          icon: 'utensils',
          priority: 'wajib',
          monthly_budget: 900000,
          is_job_search: false,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        },
      ],
      transactions: [sampleTx],
      recurring_bills: [],
      debts: [],
      goals: [],
      invoices: [],
    };

    const json = serializeBackupToJson(backup);
    const restored = parseBackupFromJson(json);

    expect(restored).toEqual(backup);
  });

  it('Export CSV lalu Import CSV menjaga nilai transaksi termasuk koma dan tanda kutip', () => {
    const csv = exportTransactionsToCsv([sampleTx]);
    const restored = importTransactionsFromCsv(csv);
    expect(restored).toHaveLength(1);
    expect(restored[0]).toEqual(sampleTx);
  });
});

describe('Resolusi Konflik Last-Write-Wins (LWW)', () => {
  it('memilih record dengan updated_at paling baru', () => {
    const older = { id: 'a', updated_at: '2026-11-25T08:00:00.000Z', deleted_at: null, amount: 10000 };
    const newer = { id: 'a', updated_at: '2026-11-25T09:00:00.000Z', deleted_at: null, amount: 25000 };

    expect(resolveLWWConflict(older, newer)).toEqual(newer);
    expect(resolveLWWConflict(newer, older)).toEqual(newer);
  });

  it('mengurutkan antrean sync agar wallets & categories selalu dikirim sebelum transactions', () => {
    const sorted = sortSyncQueueByDependency([
      { id: 'transactions:1', table: 'transactions', record_id: '1', queued_at: now },
      { id: 'wallets:1', table: 'wallets', record_id: '1', queued_at: now },
      { id: 'categories:1', table: 'categories', record_id: '1', queued_at: now },
      { id: 'profiles:1', table: 'profiles', record_id: '1', queued_at: now },
    ]);

    expect(sorted.map((item) => item.table)).toEqual([
      'profiles',
      'wallets',
      'categories',
      'transactions',
    ]);
  });
});
