import type { ReactNode } from 'react'

interface Props {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
}

/** Pastille de filtre / segment. Un seul style pour toute l'app. */
export function Chip({ active = false, onClick, children, className = '' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors ${
        active
          ? 'border-gold bg-gold text-ink'
          : 'border-line bg-surface text-cream/80 hover:border-white/25'
      } ${className}`}
    >
      {children}
    </button>
  )
}
