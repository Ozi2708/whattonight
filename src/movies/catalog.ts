import raw from '../data/movies.json'
import type { RouletteItem } from '../core/types'

export interface Movie extends RouletteItem {
  originalTitle: string
  year: number
  runtime: number | null
  genres: string[]
  rating: number | null
  director: string | null
  overview: string | null
  poster: string | null
  posterSmall: string | null
  backdrop: string | null
}

interface Catalog {
  source: string
  genres: string[]
  items: Omit<Movie, 'image'>[]
}

const data = raw as unknown as Catalog

export const MOVIES: Movie[] = data.items.map((m) => ({ ...m, image: m.poster }))

export const MOVIES_BY_ID = new Map(MOVIES.map((m) => [m.id, m]))

/** Genres réellement présents dans le catalogue, triés pour l'affichage. */
export const GENRES: string[] = [...new Set(MOVIES.flatMap((m) => m.genres))].sort((a, b) =>
  a.localeCompare(b, 'fr'),
)

/** `true` si les données viennent de TMDB (affiches HD + notes). */
export const HAS_RATINGS = MOVIES.some((m) => m.rating != null)

export function formatRuntime(minutes: number | null): string {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`
}

export function decadeOf(year: number): string {
  return `${Math.floor(year / 10) * 10}`
}
