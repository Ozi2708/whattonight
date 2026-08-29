import type { Category } from './types'

/**
 * Registre des modules. Seuls les films existent en V1 ; les autres sont
 * déclarés pour que l'ajout d'un module reste mécanique (données + écran),
 * sans toucher à la roulette ni au stockage.
 */
export const CATEGORIES: Category[] = [
  { id: 'movies', label: 'Films', emoji: '🎬', question: 'On regarde quoi ce soir ?', available: true },
  { id: 'videogames', label: 'Jeux vidéo', emoji: '🎮', question: 'On joue à quoi ce soir ?', available: false },
  { id: 'boardgames', label: 'Jeux de société', emoji: '🎲', question: 'On joue à quoi ce soir ?', available: false },
  { id: 'outings', label: 'Sortir', emoji: '🍸', question: 'On sort où ce soir ?', available: false },
  { id: 'activities', label: 'Activités', emoji: '🎳', question: 'On fait quoi ce soir ?', available: false },
]

export const MOVIES_CATEGORY = CATEGORIES[0]
