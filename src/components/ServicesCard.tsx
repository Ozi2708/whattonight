import { motion } from 'motion/react'
import { SERVICES } from '../movies/providers'
import { plural } from '../movies/catalog'

interface Props {
  services: string[]
  onChange: (services: string[]) => void
  /** Nombre d'œuvres réellement accessibles avec ces abonnements. */
  covered: number
  total: number
}

/**
 * « Mes services » — réglé une fois, modifiable à tout moment.
 *
 * C'est un fait stable sur la personne, au même titre que son prénom : le
 * demander à chaque soirée serait une taxe pour une information qui change
 * deux fois par an. D'où sa place dans le profil, et nulle part ailleurs.
 *
 * Ne rien cocher est une réponse valable, et c'est le défaut : Venn propose
 * alors tout le catalogue. Le filtre ne s'active que si on le renseigne.
 */
export function ServicesCard({ services, onChange, covered, total }: Props) {
  const toggle = (id: string) =>
    onChange(services.includes(id) ? services.filter((s) => s !== id) : [...services, id])

  const share = total ? Math.round((covered / total) * 100) : 0

  return (
    <section className="mt-6 rounded-3xl border border-line bg-surface/50 p-5">
      <h2 className="text-[15px] font-semibold">Où tu peux regarder</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
        Venn ne proposera que ce que tu peux lancer tout de suite. En duo, on
        additionne vos abonnements — vous regardez sur un seul écran.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {SERVICES.map((s) => {
          const on = services.includes(s.id)
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              aria-pressed={on}
              className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                on ? 'border-gold bg-gold/15 text-gold' : 'border-line bg-surface text-cream/65'
              }`}
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full transition-opacity"
                style={{ background: s.color, opacity: on ? 1 : 0.35 }}
              />
              {s.label}
            </button>
          )
        })}
      </div>

      <motion.p
        key={covered}
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        className="mt-4 border-t border-line/70 pt-3.5 text-[13px] text-cream/75"
      >
        {services.length === 0 ? (
          <span className="text-muted">
            Rien de coché : Venn propose tout le catalogue, sans se soucier d’où
            c’est disponible.
          </span>
        ) : (
          <>
            <span className="font-semibold text-gold">{plural(covered, 'œuvre')}</span>
            <span className="text-muted">
              {' '}
              sur {total} regardables tout de suite — {share} %
            </span>
          </>
        )}
      </motion.p>
    </section>
  )
}
