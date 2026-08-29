import { IconGrid, IconSlot, IconUser, IconVenn } from './icons'

export type Tab = 'duo' | 'roulette' | 'catalog' | 'profile'

const TABS: { id: Tab; label: string; Icon: (p: { className?: string }) => React.ReactElement }[] = [
  { id: 'duo', label: 'Duo', Icon: IconVenn },
  { id: 'roulette', label: 'Solo', Icon: IconSlot },
  { id: 'catalog', label: 'Les 100', Icon: IconGrid },
  { id: 'profile', label: 'Profil', Icon: IconUser },
]

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/85 backdrop-blur-xl">
      <ul className="mx-auto flex max-w-lg pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? 'text-gold' : 'text-muted'
                }`}
              >
                <Icon className="h-[22px]! w-[22px]!" />
                {label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
