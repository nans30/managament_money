/**
 * Struktur i18n sederhana agar bahasa lain mudah ditambahkan di kemudian hari.
 * Seluruh salinan Bahasa Indonesia menggunakan nada santai, sopan, praktis,
 * dan TIDAK MENGHAKIMI (dilarang kata seperti "boros" atau menyalahkan user).
 */

export type Locale = 'id';

export const dictionary = {
  id: {
    appName: 'DompetTenang',
    appTagline: 'Catatan keuangan tenang untuk penghasilan apa pun — tetap, freelance, maupun harian.',
    profiles: {
      fixed: {
        title: 'Gaji Tetap',
        subtitle: 'Penghasilan rutin bulanan dengan periode tanggal gajian custom.',
      },
      freelance: {
        title: 'Freelance / Tidak Menentu',
        subtitle: 'Penghasilan proyek/klien, alokasi otomatis, runway & gaji ke diri sendiri.',
      },
      daily: {
        title: 'Serabutan / Transisi',
        subtitle: 'Penghasilan harian, hitung ketahanan hari, mode hemat & hasil per jam kerja.',
      },
    },
    nav: {
      dashboard: 'Beranda',
      transactions: 'Transaksi',
      profileFeatures: 'Fitur Profil',
      planning: 'Tagihan & Target',
      settings: 'Pengaturan & Data',
    },
    quickAdd: {
      title: 'Catat Cepat (< 5 detik)',
      naturalPlaceholder: 'Ketik cepat: "makan siang 25rb", "ngojek 85rb 5jam", "transfer ke gopay 100rb"...',
      parseHint: 'Ketik kalimat biasa, sistem otomatis menebak nominal, kategori & dompet.',
      saveButton: 'Simpan Transaksi',
    },
    warnings: {
      budgetSoft80: (category: string, pct: number) =>
        `Info tenang: Pos ${category} sudah terpakai ${pct}% dari rencana periode ini.`,
      budgetReached100: (category: string) =>
        `Pos ${category} sudah melewati rencana awal. Tidak apa-apa, kita sesuaikan prioritas hari berikutnya.`,
      survivalAdvice: (days: number, savePerDayFormatted: string, extraDays: number) =>
        `Uang cukup untuk ${days} hari. Kalau hemat ${savePerDayFormatted} per hari, bisa jadi ${ extraDays } hari.`,
      emergencyModeActive:
        'Mode Hemat Darurat aktif: Budget otomatis difokuskan ke kebutuhan Wajib dulu agar napas keuangan lebih panjang.',
    },
  },
} as const;

export function t(locale: Locale = 'id') {
  return dictionary[locale];
}
