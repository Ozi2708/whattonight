import { useMemo, useState } from 'react'
import { Poster } from './Poster'
import { IconCheck, IconHeart } from './icons'
import { MOVIES, type Movie } from '../movies/catalog'

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
  onOpen: (m: Movie) => void
}

export function CatalogScreen({ seen, favorites, onOpen }: Props) {
  const [view, setView] = useState<View>('all')

  const movies = useMemo(() => {
    switch (view) {
      case 'todo':
        return MOVIES.filter((m) => !seen.has(m.id))
      case 'seen':
        return MOVIES.filter((m) => seen.has(m.id))
      case 'favorites':
        return MOVIES.filter((m) => favorites.has(m.id))
      default:
        return MOVIES
    }
  }, [view, seen, favorites])

  const progress = Math.round((seen.size / MOVIES.length) * 100)

  return (
    <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6">
      <header>
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight">
          Les {MOVIES.length} films à voir
        </h1>

        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <p className="text-[15px] font-medium">
              <span className="text-gold">{seen.size}</span>
              <span className="text-muted"> / {MOVIES.length} films vus</span>
            </p>
            <p className="text-[13px] font-semibold text-muted">{progress} %</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
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
          {movies.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onOpen(m)}
                className="group relative block w-full text-left"
              >
                <Poster
                  src={m.posterSmall ?? m.image}
                  alt={m.title}
                  className={`w-full rounded-xl border border-white/10 transition-opacity ${
                    seen.has(m.id) ? 'opacity-55' : ''
                  }`}
                  style={{ aspectRatio: '2 / 3' }}
                />

                {seen.has(m.id) && (
                  <span
                    className="absolute top-1.5 left-1.5 grid h-6 w-6 place-items-center rounded-full bg-gold text-ink shadow-lg"
                    aria-label="Déjà vu"
                  >
                    <IconCheck className="h-3.5! w-3.5!" />
                  </span>
                )}
                {favorites.has(m.id) && (
                  <span
                    className="absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-gold backdrop-blur"
                    aria-label="Favori"
                  >
                    <IconHeart className="h-3.5! w-3.5!" filled />
                  </span>
                )}

                <p className="mt-1.5 truncate text-[11.5px] font-medium text-cream/80">{m.title}</p>
                <p className="text-[11px] text-muted">{m.year}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
