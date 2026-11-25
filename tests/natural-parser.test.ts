import { describe, it, expect } from 'vitest';
import { parseIndonesianAmount, parseNaturalTransaction, parseWorkHours } from '@/lib/natural-parser';

describe('parseIndonesianAmount', () => {
  it('mendukung akhiran rb, ribu, k', () => {
    expect(parseIndonesianAmount('makan siang 25rb')).toBe(25000);
    expect(parseIndonesianAmount('kopi 18 ribu')).toBe(18000);
    expect(parseIndonesianAmount('parkir 5k')).toBe(5000);
    expect(parseIndonesianAmount('bensin 22.5rb')).toBe(22500);
    expect(parseIndonesianAmount('bensin 22,5rb')).toBe(22500);
  });

  it('mendukung akhiran jt dan juta', () => {
    expect(parseIndonesianAmount('gaji 5jt')).toBe(5000000);
    expect(parseIndonesianAmount('bayaran proyek 1.5 juta')).toBe(1500000);
    expect(parseIndonesianAmount('freelance desain 2,25jt')).toBe(2250000);
  });

  it('mendukung titik sebagai pemisah ribuan dan angka polos', () => {
    expect(parseIndonesianAmount('bensin 20.000')).toBe(20000);
    expect(parseIndonesianAmount('kontrakan 1.250.000')).toBe(1250000);
    expect(parseIndonesianAmount('beli galon 21000')).toBe(21000);
  });

  it('tidak salah menganggap angka jam kerja sebagai nominal', () => {
    expect(parseIndonesianAmount('ngojek 5 jam')).toBeNull();
    expect(parseIndonesianAmount('ngojek 85rb 5 jam')).toBe(85000);
  });
});

describe('parseWorkHours', () => {
  it('mengekstrak durasi jam kerja termasuk setengah jam', () => {
    expect(parseWorkHours('ngojek 85rb 5 jam')).toBe(5);
    expect(parseWorkHours('kuli 120rb 7.5jam')).toBe(7.5);
    expect(parseWorkHours('jaga toko 4,5 jam 60rb')).toBe(4.5);
    expect(parseWorkHours('makan siang 25rb')).toBeNull();
  });
});

describe('parseNaturalTransaction', () => {
  it('mem-parse pengeluaran makan siang 25rb', () => {
    const res = parseNaturalTransaction('makan siang 25rb');
    expect(res.type).toBe('expense');
    expect(res.amount).toBe(25000);
    expect(res.guessedCategoryName).toBe('Makan');
    expect(res.needOrWant).toBe('perlu');
  });

  it('mem-parse pengeluaran pengen seperti ngopi/boba', () => {
    const res = parseNaturalTransaction('beli boba 28k pakai gopay');
    expect(res.type).toBe('expense');
    expect(res.amount).toBe(28000);
    expect(res.guessedWalletName).toBe('GoPay');
    expect(res.needOrWant).toBe('pengen');
  });

  it('mem-parse gaji 5jt sebagai pemasukan kerja', () => {
    const res = parseNaturalTransaction('gaji 5jt masuk bank');
    expect(res.type).toBe('income');
    expect(res.incomeNature).toBe('kerja');
    expect(res.amount).toBe(5000000);
    expect(res.guessedWalletName).toBe('Bank');
  });

  it('mem-parse pemasukan harian serabutan lengkap dengan jam kerja', () => {
    const res = parseNaturalTransaction('ngojek 85rb 5 jam');
    expect(res.type).toBe('income');
    expect(res.incomeNature).toBe('kerja');
    expect(res.amount).toBe(85000);
    expect(res.workHours).toBe(5);
    expect(res.sourceOrClient?.toLowerCase()).toContain('ngojek');
  });

  it('memisahkan pemasukan non-kerja seperti bansos, kiriman keluarga, Prakerja', () => {
    const res1 = parseNaturalTransaction('bansos 300rb');
    expect(res1.type).toBe('income');
    expect(res1.incomeNature).toBe('non_kerja');
    expect(res1.amount).toBe(300000);

    const res2 = parseNaturalTransaction('kiriman keluarga 500rb');
    expect(res2.type).toBe('income');
    expect(res2.incomeNature).toBe('non_kerja');
  });

  it('mem-parse transfer antar dompet', () => {
    const res = parseNaturalTransaction('transfer ke gopay 100rb');
    expect(res.type).toBe('transfer');
    expect(res.amount).toBe(100000);
    expect(res.guessedToWalletName).toBe('GoPay');

    const res2 = parseNaturalTransaction('transfer dari bank ke dana 250rb');
    expect(res2.type).toBe('transfer');
    expect(res2.guessedWalletName).toBe('Bank');
    expect(res2.guessedToWalletName).toBe('Dana');
    expect(res2.amount).toBe(250000);
  });

  it('mendeteksi pengeluaran pos biaya cari kerja', () => {
    const res = parseNaturalTransaction('cetak cv dan fotokopi 15rb');
    expect(res.type).toBe('expense');
    expect(res.guessedCategoryName).toBe('Cari Kerja');
    expect(res.isJobSearchExpense).toBe(true);
    expect(res.amount).toBe(15000);
  });
});
