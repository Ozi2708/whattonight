import { decadeOf, elide, genreWithArticle, moodAdjective, type Movie } from './catalog'

/**
 * Le moteur de Venn : croiser deux envies pour en tirer un terrain commun.
 *
 * Deux notions strictement séparées :
 *  - CONTRAINTE  « je ne veux vraiment pas ça »  → filtre dur, jamais négociable
 *    sans accord explicite de la personne concernée.
 *  - PRÉFÉRENCE  « j'aimerais plutôt ça »        → score, jamais éliminatoire.
 *
 * Conséquence directe : on ne prend PAS l'intersection stricte des goûts. Un
 * film qui ne coche les préférences que d'une seule personne reste jouable ;
 * il est juste moins bien classé qu'un film qui parle aux deux.
 */

export interface Constraints {
  /** Durée maximale en minutes ; `null` = peu importe. */
  maxRuntime: number | null
  /** Genres refusés catégoriquement. */
  excludedGenres: string[]
  /** Exclure les films déjà vus (par l'un OU l'autre, cf. spécification). */
  unseenOnly: boolean
  /** Décennies acceptées ("1990"…) ; vide = toutes. */
  decades: string[]
}

export interface Preferences {
  genres: string[]
  moods: string[]
  /** « Peu importe, surprends-moi » : neutralise le score de cette personne. */
  surprise: boolean
}

export interface Wishes {
  constraints: Constraints
  preferences: Preferences
}

export const EMPTY_WISHES: Wishes = {
  constraints: { maxRuntime: null, excludedGenres: [], unseenOnly: true, decades: [] },
  preferences: { genres: [], moods: [], surprise: false },
}

export interface Participant {
  userId: string
  name: string
  wishes: Wishes
  seen: Set<string>
  favorites: Set<string>
}

export interface ScoredMovie {
  movie: Movie
  /** Score commun dans [0,1] — c'est lui qui classe le pool. */
  score: number
  /** Score individuel, par `userId`. Sert à expliquer le résultat. */
  perUser: Record<string, number>
}

export interface Funnel {
  total: number
  unseen: number
  constraints: number
  preferences: number
}

export interface CommonGround {
  genres: string[]
  moods: string[]
  maxRuntime: number | null
  /** `true` si au moins un des deux a demandé à être surpris. */
  anySurprise: boolean
}

export interface Relaxation {
  /** Personne à qui la contrainte appartient — c'est elle qui doit accepter. */
  userId: string
  name: string
  /** Phrase prête à afficher, à la première personne du point de vue du duo. */
  label: string
  /** Nombre de films débloqués si cette contrainte seule est relâchée. */
  gain: number
  /** Contraintes de remplacement, à appliquer seulement après accord. */
  next: Constraints
}

export interface MatchResult {
  eligible: Movie[]
  pool: ScoredMovie[]
  commonGround: CommonGround
  funnel: Funnel
  /** Non vide seulement quand aucun film ne passe les contraintes. */
  relaxations: Relaxation[]
}

/* ----------------------------------------------------------- contraintes */

/** Un film est éligible s'il satisfait les contraintes de TOUT LE MONDE. */
function satisfies(movie: Movie, participants: Participant[]): boolean {
  for (const p of participants) {
    const c = p.wishes.constraints

    // Une durée inconnue ne doit pas passer un plafond en douce.
    if (c.maxRuntime != null && (movie.runtime == null || movie.runtime > c.maxRuntime)) return false

    if (c.excludedGenres.some((g) => movie.genres.includes(g))) return false

    if (c.decades.length && !c.decades.includes(decadeOf(movie.year))) return false

    // « Jamais vu » exclut ce qu'au moins une des deux personnes a déjà vu :
    // sinon l'un des deux se retrouve à revoir un film sans l'avoir demandé.
    if (c.unseenOnly && participants.some((other) => other.seen.has(movie.id))) return false
  }
  return true
}

