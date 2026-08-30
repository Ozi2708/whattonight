import { useState } from 'react'
import { GENRES, MOODS, MOOD_LABELS } from '../movies/catalog'
import { EMPTY_WISHES, type Wishes } from '../movies/matching'

const RUNTIMES = [
  { label: 'Peu importe', value: null },
  { label: '1h30', value: 90 },
  { label: '2h', value: 120 },
  { label: '2h30', value: 150 },
] as const

interface Props {
  name: string
  onSubmit: (wishes: Wishes) => void
  busy?: boolean
  /** Abandonne la session — présent pour ne jamais enfermer l'utilisateur. */
  onCancel?: () => void
}

/**
 * Saisie des envies d'une personne.
 *
 * Deux blocs, jamais mélangés :
 *  - ENVIES (préférences) : orientent le classement. En or, en premier, parce
 *    que c'est la partie agréable et qu'elle doit se remplir en trois taps.
 *  - LIMITES (contraintes) : éliminent. En rouge, plus bas, parce qu'elles
 *    engagent — une contrainte de l'un s'impose à l'autre.
 *
 * Objectif : moins de 15 secondes. Tout est visible d'un coup, rien à déplier.
 */
export function WishesForm({ name, onSubmit, busy = false, onCancel }: Props) {
  const [w, setW] = useState<Wishes>(EMPTY_WISHES)

  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v]

  const setPref = (patch: Partial<Wishes['preferences']>) =>
    setW((s) => ({ ...s, preferences: { ...s.preferences, ...patch } }))
  const setCon = (patch: Partial<Wishes['constraints']>) =>
    setW((s) => ({ ...s, constraints: { ...s.constraints, ...patch } }))

  const { preferences: pref, constraints: con } = w
  const nothingPicked = !pref.surprise && !pref.moods.length && !pref.genres.length

  return (
    <div className="px-5 pb-32">
      <header className="pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">
          {name}, à toi
        </p>
        <h1 className="mt-2 text-[27px] leading-tight font-semibold tracking-tight">
          De quoi as-tu envie&nbsp;?
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          L’autre ne verra rien avant que vous ayez répondu tous les deux.
        </p>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-3 text-[13px] text-muted underline-offset-4 hover:text-cream hover:underline"
          >
            ← Annuler
          </button>
        )}
      </header>

      {/* ------------------------------------------------------- envies */}
      <Block title="J’ai envie de quelque chose de…" tone="pref">
        <div className="flex flex-wrap gap-2">
          {MOODS.map((id) => {
            const on = pref.moods.includes(id)
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => setPref({ moods: toggle(pref.moods, id), surprise: false })}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
                  on
                    ? 'border-gold bg-gold text-ink'
                    : 'border-line bg-surface text-cream/80'
                } ${pref.surprise ? 'opacity-40' : ''}`}
              >
                <span aria-hidden>{MOOD_LABELS[id].emoji}</span>
                {MOOD_LABELS[id].label}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          aria-pressed={pref.surprise}
          onClick={() =>
            setPref(pref.surprise ? { surprise: false } : { surprise: true, moods: [], genres: [] })
          }
          className={`mt-3 w-full rounded-2xl border py-3 text-[13.5px] font-medium transition-colors ${
            pref.surprise
              ? 'border-gold bg-gold/15 text-gold'
              : 'border-line bg-surface/60 text-cream/70'
          }`}
        >
          🎲 Peu importe, surprends-moi
        </button>
      </Block>

      <Block title="Plutôt côté genre" tone="pref">
        <div className={`flex flex-wrap gap-2 ${pref.surprise ? 'opacity-40' : ''}`}>
          {GENRES.map((g) => {
            const on = pref.genres.includes(g)
            return (
              <button
                key={g}
                type="button"
                aria-pressed={on}
                onClick={() => setPref({ genres: toggle(pref.genres, g), surprise: false })}
                className={`rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                  on ? 'border-gold bg-gold text-ink' : 'border-line bg-surface text-cream/80'
                }`}
              >
                {g}
              </button>
            )
          })}
        </div>
      </Block>

      {/* ------------------------------------------------------ limites */}
      <Block
        title="Mes limites"
        hint="Ce que tu refuses vraiment. Ça s’impose aussi à l’autre."
        tone="constraint"
      >
        <p className="mb-2 text-[12px] font-semibold tracking-wide text-muted uppercase">
          Pas plus de
        </p>
        <div className="flex flex-wrap gap-2">
          {RUNTIMES.map((r) => (
            <button
              key={r.label}
              type="button"
              aria-pressed={con.maxRuntime === r.value}
              onClick={() => setCon({ maxRuntime: r.value })}
              className={`rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                con.maxRuntime === r.value
                  ? 'border-rose-400/70 bg-rose-400/15 text-rose-200'
                  : 'border-line bg-surface text-cream/80'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-pressed={con.unseenOnly}
          onClick={() => setCon({ unseenOnly: !con.unseenOnly })}
          className={`mt-4 flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition-colors ${
            con.unseenOnly ? 'border-rose-400/50 bg-rose-400/10' : 'border-line bg-surface/60'
          }`}
        >
          <span className="text-[14px] font-medium">Un film qu’aucun de nous n’a vu</span>
          <span
            className={`h-6 w-10 shrink-0 rounded-full p-0.5 transition-colors ${
              con.unseenOnly ? 'bg-rose-400' : 'bg-line'
            }`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-ink transition-transform ${
                con.unseenOnly ? 'translate-x-4' : ''
              }`}
            />
          </span>
        </button>

        <p className="mt-4 mb-2 text-[12px] font-semibold tracking-wide text-muted uppercase">
          Surtout pas
        </p>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => {
            const on = con.excludedGenres.includes(g)
            return (
              <button
                key={g}
                type="button"
                aria-pressed={on}
                onClick={() => setCon({ excludedGenres: toggle(con.excludedGenres, g) })}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${
                  on
                    ? 'border-rose-400/70 bg-rose-400/15 text-rose-200 line-through'
                    : 'border-line bg-surface/50 text-cream/55'
                }`}
              >
                {g}
              </button>
            )
          })}
        </div>
      </Block>

      {/* Barre d'envoi : toujours atteignable sans remonter. */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t border-line bg-ink/95 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <button
          type="button"
          onClick={() => onSubmit(w)}
          disabled={busy}
          className="w-full rounded-[22px] bg-gold py-[17px] text-[16px] font-bold tracking-tight text-ink shadow-[0_10px_40px_-12px_var(--color-gold)] transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? 'Envoi…' : 'C’est envoyé'}
        </button>
        {nothingPicked && (
          <p className="mt-2 text-center text-[12px] text-muted">
            Tu peux aussi ne rien choisir : Venn suivra alors les envies de l’autre.
          </p>
        )}
      </div>
    </div>
  )
}

function Block({
  title,
  hint,
  tone,
  children,
}: {
  title: string
  hint?: string
  tone: 'pref' | 'constraint'
  children: React.ReactNode
}) {
  return (
    <section
      className={`mt-6 rounded-3xl border p-5 ${
        tone === 'pref' ? 'border-line bg-surface/40' : 'border-rose-400/20 bg-rose-400/[0.04]'
      }`}
    >
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {hint && <p className="mt-1 mb-3 text-[12.5px] leading-relaxed text-muted">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </section>
  )
}
