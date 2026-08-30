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

/**
 * Tirage pondéré : les meilleurs matchs sortent plus souvent, sans jamais
 * exclure les autres.
 *
 * La roulette a changé de rôle. En V1 elle tirait au hasard parmi ce qui
 * passait les filtres ; en V3 Venn a identifié plusieurs bons candidats et la
 * roulette choisit parmi eux. Un tirage uniforme donnerait la même chance à un
 * film « acceptable » qu'à un film « fait pour vous » — ce qui reviendrait à
 * jeter le travail du moteur.
 *
 * L'exposant creuse l'écart sans jamais l'annuler : le dernier du pool garde
 * une vraie chance. C'est ce qui préserve la surprise, donc l'intérêt même de
 * la roulette.
 */
/**
 * Les scores d'un même pool sont très resserrés — souvent quelques centièmes
 * d'écart entre le meilleur et le moins bon. Élever ça à une puissance ne
 * change presque rien : mesuré, le film le mieux noté n'était que 1,8 fois
 * plus probable que le dernier, ce qui revenait à peu près à un tirage
 * uniforme.
 *
 * On ramène donc d'abord les poids du pool sur [FLOOR, 1] avant d'appliquer
 * l'exposant. Le rapport entre le meilleur et le moins bon devient alors
 * stable et connu — environ 8 pour 1 — quelle que soit la dispersion des
 * scores bruts. Personne n'est exclu : c'est la roulette qui décide, et la
 * surprise reste possible.
 */
const EXPONENT = 3
const FLOOR = 0.5

export function pickWeighted<T extends { id: string; weight: number }>(
  pool: T[],
  history: string[],
  wildcardRate = 0,
  wildcardOf: (item: T) => boolean = () => false,
): T | null {
  if (pool.length === 0) return null
  if (pool.length === 1) return pool[0]

  // Anti-répétition d'abord : elle prime sur la pondération, parce que
  // retomber sur le même film reste la frustration numéro un.
  const window = Math.min(history.length, Math.floor(pool.length / 2))
  const recent = new Set(history.slice(0, window))
  let candidates = pool.filter((item) => !recent.has(item.id))
  if (candidates.length === 0) candidates = pool.filter((item) => item.id !== history[0])
  if (candidates.length === 0) candidates = pool

  // De temps en temps, on va délibérément chercher hors des habitudes.
  const wilds = candidates.filter(wildcardOf)
  if (wilds.length && Math.random() < wildcardRate) candidates = wilds

  const raw = candidates.map((item) => item.weight)
  const lo = Math.min(...raw)
  const hi = Math.max(...raw)
  const span = hi - lo
  const weights = raw.map((w) => {
    // Tous à égalité : tirage uniforme, aucune raison d'en préférer un.
    const normalized = span > 1e-6 ? FLOOR + (1 - FLOOR) * ((w - lo) / span) : 1
    return Math.pow(normalized, EXPONENT)
  })
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return candidates[Math.floor(Math.random() * candidates.length)]

  let ticket = Math.random() * total
  for (let i = 0; i < candidates.length; i++) {
    ticket -= weights[i]
    if (ticket <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}
