import { WalletIcon } from '@/components/Icons';

interface LoadingScreenProps {
  appName: string;
}

export function LoadingScreen({ appName }: LoadingScreenProps) {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-2xl border-2 border-limecard/30 border-t-obsidian dark:border-t-limecard animate-spin" />
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-limecard text-obsidian shadow-sm animate-pulse">
          <WalletIcon className="h-6 w-6" />
        </span>
      </div>

      <p className="mt-5 text-base font-semibold tracking-tight text-obsidian dark:text-limecard">
        {appName}
      </p>
      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
        Menyiapkan catatan keuangan lokal...
      </p>

      <div className="mt-5 flex h-5 items-end gap-1.5" aria-hidden="true">
        <span className="h-2.5 w-1.5 rounded-full bg-obsidian/70 dark:bg-limecard animate-bounce [animation-delay:-0.3s]" />
        <span className="h-4 w-1.5 rounded-full bg-obsidian/80 dark:bg-limecard animate-bounce [animation-delay:-0.2s]" />
        <span className="h-5 w-1.5 rounded-full bg-obsidian dark:bg-limecard animate-bounce [animation-delay:-0.1s]" />
        <span className="h-3.5 w-1.5 rounded-full bg-obsidian/80 dark:bg-limecard animate-bounce [animation-delay:-0.2s]" />
        <span className="h-2.5 w-1.5 rounded-full bg-obsidian/70 dark:bg-limecard animate-bounce [animation-delay:-0.3s]" />
      </div>
    </main>
  );
}
