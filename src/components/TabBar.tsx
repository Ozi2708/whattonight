import { useLayoutEffect, useRef } from 'react'
import { IconGrid, IconSlot, IconUser, IconVenn } from './icons'

export type Tab = 'duo' | 'roulette' | 'catalog' | 'profile'

const TABS: { id: Tab; label: string; Icon: (p: { className?: string }) => React.ReactElement }[] = [
  { id: 'duo', label: 'Duo', Icon: IconVenn },
  { id: 'roulette', label: 'Solo', Icon: IconSlot },
  { id: 'catalog', label: 'Collection', Icon: IconGrid },
  { id: 'profile', label: 'Profil', Icon: IconUser },
]

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const ref = useRef<HTMLElement>(null)

  // La barre publie sa propre hauteur dans `--tabbar-h`.
  //
  // Elle est fixée en bas de l'écran : tout ce qui doit rester au-dessus d'elle
  // a besoin de cette valeur. La coder en dur menait droit au mur — le bouton
  // « C'est envoyé » du formulaire d'envies se retrouvait masqué à 82 % dès
  // qu'une envie était cochée, sans qu'aucun défilement puisse le révéler.
  // Mesurer, plutôt que deviner : la hauteur dépend de la police, du zoom
  // système et de la zone sûre de l'appareil.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const publish = () =>
      document.documentElement.style.setProperty('--tabbar-h', `${el.offsetHeight}px`)
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <nav
      ref={ref}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/85 backdrop-blur-xl"
    >
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
