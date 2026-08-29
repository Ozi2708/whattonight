import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Reel } from './Reel'
import { Poster } from './Poster'
import { Chip } from './Chip'
import { IconCheck, IconHeart, IconRefresh, IconSliders, IconStar } from './icons'
import { MOVIES, formatRuntime, type Movie } from '../movies/catalog'
import { applyFilters, countActive, type Filters } from '../movies/filters'
import { pickNext, shuffle } from '../core/picker'
import { library } from '../core/library'
import { MOVIES_CATEGORY } from '../core/categories'

/** Longueur de la bande et position du gagnant : assez long pour que ça défile. */
const STRIP_LENGTH = 34
const WINNER_AT = 29
const STRIP_UNIQUE = 12

interface Props {
  filters: Filters
  onOpenFilters: () => void
  onToggleUnseen: () => void
  seen: Set<string>
  favorites: Set<string>
  history: string[]
  result: Movie | null
  onResult: (m: Movie | null) => void
  tonight: Movie | null
  onChoose: (m: Movie | null) => void
  onOpenDetails: (m: Movie) => void

  /**
   * Mode duo : le pool est calculé en amont par le moteur de compatibilité.
   * Quand il est fourni, les filtres solo disparaissent — les envies ont déjà
   * été exprimées par les deux personnes.
   */
  externalPool?: Movie[]
  eyebrow?: string
  heading?: string
  ctaLabel?: string
  /** Bloc « pourquoi ce film », sous la fiche résultat. */
  renderReasons?: (movie: Movie) => ReactNode
  /** Signal de refus, pour le futur profil de goûts. */
  onRefuse?: (movie: Movie) => void
}

type Phase = 'idle' | 'spinning'

