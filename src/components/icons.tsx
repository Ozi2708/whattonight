/** Icônes inline : pas de dépendance, taille pilotée par `currentColor` / `em`. */

type P = { className?: string }

const base = 'h-[1.25em] w-[1.25em] shrink-0'

export const IconCheck = ({ className = '' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className}`} aria-hidden>
    <path d="M4.5 12.5 9.5 17.5 19.5 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IconHeart = ({ className = '', filled = false }: P & { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} className={`${base} ${className}`} aria-hidden>
    <path
      d="M12 20.5C12 20.5 3.5 15.5 3.5 9.6A4.6 4.6 0 0 1 12 7.1a4.6 4.6 0 0 1 8.5 2.5c0 5.9-8.5 10.9-8.5 10.9Z"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinejoin="round"
    />
  </svg>
)

export const IconEye = ({ className = '' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className}`} aria-hidden>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
  </svg>
)

export const IconRefresh = ({ className = '' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className}`} aria-hidden>
    <path d="M20 11a8 8 0 1 0-.8 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M20.5 4.5V11H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IconSliders = ({ className = '' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className}`} aria-hidden>
    <path d="M4 8h9M17 8h3M4 16h3M11 16h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="15" cy="8" r="2.2" stroke="currentColor" strokeWidth="2" />
    <circle cx="9" cy="16" r="2.2" stroke="currentColor" strokeWidth="2" />
  </svg>
)

export const IconClose = ({ className = '' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className}`} aria-hidden>
    <path d="M6 6 18 18M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
)

export const IconStar = ({ className = '' }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={`${base} ${className}`} aria-hidden>
    <path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" />
  </svg>
)

export const IconSlot = ({ className = '' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className}`} aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.9" />
    <path d="M9 5v14M15 5v14" stroke="currentColor" strokeWidth="1.9" />
  </svg>
)

export const IconGrid = ({ className = '' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className}`} aria-hidden>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.9" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.9" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.9" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.9" />
  </svg>
)

export const IconUser = ({ className = '' }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className}`} aria-hidden>
    <circle cx="12" cy="8.5" r="3.8" stroke="currentColor" strokeWidth="1.9" />
    <path d="M4.5 20c1.3-3.6 4.1-5.4 7.5-5.4s6.2 1.8 7.5 5.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
  </svg>
)
