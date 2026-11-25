import {
  BriefcaseIcon,
  HomeIcon,
  ListIcon,
  SettingsIcon,
  TargetIcon,
} from '@/components/Icons';

export type ActiveTab = 'dashboard' | 'transactions' | 'profile' | 'planning' | 'settings';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelect: (tab: ActiveTab) => void;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Beranda', Icon: HomeIcon },
  { id: 'transactions', label: 'Riwayat', Icon: ListIcon },
  { id: 'profile', label: 'Profil', Icon: BriefcaseIcon },
  { id: 'planning', label: 'Rencana', Icon: TargetIcon },
  { id: 'settings', label: 'Atur', Icon: SettingsIcon },
] as const;

export function BottomNav({ activeTab, onSelect }: BottomNavProps) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed bottom-4 left-4 right-4 z-20 mx-auto max-w-md rounded-full border border-white/10 bg-obsidian/95 px-2 py-1.5 shadow-xl backdrop-blur-md"
    >
      <div className="grid grid-cols-5">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[10px] font-medium transition ${
                active
                  ? 'bg-limecard text-obsidian font-semibold'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
