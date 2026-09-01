import { motion } from 'motion/react'
import { Poster } from './Poster'
import type { Work } from '../movies/catalog'
import type { Verdict } from '../core/types'

const ANSWERS: { verdict: Verdict; emoji: string; label: string }[] = [
  { verdict: 'loved', emoji: '😍', label: 'Adoré' },
  { verdict: 'liked', emoji: '👍', label: 'Bien aimé' },
  { verdict: 'meh', emoji: '😐', label: 'Bof' },
  { verdict: 'disliked', emoji: '👎', label: 'Pas aimé' },
]

interface Props {
  movie: Work
  onAnswer: (verdict: Verdict) => void
  onSkip: () => void
}

/**
 * « Alors, ce film ? »
 *
 * C'est la boucle d'apprentissage la plus utile de Venn : un avis donné après
 * avoir vu le film vaut dix signaux déduits. D'où un seul tap, aucun
 * formulaire, aucune note à écrire — le coût doit être quasi nul, sinon
 * personne ne répond et Venn n'apprend rien.
 *
 * Chacun répond de son côté : si l'un adore et l'autre non, c'est justement
 * l'information la plus précieuse sur le duo.
 */
export function FeedbackCard({ movie, onAnswer, onSkip }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-sm rounded-3xl border border-gold/25 bg-surface/60 p-4"
    >
      <div className="flex items-center gap-3.5">
        <Poster
          src={movie.posterSmall ?? movie.image}
          alt={movie.title}
          className="w-12 shrink-0 rounded-lg border border-white/10"
          style={{ aspectRatio: '2 / 3' }}
        />
        <div className="min-w-0 text-left">
          <p className="text-[11px] tracking-wide text-muted uppercase">Votre dernière soirée</p>
          <p className="truncate text-[16px] font-semibold">Alors, {movie.title}&nbsp;?</p>
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-4 gap-2">
        {ANSWERS.map((a) => (
          <button
            key={a.verdict}
            type="button"
            onClick={() => onAnswer(a.verdict)}
            className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-ink/50 py-2.5 text-[10px] font-medium text-cream/70 transition-transform active:scale-95"
          >
            <span className="text-[20px]" aria-hidden>
              {a.emoji}
            </span>
            {a.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="mt-3 w-full text-[12.5px] text-muted underline-offset-4 hover:text-cream hover:underline"
      >
        Pas maintenant
      </button>
    </motion.section>
  )
}
