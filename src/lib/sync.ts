import {
  ALL_TABLES,
  clearSyncQueueItem,
  getAllLocalRecords,
  getLastSyncedAt,
  getLocalRecordById,
  getSyncQueue,
  setLastSyncedAt,
  upsertLocalRecord,
  type LocalRecordMap,
  type SyncQueueItem,
  type TableName,
} from './db';
import { getSupabaseClient } from './supabase';

/**
 * Urutan sinkronisasi sesuai ketergantungan Foreign Key Postgres:
 * `wallets` dan `categories` WAJIB dikirim sebelum `transactions`
 * agar tidak terjadi Foreign Key Violation (`transactions_wallet_id_fkey`).
 */
const TABLE_SYNC_PRIORITY: Record<TableName, number> = {
  profiles: 0,
  wallets: 1,
  categories: 2,
  transactions: 3,
  recurring_bills: 4,
  debts: 5,
  goals: 6,
  invoices: 7,
};

export function sortSyncQueueByDependency(queue: SyncQueueItem[]): SyncQueueItem[] {
  return [...queue].sort((a, b) => TABLE_SYNC_PRIORITY[a.table] - TABLE_SYNC_PRIORITY[b.table]);
}

export interface TimestampedRecord {
  id: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Fungsi murni resolusi konflik Last-Write-Wins (LWW) per record.
 * Membandingkan `updated_at` antara versi lokal dan versi remote.
 * Mengembalikan record yang lebih baru (jika sama persis, pilih remote agar deterministik).
 */
export function resolveLWWConflict<T extends TimestampedRecord>(local: T | undefined, remote: T): T {
  if (!local) return remote;
  const localMs = new Date(local.updated_at).getTime();
  const remoteMs = new Date(remote.updated_at).getTime();
  return localMs > remoteMs ? local : remote;
}

export interface SyncResult {
  status: 'synced' | 'offline' | 'unconfigured' | 'unauthenticated' | 'error';
  pushedCount: number;
  pulledCount: number;
  message: string;
}

/**
 * Sinkronisasi dua arah antara IndexedDB lokal dan Supabase Postgres:
 * 1. Push: Mengirim semua item dalam `sync_queue` ke Supabase via upsert.
 * 2. Pull: Mengambil perubahan terbaru sejak `last_synced_at` dari Supabase,
 *    lalu menyelesaikan konflik per record dengan aturan Last-Write-Wins (LWW).
 */
export async function syncWithSupabase(): Promise<SyncResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      status: 'offline',
      pushedCount: 0,
      pulledCount: 0,
      message: 'Sedang offline. Perubahan aman tersimpan di perangkat dan akan tersinkron saat online.',
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      status: 'unconfigured',
      pushedCount: 0,
      pulledCount: 0,
      message: 'Mode lokal aktif (Supabase belum dihubungkan di .env.local).',
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: 'unauthenticated',
      pushedCount: 0,
      pulledCount: 0,
      message: 'Belum login. Data tersimpan di perangkat lokal.',
    };
  }

  let pushedCount = 0;
  let pulledCount = 0;

  try {
    // 1. PUSH antrean offline ke Supabase sesuai urutan Foreign Key (O(1) lookup per record)
    const queue = sortSyncQueueByDependency(await getSyncQueue());
    for (const item of queue) {
      const record = await getLocalRecordById(item.table, item.record_id);
      if (!record) {
        await clearSyncQueueItem(item.id);
        continue;
      }

      // Pastikan user_id mengikuti auth.uid() yang sedang login agar sesuai RLS
      const payload = { ...record, user_id: user.id } as Record<string, unknown>;
      const conflictCol = item.table === 'profiles' ? 'user_id' : 'id';
      const { error } = await supabase.from(item.table).upsert(payload, { onConflict: conflictCol });
      if (error) {
        throw new Error(`Gagal sync tabel ${item.table}: ${error.message}`);
      }
      await clearSyncQueueItem(item.id);
      pushedCount += 1;
    }

    // 2. PULL perubahan dari Supabase ke IndexedDB dengan LWW
    const lastSyncedAt = await getLastSyncedAt();
    const syncStartedAt = new Date().toISOString();

    for (const table of ALL_TABLES) {
      let query = supabase.from(table).select('*').eq('user_id', user.id);
      if (lastSyncedAt) {
        query = query.gt('updated_at', lastSyncedAt);
      }

      const { data: remoteRows, error } = await query;
      if (error) {
        throw new Error(`Gagal membaca tabel ${table}: ${error.message}`);
      }

      if (remoteRows && remoteRows.length > 0) {
        const localRows = await getAllLocalRecords(table, true);
        const localMap = new Map(localRows.map((r) => [r.id, r]));

        for (const remoteRow of remoteRows) {
          const typedRemote = remoteRow as LocalRecordMap[TableName];
          const localRow = localMap.get(typedRemote.id);
          const winner = resolveLWWConflict(localRow, typedRemote);
          if (winner === typedRemote) {
            await upsertLocalRecord(table, typedRemote as never, false);
            pulledCount += 1;
          }
        }
      }
    }

    await setLastSyncedAt(syncStartedAt);

    return {
      status: 'synced',
      pushedCount,
      pulledCount,
      message: `Sinkronisasi selesai (${pushedCount} dikirim, ${pulledCount} diterima).`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kendala saat sinkronisasi.';
    return {
      status: 'error',
      pushedCount,
      pulledCount,
      message,
    };
  }
}
