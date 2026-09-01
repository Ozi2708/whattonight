import raw from '../data/movies.json'
import type { RouletteItem } from '../core/types'

export interface Work extends RouletteItem {
  originalTitle: string
  year: number
  runtime: number | null
  genres: string[]
  moods: string[]
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
  moods: string[]
  items: Omit<Work, 'image'>[]
}

const data = raw as unknown as Catalog

export const WORKS: Work[] = data.items.map((m) => ({ ...m, image: m.poster }))

export const WORKS_BY_ID = new Map(WORKS.map((m) => [m.id, m]))

/** Genres réellement présents dans le catalogue, triés pour l'affichage. */
export const GENRES: string[] = [...new Set(WORKS.flatMap((m) => m.genres))].sort((a, b) =>
  a.localeCompare(b, 'fr'),
)

/** `true` si les données viennent de TMDB (affiches HD + notes). */
export const HAS_RATINGS = WORKS.some((m) => m.rating != null)

/** Humeurs présentes dans le catalogue, dans l'ordre d'affichage voulu. */
export const MOOD_LABELS: Record<string, { emoji: string; label: string; adjective: string }> = {
  drole: { emoji: '😂', label: 'Drôle', adjective: 'drôle' },
  intense: { emoji: '💥', label: 'Intense', adjective: 'intense' },
  facile: { emoji: '😌', label: 'Facile à regarder', adjective: 'facile à regarder' },
  mindfuck: { emoji: '🤯', label: 'Mindfuck', adjective: 'qui retourne le cerveau' },
  emotion: { emoji: '❤️', label: 'Émotion', adjective: 'émouvant' },
  stressant: { emoji: '😱', label: 'Stressant', adjective: 'stressant' },
  spectaculaire: { emoji: '🔥', label: 'Spectaculaire', adjective: 'spectaculaire' },
  intelligent: { emoji: '🧠', label: 'Intelligent', adjective: 'intelligent' },
  chill: { emoji: '🌙', label: 'Chill', adjective: 'chill' },
  surprenant: { emoji: '🎲', label: 'Surprenant', adjective: 'surprenant' },
}

/** Genres avec leur article : les explications doivent se lire en français. */
const GENRE_ARTICLES: Record<string, string> = {
  Action: "l'action",
  Animation: "l'animation",
  Aventure: "l'aventure",
  Comédie: 'la comédie',
  Crime: 'le crime',
  Drame: 'le drame',
  Familial: 'le familial',
  Fantastique: 'le fantastique',
  Guerre: 'la guerre',
  Histoire: "l'histoire",
  Horreur: "l'horreur",
  Musique: 'la musique',
  Mystère: 'le mystère',
  Romance: 'la romance',
  'Science-Fiction': 'la science-fiction',
  Thriller: 'le thriller',
  Western: 'le western',
}

export const genreWithArticle = (g: string) => GENRE_ARTICLES[g] ?? g.toLowerCase()

/** « de » / « d' » selon l'initiale — sinon on lit « de intense ». */
export const elide = (word: string) =>
  /^[aeiouyéèêàâîïôûh]/i.test(word) ? `d'${word}` : `de ${word}`

export const moodAdjective = (id: string) => MOOD_LABELS[id]?.adjective ?? id

export const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

export const MOODS: string[] = Object.keys(MOOD_LABELS).filter((id) =>
  WORKS.some((m) => m.moods.includes(id)),
)

export const moodLabel = (id: string) => MOOD_LABELS[id]?.label ?? id

export function formatRuntime(minutes: number | null): string {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`
}

export function decadeOf(year: number): string {
  return `${Math.floor(year / 10) * 10}`
}
