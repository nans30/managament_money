import type { Wallet } from '@/lib/types';

interface WalletLogoProps {
  type: Wallet['type'];
  name?: string;
  className?: string;
}

/**
 * Logo monokrom dompet & e-wallet Indonesia (Cash, Bank, GoPay, OVO, Dana, ShopeePay)
 * yang diwarnai seragam mengikuti palet UI aplikasi (Obsidian + Acid Lime).
 */
export function WalletLogo({ type, name = '', className = 'h-5 w-5' }: WalletLogoProps) {
  const lower = name.toLowerCase();
  const resolvedType: Wallet['type'] =
    type !== 'custom'
      ? type
      : lower.includes('gopay')
        ? 'gopay'
        : lower.includes('ovo')
          ? 'ovo'
          : lower.includes('dana')
            ? 'dana'
            : lower.includes('shopee') || lower.includes('spay')
              ? 'shopeepay'
              : lower.includes('bank') ||
                  lower.includes('bca') ||
                  lower.includes('bri') ||
                  lower.includes('bni') ||
                  lower.includes('mandiri') ||
                  lower.includes('jago') ||
                  lower.includes('seabank')
                ? 'bank'
                : lower.includes('cash') || lower.includes('tunai')
                  ? 'cash'
                  : 'custom';

  switch (resolvedType) {
    case 'gopay':
      // Siluet ikonik GoPay: dompet membulat dengan tombol lingkaran khas di tengah-kanan
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="2.5" y="5" width="19" height="14" rx="4.5" stroke="currentColor" strokeWidth="2.1" />
          <path d="M14.5 9.5H21.5V14.5H14.5C13.12 14.5 12 13.38 12 12C12 10.62 13.12 9.5 14.5 9.5Z" fill="currentColor" />
          <circle cx="15" cy="12" r="1.2" fill="#111211" />
        </svg>
      );

    case 'ovo':
      // Emblem ikonik OVO: tiga bentuk geometris O - V - O dalam kapsul bersih
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <circle cx="5.5" cy="12" r="2.7" stroke="currentColor" strokeWidth="2" />
          <path d="M10.2 9.4L12 14.6L13.8 9.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="18.5" cy="12" r="2.7" stroke="currentColor" strokeWidth="2" />
        </svg>
      );

    case 'dana':
      // Siluet ikonik DANA: pita gelombang terlipat (folded wave ribbon)
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M3.5 9.2C6.2 7.2 9.2 7.2 12 9.2C14.8 11.2 17.8 11.2 20.5 9.2V14.8C17.8 16.8 14.8 16.8 12 14.8C9.2 12.8 6.2 12.8 3.5 14.8V9.2Z"
            fill="currentColor"
          />
          <path
            d="M3.5 12C6.2 10.3 9.2 10.3 12 12C14.8 13.7 17.8 13.7 20.5 12"
            stroke="#111211"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'shopeepay':
      // Siluet ikonik ShopeePay: tas belanja dengan huruf S di tengah
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M8.5 8V6.5C8.5 4.57 10.07 3 12 3C13.93 3 15.5 4.57 15.5 6.5V8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect x="4" y="8" width="16" height="13" rx="3" stroke="currentColor" strokeWidth="2" />
          <path
            d="M14.2 12.2C14.2 11.3 13.2 10.8 12 10.8C10.8 10.8 9.9 11.3 9.9 12.1C9.9 13 10.8 13.3 12.1 13.6C13.4 13.9 14.3 14.3 14.3 15.3C14.3 16.3 13.3 17 12 17C10.7 17 9.8 16.4 9.7 15.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'bank':
      // Ikon gedung bank berkolom klasik
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M3 9.5L12 4L21 9.5H3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M6 10V17M10 10V17M14 10V17M18 10V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M3 20H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'cash':
      // Ikon uang kertas tunai
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="2.5" y="6" width="19" height="12" rx="2.5" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="2" />
          <path d="M6 9.5H6.01M18 14.5H18.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );

    default:
      // Dompet custom umum
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}
