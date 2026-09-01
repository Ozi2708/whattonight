import { Sheet } from './Sheet'
import { Poster } from './Poster'
import { IconCheck, IconHeart, IconStar } from './icons'
import { formatEngagement, type Work } from '../movies/catalog'
import type { Verdict } from '../core/types'

interface Props {
  movie: Work | null
  onClose: () => void
  seen: boolean
  favorite: boolean
  /** Avis déjà donné, ou `null`. */
  verdict: Verdict | null
  onRate: (verdict: Verdict) => void
  onToggleSeen: () => void
  onToggleFavorite: () => void
  onPlay: () => void
}

const VERDICTS: { id: Verdict; emoji: string; label: string }[] = [
  { id: 'loved', emoji: '😍', label: 'Adoré' },
  { id: 'liked', emoji: '👍', label: 'Aimé' },
  { id: 'meh', emoji: '😐', label: 'Bof' },
  { id: 'disliked', emoji: '👎', label: 'Non' },
]

/** Fiche film : rapide à lire, l'affiche fait le gros du travail. */
export function WorkSheet({
  movie,
  onClose,
  seen,
  favorite,
  verdict,
  onRate,
  onToggleSeen,
  onToggleFavorite,
  onPlay,
}: Props) {
  return (
    <Sheet open={movie !== null} onClose={onClose} label={movie?.title ?? 'Fiche film'}>
      {movie && (
        <div className="relative">
          {/* Ambiance : l'affiche elle-même, floutée, colore la fiche. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden">
            <img
              src={movie.backdrop ?? movie.image ?? ''}
              alt=""
              aria-hidden
              referrerPolicy="no-referrer"
              className="h-full w-full scale-125 object-cover opacity-35 blur-2xl saturate-150"
            />
            <div className="absolute inset-0 bg-linear-to-b from-transparent to-ink-soft" />
          </div>

          <div className="relative px-5 pt-4 pb-9">
            <div className="flex gap-4">
              <Poster
                src={movie.image}
                alt={movie.title}
                eager
                className="w-[124px] shrink-0 rounded-xl border border-white/10 shadow-2xl"
                style={{ aspectRatio: '2 / 3' }}
              />
              <div className="min-w-0 flex-1 pt-1">
                <h2 className="text-[22px] leading-tight font-semibold tracking-tight text-balance">
                  {movie.title}
                </h2>
                {movie.originalTitle !== movie.title && (
                  <p className="mt-1 text-[13px] text-muted">{movie.originalTitle}</p>
                )}
                <p className="mt-2.5 text-[13px] text-muted">
                  {movie.year} · {formatEngagement(movie)}
                  {movie.kind === 'series' && movie.ended === false && ' · en cours'}
                  {movie.kind === 'series' && movie.ended === true && ' · terminée'}
                </p>
                {movie.director && (
                  <p className="mt-1 text-[13px] text-muted">
                    de <span className="text-cream/85">{movie.director}</span>
                  </p>
                )}
                {movie.rating != null && (
                  <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-gold/15 px-2 py-1 text-[13px] font-semibold text-gold">
                    <IconStar className="h-3.5! w-3.5!" />
                    {movie.rating.toFixed(1)}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {movie.genres.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-line px-2.5 py-1 text-[12px] text-cream/70"
                >
                  {g}
                </span>
              ))}
            </div>

            {movie.overview && (
              <p className="mt-4 text-[14px] leading-relaxed text-cream/75">{movie.overview}</p>
            )}

            {/* L'avis est proposé dès que le film est vu : c'est le moment où
                la personne y pense, et un tap suffit. Rien n'oblige à répondre. */}
            {seen && (
              <div className="mt-6">
                <p className="text-[12px] font-semibold tracking-wide text-muted uppercase">
                  Tu en as pensé quoi&nbsp;?
                </p>
                <div className="mt-2.5 grid grid-cols-4 gap-2">
                  {VERDICTS.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onRate(v.id)}
                      aria-pressed={verdict === v.id}
                      className={`flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-[10.5px] font-medium transition-colors ${
                        verdict === v.id
                          ? 'border-gold bg-gold/15 text-gold'
                          : 'border-line bg-surface text-cream/70'
                      }`}
                    >
                      <span className="text-[19px]" aria-hidden>
                        {v.emoji}
                      </span>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-2.5">
              <ToggleButton active={seen} onClick={onToggleSeen}>
                <IconCheck className="h-4! w-4!" />
                {seen ? 'Déjà vu' : 'Pas encore vu'}
              </ToggleButton>
              <ToggleButton active={favorite} onClick={onToggleFavorite}>
                <IconHeart className="h-4! w-4!" filled={favorite} />
                {favorite ? 'Favori' : 'Ajouter aux favoris'}
              </ToggleButton>
            </div>

            <button
              type="button"
              onClick={onPlay}
              className="mt-2.5 w-full rounded-2xl bg-gold py-4 text-[15px] font-semibold text-ink"
            >
              C'est ce film ce soir
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-center gap-2 rounded-2xl border py-3.5 text-[13px] font-medium transition-colors ${
        active ? 'border-gold/60 bg-gold/15 text-gold' : 'border-line bg-surface text-cream/80'
      }`}
    >
      {children}
    </button>
  )
}
