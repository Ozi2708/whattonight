import { motion } from 'motion/react'
import { VennMark } from './VennMark'
import { formatRuntime, moodLabel, plural } from '../movies/catalog'
import type { MatchResult, Relaxation } from '../movies/matching'

interface Props {
  result: MatchResult
  currentUserId: string
  names: Record<string, string>
  onStart: () => void
  /** Accepté uniquement par la personne concernée — jamais appliqué d'office. */
  onAcceptRelaxation: (r: Relaxation) => void
  busy?: boolean
}

/**
 * Écran de terrain commun.
 *
 * On annonce un nombre et quelques mots-clés, pas une liste : le plaisir doit
 * venir du tirage, pas d'un catalogue à éplucher.
 */
export function CompatibilityScreen({
  result,
  currentUserId,
  names,
  onStart,
  onAcceptRelaxation,
  busy = false,
}: Props) {
  const count = result.pool.length

  if (count === 0) return <NoMatch result={result} currentUserId={currentUserId} names={names} onAccept={onAcceptRelaxation} busy={busy} />

  const { commonGround: cg } = result
  const tags = [
    ...cg.genres.slice(0, 2),
    ...cg.moods.slice(0, 2).map(moodLabel),
    ...(cg.maxRuntime ? [`Moins de ${formatRuntime(cg.maxRuntime)}`] : []),
  ]

  return (
    <div className="ambient flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      >
        <VennMark className="h-20 w-20" animate />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-7 text-[27px] leading-tight font-semibold tracking-tight text-balance"
      >
        On a trouvé {plural(count, 'film')} qui vous vont à tous les deux.
      </motion.h1>

      {tags.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-7 w-full max-w-sm"
        >
          <p className="text-[12px] font-semibold tracking-wide text-muted uppercase">
            Votre terrain commun
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-gold/35 bg-gold/10 px-3.5 py-2 text-[13px] font-medium text-gold"
              >
                {t}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-6 text-[12.5px] text-muted"
      >
        {result.funnel.total} films → {result.funnel.constraints} respectent vos limites →{' '}
        {result.funnel.preferences} vous ressemblent
      </motion.p>

      <motion.button
        type="button"
        onClick={onStart}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="mt-9 w-full max-w-sm rounded-[22px] bg-gold py-[18px] text-[16px] font-bold tracking-tight text-ink shadow-[0_10px_40px_-10px_var(--color-gold)] transition-transform active:scale-[0.98]"
      >
        🎰 Trouver notre film
      </motion.button>
    </div>
  )
}

/**
 * Aucun film ne passe les contraintes.
 *
 * On ne dit jamais « aucun résultat » et on ne retire jamais une contrainte
 * tout seul : on chiffre ce que chaque assouplissement rapporterait, et c'est
 * la personne concernée — elle seule — qui peut l'accepter.
 */
function NoMatch({
  result,
  currentUserId,
  names,
  onAccept,
  busy,
}: {
  result: MatchResult
  currentUserId: string
  names: Record<string, string>
  onAccept: (r: Relaxation) => void
  busy: boolean
}) {
  const options = result.relaxations

  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-10">
      <div className="text-center">
        <div className="text-4xl">😅</div>
        <h1 className="mt-5 text-[25px] leading-tight font-semibold tracking-tight text-balance">
          Vos envies sont difficiles à concilier ce soir
        </h1>
      </div>

      {options.length === 0 ? (
        <p className="mt-5 text-center text-[14px] leading-relaxed text-muted text-balance">
          Vous avez exclu tous vos terrains communs. Il faut que l’un de vous
          relâche une limite pour que Venn ait de quoi chercher.
        </p>
      ) : (
        <>
          <p className="mt-5 text-center text-[14px] leading-relaxed text-muted text-balance">
            Voici ce qui débloquerait le plus de films. Chacun décide pour ses
            propres limites.
          </p>

          <ul className="mt-7 space-y-2.5">
            {options.map((r, i) => {
              const mine = r.userId === currentUserId
              return (
                <li
                  key={`${r.userId}-${r.label}-${i}`}
                  className="rounded-2xl border border-line bg-surface/60 p-4"
                >
                  <p className="text-[14.5px] font-medium">{r.label}</p>
                  <p className="mt-1 text-[13px] text-gold">
                    +{plural(r.gain, 'film')} disponible{r.gain > 1 ? 's' : ''}
                  </p>
                  {mine ? (
                    <button
                      type="button"
                      onClick={() => onAccept(r)}
                      disabled={busy}
                      className="mt-3 w-full rounded-xl bg-gold py-3 text-[14px] font-semibold text-ink disabled:opacity-50"
                    >
                      J’accepte
                    </button>
                  ) : (
                    <p className="mt-3 text-[12.5px] text-muted">
                      {/* Tournure neutre : le prénom ne dit rien du genre. */}
                      {names[r.userId] ?? 'La personne concernée'} peut l’accepter depuis son
                      téléphone.
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
