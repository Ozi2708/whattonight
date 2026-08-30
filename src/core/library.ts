import { useMemo, useSyncExternalStore } from 'react'
import type { CategoryId, CategoryState, Verdict } from './types'

/**
 * Bibliothèque de l'utilisateur (vus / favoris / historique), persistée en
 * localStorage. Le store est volontairement minuscule : un objet en mémoire,
 * un abonnement, une écriture différée.
 */

const KEY = 'venn/v1'
const LEGACY_KEY = 'what-tonight/v1'
const HISTORY_MAX = 20
/** Les relances sont un signal faible : inutile d'en garder une archive. */
const REFUSED_MAX = 50

type Library = Record<string, CategoryState>

const emptyCategory = (): CategoryState => ({
  seen: [],
  favorites: [],
  history: [],
  lastPicked: null,
  ratings: {},
  adjustments: {},
  chosen: [],
  refused: [],
})

function load(): Library {
  try {
    // Reprise silencieuse des données de la V1 : la progression déjà
    // accumulée ne doit pas disparaître avec le changement de nom.
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed.categories ?? {}) : {}
  } catch {
    // Stockage indisponible (navigation privée, quota) : on repart à vide
    // plutôt que de faire planter l'app.
    return {}
  }
}

let state: Library = load()
const listeners = new Set<() => void>()

let saveTimer: ReturnType<typeof setTimeout> | undefined
function commit(next: Library) {
  state = next
  listeners.forEach((l) => l())
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, categories: state }))
    } catch {
      /* quota dépassé : l'app reste utilisable, seule la persistance est perdue */
    }
  }, 120)
}

export const subscribeLibrary = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

function read(category: CategoryId): CategoryState {
  return state[category] ?? emptyCategory()
}

function update(category: CategoryId, patch: (c: CategoryState) => CategoryState) {
  commit({ ...state, [category]: patch(read(category)) })
}

const toggleIn = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id]

/* ------------------------------------------------------------------ actions */

export const readCategory = (category: CategoryId): CategoryState => read(category)

export const library = {
  /** Fusion avec l'état distant : on garde l'union, jamais de perte. */
  mergeRemote: (
    category: CategoryId,
    seen: string[],
    favorites: string[],
    ratings: Record<string, Verdict> = {},
  ) =>
    update(category, (c) => ({
      ...c,
      seen: [...new Set([...c.seen, ...seen])],
      favorites: [...new Set([...c.favorites, ...favorites])],
      // Les avis distants ne remplacent jamais un avis local : celui-ci vient
      // peut-être d'être donné et n'est pas encore remonté.
      ratings: { ...ratings, ...(c.ratings ?? {}) },
    })),

  /**
   * Donner un avis vaut aussi « je l'ai vu » : personne ne juge un film qu'il
   * n'a pas regardé, et le redemander séparément serait une corvée.
   */
  rate: (category: CategoryId, id: string, verdict: Verdict | null) =>
    update(category, (c) => {
      const ratings = { ...(c.ratings ?? {}) }
      if (verdict) ratings[id] = verdict
      else delete ratings[id]
      return {
        ...c,
        ratings,
        seen: verdict && !c.seen.includes(id) ? [...c.seen, id] : c.seen,
      }
    }),

  /** Correction manuelle du portrait de goûts, dans [-1, 1]. */
  adjust: (category: CategoryId, key: string, delta: number) =>
    update(category, (c) => ({
      ...c,
      adjustments: { ...(c.adjustments ?? {}), [key]: Math.max(-1, Math.min(1, delta)) },
    })),

  clearAdjustments: (category: CategoryId) => update(category, (c) => ({ ...c, adjustments: {} })),

  toggleSeen: (category: CategoryId, id: string) =>
    update(category, (c) => ({ ...c, seen: toggleIn(c.seen, id) })),

  setSeen: (category: CategoryId, id: string, seen: boolean) =>
    update(category, (c) => ({
      ...c,
      seen: seen ? (c.seen.includes(id) ? c.seen : [...c.seen, id]) : c.seen.filter((x) => x !== id),
    })),

  toggleFavorite: (category: CategoryId, id: string) =>
    update(category, (c) => ({ ...c, favorites: toggleIn(c.favorites, id) })),

  /** Enregistre un tirage : alimente l'anti-répétition. */
  remember: (category: CategoryId, id: string) =>
    update(category, (c) => ({
      ...c,
      history: [id, ...c.history.filter((x) => x !== id)].slice(0, HISTORY_MAX),
    })),

  /**
   * « C'est parti » : le choix de la soirée.
   *
   * On garde la liste complète, pas seulement le dernier : choisir un film
   * après l'avoir vu passer est l'un des rares signaux que Venn obtienne sans
   * rien demander.
   */
  choose: (category: CategoryId, id: string) =>
    update(category, (c) => ({
      ...c,
      lastPicked: id,
      chosen: [id, ...(c.chosen ?? []).filter((x) => x !== id)],
    })),

  /**
   * Relance : le film affiché est écarté.
   *
   * Volontairement peu pesant côté moteur — relancer veut souvent dire « pas
   * ce soir », pas « je déteste ». En faire un rejet franc apprendrait faux.
   */
  refuse: (category: CategoryId, id: string) =>
    update(category, (c) => ({
      ...c,
      refused: [id, ...(c.refused ?? []).filter((x) => x !== id)].slice(0, REFUSED_MAX),
    })),

  clearChoice: (category: CategoryId) => update(category, (c) => ({ ...c, lastPicked: null })),

  reset: (category: CategoryId) => update(category, () => emptyCategory()),
}

/* --------------------------------------------------------------------- hook */

export function useLibrary(category: CategoryId) {
  const raw = useSyncExternalStore(
    subscribeLibrary,
    () => state[category],
    () => undefined,
  )
  const c = raw ?? emptyCategory()
  // Mémoïsé : sans ça, chaque rendu fabriquerait de nouveaux Set, et tout ce
  // qui en dépend — portrait de goûts, croisement des envies, pool — serait
  // recalculé en boucle sans qu'aucune donnée n'ait changé.
  const seenSet = useMemo(() => new Set(c.seen), [c.seen])
  const favoriteSet = useMemo(() => new Set(c.favorites), [c.favorites])

  return {
    ...c,
    ratings: c.ratings ?? EMPTY_RATINGS,
    adjustments: c.adjustments ?? EMPTY_ADJUSTMENTS,
    chosen: c.chosen ?? EMPTY_LIST,
    refused: c.refused ?? EMPTY_LIST,
    seenSet,
    favoriteSet,
  }
}

// Références stables pour les champs absents : `?? {}` fabriquerait un objet
// neuf à chaque rendu, ce qui invaliderait les mémoïsations en aval.
const EMPTY_RATINGS: Record<string, Verdict> = {}
const EMPTY_ADJUSTMENTS: Record<string, number> = {}
const EMPTY_LIST: string[] = []
