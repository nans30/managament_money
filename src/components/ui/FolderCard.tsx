import type { ReactNode } from 'react';

interface FolderCardProps {
  title: ReactNode;
  variant: 'lime' | 'coral';
  shoulder?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Kartu khas bergaya Folder-Tab (Acid Lime / Coral) dengan bahu gelap di kanan atas.
 * Dipakai konsisten di seluruh tab (Catat Cepat, Freelance, Serabutan, Tagihan, Utang, Cloud).
 */
export function FolderCard({
  title,
  variant,
  shoulder,
  children,
  className = '',
}: FolderCardProps) {
  const bgClass = variant === 'lime' ? 'bg-limecard' : 'bg-coral';

  return (
    <section className={`overflow-hidden rounded-[28px] bg-obsidian-muted shadow-sm ${className}`}>
      <div className="flex items-stretch">
        <div
          className={`flex items-center gap-2 rounded-tr-[22px] ${bgClass} px-5 pt-3.5 pb-1.5 text-xs font-semibold text-obsidian`}
        >
          {title}
        </div>
        <div className="flex flex-1 items-center justify-end gap-2 px-4 py-2">{shoulder}</div>
      </div>
      <div className={`rounded-tr-[24px] ${bgClass} px-5 pt-3 pb-5 text-obsidian`}>{children}</div>
    </section>
  );
}
