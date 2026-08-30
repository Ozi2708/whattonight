import { useMemo } from 'react'
import { motion } from 'motion/react'
import { MOOD_LABELS } from '../movies/catalog'
import type { Affinity } from '../movies/taste'

/**
 * La silhouette de goûts — et sa version à deux.
 *
 * L'ordre des axes n'est pas décoratif : les humeurs sont rangées du plus
 * léger au plus chargé, de sorte que les contraires se retrouvent face à face
 * — « facile » en face de « mindfuck », « chill » en face de « intense ». La
 * forme obtenue penche alors visiblement d'un côté, ce qui en fait une
 * signature reconnaissable plutôt qu'un graphique de plus. Ranger ces dix axes
 * au hasard donnerait des étoiles toutes semblables.
 *
 * Géométrie partagée par la vue solo et la vue duo : deux copies finiraient
 * par diverger, et les deux écrans ne parleraient plus de la même chose.
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

const polygon = (radii: number[]) =>
  radii
    .map((r, i) => {
      const [x, y] = point(i, r)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

/** Rayons d'une personne, axe par axe, dans l'ordre de `AXES`. */
function radiiOf(moods: Affinity[]): number[] {
  const byKey = new Map(moods.map((m) => [m.key, m.score]))
  // Une humeur sans preuve reste au milieu : l'absence de donnée ne doit pas
  // se lire comme un rejet.
  return AXES.map((key) => radius(byKey.get(key) ?? 0))
}

const scoresOf = (moods: Affinity[]) => {
  const byKey = new Map(moods.map((m) => [m.key, m.score]))
  return AXES.map((key) => byKey.get(key) ?? 0)
}

export const EMPTY_SHAPE = AXES.map((_, i) => {
  const angle = (i / AXES.length) * Math.PI * 2 - Math.PI / 2
  return `${(50 + Math.cos(angle) * 34).toFixed(1)},${(50 + Math.sin(angle) * 34).toFixed(1)}`
}).join(' ')

/* ------------------------------------------------------------ décor commun */

function Grid() {
  return (
    <>
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
    </>
  )
}

function Emojis({ scores, threshold = 0.16 }: { scores: number[]; threshold?: number }) {
  return (
    <>
      {AXES.map((key, i) => {
        const [x, y] = point(i, R_EMOJI)
        const strong = scores[i] >= threshold
        return (
          <text
            key={`e-${key}`}
            x={x}
            y={y + 5}
            textAnchor="middle"
            style={{ fontSize: strong ? 17 : 13 }}
            opacity={strong ? 1 : 0.28}
          >
            {MOOD_LABELS[key]?.emoji ?? ''}
          </text>
        )
      })}
    </>
  )
}

/* ------------------------------------------------------------------- solo */

export function Signature({ moods }: { moods: Affinity[] }) {
  const { shape, scores } = useMemo(() => {
    const s = scoresOf(moods)
    return { shape: polygon(radiiOf(moods)), scores: s }
  }, [moods])

  const strong = AXES.map((key, i) => ({ key, i, score: scores[i] })).filter(
    (n) => n.score >= 0.16,
  )

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

      <Grid />

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
        {strong.map((n) => {
          const [x, y] = point(n.i, radius(n.score))
          return <circle key={n.key} cx={x} cy={y} r="4" fill="var(--color-gold)" />
        })}
      </motion.g>

      <Emojis scores={scores} />
    </svg>
  )
}

/* -------------------------------------------------------------------- duo */

/**
 * Les deux silhouettes, et leur zone commune.
 *
 * La zone pleine est le minimum axe par axe. Ce n'est pas tout à fait
 * l'intersection géométrique des deux polygones — les arêtes entre deux axes
 * peuvent se croiser — mais c'est EXACTEMENT la définition que le moteur
 * utilise pour le terrain commun (cf. `pairScore` dans matching.ts, dominé par
 * le moins bien servi des deux). Le dessin montre donc la règle réelle, pas
 * une jolie approximation qui dirait autre chose que le calcul.
 */
export function DuoSignature({
  a,
  b,
}: {
  a: { name: string; moods: Affinity[] }
  b: { name: string; moods: Affinity[] }
}) {
  const { shapeA, shapeB, shapeCommon, scoresMax } = useMemo(() => {
    const ra = radiiOf(a.moods)
    const rb = radiiOf(b.moods)
    const sa = scoresOf(a.moods)
    const sb = scoresOf(b.moods)
    return {
      shapeA: polygon(ra),
      shapeB: polygon(rb),
      shapeCommon: polygon(ra.map((r, i) => Math.min(r, rb[i]))),
      // Un emoji est mis en avant dès que l'un des deux y tient.
      scoresMax: sa.map((s, i) => Math.max(s, sb[i])),
    }
  }, [a.moods, b.moods])

  return (
    <div>
      <svg viewBox="0 0 260 260" className="mx-auto h-auto w-full max-w-[248px]" aria-hidden>
        <defs>
          {/* Le dégradé va d'une couleur à l'autre : le terrain commun
              appartient littéralement aux deux. */}
          <linearGradient id="venn-common" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--color-duo)" stopOpacity="0.8" />
          </linearGradient>
          <filter id="venn-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <Grid />

        <motion.g
          initial={{ scale: 0.25, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 130, damping: 18, mass: 0.9 }}
          style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
        >
          {/* Les deux contours d'abord, sans remplissage : ce qui doit sauter
              aux yeux, c'est la zone partagée, pas chaque profil séparément. */}
          <polygon
            points={shapeA}
            fill="var(--color-gold)"
            fillOpacity="0.07"
            stroke="var(--color-gold)"
            strokeWidth="1.75"
            strokeLinejoin="round"
            opacity="0.85"
          />
          <polygon
            points={shapeB}
            fill="var(--color-duo)"
            fillOpacity="0.07"
            stroke="var(--color-duo)"
            strokeWidth="1.75"
            strokeLinejoin="round"
            opacity="0.85"
          />
          <polygon
            points={shapeCommon}
            fill="url(#venn-common)"
            stroke="var(--color-cream)"
            strokeWidth="1.75"
            strokeOpacity="0.8"
            strokeLinejoin="round"
            filter="url(#venn-glow)"
          />
        </motion.g>

        <Emojis scores={scoresMax} />
      </svg>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
        <Legend color="var(--color-gold)" label={a.name} />
        <Legend color="var(--color-duo)" label={b.name} />
      </div>
      <p className="mt-2 text-center text-[12px] leading-relaxed text-muted">
        La zone pleine, c’est votre terrain commun.
      </p>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] text-cream/75">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}
