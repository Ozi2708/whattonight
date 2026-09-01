import { decadeOf, type Kind, type Work } from './catalog'
import { isCovered } from './providers'

export interface Filters {
  /** Film ou série : deux tirages distincts, jamais mélangés. */
  kind: Kind
  unseenOnly: boolean
  /**
   * Ne proposer que ce qu'on peut lancer tout de suite. Actif par défaut :
   * une suggestion qu'on ne peut pas regarder n'est pas une suggestion.
   * Sans abonnement renseigné, ce réglage n'a aucun effet.
   */
  servicesOnly: boolean
  genres: string[]
  /** Durée maximale en minutes ; `null` = peu importe. */
  maxRuntime: number | null
  /** Décennies retenues ("1990", "2000"…) ; vide = toutes. */
  decades: string[]
}

export const NO_FILTERS: Filters = {
  kind: 'movie',
  unseenOnly: false,
  servicesOnly: true,
  genres: [],
  maxRuntime: null,
  decades: [],
}

export const RUNTIME_OPTIONS = [
  { label: 'Peu importe', value: null },
  { label: '- de 1h30', value: 90 },
  { label: '- de 2h', value: 120 },
  { label: '- de 2h30', value: 150 },
] as const

export const DECADE_OPTIONS = [
  { label: '90s', value: '1990' },
  { label: '2000s', value: '2000' },
  { label: '2010s', value: '2010' },
  { label: '2020s', value: '2020' },
] as const

export function applyFilters(
  movies: Work[],
  filters: Filters,
  seen: Set<string>,
  services: string[] = [],
): Work[] {
  return movies.filter((m) => {
    if (m.kind !== filters.kind) return false
    if (filters.servicesOnly && !isCovered(m.id, services)) return false
    if (filters.unseenOnly && seen.has(m.id)) return false
    if (filters.genres.length && !m.genres.some((g) => filters.genres.includes(g))) return false
    // La durée ne veut rien dire pour une série : « moins de 2h » désigne la
    // longueur d'une soirée de film, pas un épisode. On ne l'applique donc
    // qu'aux films, plutôt que d'exclure toutes les séries dès qu'une limite
    // est posée.
    if (m.kind === 'movie' && filters.maxRuntime != null) {
      // Une durée inconnue ne doit pas passer un filtre de durée en douce.
      if (m.runtime == null || m.runtime > filters.maxRuntime) return false
    }
    if (filters.decades.length && !filters.decades.includes(decadeOf(m.year))) return false
    return true
  })
}

/** Nombre de critères actifs — sert au badge du bouton « Filtres ». */
export function countActive(filters: Filters): number {
  return (
    (filters.unseenOnly ? 1 : 0) +
    (filters.genres.length ? 1 : 0) +
    (filters.maxRuntime != null ? 1 : 0) +
    (filters.decades.length ? 1 : 0)
  )
}
