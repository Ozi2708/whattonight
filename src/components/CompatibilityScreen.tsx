import { motion } from 'motion/react'
import { VennMark } from './VennMark'
import { formatRuntime, moodLabel, plural } from '../movies/catalog'
import { serviceLabel } from '../movies/providers'
import type { MatchResult, Relaxation } from '../movies/matching'

interface Props {
  result: MatchResult
  currentUserId: string
  names: Record<string, string>
  onStart: () => void
  /** Accepté uniquement par la personne concernée — jamais appliqué d'office. */
  onAcceptRelaxation: (r: Relaxation) => void
  /** Annule la session : les deux repartent de l'espace duo. */
  onRestart?: () => void
  /** Seul l'hôte lance la roulette, pour que les deux voient le même film. */
  canStart?: boolean
  hostName?: string
  busy?: boolean
  /** Union des abonnements du duo — vide si personne n'en a renseigné. */
  services?: string[]
  /** Nombre d'œuvres écartées faute d'abonnement. */
  beyondServices?: number
  onIgnoreServices?: () => void
  /** « film » ou « série » — le mot doit coller à ce que la soirée cherche. */
  noun?: string
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
  onRestart,
  canStart = true,
  hostName,
  busy = false,
  services = [],
  beyondServices = 0,
  onIgnoreServices,
  noun = 'film',
}: Props) {
  const count = result.pool.length

  if (count === 0) {
    return (
      <NoMatch
        result={result}
        currentUserId={currentUserId}
        names={names}
        onAccept={onAcceptRelaxation}
        onRestart={onRestart}
        busy={busy}
      />
    )
  }

  const { commonGround: cg, funnel } = result
  // Le titre doit décrire ce qui s'est réellement passé. Quand personne
  // n'exprime de préférence, aucun tri n'a eu lieu : annoncer « on a trouvé »
  // laisserait croire à un travail de sélection qui n'a pas été fait.
  const narrowed = funnel.preferences < funnel.constraints
  const limited = funnel.constraints < funnel.total
  // Accord du verbe : « 1 film respectent » se lit mal et fait amateur.
  const s_ = count > 1 ? 's' : ''

  const tags = [
    ...cg.genres.slice(0, 2),
    ...cg.moods.slice(0, 2).map(moodLabel),
    ...(cg.maxRuntime ? [`Moins de ${formatRuntime(cg.maxRuntime)}`] : []),
    ...(services.length ? [services.length === 1 ? serviceLabel(services[0]) : `Vos ${services.length} services`] : []),
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
        {narrowed
          ? `On a trouvé ${plural(count, noun)} qui vous v${count > 1 ? 'ont' : 'a'} à tous les deux.`
          : limited
            ? `${plural(count, noun)} respecte${s_} vos limites à tous les deux.`
            : `Tout est ouvert : ${plural(count, noun)} sur la table.`}
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
        {/* On n'affiche que les étapes qui ont réellement retiré des films :
            « 100 → 100 → 100 » n'apprend rien et fait douter du calcul. */}
        {plural(funnel.total, noun)}
        {limited &&
          ` → ${funnel.constraints} respecte${funnel.constraints > 1 ? 'nt' : ''} vos limites`}
        {narrowed &&
          ` → ${funnel.preferences} vous ressemble${funnel.preferences > 1 ? 'nt' : ''}`}
        {!limited && !narrowed && ' — vous n’avez encore rien écarté'}
      </motion.p>

      {/* L'élargissement se décide en voyant ce qu'il rapporte, pas à
          l'aveugle avant de chercher. Même mécanique que les compromis
          chiffrés : on montre le coût, on ne l'impose pas. */}
      {services.length > 0 && beyondServices > 0 && onIgnoreServices && (
        <motion.button
          type="button"
          onClick={onIgnoreServices}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-3 text-[12.5px] text-gold underline-offset-4 hover:underline"
        >
          Chercher au-delà de vos abonnements : +{plural(beyondServices, noun)}
        </motion.button>
      )}

      {canStart ? (
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
      ) : (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="mt-9 w-full max-w-sm rounded-[22px] border border-line bg-surface/60 py-[18px] text-[14.5px] text-muted"
        >
          {hostName ? `${hostName} lance la roulette…` : 'En attente du lancement…'}
          <br />
          <span className="text-[12.5px] opacity-80">Tu la verras défiler en direct.</span>
        </motion.p>
      )}

      {/* Le choix est maigre sans être vide : les compromis étaient calculés
          mais n'étaient affichés que lorsqu'il ne restait RIEN. Deux films un
          soir, c'est déjà une frustration — autant dire ce qui l'ouvrirait. */}
      {result.relaxations.length > 0 && (
        <div className="mt-8 w-full max-w-sm">
          <p className="text-[13px] leading-relaxed text-muted text-balance">
            Le choix est mince ce soir. Voici ce qui l’élargirait — chacun
            décide pour ses propres limites.
          </p>
          <Relaxations
            options={result.relaxations}
            currentUserId={currentUserId}
            names={names}
            onAccept={onAcceptRelaxation}
            busy={busy}
          />
        </div>
      )}

      {onRestart && <Restart onRestart={onRestart} />}
    </div>
  )
}

/**
 * Assouplissements chiffrés.
 *
 * On ne retire JAMAIS une contrainte de soi-même : on annonce ce que chacune
 * coûte, et seule la personne concernée peut céder sur la sienne — depuis son
 * propre téléphone.
 */
function Relaxations({
  options,
  currentUserId,
  names,
  onAccept,
  busy,
}: {
  options: Relaxation[]
  currentUserId: string
  names: Record<string, string>
  onAccept: (r: Relaxation) => void
  busy: boolean
}) {
  return (
    <ul className="mt-4 space-y-2.5">
      {options.map((r, i) => {
        const mine = r.userId === currentUserId
        return (
          <li
            key={`${r.userId}-${r.label}-${i}`}
            className="rounded-2xl border border-line bg-surface/60 p-4 text-left"
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
                {names[r.userId] ?? 'La personne concernée'} peut l’accepter depuis son téléphone.
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Toujours offrir une porte de sortie : on ne bloque personne sur un écran. */
function Restart({ onRestart }: { onRestart: () => void }) {
  return (
    <button
      type="button"
      onClick={onRestart}
      className="mt-6 text-[13px] text-muted underline-offset-4 hover:text-cream hover:underline"
    >
      Recommencer avec d’autres envies
    </button>
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
  onRestart,
  busy,
}: {
  result: MatchResult
  currentUserId: string
  names: Record<string, string>
  onAccept: (r: Relaxation) => void
  onRestart?: () => void
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

          <Relaxations
            options={options}
            currentUserId={currentUserId}
            names={names}
            onAccept={onAccept}
            busy={busy}
          />
        </>
      )}

      {onRestart && (
        <div className="mt-8 text-center">
          <Restart onRestart={onRestart} />
        </div>
      )}
    </div>
  )
}
