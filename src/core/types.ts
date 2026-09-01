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

/**
 * Avis explicite sur un titre.
 *
 * C'est le signal le plus fort dont dispose Venn : il vient d'une personne qui
 * a vu le film et qui prend la peine de le dire. Tout le reste — favoris,
 * choix, relances — pèse beaucoup moins.
 */
export type Verdict = 'loved' | 'liked' | 'meh' | 'disliked'

/** État persisté pour une catégorie donnée. */
export interface CategoryState {
  seen: string[]
  favorites: string[]
  /** Derniers tirages, du plus récent au plus ancien (anti-répétition). */
  history: string[]
  lastPicked: string | null
  /** Avis explicites, par identifiant de titre. */
  ratings?: Record<string, Verdict>
  /** Titres réellement retenus après un tirage — un signal fort. */
  chosen?: string[]
  /** Titres relancés — signal faible, borné, assumé comme tel. */
  refused?: string[]
  /**
   * Corrections apportées par l'utilisateur à son portrait (« Ajuster »).
   * Clé = genre ou humeur, valeur = décalage dans [-1, 1].
   */
  adjustments?: Record<string, number>
  /**
   * Services auxquels la personne est abonnée. Vide = elle n'a rien dit, et
   * Venn ne filtre alors rien du tout.
   */
  services?: string[]
}
