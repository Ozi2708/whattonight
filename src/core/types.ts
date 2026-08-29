/**
 * Types partagés par tous les modules ("films" aujourd'hui, jeux vidéo / jeux de
 * société / activités demain). Tout ce qui est générique vit ici : la roulette,
 * le stockage et les statistiques ne connaissent que `RouletteItem`.
 */

export type CategoryId = 'movies' | 'videogames' | 'boardgames' | 'activities' | 'outings'

/** Le minimum qu'un module doit fournir pour passer dans la roulette. */
export interface RouletteItem {
  id: string
  title: string
  /** Visuel principal — c'est lui qui porte tout le design. */
  image: string | null
}

export interface Category {
  id: CategoryId
  label: string
  emoji: string
  /** Question affichée en tête de la roulette. */
  question: string
  available: boolean
}

/** État persisté pour une catégorie donnée. */
export interface CategoryState {
  seen: string[]
  favorites: string[]
  /** Derniers tirages, du plus récent au plus ancien (anti-répétition). */
  history: string[]
  lastPicked: string | null
}
