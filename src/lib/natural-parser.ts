import type { IncomeNature, NeedOrWant, TransactionType } from './types';

export interface ParsedNaturalTransaction {
  type: TransactionType;
  amount: number | null;
  guessedCategoryName: string | null;
  guessedWalletName: string | null;
  guessedToWalletName: string | null;
  sourceOrClient: string | null;
  workHours: number | null;
  incomeNature: IncomeNature;
  isJobSearchExpense: boolean;
  needOrWant: NeedOrWant | null;
  note: string;
}

const INCOME_KEYWORDS = [
  'gaji',
  'gajian',
  'freelance',
  'proyek',
  'project',
  'klien',
  'client',
  'invoice',
  'bayaran',
  'honor',
  'bonus',
  'thr',
  'ngojek',
  'ojol',
  'grab',
  'gojek',
  'kuli',
  'dagang',
  'jualan',
  'serabutan',
  'tip',
  'tips',
  'komisi',
  'cuan',
  'pemasukan',
  'terima',
  'dapat',
  'dapet',
];

const NON_WORK_INCOME_KEYWORDS = [
  'bansos',
  'bantuan',
  'prakerja',
  'kiriman',
  'ortu',
  'orang tua',
  'keluarga',
  'hibah',
  'hadiah',
  'pemberian',
  'blt',
];

const TRANSFER_KEYWORDS = ['transfer', 'tf', 'pindah', 'topup', 'top up', 'isi saldo', 'tarik tunai'];

const WALLET_KEYWORDS: Array<{ keyword: string; name: string }> = [
  { keyword: 'gopay', name: 'GoPay' },
  { keyword: 'ovo', name: 'OVO' },
  { keyword: 'dana', name: 'Dana' },
  { keyword: 'shopeepay', name: 'ShopeePay' },
  { keyword: 'spay', name: 'ShopeePay' },
  { keyword: 'bank', name: 'Bank' },
  { keyword: 'bca', name: 'Bank' },
  { keyword: 'bri', name: 'Bank' },
  { keyword: 'bni', name: 'Bank' },
  { keyword: 'mandiri', name: 'Bank' },
  { keyword: 'bsi', name: 'Bank' },
  { keyword: 'jago', name: 'Bank' },
  { keyword: 'seabank', name: 'Bank' },
  { keyword: 'cash', name: 'Cash' },
  { keyword: 'tunai', name: 'Cash' },
  { keyword: 'dompet', name: 'Cash' },
];

const CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[]; defaultTag: NeedOrWant }> = [
  {
    category: 'Makan',
    keywords: [
      'makan',
      'sarapan',
      'siang',
      'malam',
      'kopi',
      'ngopi',
      'jajan',
      'nasi',
      'mie',
      'bakso',
      'warteg',
      'minum',
      'es teh',
      'cemilan',
      'snack',
      'geprek',
      'soto',
      'bubur',
    ],
    defaultTag: 'perlu',
  },
  {
    category: 'Transport',
    keywords: ['bensin', 'pertalite', 'pertamax', 'parkir', 'tol', 'ojek', 'angkot', 'kereta', 'krl', 'tj', 'bus', 'transjakarta', 'servis motor', 'tambal ban'],
    defaultTag: 'perlu',
  },
  {
    category: 'Tagihan',
    keywords: ['listrik', 'token', 'pln', 'air', 'pdam', 'kos', 'kontrakan', 'sewa', 'wifi', 'indihome', 'cicilan', 'paylater', 'bpjs', 'tagihan', 'pajak'],
    defaultTag: 'perlu',
  },
  {
    category: 'Kebutuhan Rumah',
    keywords: ['sabun', 'shampo', 'beras', 'galon', 'gas', 'lpg', 'elpiji', 'deterjen', 'laundry', 'indomaret', 'alfamart', 'pasar', 'sayur', 'belanja bulanan'],
    defaultTag: 'perlu',
  },
  {
    category: 'Kesehatan',
    keywords: ['obat', 'apotek', 'dokter', 'klinik', 'vitamin', 'puskesmas', 'rumah sakit', 'periksa'],
    defaultTag: 'perlu',
  },
  {
    category: 'Pulsa/Kuota',
    keywords: ['pulsa', 'kuota', 'paket data', 'internet', 'telkomsel', 'xl', 'indosat', 'tri', 'axis', 'by.u'],
    defaultTag: 'perlu',
  },
  {
    category: 'Cari Kerja',
    keywords: ['cetak cv', 'print cv', 'lamaran', 'interview', 'wawancara', 'fotokopi', 'materai', 'skck', 'cari kerja'],
    defaultTag: 'perlu',
  },
  {
    category: 'Hiburan',
    keywords: ['nonton', 'bioskop', 'netflix', 'spotify', 'game', 'topup game', 'nongkrong', 'karaoke', 'jalan-jalan', 'liburan', 'boba'],
    defaultTag: 'pengen',
  },
];

