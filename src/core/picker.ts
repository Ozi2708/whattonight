/**
 * Tirage aléatoire « non frustrant ».
 *
 * Règles :
 *  - les filtres priment toujours (on ne pioche que dans `pool`) ;
 *  - on évite les derniers tirages pour ne pas retomber sur le même film, ni
 *    tourner en boucle sur 3-4 titres ;
 *  - si le pool est trop petit pour respecter ça, on se contente d'écarter le
 *    tirage immédiatement précédent.
 */
export function pickNext<T extends { id: string }>(pool: T[], history: string[]): T | null {
  if (pool.length === 0) return null
  if (pool.length === 1) return pool[0]

  // Fenêtre d'exclusion : la moitié du pool, plafonnée à l'historique retenu.
  const window = Math.min(history.length, Math.floor(pool.length / 2))
  const recent = new Set(history.slice(0, window))

  let candidates = pool.filter((item) => !recent.has(item.id))
  if (candidates.length === 0) candidates = pool.filter((item) => item.id !== history[0])
  if (candidates.length === 0) candidates = pool

  return candidates[Math.floor(Math.random() * candidates.length)]
}

/** Mélange non destructif (Fisher-Yates) — utilisé pour garnir la roulette. */
export function shuffle<T>(items: T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
