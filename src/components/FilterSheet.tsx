import { Sheet } from './Sheet'
import { Chip } from './Chip'
import { GENRES } from '../movies/catalog'
import { DECADE_OPTIONS, NO_FILTERS, RUNTIME_OPTIONS, type Filters } from '../movies/filters'

interface Props {
  open: boolean
  onClose: () => void
  filters: Filters
  onChange: (f: Filters) => void
  /** Nombre de films correspondant aux filtres en cours. */
  matches: number
}

export function FilterSheet({ open, onClose, filters, onChange, matches }: Props) {
  const toggleGenre = (g: string) =>
    onChange({
      ...filters,
      genres: filters.genres.includes(g)
        ? filters.genres.filter((x) => x !== g)
        : [...filters.genres, g],
    })

  const toggleDecade = (d: string) =>
    onChange({
      ...filters,
      decades: filters.decades.includes(d)
        ? filters.decades.filter((x) => x !== d)
        : [...filters.decades, d],
    })

  return (
    <Sheet open={open} onClose={onClose} label="Filtres de la roulette">
      <div className="px-5 pb-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Filtres</h2>
          <button
            type="button"
            onClick={() => onChange(NO_FILTERS)}
            className="text-[13px] text-muted underline-offset-4 hover:text-cream hover:underline"
          >
            Tout effacer
          </button>
        </div>

        <Section title="Genre" hint="plusieurs choix possibles">
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <Chip key={g} active={filters.genres.includes(g)} onClick={() => toggleGenre(g)}>
                {g}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Durée">
          <div className="flex flex-wrap gap-2">
            {RUNTIME_OPTIONS.map((o) => (
              <Chip
                key={o.label}
                active={filters.maxRuntime === o.value}
                onClick={() => onChange({ ...filters, maxRuntime: o.value })}
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Époque">
          <div className="flex flex-wrap gap-2">
            <Chip
              active={filters.decades.length === 0}
              onClick={() => onChange({ ...filters, decades: [] })}
            >
              Toutes
            </Chip>
            {DECADE_OPTIONS.map((d) => (
              <Chip
                key={d.value}
                active={filters.decades.includes(d.value)}
                onClick={() => toggleDecade(d.value)}
              >
                {d.label}
              </Chip>
            ))}
          </div>
        </Section>

        <button
          type="button"
          onClick={onClose}
          disabled={matches === 0}
          className="mt-8 w-full rounded-2xl bg-gold py-4 text-[15px] font-semibold text-ink transition-opacity disabled:opacity-40"
        >
          {matches === 0
            ? 'Aucun film ne correspond'
            : `Voir ${matches} film${matches > 1 ? 's' : ''}`}
        </button>
      </div>
    </Sheet>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-7">
      <h3 className="mb-3 flex items-baseline gap-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
        {title}
        {hint && <span className="text-[11px] font-normal normal-case opacity-70">{hint}</span>}
      </h3>
      {children}
    </section>
  )
}