const WANT_HINT_KEYWORDS = ['kopi', 'ngopi', 'boba', 'jajan', 'snack', 'bioskop', 'nonton', 'game', 'nongkrong', 'belanja lucu', 'checkout'];

/**
 * Mengurai nominal Rupiah dari teks bahasa natural Indonesia.
 * Mendukung:
 * - "25rb", "25 ribu", "25k", "25.5rb", "25,5rb"
 * - "5jt", "5 juta", "1.5jt", "1,5 juta"
 * - "20.000", "1.250.000", "25000"
 * Selalu mengembalikan bilangan bulat Rupiah (integer) atau null.
 */
export function parseIndonesianAmount(input: string): number | null {
  const lower = input.toLowerCase();

  // 1. Cek nominal dengan akhiran juta / jt
  const millionMatch = lower.match(/(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(?:jt|juta)\b/);
  if (millionMatch && millionMatch[1]) {
    const normalized = millionMatch[1].replace(',', '.');
    const num = Number.parseFloat(normalized);
    if (Number.isFinite(num) && num > 0) {
      return Math.round(num * 1_000_000);
    }
  }

  // 2. Cek nominal dengan akhiran ribu / rb / k
  const thousandMatch = lower.match(/(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(?:rb|ribu|k)\b/);
  if (thousandMatch && thousandMatch[1]) {
    const normalized = thousandMatch[1].replace(',', '.');
    const num = Number.parseFloat(normalized);
    if (Number.isFinite(num) && num > 0) {
      return Math.round(num * 1_000);
    }
  }

  // 3. Cek nominal dengan pemisah ribuan titik (contoh: 20.000 atau 1.250.000)
  const dottedMatch = lower.match(/(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})+)\b/);
  if (dottedMatch && dottedMatch[1]) {
    const clean = dottedMatch[1].replace(/\./g, '');
    const num = Number.parseInt(clean, 10);
    if (Number.isFinite(num) && num > 0) {
      return num;
    }
  }

  // 4. Cek angka polos >= 100 (agar angka jam seperti "5 jam" tidak dianggap nominal)
  // Hapus dulu frasa jam kerja agar tidak tertangkap sebagai nominal
  const withoutHours = lower.replace(/\b\d+(?:[.,]\d+)?\s*(?:jam|j)\b/g, '');
  const plainMatches = withoutHours.match(/\b\d{3,}\b/g);
  if (plainMatches && plainMatches.length > 0) {
    const num = Number.parseInt(plainMatches[0], 10);
    if (Number.isFinite(num) && num > 0) {
      return num;
    }
  }

  return null;
}

/**
 * Mengurai durasi jam kerja dari teks (contoh: "ngojek 85rb 5 jam" atau "kuli 120rb 7.5jam").
 */
export function parseWorkHours(input: string): number | null {
  const lower = input.toLowerCase();
  const match = lower.match(/\b(\d+(?:[.,]\d+)?)\s*jam\b/);
  if (match && match[1]) {
    const num = Number.parseFloat(match[1].replace(',', '.'));
    if (Number.isFinite(num) && num > 0 && num <= 24) {
      return num;
    }
  }
  return null;
}

