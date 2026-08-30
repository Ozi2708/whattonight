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
 * sans l'être — il n'existe pas d'unité de mesure du goût. Des mots, des
 * jauges relatives et des affiches disent la même chose sans mentir sur la
 * nature de l'information.
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

  const topGenres = profile.genres.filter((g) => g.score > 0).slice(0, 5)
  const disliked = profile.genres.filter((g) => g.score <= -0.2).slice(0, 3)

  return (
    <section className="mt-8">
      <header>
        <h2 className="text-[19px] font-semibold tracking-tight">Ton ADN cinéma</h2>
        <p className="mt-0.5 text-[12.5px] text-muted">{profile.depthLabel}</p>
      </header>

      {/* --------------------------------------------- floraison des humeurs */}
      {profile.traits.length >= 2 && (
        <div className="mt-5 rounded-3xl border border-line bg-surface/40 p-5">
          <Bloom traits={profile.traits} />
          <div className="mt-4 flex flex-wrap justify-center gap-2">
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
          {profile.sentence && (
            <p className="mt-4 text-center text-[13.5px] leading-relaxed text-cream/75 text-balance">
              {profile.sentence}
            </p>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ genres */}
      {topGenres.length > 0 && (
        <div className="mt-4 space-y-2">
          {topGenres.map((g) => (
            <Gauge key={g.key} affinity={g} max={topGenres[0].score} />
          ))}
          {disliked.length > 0 && (
            <p className="pt-1 text-[12.5px] text-muted">
              Tu évites plutôt {disliked.map((g) => g.label.toLowerCase()).join(', ')}.
            </p>
          )}
        </div>
      )}

      {/* --------------------------------------- films qui te représentent */}
      {profile.representative.length >= 3 && (
        <div className="mt-7">
          <h3 className="text-[13px] font-semibold tracking-wide text-muted uppercase">
            Films qui te représentent
          </h3>
          <ul className="mt-3 -mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1 no-scrollbar">
            {profile.representative.map((m) => (
              <li key={m.id} className="w-[86px] shrink-0">
                <button type="button" onClick={() => onOpen(m)} className="block w-full text-left">
                  <Poster
                    src={m.posterSmall ?? m.image}
                    alt={m.title}
                    className="w-full rounded-xl border border-white/10"
                    style={{ aspectRatio: '2 / 3' }}
                  />
                  <p className="mt-1.5 truncate text-[11px] text-cream/70">{m.title}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ------------------------------------------------ côté inattendu */}
      {profile.insights.length > 0 && (
        <div className="mt-7">
          <h3 className="text-[13px] font-semibold tracking-wide text-muted uppercase">
            Ton côté inattendu
          </h3>
          <ul className="mt-3 space-y-2.5">
            {profile.insights.map((insight) => (
              <li
                key={insight.text}
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface/50 p-3"
              >
                <span className="flex -space-x-3">
                  {insight.movies.slice(0, 3).map((m) => (
                    <Poster
                      key={m.id}
                      src={m.posterSmall ?? m.image}
                      alt=""
                      className="w-8 shrink-0 rounded border border-white/15"
                      style={{ aspectRatio: '2 / 3' }}
                    />
                  ))}
                </span>
                <p className="text-[13px] leading-snug text-cream/80">{insight.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --------------------------------------------------- ça te ressemble */}
      <div className="mt-7 rounded-3xl border border-line bg-surface/40 p-4 text-center">
        {confirmed ? (
          <p className="py-1 text-[13.5px] text-gold">
            Noté. Venn continue d’affiner en te lisant.
          </p>
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

/* ------------------------------------------------------------- portrait vide */

function EmptyTaste({ onDiscover }: { onDiscover: () => void }) {
  return (
    <section className="mt-8 rounded-3xl border border-line bg-surface/40 p-6 text-center">
      <div className="text-3xl">🧬</div>
      <h2 className="mt-3 text-[18px] font-semibold tracking-tight">Ton ADN cinéma</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted text-balance">
        Venn ne te connaît pas encore. Il apprend tout seul au fil des soirées —
        ou tu peux lui donner un coup de pouce en une minute.
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

/* ------------------------------------------------------------------ jauge */

function Gauge({ affinity, max }: { affinity: Affinity; max: number }) {
  // Jauge RELATIVE : elle situe le genre par rapport aux autres goûts de la
  // personne, pas sur une échelle absolue qui n'existe pas.
  const width = Math.max(0.12, Math.min(1, affinity.score / (max || 1)))
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface/40 px-4 py-3">
      <span className="w-[102px] shrink-0 truncate text-[12.5px] font-medium">{affinity.label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink">
        <motion.span
          className="block h-full rounded-full bg-gold"
          initial={{ width: 0 }}
          animate={{ width: `${width * 100}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </span>
      <span className="w-[66px] shrink-0 text-right text-[11px] text-muted">
        {affinity.adjusted ? 'ajusté' : affinity.level}
      </span>
    </div>
  )
}

/* -------------------------------------------------------------- floraison */

/**
 * Les humeurs dominantes, en pétales.
 *
 * Une forme organique plutôt qu'un histogramme : on ne cherche pas à faire
 * lire des valeurs, mais à donner une silhouette reconnaissable — « voilà à
 * quoi ressemble mon cinéma ».
 */
function Bloom({ traits }: { traits: Affinity[] }) {
  const petals = useMemo(() => {
    const max = Math.max(...traits.map((t) => t.score), 0.01)
    return traits.map((t, i) => {
      const angle = (i / traits.length) * Math.PI * 2 - Math.PI / 2
      const length = 22 + 34 * Math.min(1, t.score / max)
      return {
        key: t.key,
        x: 60 + Math.cos(angle) * length,
        y: 60 + Math.sin(angle) * length,
        r: 15 + 9 * Math.min(1, t.score / max),
        emoji: t.emoji,
      }
    })
  }, [traits])

  return (
    /* Le cadrage doit englober le pétale le plus long ET son rayon : en
       0..120, le pétale du haut sortait par le bord et se trouvait coupé. */
    <svg viewBox="-24 -24 168 168" className="mx-auto h-40 w-40" aria-hidden>
      {petals.map((p, i) => (
        <motion.circle
          key={p.key}
          cx={p.x}
          cy={p.y}
          r={p.r}
          fill="var(--color-gold)"
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 0.24, scale: 1 }}
          transition={{ delay: 0.06 * i, type: 'spring', stiffness: 180, damping: 16 }}
          style={{ transformOrigin: `${p.x}px ${p.y}px`, mixBlendMode: 'screen' }}
        />
      ))}
      <circle cx="60" cy="60" r="15" fill="var(--color-gold)" opacity="0.5" />
      {petals.map((p) => (
        <text
          key={`e-${p.key}`}
          x={p.x}
          y={p.y + 5}
          textAnchor="middle"
          className="text-[13px]"
          style={{ fontSize: 14 }}
        >
          {p.emoji}
        </text>
      ))}
    </svg>
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
