import { AppBackupSchema, type AppBackup, type Transaction } from './types';

/**
 * Fungsi murni Export & Import JSON dan CSV sebagai cadangan kedua (backup).
 * Memastikan Export JSON lalu Import ulang menghasilkan data yang 100% identik.
 */

export function serializeBackupToJson(backup: AppBackup): string {
  // Validasi dulu sebelum export
  const parsed = AppBackupSchema.parse(backup);
  return JSON.stringify(parsed, null, 2);
}

export function parseBackupFromJson(jsonString: string): AppBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonString);
  } catch {
    throw new Error('File JSON tidak valid atau rusak.');
  }
  const result = AppBackupSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Format backup JSON tidak sesuai skema: ${result.error.issues[0]?.message ?? 'unknown'}`);
  }
  return result.data;
}

const CSV_HEADERS = [
  'id',
  'user_id',
  'type',
  'amount',
  'wallet_id',
  'to_wallet_id',
  'category_id',
  'source_or_client',
  'need_or_want',
  'work_hours',
  'income_nature',
  'is_job_search_expense',
  'note',
  'date',
  'created_at',
  'updated_at',
  'deleted_at',
] as const;

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportTransactionsToCsv(transactions: Transaction[]): string {
  const lines: string[] = [CSV_HEADERS.join(',')];
  for (const tx of transactions) {
    const row = CSV_HEADERS.map((key) => escapeCsvCell(tx[key]));
    lines.push(row.join(','));
  }
  return lines.join('\n');
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function importTransactionsFromCsv(csvText: string): Transaction[] {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]!);
  const idx = (name: string) => headers.indexOf(name);

  const transactions: Transaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]!);
    const get = (name: string) => {
      const pos = idx(name);
      return pos >= 0 ? (cols[pos] ?? '') : '';
    };

    const rawAmount = Number.parseInt(get('amount'), 10);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) continue;

    const workHoursStr = get('work_hours');
    const parsedHours = workHoursStr ? Number.parseFloat(workHoursStr) : null;

    transactions.push({
      id: get('id'),
      user_id: get('user_id'),
      type: (get('type') as Transaction['type']) || 'expense',
      amount: rawAmount,
      wallet_id: get('wallet_id'),
      to_wallet_id: get('to_wallet_id') || null,
      category_id: get('category_id') || null,
      source_or_client: get('source_or_client') || null,
      need_or_want: (get('need_or_want') as Transaction['need_or_want']) || null,
      work_hours: parsedHours && Number.isFinite(parsedHours) ? parsedHours : null,
      income_nature: (get('income_nature') as Transaction['income_nature']) || 'kerja',
      is_job_search_expense: get('is_job_search_expense') === 'true',
      note: get('note'),
      date: get('date'),
      created_at: get('created_at'),
      updated_at: get('updated_at'),
      deleted_at: get('deleted_at') || null,
    });
  }

  return transactions;
}