function findWalletInText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const w of WALLET_KEYWORDS) {
    const regex = new RegExp(`\\b${w.keyword}\\b`, 'i');
    if (regex.test(lower)) {
      return w.name;
    }
  }
  return null;
}

/**
 * Parser utama transaksi bahasa natural Indonesia (fungsi murni, tanpa UI/DB).
 */
export function parseNaturalTransaction(rawInput: string): ParsedNaturalTransaction {
  const trimmed = rawInput.trim();
  const lower = trimmed.toLowerCase();

  const amount = parseIndonesianAmount(trimmed);
  const workHours = parseWorkHours(trimmed);

  // Deteksi tipe: transfer, income, atau expense
  let type: TransactionType = 'expense';
  let incomeNature: IncomeNature = 'kerja';

  const isTransfer = TRANSFER_KEYWORDS.some((kw) => lower.includes(kw));
  const isNonWorkIncome = NON_WORK_INCOME_KEYWORDS.some((kw) => lower.includes(kw));
  const isWorkIncome = INCOME_KEYWORDS.some((kw) => {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    return regex.test(lower);
  });

  if (isTransfer) {
    type = 'transfer';
  } else if (isNonWorkIncome) {
    type = 'income';
    incomeNature = 'non_kerja';
  } else if (isWorkIncome) {
    type = 'income';
    incomeNature = 'kerja';
  }

  // Deteksi dompet asal & tujuan
  let guessedWalletName: string | null = null;
  let guessedToWalletName: string | null = null;

  if (type === 'transfer') {
    // Pola: "transfer dari bank ke gopay 100rb" atau "transfer ke gopay 100rb"
    const fromToMatch = lower.match(/dari\s+([a-z0-9]+)\s+ke\s+([a-z0-9]+)/);
    const toOnlyMatch = lower.match(/ke\s+([a-z0-9]+)/);
    if (fromToMatch) {
      guessedWalletName = findWalletInText(fromToMatch[1] ?? '');
      guessedToWalletName = findWalletInText(fromToMatch[2] ?? '');
    } else if (toOnlyMatch) {
      guessedToWalletName = findWalletInText(toOnlyMatch[1] ?? '');
    } else {
      guessedToWalletName = findWalletInText(lower);
    }
  } else {
    guessedWalletName = findWalletInText(lower);
  }

  // Deteksi kategori untuk pengeluaran
  let guessedCategoryName: string | null = null;
  let needOrWant: NeedOrWant | null = null;
  let isJobSearchExpense = false;

  if (type === 'expense') {
    for (const entry of CATEGORY_KEYWORDS) {
      const matched = entry.keywords.some((kw) => {
        const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(lower);
      });
      if (matched) {
        guessedCategoryName = entry.category;
        needOrWant = entry.defaultTag;
        if (entry.category === 'Cari Kerja') {
          isJobSearchExpense = true;
        }
        break;
      }
    }
    if (!guessedCategoryName) {
      guessedCategoryName = 'Lain-lain';
      needOrWant = 'perlu';
    }
    if (
      WANT_HINT_KEYWORDS.some((kw) => {
        const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(lower);
      })
    ) {
      needOrWant = 'pengen';
    }
  }

  // Deteksi sumber / jenis kerja / klien untuk pemasukan
  let sourceOrClient: string | null = null;
  if (type === 'income') {
    const cleanedSource = trimmed
      .replace(/(?:rp\.?\s*)?\d+(?:[.,]\d+)?\s*(?:jt|juta|rb|ribu|k)\b/gi, '')
      .replace(/(?:rp\.?\s*)?\d{1,3}(?:\.\d{3})+\b/g, '')
      .replace(/\b\d+(?:[.,]\d+)?\s*jam\b/gi, '')
      .replace(/\b\d{3,}\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    sourceOrClient = cleanedSource || (incomeNature === 'non_kerja' ? 'Bantuan / Kiriman' : 'Pemasukan');
  }

  return {
    type,
    amount,
    guessedCategoryName,
    guessedWalletName,
    guessedToWalletName,
    sourceOrClient,
    workHours,
    incomeNature,
    isJobSearchExpense,
    needOrWant,
    note: trimmed,
  };
}
