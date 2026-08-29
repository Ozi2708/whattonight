import { useState, type CSSProperties } from 'react'

interface Props {
  src: string | null
  alt: string
  className?: string
  /** Chargement prioritaire pour les affiches immédiatement visibles. */
  eager?: boolean
  style?: CSSProperties
}

/**
 * Affiche de film. Gère l'apparition en fondu et un repli typographique quand
 * l'image manque ou échoue — jamais de trou noir dans la grille.
 */
export function Poster({ src, alt, className = '', eager = false, style }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div className={`relative overflow-hidden bg-surface-2 ${className}`} style={style}>
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover transition-opacity duration-500 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-surface-2 to-ink p-3">
          <span className="text-center text-[11px] leading-tight font-medium text-muted">{alt}</span>
        </div>
      )}
    </div>
  )
}