/* ------------------------------------------------------------ préférences */

/** Neutre : ni bonus ni malus. Ce qui n'est pas demandé n'est pas pénalisé. */
const NEUTRAL = 0.6

/**
 * Un critère coché et trouvé vaut beaucoup ; coché et absent vaut peu, mais
 * jamais zéro — une préférence n'élimine pas.
 */
function axisScore(wanted: string[], actual: string[]): number | null {
  if (wanted.length === 0) return null // axe non renseigné : il ne compte pas
  const hits = actual.filter((v) => wanted.includes(v)).length
  // 0.35 et non 0 : un critère raté reste un film jouable. Un film porte 2 ou 3
  // humeurs sur 10, donc exiger une humeur précise reviendrait à en faire une
  // contrainte déguisée.
  if (hits === 0) return 0.35
  return Math.min(1, 0.75 + 0.25 * (hits - 1))
}

function scoreFor(movie: Movie, p: Participant): number {
  const { preferences: pref } = p.wishes
  if (pref.surprise) return NEUTRAL

  const genre = axisScore(pref.genres, movie.genres)
  const mood = axisScore(pref.moods, movie.moods)

  let base: number
  if (genre == null && mood == null) base = NEUTRAL
  else if (genre == null) base = mood!
  else if (mood == null) base = genre
  else base = 0.55 * genre + 0.45 * mood

  // Les favoris pèsent, mais ne peuvent pas faire gagner un film à eux seuls :
  // le bonus est trop petit pour rattraper un mauvais score.
  return Math.min(1, base + (p.favorites.has(movie.id) ? 0.06 : 0))
}

/**
 * Score du duo. Volontairement dominé par le moins bien servi des deux : c'est
 * la définition même d'un terrain commun. Une moyenne simple laisserait passer
 * « excellent pour l'un, médiocre pour l'autre ».
 */
function pairScore(scores: number[]): number {
  const min = Math.min(...scores)
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  return 0.65 * min + 0.35 * mean
}

/* ----------------------------------------------------------- hasard semé */

/**
 * Hasard reproductible.
 *
 * Les deux téléphones calculent le pool chacun de leur côté : ils doivent
 * tomber sur exactement le même. Un `Math.random()` donnerait deux résultats
 * différents, et l'écran de compatibilité annoncerait deux nombres de films
 * différents pour la même soirée. La graine est l'identifiant de session :
 * stable pour les deux, neuve à chaque soirée.
 */
