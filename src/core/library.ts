import { useSyncExternalStore } from 'react'
import type { CategoryId, CategoryState } from './types'

/**
 * Bibliothèque de l'utilisateur (vus / favoris / historique), persistée en
 * localStorage. Le store est volontairement minuscule : un objet en mémoire,
 * un abonnement, une écriture différée.
 */

const KEY = 'venn/v1'
const LEGACY_KEY = 'what-tonight/v1'
const HISTORY_MAX = 20

type Library = Record<string, CategoryState>

const emptyCategory = (): CategoryState => ({ seen: [], favorites: [], history: [], lastPicked: null })

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
  mergeRemote: (category: CategoryId, seen: string[], favorites: string[]) =>
    update(category, (c) => ({
      ...c,
      seen: [...new Set([...c.seen, ...seen])],
      favorites: [...new Set([...c.favorites, ...favorites])],
    })),

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

  /** « C'est parti » : le choix de la soirée. */
  choose: (category: CategoryId, id: string) => update(category, (c) => ({ ...c, lastPicked: id })),

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
  return {
    ...c,
    seenSet: new Set(c.seen),
    favoriteSet: new Set(c.favorites),
  }
}
