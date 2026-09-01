import { useEffect, useMemo, useRef, useState } from 'react'
import { Poster } from './Poster'
import { SeenStamp } from './SeenStamp'
import { IconHeart } from './icons'
import { WORKS, type Work } from '../movies/catalog'

type View = 'all' | 'todo' | 'seen' | 'favorites'

const VIEWS: { id: View; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'todo', label: 'À voir' },
  { id: 'seen', label: 'Déjà vus' },
  { id: 'favorites', label: 'Favoris' },
]

interface Props {
  seen: Set<string>
  favorites: Set<string>
  onOpen: (m: Work) => void
}

/** Petite phrase de progression. Jamais de points ni de badges : une collection. */
function milestone(count: number, total: number): string {
  if (count === 0) return 'La collection est vierge.'
  if (count === total) return 'Collection complète. Rien que ça.'
  if (count >= total * 0.75) return `Plus que ${total - count} et la liste est bouclée.`
  if (count >= total * 0.4) return 'La collection prend forme.'
  if (count >= total * 0.15) return 'Ça se remplit.'
  return `${total - count} affiches encore vierges.`
}

export function CatalogScreen({ seen, favorites, onOpen }: Props) {
  const [view, setView] = useState<View>('all')

  // On n'anime le tampon que sur les films qui VIENNENT d'être marqués.
  // Animer toute la grille à chaque rendu donnerait un écran nerveux et
  // ferait perdre l'information : c'est le changement qui doit sauter aux yeux.
  const known = useRef<Set<string> | null>(null)
  const [freshlySeen, setFreshlySeen] = useState<Set<string>>(new Set())
  useEffect(() => {
    const previous = known.current
    known.current = new Set(seen)
    if (!previous) return
    const added = [...seen].filter((id) => !previous.has(id))
    if (added.length) setFreshlySeen(new Set(added))
  }, [seen])

  const movies = useMemo(() => {
    switch (view) {
      case 'todo':
        return WORKS.filter((m) => !seen.has(m.id))
      case 'seen':
        return WORKS.filter((m) => seen.has(m.id))
      case 'favorites':
        return WORKS.filter((m) => favorites.has(m.id))
      default:
        return WORKS
    }
  }, [view, seen, favorites])

  const progress = Math.round((seen.size / WORKS.length) * 100)

  return (
    <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6">
      <header>
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight">
          Les {WORKS.length} films à voir
        </h1>

        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <p className="text-[15px] font-medium">
              <span className="text-gold">{seen.size}</span>
              <span className="text-muted"> / {WORKS.length} films vus</span>
            </p>
            <p className="text-[13px] font-semibold text-muted">{progress} %</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-[12.5px] text-muted">{milestone(seen.size, WORKS.length)}</p>
        </div>
      </header>

      <div className="mt-5 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            aria-pressed={view === v.id}
            className={`rounded-full border px-4 py-2 text-[13px] font-medium whitespace-nowrap transition-colors ${
              view === v.id
                ? 'border-cream bg-cream text-ink'
                : 'border-line bg-surface text-cream/75'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {movies.length === 0 ? (
        <p className="py-20 text-center text-[14px] text-muted">
          {view === 'favorites' ? 'Aucun favori pour l’instant.' : 'Rien ici pour l’instant.'}
        </p>
      ) : (
        <ul className="mt-5 grid grid-cols-3 gap-2.5">
          {movies.map((m) => {
            const isSeen = seen.has(m.id)
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onOpen(m)}
                  className="group block w-full text-left"
                >
                  <span className="relative block overflow-hidden rounded-xl border border-white/10">
                    <Poster
                      src={m.posterSmall ?? m.image}
                      alt={m.title}
                      className={`w-full transition-[filter] duration-500 ${
                        // Assombri et désaturé : l'affiche reste reconnaissable,
                        // mais recule visuellement derrière le tampon.
                        isSeen ? 'brightness-[0.42] saturate-[0.55]' : ''
                      }`}
                      style={{ aspectRatio: '2 / 3' }}
                    />

                    {isSeen && <SeenStamp animate={freshlySeen.has(m.id)} />}

                    {favorites.has(m.id) && (
                      <span
                        className="absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/65 text-gold backdrop-blur"
                        aria-label="Favori"
                      >
                        <IconHeart className="h-3.5! w-3.5!" filled />
                      </span>
                    )}
                  </span>

                  <p
                    className={`mt-1.5 truncate text-[11.5px] font-medium ${
                      isSeen ? 'text-cream/45' : 'text-cream/80'
                    }`}
                  >
                    {m.title}
                  </p>
                  <p className="text-[11px] text-muted">{m.year}</p>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
