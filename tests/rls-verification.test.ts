import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Verifikasi Otomatis Row Level Security (RLS) dan Skema Database:
 * 1. Memastikan file migrasi SQL mengaktifkan RLS pada ke-8 tabel wajib.
 * 2. Memastikan setiap tabel memiliki policy `user_id = auth.uid()` untuk SELECT, INSERT, UPDATE, DELETE.
 * 3. Memastikan simulator evaluasi RLS menolak akses ketika User A mencoba membaca atau mengubah baris milik User B.
 */

const REQUIRED_TABLES = [
  'profiles',
  'wallets',
  'categories',
  'transactions',
  'recurring_bills',
  'debts',
  'goals',
  'invoices',
] as const;

interface RLSRow {
  id: string;
  user_id: string;
  [key: string]: unknown;
}

class RLSPolicyEngineSimulator {
  /**
   * Mensimulasikan policy Postgres RLS `USING (user_id = auth.uid())` dan `WITH CHECK (user_id = auth.uid())`
   */
  static canSelect(authUid: string | null, row: RLSRow): boolean {
    if (!authUid) return false;
    return row.user_id === authUid;
  }

  static canInsert(authUid: string | null, newRow: RLSRow): boolean {
    if (!authUid) return false;
    return newRow.user_id === authUid;
  }

  static canUpdate(authUid: string | null, existingRow: RLSRow, updatedRow: RLSRow): boolean {
    if (!authUid) return false;
    return existingRow.user_id === authUid && updatedRow.user_id === authUid;
  }

  static canDelete(authUid: string | null, existingRow: RLSRow): boolean {
    if (!authUid) return false;
    return existingRow.user_id === authUid;
  }
}

describe('Verifikasi Skema SQL & Row Level Security (RLS)', () => {
  const sqlPath = path.resolve(__dirname, '../supabase/migrations/0001_initial_schema.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  it('mengaktifkan ENABLE ROW LEVEL SECURITY di semua 8 tabel utama', () => {
    for (const table of REQUIRED_TABLES) {
      const regex = new RegExp(`ALTER\\s+TABLE\\s+public\\.${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY;`, 'i');
      expect(sqlContent).toMatch(regex);
    }
  });

  it('memiliki policy SELECT, INSERT, UPDATE, DELETE berbasis user_id = auth.uid() di semua tabel', () => {
    for (const table of REQUIRED_TABLES) {
      expect(sqlContent).toContain(`ON public.${table} FOR SELECT USING (user_id = auth.uid())`);
      expect(sqlContent).toContain(`ON public.${table} FOR INSERT WITH CHECK (user_id = auth.uid())`);
      expect(sqlContent).toContain(`ON public.${table} FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`);
      expect(sqlContent).toContain(`ON public.${table} FOR DELETE USING (user_id = auth.uid())`);
    }
  });

  it('menggunakan BIGINT untuk semua kolom nominal uang dan bukan FLOAT/REAL', () => {
    expect(sqlContent).not.toMatch(/\b(FLOAT|REAL|DOUBLE\s+PRECISION)\b/i);
    expect(sqlContent).toContain('amount BIGINT NOT NULL');
    expect(sqlContent).toContain('initial_balance BIGINT NOT NULL');
    expect(sqlContent).toContain('monthly_budget BIGINT NOT NULL');
  });

  it('membuktikan User A tidak bisa membaca, mengubah, atau menghapus data milik User B', () => {
    const userA = '11111111-1111-4111-8111-111111111111';
    const userB = '22222222-2222-4222-8222-222222222222';

    const databaseRows: RLSRow[] = [
      { id: 'tx-1', user_id: userA, amount: 50000, note: 'Makan siang User A' },
      { id: 'tx-2', user_id: userB, amount: 120000, note: 'Ngojek User B' },
    ];

    // User A melakukan SELECT: hanya boleh melihat baris milik User A
    const visibleToUserA = databaseRows.filter((row) =>
      RLSPolicyEngineSimulator.canSelect(userA, row)
    );
    expect(visibleToUserA).toHaveLength(1);
    expect(visibleToUserA[0]?.id).toBe('tx-1');

    // User A mencoba membaca langsung baris User B -> Ditolak
    expect(RLSPolicyEngineSimulator.canSelect(userA, databaseRows[1]!)).toBe(false);

    // User A mencoba menyisipkan baris atas nama User B -> Ditolak
    expect(
      RLSPolicyEngineSimulator.canInsert(userA, {
        id: 'tx-spoof',
        user_id: userB,
        amount: 999999,
      })
    ).toBe(false);

    // User A mencoba mengubah baris milik User B -> Ditolak
    expect(
      RLSPolicyEngineSimulator.canUpdate(userA, databaseRows[1]!, {
        ...databaseRows[1]!,
        amount: 1000,
      })
    ).toBe(false);

    // User A mencoba menghapus baris milik User B -> Ditolak
    expect(RLSPolicyEngineSimulator.canDelete(userA, databaseRows[1]!)).toBe(false);
  });
});
