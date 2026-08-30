import { useState } from 'react'
import { motion } from 'motion/react'
import { EMPTY_WISHES, type Wishes } from '../movies/matching'

/**
 * « Choisis pour nous » — le contexte du soir en deux questions.
 *
 * Ces réponses restent des ENVIES, pas des habitudes : elles passent par le
 * même canal que le formulaire complet, et gardent donc la priorité sur le
 * profil. Quelqu'un qui répond « chill » un vendredi soir obtiendra du chill,
 * même si Venn le sait amateur de thrillers nerveux.
 *
 * Une seule contrainte dure ici — la durée. On ne devine jamais un interdit à
 * partir d'une humeur.
 */

const ENERGIES = [
  { id: 'chill', emoji: '😴', label: 'Chill', hint: 'On se pose', moods: ['chill', 'facile'] },
  { id: 'normal', emoji: '🙂', label: 'Normal', hint: 'Ouvert à tout', moods: [] as string[] },
  {
    id: 'fond',
    emoji: '🔥',
    label: 'À fond',
    hint: 'On veut être scotchés',
    moods: ['intense', 'spectaculaire'],
  },
] as const

const TIMES = [
  { label: '1h30', value: 90 },
  { label: '2h', value: 120 },
  { label: '2h30', value: 150 },
  { label: 'Peu importe', value: null },
] as const

interface Props {
  name: string
  onSubmit: (wishes: Wishes) => void
  busy?: boolean
  onCancel?: () => void
}

export function QuickContext({ name, onSubmit, busy = false, onCancel }: Props) {
  const [energy, setEnergy] = useState<(typeof ENERGIES)[number]['id'] | null>(null)
  const [time, setTime] = useState<number | null | undefined>(undefined)

  const ready = energy !== null && time !== undefined

  const submit = () => {
    if (!ready) return
    const picked = ENERGIES.find((e) => e.id === energy)!
    onSubmit({
      ...EMPTY_WISHES,
      constraints: { ...EMPTY_WISHES.constraints, maxRuntime: time ?? null },
      preferences: { genres: [], moods: [...picked.moods], surprise: false },
    })
  }

  return (
    <div className="flex flex-1 flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-40">
      <header>
        <p className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">
          {name}, à toi
        </p>
        <h1 className="mt-2 text-[27px] leading-tight font-semibold tracking-tight">
          Deux questions, et c’est tout.
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          Venn s’occupe du reste avec ce qu’il sait déjà de vous deux.
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

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold">Quelle énergie ce soir&nbsp;?</h2>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {ENERGIES.map((e) => {
            const on = energy === e.id
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={on}
                onClick={() => setEnergy(e.id)}
                className={`flex flex-col items-center gap-1 rounded-2xl border py-4 transition-colors ${
                  on ? 'border-gold bg-gold/15' : 'border-line bg-surface/60'
                }`}
              >
                <span className="text-[26px]" aria-hidden>
                  {e.emoji}
                </span>
                <span className={`text-[13.5px] font-semibold ${on ? 'text-gold' : ''}`}>
                  {e.label}
                </span>
                <span className="text-[11px] text-muted">{e.hint}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="text-[15px] font-semibold">Combien de temps avez-vous&nbsp;?</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {TIMES.map((t) => {
            const on = time === t.value
            return (
              <button
                key={t.label}
                type="button"
                aria-pressed={on}
                onClick={() => setTime(t.value)}
                className={`rounded-full border px-4 py-2.5 text-[13.5px] font-medium transition-colors ${
                  on ? 'border-gold bg-gold text-ink' : 'border-line bg-surface text-cream/80'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </section>

      <motion.div
        className="fixed inset-x-0 bottom-[var(--tabbar-h)] z-30 mx-auto max-w-lg border-t border-line bg-ink/95 px-5 pt-3 pb-3 backdrop-blur"
        initial={false}
      >
        <button
          type="button"
          onClick={submit}
          disabled={!ready || busy}
          className="w-full rounded-[22px] bg-gold py-[17px] text-[16px] font-bold tracking-tight text-ink shadow-[0_10px_40px_-12px_var(--color-gold)] transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? 'Envoi…' : ready ? 'C’est envoyé' : 'Réponds aux deux questions'}
        </button>
      </motion.div>
    </div>
  )
}
