import {
  ALL_TABLES,
  clearSyncQueueItem,
  getAllLocalRecords,
  getLastSyncedAt,
  getSyncQueue,
  setLastSyncedAt,
  upsertLocalRecord,
  type LocalRecordMap,
  type TableName,
} from './db';
import { getSupabaseClient } from './supabase';

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
    // 1. PUSH antrean offline ke Supabase
    const queue = await getSyncQueue();
    for (const item of queue) {
      const localRows = await getAllLocalRecords(item.table, true);
      const record = localRows.find((r) => r.id === item.record_id);
      if (!record) {
        await clearSyncQueueItem(item.id);
        continue;
      }

      // Pastikan user_id mengikuti auth.uid() yang sedang login agar sesuai RLS
      const payload = { ...record, user_id: user.id } as Record<string, unknown>;
      const { error } = await supabase.from(item.table).upsert(payload, { onConflict: 'id' });
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
