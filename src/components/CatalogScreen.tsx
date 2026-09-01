import { useEffect, useMemo, useRef, useState } from 'react'
import { Poster } from './Poster'
import { SeenStamp } from './SeenStamp'
import { IconHeart } from './icons'
import { CANON, WORKS, formatEngagement, plural, type Work } from '../movies/catalog'

/** Ce qu'on regarde : la collection, le réservoir, ou les séries. */
type Scope = 'canon' | 'films' | 'series'
/** Où on en est : indépendant de ce qu'on regarde. */
type State = 'all' | 'todo' | 'seen' | 'favorites'

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'canon', label: `Les ${CANON.length}` },
  { id: 'films', label: 'Tous les films' },
  { id: 'series', label: 'Séries' },
]

const STATES: { id: State; label: string }[] = [
  { id: 'all', label: 'Tout' },
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
  const [scope, setScope] = useState<Scope>('canon')
  const [state, setState] = useState<State>('all')

  // On n'anime le tampon que sur les œuvres qui VIENNENT d'être marquées.
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

  const works = useMemo(() => {
    const base =
      scope === 'canon'
        ? CANON
        : scope === 'series'
          ? WORKS.filter((w) => w.kind === 'series')
          : WORKS.filter((w) => w.kind === 'movie')

    switch (state) {
      case 'todo':
        return base.filter((w) => !seen.has(w.id))
      case 'seen':
        return base.filter((w) => seen.has(w.id))
      case 'favorites':
        return base.filter((w) => favorites.has(w.id))
      default:
        return base
    }
  }, [scope, state, seen, favorites])

  // La progression porte TOUJOURS sur le canon, quel que soit l'onglet ouvert.
  // C'est lui la collection : le réservoir n'est pas une liste à compléter.
  const canonSeen = CANON.filter((w) => seen.has(w.id)).length
  const progress = Math.round((canonSeen / CANON.length) * 100)

  return (
    <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6">
      <header>
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight">Collection</h1>

        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <p className="text-[15px] font-medium">
              <span className="text-gold">{canonSeen}</span>
              <span className="text-muted"> / {CANON.length} films à voir</span>
            </p>
            <p className="text-[13px] font-semibold text-muted">{progress} %</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-[12.5px] text-muted">{milestone(canonSeen, CANON.length)}</p>
        </div>
      </header>

      {/* Deux rangées, deux questions distinctes : « quoi » puis « où j'en
          suis ». Les mélanger sur une seule ligne obligeait à relire la
          rangée entière pour comprendre ce qui était filtré. */}
      <div className="mt-5 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
        {SCOPES.map((s) => (
          <Chip key={s.id} on={scope === s.id} onClick={() => setScope(s.id)} accent>
            {s.label}
          </Chip>
        ))}
      </div>
      <div className="mt-2 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
        {STATES.map((s) => (
          <Chip key={s.id} on={state === s.id} onClick={() => setState(s.id)}>
            {s.label}
          </Chip>
        ))}
      </div>

      <p className="mt-3 text-[12.5px] text-muted">
        {plural(works.length, scope === 'series' ? 'série' : 'film')}
        {scope === 'films' && ' · les ★ font partie des 100'}
      </p>

      {works.length === 0 ? (
        <p className="py-20 text-center text-[14px] text-muted">
          {state === 'favorites' ? 'Aucun favori pour l’instant.' : 'Rien ici pour l’instant.'}
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2.5">
          {works.map((w) => {
            const isSeen = seen.has(w.id)
            return (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => onOpen(w)}
                  className="group block w-full text-left"
                >
                  <span className="relative block overflow-hidden rounded-xl border border-white/10">
                    <Poster
                      src={w.posterSmall ?? w.image}
                      alt={w.title}
                      className={`w-full transition-[filter] duration-500 ${
                        // Assombri et désaturé : l'affiche reste reconnaissable,
                        // mais recule visuellement derrière le tampon.
                        isSeen ? 'brightness-[0.42] saturate-[0.55]' : ''
                      }`}
                      style={{ aspectRatio: '2 / 3' }}
                    />

                    {isSeen && <SeenStamp animate={freshlySeen.has(w.id)} />}

                    {/* Le point doré ne s'affiche que hors de la vue « Les 100 » :
                        à l'intérieur, tout en fait partie, il ne dirait rien. */}
                    {scope === 'films' && w.canon && (
                      <span
                        className="absolute top-1.5 left-1.5 h-2.5 w-2.5 rounded-full bg-gold shadow-[0_0_0_2px_rgba(0,0,0,0.5)]"
                        aria-label="Fait partie des 100"
                      />
                    )}

                    {favorites.has(w.id) && (
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
                    {w.title}
                  </p>
                  <p className="truncate text-[11px] text-muted">
                    {w.kind === 'series' ? formatEngagement(w) : w.year}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Chip({
  on,
  accent = false,
  onClick,
  children,
}: {
  on: boolean
  accent?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-4 py-2 text-[13px] font-medium whitespace-nowrap transition-colors ${
        on
          ? accent
            ? 'border-gold bg-gold text-ink'
            : 'border-cream bg-cream text-ink'
          : 'border-line bg-surface text-cream/75'
      }`}
    >
      {children}
    </button>
  )
}
