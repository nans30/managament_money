import { describe, it, expect } from 'vitest';
import { formatRupiah, toRupiahInt } from '@/lib/format';

describe('formatRupiah & toRupiahInt', () => {
  it('memformat angka positif dengan pemisah titik ribuan', () => {
    expect(formatRupiah(0)).toBe('Rp0');
    expect(formatRupiah(500)).toBe('Rp500');
    expect(formatRupiah(25000)).toBe('Rp25.000');
    expect(formatRupiah(1250000)).toBe('Rp1.250.000');
    expect(formatRupiah(1000000000)).toBe('Rp1.000.000.000');
  });

  it('memformat angka negatif dengan benar', () => {
    expect(formatRupiah(-50000)).toBe('-Rp50.000');
  });

  it('membulatkan nilai ke bilangan bulat rupiah', () => {
    expect(toRupiahInt(12345.6)).toBe(12346);
    expect(toRupiahInt(Number.NaN)).toBe(0);
  });
});