export function RouletteScreen({
  filters,
  onOpenFilters,
  onToggleUnseen,
  seen,
  favorites,
  history,
  result,
  onResult,
  tonight,
  onChoose,
  onOpenDetails,
  externalPool,
  eyebrow = 'Venn',
  heading,
  ctaLabel,
  renderReasons,
  onRefuse,
}: Props) {
  const reduced = useReducedMotion() ?? false
  const [phase, setPhase] = useState<Phase>('idle')
  const [strip, setStrip] = useState<Movie[]>([])

  const soloPool = useMemo(() => applyFilters(MOVIES, filters, seen), [filters, seen])
  const pool = externalPool ?? soloPool
  const duo = externalPool !== undefined
  const activeCount = countActive(filters)

  const spin = useCallback(() => {
    const winner = pickNext(pool, history)
    if (!winner) return

    const base = shuffle(pool).slice(0, Math.min(STRIP_UNIQUE, pool.length))
    const next = Array.from({ length: STRIP_LENGTH }, (_, i) => base[i % base.length])
    next[WINNER_AT] = winner

    library.remember(MOVIES_CATEGORY.id, winner.id)
    onChoose(null)
    onResult(null)
    setStrip(next)
    setPhase('spinning')
  }, [pool, history, onChoose, onResult])

  /** Relancer = refuser le film affiché : l'information vaut la peine d'être gardée. */
  const respin = useCallback(() => {
    if (result) onRefuse?.(result)
    spin()
  }, [result, onRefuse, spin])

  const handleLanded = useCallback(() => {
    // Court temps d'arrêt sur l'affiche avant de déplier la fiche : sans ça,
    // le résultat « saute » et on perd la récompense du tirage.
    setTimeout(() => {
      onResult(strip[WINNER_AT])
      setPhase('idle')
    }, 420)
  }, [strip, onResult])

  const empty = pool.length === 0

  return (
    <div className="ambient relative flex flex-1 flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      {/* Ambiance colorée tirée de l'affiche courante. */}
      <AmbientGlow movie={tonight ?? result} />

      <header className="relative shrink-0">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">{eyebrow}</p>
        <h1 className="mt-2 text-[30px] leading-[1.1] font-semibold tracking-tight text-balance">
          {tonight ? 'Ce soir, c’est' : (heading ?? MOVIES_CATEGORY.question)}
        </h1>
      </header>

      <div className="relative flex flex-1 flex-col justify-center py-3">
        <AnimatePresence mode="wait">
          {tonight ? (
            <TonightPanel
              key="tonight"
              movie={tonight}
              onDetails={() => onOpenDetails(tonight)}
              onChangeMind={() => {
                onRefuse?.(tonight)
                spin()
              }}
            />
          ) : phase === 'spinning' ? (
            <motion.div
              key="reel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25 }}
            >
              <Reel strip={strip} winnerIndex={WINNER_AT} reduced={reduced} onLanded={handleLanded} />
              <p className="mt-8 text-center text-[13px] text-muted">
                {duo ? 'On cherche dans votre terrain commun…' : 'On tire au sort…'}
              </p>
            </motion.div>
          ) : result ? (
            <ResultCard
              key="result"
              movie={result}
              seen={seen.has(result.id)}
              favorite={favorites.has(result.id)}
              reduced={reduced}
              reasons={renderReasons?.(result)}
              onDetails={() => onOpenDetails(result)}
              onGo={() => onChoose(result)}
              onRespin={respin}
              onSeen={() => library.toggleSeen(MOVIES_CATEGORY.id, result.id)}
              onFavorite={() => library.toggleFavorite(MOVIES_CATEGORY.id, result.id)}
            />
          ) : empty ? (
            <EmptyState key="empty" duo={duo} onOpenFilters={onOpenFilters} />
          ) : (
            <IdleState key="idle" count={pool.length} duo={duo} />
          )}
        </AnimatePresence>
      </div>

      {!tonight && phase !== 'spinning' && (
        <div className="relative shrink-0 pb-4">
          {/* Les filtres solo n'ont pas de sens en duo : les envies ont déjà
              été exprimées par chacun, et une contrainte ne se modifie pas ici. */}
          {!duo && (
            <div className="mb-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
              <Chip active={filters.unseenOnly} onClick={onToggleUnseen}>
                Jamais vu
              </Chip>
              <Chip active={activeCount > (filters.unseenOnly ? 1 : 0)} onClick={onOpenFilters}>
                <span className="flex items-center gap-1.5">
                  <IconSliders className="h-3.5! w-3.5!" />
                  Filtres
                  {activeCount > 0 && (
                    <span className="rounded-full bg-ink/20 px-1.5 text-[11px] font-semibold">
                      {activeCount}
                    </span>
                  )}
                </span>
              </Chip>
              <span className="ml-auto pl-2 text-[12px] whitespace-nowrap text-muted">
                {pool.length} film{pool.length > 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Une fois un résultat affiché, « Relancer » vit dans la fiche :
              un second bouton ferait doublon et ferait déborder l'écran. */}
          {!result && (
            <button
              type="button"
              onClick={spin}
              disabled={empty}
              className="w-full rounded-[22px] bg-gold py-[18px] text-[16px] font-bold tracking-tight text-ink shadow-[0_10px_40px_-10px_var(--color-gold)] transition-transform active:scale-[0.98] disabled:opacity-35 disabled:shadow-none"
            >
              {ctaLabel ?? '🎰 Lancer la roulette'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ écrans */

function IdleState({ count, duo }: { count: number; duo: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center text-center"
    >
      <FannedPosters />
      <p className="mt-8 max-w-[17rem] text-[15px] leading-relaxed text-muted text-balance">
        {duo
          ? `${count} films correspondent à vos envies communes ce soir.`
          : `${count} films triés sur le volet. Appuie, et la soirée est décidée.`}
      </p>
    </motion.div>
  )
}

/**
 * Trois affiches en éventail : montre tout de suite de quoi il s'agit.
 * Disposées en flux (et non en absolu) pour que l'éventail ne puisse jamais
 * déborder de l'écran, quelle que soit la largeur du téléphone.
 */
function FannedPosters() {
  const sample = useMemo(() => shuffle(MOVIES).slice(0, 3), [])
  const tilts = [
    'w-[27%] -rotate-12 translate-x-4 opacity-80',
    'w-[34%] z-10',
    'w-[27%] rotate-12 -translate-x-4 opacity-80',
  ]
  return (
    <div className="flex h-[230px] w-full items-center justify-center">
      {sample.map((m, i) => (
        <Poster
          key={m.id}
          src={m.posterSmall ?? m.image}
          alt={m.title}
          eager
          className={`rounded-2xl border border-white/10 shadow-2xl ${tilts[i]}`}
          style={{ aspectRatio: '2 / 3' }}
        />
      ))}
    </div>
  )
}

function EmptyState({ duo, onOpenFilters }: { duo: boolean; onOpenFilters: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center py-10 text-center"
    >
      <div className="mb-5 text-4xl">🍿</div>
      <h2 className="text-xl font-semibold tracking-tight">Aucun film ne correspond</h2>
      <p className="mt-2 max-w-[17rem] text-[14px] leading-relaxed text-muted text-balance">
        {duo
          ? 'Vos envies sont difficiles à concilier ce soir.'
          : 'Tes filtres sont un peu trop serrés. Assouplis-en un et la roulette repart.'}
      </p>
      {!duo && (
        <button
          type="button"
          onClick={onOpenFilters}
          className="mt-6 rounded-2xl border border-gold/50 bg-gold/10 px-6 py-3.5 text-[14px] font-semibold text-gold"
        >
          Modifier les filtres
        </button>
      )}
    </motion.div>
  )
}

interface ResultProps {
  movie: Movie
  seen: boolean
  favorite: boolean
  reduced: boolean
  reasons?: ReactNode
  onDetails: () => void
  onGo: () => void
  onRespin: () => void
  onSeen: () => void
  onFavorite: () => void
}

function ResultCard({
  movie,
  seen,
  favorite,
  reduced,
  reasons,
  onDetails,
  onGo,
  onRespin,
  onSeen,
  onFavorite,
}: ResultProps) {
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="flex flex-col items-center text-center"
    >
      <button type="button" onClick={onDetails} className="relative">
        <Poster
          src={movie.image}
          alt={movie.title}
          eager
          className="w-[min(48vw,186px)] rounded-2xl border border-white/15 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.9)] ring-1 ring-gold/25"
          style={{ aspectRatio: '2 / 3' }}
        />
      </button>

      <h2 className="mt-4 text-[25px] leading-tight font-semibold tracking-tight text-balance">
        {movie.title}
      </h2>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[13px] text-muted">
        <span>{movie.year}</span>
        <span className="opacity-40">·</span>
        <span>{formatRuntime(movie.runtime)}</span>
        <span className="opacity-40">·</span>
        <span>{movie.genres.join(', ')}</span>
        {movie.rating != null && (
          <span className="inline-flex items-center gap-1 font-semibold text-gold">
            <IconStar className="h-3! w-3!" />
            {movie.rating.toFixed(1)}
          </span>
        )}
      </div>

      {reasons ?? (
        movie.overview && (
          <p className="mt-3 line-clamp-3 max-w-[22rem] text-[13.5px] leading-relaxed text-cream/65">
            {movie.overview}
          </p>
        )
      )}

      <button
        type="button"
        onClick={onGo}
        className="mt-5 w-full max-w-[22rem] rounded-[22px] bg-gold py-[18px] text-[16px] font-bold tracking-tight text-ink shadow-[0_10px_40px_-10px_var(--color-gold)] transition-transform active:scale-[0.98]"
      >
        C’est parti
      </button>

      <div className="mt-2.5 grid w-full max-w-[22rem] grid-cols-3 gap-2">
        <GhostAction onClick={onRespin} label="Relancer">
          <IconRefresh className="h-[18px]! w-[18px]!" />
        </GhostAction>
        <GhostAction onClick={onSeen} label="Déjà vu" active={seen}>
          <IconCheck className="h-[18px]! w-[18px]!" />
        </GhostAction>
        <GhostAction onClick={onFavorite} label="Favori" active={favorite}>
          <IconHeart className="h-[18px]! w-[18px]!" filled={favorite} />
        </GhostAction>
      </div>
    </motion.div>
  )
}

function GhostAction({
  onClick,
  label,
  active = false,
  children,
}: {
  onClick: () => void
  label: string
  active?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center gap-1.5 rounded-2xl border py-3 text-[12px] font-medium transition-colors ${
        active ? 'border-gold/60 bg-gold/15 text-gold' : 'border-line bg-surface/70 text-cream/75'
      }`}
    >
      {children}
      {label}
    </button>
  )
}

function TonightPanel({
  movie,
  onDetails,
  onChangeMind,
}: {
  movie: Movie
  onDetails: () => void
  onChangeMind: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 26 }}
      className="flex flex-col items-center text-center"
    >
      <button type="button" onClick={onDetails}>
        <Poster
          src={movie.image}
          alt={movie.title}
          eager
          className="w-[min(58vw,230px)] rounded-2xl border border-white/15 shadow-[0_24px_70px_-16px_rgba(0,0,0,0.95)] ring-2 ring-gold/40"
          style={{ aspectRatio: '2 / 3' }}
        />
      </button>
      <h2 className="mt-6 text-[28px] leading-tight font-semibold tracking-tight text-balance">
        {movie.title}
      </h2>
      <p className="mt-2 text-[13px] text-muted">
        {movie.year} · {formatRuntime(movie.runtime)}
      </p>
      <p className="mt-5 text-[14px] text-gold">Bonne séance 🍿</p>

      <div className="mt-7 flex w-full max-w-[22rem] gap-2.5">
        <button
          type="button"
          onClick={onDetails}
          className="flex-1 rounded-2xl border border-line bg-surface py-3.5 text-[14px] font-medium text-cream/85"
        >
          Voir la fiche
        </button>
        <button
          type="button"
          onClick={onChangeMind}
          className="flex-1 rounded-2xl border border-line bg-surface py-3.5 text-[14px] font-medium text-cream/85"
        >
          Changer d’avis
        </button>
      </div>
    </motion.div>
  )
}

/** Nappe colorée tirée de l'affiche : donne une identité à chaque film. */
function AmbientGlow({ movie }: { movie: Movie | null }) {
  if (!movie?.image) return null
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <img
        key={movie.id}
        src={movie.image}
        alt=""
        aria-hidden
        referrerPolicy="no-referrer"
        className="h-full w-full scale-150 object-cover opacity-25 blur-[70px] saturate-200"
      />
      <div className="absolute inset-0 bg-linear-to-b from-ink/40 via-ink/60 to-ink" />
    </div>
  )
}
