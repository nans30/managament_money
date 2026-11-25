import type { ReactNode } from 'react';

interface PaperCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Kartu putih bersih (.surface-paper) dengan teks hitam pekat yang kontrasnya
 * selalu tajam di Light Mode maupun Dark Mode.
 */
export function PaperCard({ children, className = '' }: PaperCardProps) {
  return (
    <section className={`surface-paper rounded-[28px] p-5 shadow-sm ${className}`}>
      {children}
    </section>
  );
}