function seedFrom(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(list: T[], rnd: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/* ----------------------------------------------------------------- pool */

const THRESHOLD = 0.5
const POOL_MIN = 8

/**
 * Le pool : tous les films qui atteignent le seuil, sans plafond.
 *
 * Il y avait ici un `slice(0, 24)`. Il paraissait anodin ; il ne l'était pas.
 * Les scores ne prennent qu'une poignée de valeurs distinctes, donc les ex æquo
 * sont la règle, pas l'exception — et quand personne n'exprime de préférence
 * (ou que les deux demandent une surprise), les 100 films sont à égalité
 * PARFAITE. Le tri étant stable, le plafond découpait alors toujours les
 * 24 mêmes têtes de catalogue, et les 76 autres étaient inatteignables.
 *
 * D'où deux corrections indissociables :
 *  - mélanger AVANT de trier, pour que les ex æquo ne soient plus départagés
 *    par l'ordre du fichier de données ;
 *  - ne plus plafonner, pour ne plus annoncer « 24 films » quand la vraie
 *    réponse est « les 100 ».
 */
function buildPool(
  eligible: Movie[],
  participants: Participant[],
  rnd: () => number,
): ScoredMovie[] {
  const scored: ScoredMovie[] = shuffle(eligible, rnd)
    .map((movie) => {
      const perUser: Record<string, number> = {}
      for (const p of participants) perUser[p.userId] = scoreFor(movie, p)
      return { movie, score: pairScore(Object.values(perUser)), perUser }
    })
    .sort((a, b) => b.score - a.score)

  // Une préférence n'élimine jamais : si le seuil est trop sélectif, on garde
  // quand même les meilleurs plutôt que de renvoyer une liste vide.
  const pool = scored.filter((s) => s.score >= THRESHOLD)
  return pool.length >= POOL_MIN ? pool : scored.slice(0, Math.min(POOL_MIN, scored.length))
}

/* --------------------------------------------------------- terrain commun */

function commonGround(participants: Participant[], pool: ScoredMovie[]): CommonGround {
  const prefs = participants.map((p) => p.wishes.preferences)

  const shared = (pick: (p: Preferences) => string[]) => {
    const lists = prefs.filter((p) => !p.surprise).map(pick).filter((l) => l.length)
    if (lists.length === 0) return []
    // Ce que les deux ont demandé…
    const both = lists.reduce((acc, l) => acc.filter((v) => l.includes(v)))
    if (both.length) return both
    // …sinon ce qu'un seul a demandé et qui est réellement présent dans le pool.
    const wanted = new Set(lists.flat())
    const counts = new Map<string, number>()
    for (const { movie } of pool) {
      for (const v of [...movie.genres, ...movie.moods]) {
        if (wanted.has(v)) counts.set(v, (counts.get(v) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([v]) => v)
  }

  const caps = participants
    .map((p) => p.wishes.constraints.maxRuntime)
    .filter((v): v is number => v != null)

  return {
    genres: shared((p) => p.genres),
    moods: shared((p) => p.moods),
    maxRuntime: caps.length ? Math.min(...caps) : null,
    anySurprise: prefs.some((p) => p.surprise),
  }
}

/* ------------------------------------------------------------ compromis */

const runtimeLabel = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`

/**
 * Quand aucun film ne passe, on ne retire JAMAIS une contrainte en douce : on
 * chiffre ce que chaque assouplissement rapporterait, et c'est la personne
 * concernée qui tranche.
 */
function findRelaxations(movies: Movie[], participants: Participant[]): Relaxation[] {
  const out: Relaxation[] = []

  const countWith = (userId: string, next: Constraints) => {
    const patched = participants.map((p) =>
      p.userId === userId ? { ...p, wishes: { ...p.wishes, constraints: next } } : p,
    )
    return movies.filter((m) => satisfies(m, patched)).length
  }

  for (const p of participants) {
    const c = p.wishes.constraints

    // Durée : proposer le plafond de l'autre, puis « peu importe ».
    if (c.maxRuntime != null) {
      const others = participants
        .filter((o) => o.userId !== p.userId)
        .map((o) => o.wishes.constraints.maxRuntime)
      const steps = [...new Set([...others.filter((v): v is number => v != null), null])].filter(
        (v) => v === null || v > c.maxRuntime!,
      )
      for (const step of steps) {
        const next = { ...c, maxRuntime: step }
        out.push({
          userId: p.userId,
          name: p.name,
          label:
            step === null
              ? `Si ${p.name} accepte n’importe quelle durée`
              : `Si ${p.name} accepte jusqu’à ${runtimeLabel(step)}`,
          gain: countWith(p.userId, next),
          next,
        })
      }
    }

    for (const genre of c.excludedGenres) {
      const next = { ...c, excludedGenres: c.excludedGenres.filter((g) => g !== genre) }
      out.push({
        userId: p.userId,
        name: p.name,
        label: `Si ${p.name} accepte ${genreWithArticle(genre)}`,
        gain: countWith(p.userId, next),
        next,
      })
    }

    if (c.unseenOnly) {
      const next = { ...c, unseenOnly: false }
      out.push({
        userId: p.userId,
        name: p.name,
        label: `Si ${p.name} accepte de revoir un film`,
        gain: countWith(p.userId, next),
        next,
      })
    }

    if (c.decades.length) {
      const next = { ...c, decades: [] }
      out.push({
        userId: p.userId,
        name: p.name,
        label: `Si ${p.name} ouvre à toutes les époques`,
        gain: countWith(p.userId, next),
        next,
      })
    }
  }

  return out
    .filter((r) => r.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 4)
}

/* -------------------------------------------------------------- entrée */

/**
 * @param seed  Identifiant de session. Départage les ex æquo de façon
 *              identique sur les deux téléphones, et différemment d'un soir
 *              à l'autre.
 */
export function match(movies: Movie[], participants: Participant[], seed = ''): MatchResult {
  const anyUnseenOnly = participants.some((p) => p.wishes.constraints.unseenOnly)
  const unseen = anyUnseenOnly
    ? movies.filter((m) => !participants.some((p) => p.seen.has(m.id))).length
    : movies.length

  const eligible = movies.filter((m) => satisfies(m, participants))
  const pool = buildPool(eligible, participants, mulberry32(seedFrom(seed)))

  return {
    eligible,
    pool,
    commonGround: commonGround(participants, pool),
    funnel: {
      total: movies.length,
      unseen,
      constraints: eligible.length,
      preferences: pool.length,
    },
    // Calculées aussi quand le choix est maigre : l'écran de résultat peut
    // alors proposer d'élargir, sans jamais rien modifier de lui-même.
    relaxations: eligible.length < 5 ? findRelaxations(movies, participants) : [],
  }
}

/**
 * « Pourquoi ce film ? » — uniquement des raisons vérifiables, jamais du
 * remplissage. Une explication fausse coûte plus cher qu'une explication
 * absente.
 */
export function explain(scored: ScoredMovie, participants: Participant[]): string[] {
  const { movie } = scored
  const reasons: string[] = []

  const sharedGenres = movie.genres.filter((g) =>
    participants.every((p) => p.wishes.preferences.surprise || p.wishes.preferences.genres.includes(g)),
  )
  if (sharedGenres.length) {
    reasons.push(`Vous aimez tous les deux ${genreWithArticle(sharedGenres[0])}`)
  }

  const sharedMoods = movie.moods.filter((m) =>
    participants.every((p) => p.wishes.preferences.surprise || p.wishes.preferences.moods.includes(m)),
  )
  if (sharedMoods.length) {
    reasons.push(`Vous vouliez tous les deux quelque chose ${elide(moodAdjective(sharedMoods[0]))}`)
  }

  for (const p of participants) {
    const pref = p.wishes.preferences
    if (pref.surprise) continue
    const mood = movie.moods.find((m) => pref.moods.includes(m) && !sharedMoods.includes(m))
    if (mood) reasons.push(`${p.name} voulait quelque chose ${elide(moodAdjective(mood))}`)
    else {
      const genre = movie.genres.find((g) => pref.genres.includes(g) && !sharedGenres.includes(g))
      if (genre) reasons.push(`${p.name} cherchait plutôt ${genreWithArticle(genre)}`)
    }
  }

  const caps = participants
    .map((p) => p.wishes.constraints.maxRuntime)
    .filter((v): v is number => v != null)
  if (caps.length && movie.runtime != null) {
    reasons.push(`Tient dans votre durée (${runtimeLabel(Math.min(...caps))} max)`)
  }

  if (participants.some((p) => p.wishes.constraints.unseenOnly)) {
    reasons.push('Aucun de vous ne l’a vu')
  }

  return reasons.slice(0, 5)
}

/**
 * Le pourcentage n'est affiché que s'il veut dire quelque chose. En dessous,
 * mieux vaut ne rien annoncer qu'une fausse précision.
 */
export function matchLabel(score: number): { percent: number; text: string } | null {
  if (score < 0.6) return null
  return {
    percent: Math.round(score * 100),
    text: score >= 0.85 ? 'Excellent match' : score >= 0.7 ? 'Bon match' : 'Match correct',
  }
}
