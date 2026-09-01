import raw from '../data/catalogue.json'
import type { RouletteItem } from '../core/types'

/** Forme de la réponse à « on regarde quoi ce soir ? ». */
export type Kind = 'movie' | 'series'

export interface Work extends RouletteItem {
  kind: Kind
  /**
   * Appartient à la collection à compléter — « Les 100 films à voir ».
   *
   * Le catalogue est bien plus large que le canon : le canon est une promesse
   * éditoriale finie, le reste est un réservoir pour ne jamais tourner en
   * rond. Seul le canon compte dans la progression.
   */
  canon: boolean
  originalTitle: string
  year: number
  /** Durée du film ; pour une série, celle d'un épisode — souvent inconnue. */
  runtime: number | null
  genres: string[]
  moods: string[]
  rating: number | null
  director: string | null
  overview: string | null
  poster: string | null
  posterSmall: string | null
  backdrop: string | null
  /** Séries uniquement. */
  seasons: number | null
  episodes: number | null
  ended: boolean | null
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

/** La collection finie, celle qui porte la barre de progression. */
export const CANON = WORKS.filter((w) => w.canon)

export const worksOfKind = (kind: Kind) => WORKS.filter((w) => w.kind === kind)

/**
 * Genres réellement présents au catalogue.
 *
 * « Confort » et « Blockbuster » passent en tête plutôt qu'à leur rang
 * alphabétique : ils ne décrivent pas le SUJET du film mais son REGISTRE, et
 * c'est souvent la première chose qu'on a en tête — « ce soir, une valeur
 * sûre ». Les noyer entre Aventure et Crime les rendrait invisibles.
 */
const EN_TETE = ['Confort', 'Blockbuster']

export const GENRES: string[] = [
  ...EN_TETE.filter((g) => WORKS.some((w) => w.genres.includes(g))),
  ...[...new Set(WORKS.flatMap((m) => m.genres))]
    .filter((g) => !EN_TETE.includes(g))
    .sort((a, b) => a.localeCompare(b, 'fr')),
]

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

/**
 * Ce qu'on affiche à la place de la durée pour une série.
 *
 * TMDB ne connaît la durée d'un épisode que pour une série sur six : mieux
 * vaut annoncer ce qu'on sait — saisons et épisodes — que d'inventer une
 * durée. Et c'est de toute façon l'information utile : ce qui compte pour
 * une série, c'est l'engagement.
 */
export function formatEngagement(work: Work): string {
  if (work.kind !== 'series') return formatRuntime(work.runtime)
  const parts: string[] = []
  if (work.seasons) parts.push(plural(work.seasons, 'saison'))
  if (work.episodes) parts.push(plural(work.episodes, 'épisode'))
  if (!parts.length) return 'Série'
  return parts.join(' · ')
}

export function decadeOf(year: number): string {
  return `${Math.floor(year / 10) * 10}`
}
