import { useState } from 'react'
import { Poster } from './Poster'
import { MOVIES, MOVIES_BY_ID, formatRuntime, type Movie } from '../movies/catalog'
import { CATEGORIES, MOVIES_CATEGORY } from '../core/categories'
import { library } from '../core/library'

interface Props {
  seen: Set<string>
  favorites: Set<string>
  lastPicked: string | null
  onOpen: (m: Movie) => void
}

export function ProfileScreen({ seen, favorites, lastPicked, onOpen }: Props) {
  const [confirming, setConfirming] = useState(false)
  const progress = Math.round((seen.size / MOVIES.length) * 100)
  const last = lastPicked ? MOVIES_BY_ID.get(lastPicked) : undefined

  return (
    <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6">
      <h1 className="text-[26px] leading-tight font-semibold tracking-tight">Profil</h1>

      <div className="mt-6 rounded-3xl border border-line bg-surface/60 p-6">
        <div className="flex items-center gap-5">
          <ProgressRing value={progress} />
          <div>
            <p className="text-[28px] leading-none font-semibold">
              {seen.size}
              <span className="text-[18px] text-muted"> / {MOVIES.length}</span>
            </p>
            <p className="mt-1.5 text-[13px] text-muted">films vus</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Stat value={favorites.size} label={favorites.size > 1 ? 'favoris' : 'favori'} />
          <Stat value={MOVIES.length - seen.size} label="restants" />
        </div>
      </div>

      {last && (
        <section className="mt-6">
          <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">
            Dernier film choisi
          </h2>
          <button
            type="button"
            onClick={() => onOpen(last)}
            className="flex w-full items-center gap-4 rounded-2xl border border-line bg-surface/60 p-3 text-left"
          >
            <Poster
              src={last.posterSmall ?? last.image}
              alt={last.title}
              className="w-14 shrink-0 rounded-lg border border-white/10"
              style={{ aspectRatio: '2 / 3' }}
            />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium">{last.title}</p>
              <p className="mt-0.5 text-[12.5px] text-muted">
                {last.year} · {formatRuntime(last.runtime)}
              </p>
            </div>
          </button>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">
          Bientôt
        </h2>
        <ul className="flex flex-wrap gap-2">
          {CATEGORIES.filter((c) => !c.available).map((c) => (
            <li
              key={c.id}
              className="rounded-full border border-line bg-surface/40 px-3.5 py-2 text-[13px] text-muted"
            >
              {c.emoji} {c.label}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 border-t border-line pt-6">
        {confirming ? (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                library.reset(MOVIES_CATEGORY.id)
                setConfirming(false)
              }}
              className="flex-1 rounded-2xl border border-red-500/40 bg-red-500/10 py-3.5 text-[14px] font-semibold text-red-400"
            >
              Tout effacer
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-2xl border border-line bg-surface py-3.5 text-[14px] font-medium"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-[13px] text-muted underline-offset-4 hover:text-cream hover:underline"
          >
            Réinitialiser ma progression
          </button>
        )}
      </section>
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-ink/40 px-4 py-3.5">
      <p className="text-[22px] leading-none font-semibold">{value}</p>
      <p className="mt-1.5 text-[12.5px] text-muted">{label}</p>
    </div>
  )
}

function ProgressRing({ value }: { value: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90" aria-hidden>
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="7" />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke="var(--color-gold)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * value) / 100}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
  )
}
