import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Poster } from './Poster'
import { MOOD_LABELS, type Movie } from '../movies/catalog'
import type { Affinity, TasteProfile } from '../movies/taste'

interface Props {
  profile: TasteProfile
  onOpen: (m: Movie) => void
  /** Ouvre le module « Aide Venn à mieux te connaître ». */
  onDiscover: () => void
  /** Correction manuelle : clé de genre ou d'humeur, décalage dans [-1, 1]. */
  onAdjust: (key: string, value: number) => void
  onResetAdjustments: () => void
}

/**
 * « Mes goûts » — le portrait que Venn se fait de la personne.
 *
 * Parti pris : aucun pourcentage. Un « 73 % thriller » aurait l'air précis
 * sans l'être — il n'existe pas d'unité de mesure du goût. Des formes, des
 * mots et des affiches disent la même chose sans mentir sur la nature de
 * l'information.
 *
 * Et surtout : tout ce qui est affiché doit être corrigeable. Venn propose une
 * lecture, il ne décrète pas qui vous êtes.
 */
export function TasteSection({
  profile,
  onOpen,
  onDiscover,
  onAdjust,
  onResetAdjustments,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  if (profile.depth === 'vierge') return <EmptyTaste onDiscover={onDiscover} />

  const liked = profile.genres.filter((g) => g.score >= 0.06).slice(0, 6)
  const avoided = profile.genres.filter((g) => g.score <= -0.2).slice(0, 3)

  return (
    <section className="mt-8">
      <header>
        <h2 className="text-[19px] font-semibold tracking-tight">Ton ADN cinéma</h2>
        <p className="mt-0.5 text-[12.5px] text-muted">{profile.depthLabel}</p>
      </header>

      {/* ------------------------------------------------------- la silhouette */}
      <div className="ambient mt-5 overflow-hidden rounded-3xl border border-line bg-surface/30 px-3 pt-4 pb-6">
        <Signature moods={profile.moods} />

        {profile.traits.length > 0 && (
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {profile.traits.map((t) => (
              <span
                key={t.key}
                className="flex items-center gap-1.5 rounded-full border border-gold/35 bg-gold/10 px-3 py-1.5 text-[12.5px] font-medium text-gold"
              >
                <span aria-hidden>{t.emoji}</span>
                {t.label}
              </span>
            ))}
          </div>
        )}

        {profile.sentence && (
          <p className="mx-auto mt-4 max-w-[19rem] text-center text-[14px] leading-relaxed text-cream/80 text-balance">
            {profile.sentence}
          </p>
        )}
      </div>

      {/* ------------------------------------------------------------ genres */}
      {liked.length > 0 && (
        <div className="mt-4 rounded-3xl border border-line bg-surface/30 p-5">
          <h3 className="text-center text-[11.5px] font-semibold tracking-[0.16em] text-muted uppercase">
            Tes terrains
          </h3>
          {/* Taille et intensité par palier, pas par valeur continue : c'est
              exactement ce que le moteur sait dire, ni plus ni moins. */}
          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
            {liked.map((g, i) => (
              <motion.span
                key={g.key}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * i, type: 'spring', stiffness: 260, damping: 20 }}
                className={`rounded-full border ${CHIP[weight(g.score, liked[0].score)]}`}
              >
                {g.label}
              </motion.span>
            ))}
          </div>

          {avoided.length > 0 && (
            <div className="mt-4 border-t border-line/70 pt-3.5">
              <p className="text-center text-[11px] tracking-wide text-muted uppercase">
                Beaucoup moins
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {avoided.map((g) => (
                  <span
                    key={g.key}
                    className="rounded-full border border-line bg-ink/40 px-2.5 py-1 text-[11.5px] text-muted"
                  >
                    {g.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------- films qui te représentent */}
      {profile.representative.length >= 3 && (
        <div className="mt-4 rounded-3xl border border-line bg-surface/30 px-5 py-6">
          <h3 className="text-center text-[11.5px] font-semibold tracking-[0.16em] text-muted uppercase">
            Ceux qui te ressemblent
          </h3>
          <PosterFan movies={profile.representative} onOpen={onOpen} />
        </div>
      )}

      {/* ------------------------------------------------ côté inattendu */}
      {profile.insights.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {profile.insights.map((insight) => (
            <div
              key={insight.text}
              className="flex items-center gap-3.5 rounded-3xl border border-line bg-surface/30 p-4"
            >
              <span className="flex shrink-0 -space-x-4">
                {insight.movies.slice(0, 3).map((m, i) => (
                  <Poster
                    key={m.id}
                    src={m.posterSmall ?? m.image}
                    alt=""
                    className="w-9 rounded-md border border-white/15 shadow-lg"
                    style={{ aspectRatio: '2 / 3', zIndex: 3 - i }}
                  />
                ))}
              </span>
              <p className="text-[13px] leading-snug text-cream/80">
                <span className="mb-0.5 block text-[10.5px] tracking-[0.16em] text-gold/70 uppercase">
                  Ton côté inattendu
                </span>
                {insight.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* --------------------------------------------------- ça te ressemble */}
      <div className="mt-4 rounded-3xl border border-line bg-surface/30 p-4 text-center">
        {confirmed ? (
          <p className="py-1 text-[13.5px] text-gold">Noté. Venn continue d’affiner en te lisant.</p>
        ) : (
          <>
            <p className="text-[14px] font-medium">Ça te ressemble&nbsp;?</p>
            <div className="mt-3 flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmed(true)}
                className="flex-1 rounded-2xl border border-gold/40 bg-gold/10 py-3 text-[14px] font-semibold text-gold"
              >
                👍 Oui
              </button>
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="flex-1 rounded-2xl border border-line bg-surface py-3 text-[14px] font-medium"
              >
                ✏️ Ajuster
              </button>
            </div>
          </>
        )}
      </div>

      {editing && (
        <AdjustPanel
          profile={profile}
          onAdjust={onAdjust}
          onReset={onResetAdjustments}
          onClose={() => setEditing(false)}
        />
      )}

      <button
        type="button"
        onClick={onDiscover}
        className="mt-4 w-full rounded-2xl border border-line bg-surface/50 py-3.5 text-[13.5px] font-medium text-cream/80"
      >
        Aider Venn à mieux te connaître
      </button>
    </section>
  )
}

/**
 * Taille des genres : RELATIVE au profil de la personne, pas à une échelle
 * absolue.
 *
 * Les paliers absolus (« très fort », « fort »…) laissaient régulièrement les
 * six genres dans la même case : aucune hiérarchie ne se voyait, et le nuage
 * n'apprenait rien. Or ce que Venn sait réellement, c'est un CLASSEMENT — pas
 * une valeur sur une échelle universelle. Le montrer ainsi est à la fois plus
 * lisible et plus honnête.
 */
function weight(score: number, top: number): 'majeur' | 'net' | 'discret' {
  const ratio = top > 0 ? score / top : 0
  if (ratio >= 0.85) return 'majeur'
  if (ratio >= 0.6) return 'net'
  return 'discret'
}

const CHIP: Record<string, string> = {
  majeur:
    'border-gold bg-gold px-4 py-2.5 text-[16.5px] font-bold tracking-tight text-ink shadow-[0_6px_22px_-8px_var(--color-gold)]',
  net: 'border-gold/55 bg-gold/12 px-3.5 py-2 text-[13.5px] font-semibold text-gold',
  discret: 'border-line bg-surface px-3 py-1.5 text-[12px] text-cream/60',
}

/* ------------------------------------------------------------- portrait vide */

function EmptyTaste({ onDiscover }: { onDiscover: () => void }) {
  return (
    <section className="ambient mt-8 rounded-3xl border border-line bg-surface/30 p-6 text-center">
      <svg viewBox="0 0 100 100" className="mx-auto h-24 w-24" aria-hidden>
        <polygon
          points={EMPTY_SHAPE}
          fill="var(--color-gold)"
          fillOpacity="0.08"
          stroke="var(--color-gold)"
          strokeOpacity="0.4"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
      </svg>
      <h2 className="mt-4 text-[18px] font-semibold tracking-tight">Ton ADN cinéma</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted text-balance">
        Ta silhouette est encore vide. Venn la dessine tout seul au fil des
        soirées — ou tu peux l’aider en une minute.
      </p>
      <button
        type="button"
        onClick={onDiscover}
        className="mt-5 w-full rounded-2xl bg-gold py-3.5 text-[14px] font-semibold text-ink"
      >
        Aider Venn à me connaître
      </button>
    </section>
  )
}

/* ---------------------------------------------------------------- silhouette */

/**
 * L'ordre des axes n'est pas décoratif.
 *
 * Les humeurs sont rangées du plus léger au plus chargé, de sorte que les
 * contraires se retrouvent face à face : « facile » en face de « mindfuck »,
 * « chill » en face de « intense ». La forme obtenue penche alors visiblement
 * d'un côté — c'est ce qui en fait une signature reconnaissable plutôt qu'un
 * graphique de plus. Ranger ces dix axes au hasard donnerait des étoiles
 * toutes semblables.
 */
const AXES = [
  'drole',
  'facile',
  'chill',
  'emotion',
  'intelligent',
  'mindfuck',
  'surprenant',
  'stressant',
  'intense',
  'spectaculaire',
]

const CENTER = 130
const R_MIN = 16
const R_MAX = 84
const R_EMOJI = 108

/** Un score dans [-0.45, 0.45] occupe tout le rayon ; au-delà, on plafonne. */
function radius(score: number): number {
  const t = Math.max(0, Math.min(1, (score + 0.45) / 0.9))
  return R_MIN + t * (R_MAX - R_MIN)
}

const point = (i: number, r: number) => {
  const angle = (i / AXES.length) * Math.PI * 2 - Math.PI / 2
  return [CENTER + Math.cos(angle) * r, CENTER + Math.sin(angle) * r] as const
}

const EMPTY_SHAPE = AXES.map((_, i) => {
  const angle = (i / AXES.length) * Math.PI * 2 - Math.PI / 2
  return `${(50 + Math.cos(angle) * 34).toFixed(1)},${(50 + Math.sin(angle) * 34).toFixed(1)}`
}).join(' ')

function Signature({ moods }: { moods: Affinity[] }) {
  const byKey = useMemo(() => new Map(moods.map((m) => [m.key, m])), [moods])

  const nodes = AXES.map((key, i) => {
    const affinity = byKey.get(key)
    // Une humeur sans preuve reste au milieu : l'absence de donnée ne doit pas
    // se lire comme un rejet.
    const score = affinity?.score ?? 0
    const [x, y] = point(i, radius(score))
    const [ex, ey] = point(i, R_EMOJI)
    return { key, score, x, y, ex, ey, emoji: MOOD_LABELS[key]?.emoji ?? '' }
  })

  const shape = nodes.map((n) => `${n.x.toFixed(1)},${n.y.toFixed(1)}`).join(' ')
  const strong = nodes.filter((n) => n.score >= 0.16)

  return (
    <svg viewBox="0 0 260 260" className="mx-auto h-auto w-full max-w-[264px]" aria-hidden>
      <defs>
        {/* Dégradé plutôt qu'un aplat : la forme prend du volume et le regard
            va vers le centre, là où se lit la dominante. */}
        <radialGradient id="adn-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.42" />
          <stop offset="70%" stopColor="var(--color-gold)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0.08" />
        </radialGradient>
        <filter id="adn-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Repères : trois anneaux discrets, juste assez pour donner l'échelle. */}
      {[0.34, 0.67, 1].map((k) => (
        <circle
          key={k}
          cx={CENTER}
          cy={CENTER}
          r={R_MIN + (R_MAX - R_MIN) * k}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth="1"
          opacity={0.55}
        />
      ))}
      {AXES.map((key, i) => {
        const [x, y] = point(i, R_MAX)
        return (
          <line
            key={key}
            x1={CENTER}
            y1={CENTER}
            x2={x}
            y2={y}
            stroke="var(--color-line)"
            strokeWidth="1"
            opacity={0.4}
          />
        )
      })}

      <motion.g
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 130, damping: 18, mass: 0.9 }}
        style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
      >
        {/* Le remplissage n'est pas flouté : appliquer le halo à l'ensemble
            noyait les sommets et toutes les silhouettes se ressemblaient. */}
        <polygon points={shape} fill="url(#adn-fill)" />
        <polygon
          points={shape}
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          filter="url(#adn-glow)"
        />
        {/* Seuls les sommets marqués sont matérialisés : un point partout
            ferait ressembler tous les profils à la même roue dentée. */}
        {strong.map((n) => (
          <circle key={n.key} cx={n.x} cy={n.y} r="4" fill="var(--color-gold)" />
        ))}
      </motion.g>

      {nodes.map((n) => (
        <text
          key={`e-${n.key}`}
          x={n.ex}
          y={n.ey + 5}
          textAnchor="middle"
          style={{ fontSize: n.score >= 0.16 ? 17 : 13 }}
          opacity={n.score >= 0.16 ? 1 : 0.28}
        >
          {n.emoji}
        </text>
      ))}
    </svg>
  )
}

/* ------------------------------------------------------------ éventail */

/**
 * Les affiches en éventail plutôt qu'en liste : elles se lisent comme une main
 * de cartes, et c'est l'image qui parle, pas le titre.
 */
function PosterFan({ movies, onOpen }: { movies: Movie[]; onOpen: (m: Movie) => void }) {
  const shown = movies.slice(0, 5)
  const middle = (shown.length - 1) / 2

  return (
    <div className="mt-5 flex items-end justify-center">
      {shown.map((m, i) => {
        const offset = i - middle
        return (
          <motion.button
            key={m.id}
            type="button"
            onClick={() => onOpen(m)}
            title={m.title}
            aria-label={m.title}
            initial={{ opacity: 0, y: 14, rotate: 0 }}
            animate={{ opacity: 1, y: Math.abs(offset) * 7, rotate: offset * 7 }}
            transition={{ delay: 0.06 * i, type: 'spring', stiffness: 200, damping: 18 }}
            whileTap={{ scale: 0.94 }}
            className="w-[74px] shrink-0"
            style={{
              marginLeft: i === 0 ? 0 : -16,
              transformOrigin: 'bottom center',
              zIndex: shown.length - Math.abs(Math.round(offset)),
            }}
          >
            <Poster
              src={m.posterSmall ?? m.image}
              alt=""
              className="w-full rounded-lg border border-white/15 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.9)]"
              style={{ aspectRatio: '2 / 3' }}
            />
          </motion.button>
        )
      })}
    </div>
  )
}

/* --------------------------------------------------------------- ajustement */

const NUDGES = [
  { label: 'Pas du tout moi', value: -0.6 },
  { label: 'Un peu', value: 0.15 },
  { label: 'Beaucoup', value: 0.5 },
]

/**
 * Correction manuelle.
 *
 * Trois choix par ligne, pas un curseur. Un curseur laisserait croire qu'il
 * existe une valeur juste à trouver ; on demande simplement un ordre de
 * grandeur, ce qui est la seule chose qu'un humain sache donner ici.
 */
function AdjustPanel({
  profile,
  onAdjust,
  onReset,
  onClose,
}: {
  profile: TasteProfile
  onAdjust: (key: string, value: number) => void
  onReset: () => void
  onClose: () => void
}) {
  const rows = [
    ...profile.genres.slice(0, 6).map((g) => ({ key: g.key, label: g.label, current: g })),
    ...profile.moods.slice(0, 4).map((m) => ({
      key: m.key,
      label: `${MOOD_LABELS[m.key]?.emoji ?? ''} ${m.label}`.trim(),
      current: m,
    })),
  ]

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="mt-3 overflow-hidden rounded-3xl border border-gold/25 bg-surface/50 p-4"
    >
      <p className="text-[13px] leading-relaxed text-muted">
        Dis à Venn ce qu’il a mal compris. Ce que tu corriges ici prime sur ce
        qu’il a déduit.
      </p>

      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li key={row.key}>
            <p className="text-[13px] font-medium">{row.label}</p>
            <div className="mt-1.5 flex gap-1.5">
              {NUDGES.map((n) => {
                const on = row.current.adjusted && Math.abs(row.current.score - n.value) < 0.01
                return (
                  <button
                    key={n.label}
                    type="button"
                    onClick={() => onAdjust(row.key, n.value)}
                    aria-pressed={on}
                    className={`flex-1 rounded-xl border px-2 py-2 text-[11.5px] font-medium transition-colors ${
                      on ? 'border-gold bg-gold text-ink' : 'border-line bg-surface text-cream/70'
                    }`}
                  >
                    {n.label}
                  </button>
                )
              })}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex gap-2.5">
        <button
          type="button"
          onClick={onReset}
          className="flex-1 rounded-2xl border border-line bg-surface py-3 text-[13.5px] font-medium text-muted"
        >
          Tout remettre à zéro
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-2xl bg-gold py-3 text-[13.5px] font-semibold text-ink"
        >
          Terminé
        </button>
      </div>
    </motion.div>
  )
}
