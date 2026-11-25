/**
 * Helper murni untuk memformat dan mem-parse bilangan bulat Rupiah.
 * Aturan wajib:
 * - Uang disimpan sebagai bilangan bulat (integer). Tidak boleh ada float.
 * - Contoh output: formatRupiah(1250000) -> "Rp1.250.000"
 * - Contoh negatif: formatRupiah(-50000) -> "-Rp50.000"
 */
export function formatRupiah(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new Error('Nominal harus berupa angka yang valid');
  }
  const rounded = Math.round(amount);
  const isNegative = rounded < 0;
  const absStr = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return isNegative ? `-Rp${absStr}` : `Rp${absStr}`;
}

/**
 * Memastikan nilai uang adalah integer bulat Rupiah.
 */
export function toRupiahInt(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value);
}
