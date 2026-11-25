import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  Profile,
  Wallet,
  Category,
  Transaction,
  RecurringBill,
  Debt,
  Goal,
  Invoice,
  AppBackup,
} from './types';

export type TableName =
  | 'profiles'
  | 'wallets'
  | 'categories'
  | 'transactions'
  | 'recurring_bills'
  | 'debts'
  | 'goals'
  | 'invoices';

export const ALL_TABLES: TableName[] = [
  'profiles',
  'wallets',
  'categories',
  'transactions',
  'recurring_bills',
  'debts',
  'goals',
  'invoices',
];

export interface SyncQueueItem {
  id: string; // `${table}:${recordId}` agar update berulang pada record sama ter-deduplikasi
  table: TableName;
  record_id: string;
  queued_at: string;
}

interface MoneyAppDB extends DBSchema {
  profiles: { key: string; value: Profile; indexes: { 'by-updated': string } };
  wallets: { key: string; value: Wallet; indexes: { 'by-updated': string } };
  categories: { key: string; value: Category; indexes: { 'by-updated': string } };
  transactions: { key: string; value: Transaction; indexes: { 'by-updated': string; 'by-date': string } };
  recurring_bills: { key: string; value: RecurringBill; indexes: { 'by-updated': string } };
  debts: { key: string; value: Debt; indexes: { 'by-updated': string } };
  goals: { key: string; value: Goal; indexes: { 'by-updated': string } };
  invoices: { key: string; value: Invoice; indexes: { 'by-updated': string } };
  sync_queue: { key: string; value: SyncQueueItem };
  meta: { key: string; value: { key: string; value: string } };
}

const DB_NAME = 'dompet_tenang_offline_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MoneyAppDB>> | null = null;

/**
 * Membuka atau menginisialisasi database IndexedDB lokal (offline-first).
 */
export function getLocalDB(): Promise<IDBPDatabase<MoneyAppDB>> {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB hanya tersedia di lingkungan browser');
  }
  if (!dbPromise) {
    dbPromise = openDB<MoneyAppDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const table of ALL_TABLES) {
          if (!db.objectStoreNames.contains(table)) {
            if (table === 'transactions') {
              const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
              txStore.createIndex('by-updated', 'updated_at');
              txStore.createIndex('by-date', 'date');
            } else {
              const store = db.createObjectStore(table, { keyPath: 'id' });
              store.createIndex('by-updated', 'updated_at');
            }
          }
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
      blocked() {
        console.warn('IndexedDB sedang diblokir tab lain.');
      },
      blocking(_currentVersion, _blockedVersion, event) {
        (event.target as IDBDatabase | null)?.close();
        dbPromise = null;
      },
      terminated() {
        dbPromise = null;
      },
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

export interface LocalRecordMap {
  profiles: Profile;
  wallets: Wallet;
  categories: Category;
  transactions: Transaction;
  recurring_bills: RecurringBill;
  debts: Debt;
  goals: Goal;
  invoices: Invoice;
}

/**
 * Menulis satu record ke IndexedDB dan memasukkannya ke antrean sinkronisasi offline.
 */
export async function upsertLocalRecord<T extends TableName>(
  table: T,
  record: LocalRecordMap[T],
  enqueueSync = true
): Promise<void> {
  const db = await getLocalDB();
  const tx = db.transaction([table, 'sync_queue'], 'readwrite');
  await tx.objectStore(table).put(record);
  if (enqueueSync) {
    await tx.objectStore('sync_queue').put({
      id: `${table}:${record.id}`,
      table,
      record_id: record.id,
      queued_at: new Date().toISOString(),
    });
  }
  await tx.done;
}

/**
 * Soft delete record di IndexedDB (mengisi deleted_at dan updated_at)
 * lalu antrekan sinkronisasi agar penghapusan ikut ter-sync saat online.
 */
export async function softDeleteLocalRecord<T extends TableName>(
  table: T,
  recordId: string
): Promise<void> {
  const db = await getLocalDB();
  const existing = await db.get(table, recordId);
  if (!existing) return;
  const now = new Date().toISOString();
  const updated = {
    ...existing,
    deleted_at: now,
    updated_at: now,
  } as LocalRecordMap[T];
  await upsertLocalRecord(table, updated, true);
}

/**
 * Membaca satu record berdasarkan ID secara langsung (O(1) lookup, tanpa full-table scan).
 */
export async function getLocalRecordById<T extends TableName>(
  table: T,
  recordId: string
): Promise<LocalRecordMap[T] | undefined> {
  const db = await getLocalDB();
  return (await db.get(table, recordId)) as LocalRecordMap[T] | undefined;
}

/**
 * Membaca semua record aktif (deleted_at === null) atau seluruh record termasuk soft-deleted.
 */
export async function getAllLocalRecords<T extends TableName>(
  table: T,
  includeDeleted = false
): Promise<Array<LocalRecordMap[T]>> {
  const db = await getLocalDB();
  const all = (await db.getAll(table)) as Array<LocalRecordMap[T]>;
  if (includeDeleted) return all;
  return all.filter((r) => r.deleted_at === null);
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getLocalDB();
  return db.getAll('sync_queue');
}

export async function clearSyncQueueItem(queueId: string): Promise<void> {
  const db = await getLocalDB();
  await db.delete('sync_queue', queueId);
}

export async function getLastSyncedAt(): Promise<string | null> {
  const db = await getLocalDB();
  const row = await db.get('meta', 'last_synced_at');
  return row ? row.value : null;
}

export async function setLastSyncedAt(iso: string): Promise<void> {
  const db = await getLocalDB();
  await db.put('meta', { key: 'last_synced_at', value: iso });
}

/**
 * Mengambil seluruh snapshot data lokal untuk keperluan Export JSON/CSV.
 */
export async function readFullLocalSnapshot(): Promise<AppBackup> {
  const [
    profiles,
    wallets,
    categories,
    transactions,
    recurring_bills,
    debts,
    goals,
    invoices,
  ] = await Promise.all([
    getAllLocalRecords('profiles', true),
    getAllLocalRecords('wallets', true),
    getAllLocalRecords('categories', true),
    getAllLocalRecords('transactions', true),
    getAllLocalRecords('recurring_bills', true),
    getAllLocalRecords('debts', true),
    getAllLocalRecords('goals', true),
    getAllLocalRecords('invoices', true),
  ]);

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    profiles,
    wallets,
    categories,
    transactions,
    recurring_bills,
    debts,
    goals,
    invoices,
  };
}

/**
 * Mengimpor seluruh snapshot backup ke IndexedDB (menggantikan isi lokal secara atomik).
 */
export async function replaceFullLocalSnapshot(backup: AppBackup, enqueueSync = true): Promise<void> {
  const db = await getLocalDB();
  const stores = [...ALL_TABLES, 'sync_queue'] as const;
  const tx = db.transaction(stores, 'readwrite');

  for (const table of ALL_TABLES) {
    await tx.objectStore(table).clear();
  }
  await tx.objectStore('sync_queue').clear();

  const now = new Date().toISOString();
  for (const table of ALL_TABLES) {
    const rows = backup[table];
    for (const row of rows) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await tx.objectStore(table).put(row as any);
      if (enqueueSync) {
        await tx.objectStore('sync_queue').put({
          id: `${table}:${row.id}`,
          table,
          record_id: row.id,
          queued_at: now,
        });
      }
    }
  }

  await tx.done;
}
