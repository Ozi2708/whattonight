import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Poster } from './Poster'
import { MOVIES, formatRuntime, type Movie } from '../movies/catalog'
import type { Verdict } from '../core/types'

const ANSWERS: { verdict: Verdict | null; emoji: string; label: string }[] = [
  { verdict: 'loved', emoji: '😍', label: 'J’adore' },
  { verdict: 'liked', emoji: '👍', label: 'J’aime' },
  { verdict: 'meh', emoji: '😐', label: 'Bof' },
  { verdict: 'disliked', emoji: '👎', label: 'Pas pour moi' },
  { verdict: null, emoji: '❓', label: 'Pas vu' },
]

const DECK_SIZE = 15

/**
 * Sélectionne les films qui apprennent le plus.
 *
 * Prendre les quinze premiers du catalogue apprendrait peu : il s'ouvre sur
 * une série de drames, et quinze drames ne disent presque rien d'une personne.
 * On choisit donc gloutonnement les films qui couvrent le plus d'étiquettes
 * encore inconnues — chaque réponse porte alors sur un terrain neuf.
 *
 * À couverture égale, l'ordre du catalogue tranche : il va grossièrement du
 * plus connu au moins connu, et on ne peut rien apprendre d'un film que la
 * personne n'a pas vu.
 */
function buildDeck(alreadyRated: Set<string>): Movie[] {
  const pool = MOVIES.filter((m) => !alreadyRated.has(m.id))
  const covered = new Map<string, number>()
  const deck: Movie[] = []

  const gain = (m: Movie) =>
    [...m.genres, ...m.moods].reduce((sum, k) => sum + 1 / (1 + (covered.get(k) ?? 0) * 2), 0)

  const remaining = [...pool]
  while (deck.length < DECK_SIZE && remaining.length) {
    let bestIndex = 0
    let bestGain = -Infinity
    for (let i = 0; i < remaining.length; i++) {
      const g = gain(remaining[i])
      if (g > bestGain + 1e-9) {
        bestGain = g
        bestIndex = i
      }
    }
    const [picked] = remaining.splice(bestIndex, 1)
    deck.push(picked)
    for (const k of [...picked.genres, ...picked.moods]) {
      covered.set(k, (covered.get(k) ?? 0) + 1)
    }
  }
  return deck
}

interface Props {
  alreadyRated: Set<string>
  onRate: (movieId: string, verdict: Verdict) => void
  onClose: () => void
}

/**
 * « Aide Venn à mieux te connaître ».
 *
 * Une carte, cinq boutons, un tap. Jamais obligatoire, arrêtable à tout
 * moment, et « Pas vu » est une réponse à part entière : dire qu'on n'a pas vu
 * un film est une information, pas un échec.
 */
export function QuickTaste({ alreadyRated, onRate, onClose }: Props) {
  // Figé au montage, et pas recalculé à chaque réponse : `alreadyRated` grandit
  // au fil des taps, et un paquet reconstruit à chaque fois se vidait sous les
  // doigts — le module s'arrêtait après neuf cartes au lieu de quinze.
  const [deck] = useState(() => buildDeck(alreadyRated))
  const [index, setIndex] = useState(0)
  const [answered, setAnswered] = useState(0)

  const movie = deck[index]
  const done = !movie

  const answer = (verdict: Verdict | null) => {
    if (movie && verdict) {
      onRate(movie.id, verdict)
      setAnswered((n) => n + 1)
    }
    setIndex((i) => i + 1)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink">
      <header className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">
            Aide Venn
          </p>
          <p className="mt-0.5 text-[13px] text-muted">
            {done ? 'Terminé' : `${index + 1} sur ${deck.length}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-line px-3.5 py-2 text-[13px] font-medium text-cream/80"
        >
          {done ? 'Fermer' : 'Arrêter'}
        </button>
      </header>

      {done ? (
        <Finished answered={answered} onClose={onClose} />
      ) : (
        <>
          <div className="flex flex-1 flex-col items-center justify-center px-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={movie.id}
                initial={{ opacity: 0, y: 24, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -18, scale: 0.96 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="flex w-full max-w-[15rem] flex-col items-center"
              >
                <Poster
                  src={movie.poster ?? movie.image}
                  alt={movie.title}
                  className="w-full rounded-2xl border border-white/10 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]"
                  style={{ aspectRatio: '2 / 3' }}
                />
                <p className="mt-4 text-center text-[19px] leading-tight font-semibold tracking-tight text-balance">
                  {movie.title}
                </p>
                <p className="mt-1 text-[12.5px] text-muted">
                  {movie.year} · {formatRuntime(movie.runtime)}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-4 gap-2">
              {ANSWERS.filter((a) => a.verdict).map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => answer(a.verdict)}
                  className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface py-3 text-[10.5px] font-medium text-cream/75 transition-transform active:scale-95"
                >
                  <span className="text-[22px]" aria-hidden>
                    {a.emoji}
                  </span>
                  {a.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => answer(null)}
              className="mt-2.5 w-full rounded-2xl border border-line bg-surface/50 py-3 text-[13.5px] font-medium text-muted"
            >
              ❓ Pas vu
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function Finished({ answered, onClose }: { answered: number; onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <div className="text-4xl">🧬</div>
      <h2 className="mt-5 text-[23px] leading-tight font-semibold tracking-tight text-balance">
        {answered === 0
          ? 'Rien de perdu'
          : `${answered} avis, et Venn te comprend déjà mieux`}
      </h2>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted text-balance">
        {answered === 0
          ? 'Venn continuera d’apprendre au fil de tes soirées.'
          : 'Ton portrait se trouve dans Profil, et il continuera de bouger tout seul.'}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-8 w-full max-w-xs rounded-[22px] bg-gold py-[17px] text-[16px] font-bold text-ink"
      >
        C’est noté
      </button>
    </div>
  )
}
