import { MOVIES, MOVIES_BY_ID, MOOD_LABELS, genreWithArticle, type Movie } from './catalog'
import type { Verdict } from '../core/types'

/**
 * Le portrait de goûts : ce que Venn croit comprendre d'une personne.
 *
 * Trois principes tiennent tout ce fichier.
 *
 * 1. ON MESURE UN ÉCART, PAS UN VOLUME.
 *    62 des 100 films sont des drames. Compter les occurrences ferait de tout
 *    le monde un amateur de drame. On compare donc chaque genre à la moyenne
 *    de la personne elle-même : « tes drames sont-ils mieux notés que tes
 *    autres films ? » — pas « as-tu vu beaucoup de drames ? ».
 *
 * 2. PEU DE PREUVES ⇒ PEU D'AFFIRMATION.
 *    Un western adoré ne fait pas de quelqu'un un amateur de westerns. Chaque
 *    affinité est rétrécie vers zéro tant que les observations sont rares, et
 *    rien n'est affiché en dessous d'un minimum de matière.
 *
 * 3. ON NE DIT QUE CE QUI EST VÉRIFIABLE.
 *    Chaque phrase produite ici découle d'un fait qu'on pourrait montrer à
 *    l'utilisateur. Aucune formule décorative, aucun pourcentage inventé.
 */

/* ------------------------------------------------------------------ poids */

/**
 * Combien vaut chaque signal, sur une échelle de goût dans [-1, 1].
 *
 * L'écart est volontairement brutal entre ce qui est dit et ce qui est
 * déduit : un avis explicite après visionnage pèse dix fois une relance.
 * Relancer la roulette veut souvent dire « pas ce soir », pas « je déteste ».
 */
const VERDICT_VALUE: Record<Verdict, number> = {
  loved: 1,
  liked: 0.5,
  meh: -0.35,
  disliked: -0.9,
}

/** Confiance accordée à chaque type de signal (multiplie son poids). */
const WEIGHT = {
  verdict: 1,
  favorite: 0.55,
  chosen: 0.3,
  seen: 0.12,
  refused: 0.08,
} as const

/** En dessous, on se tait : l'affinité n'est pas assez étayée pour être dite. */
const MIN_OBSERVATIONS = 1.2
/** Rétrécissement bayésien : k observations « neutres » ajoutées d'office. */
const SHRINK = 2.2

/* ------------------------------------------------------------------ types */

export interface Signals {
  ratings: Record<string, Verdict>
  favorites: Set<string>
  seen: Set<string>
  /** Films réellement retenus après une roulette. */
  chosen: string[]
  /** Films relancés — signal faible, assumé comme tel. */
  refused: string[]
  /** Corrections explicites de l'utilisateur, par genre ou humeur. */
  adjustments: Record<string, number>
}

/** Gelé : partagé par référence, il ne doit jamais être modifié en place. */
export const EMPTY_SIGNALS: Signals = Object.freeze({
  ratings: Object.freeze({}) as Record<string, Verdict>,
  favorites: new Set<string>(),
  seen: new Set<string>(),
  chosen: Object.freeze([]) as unknown as string[],
  refused: Object.freeze([]) as unknown as string[],
  adjustments: Object.freeze({}) as Record<string, number>,
})

export interface Affinity {
  key: string
  label: string
  emoji?: string
  /** Écart de goût dans [-1, 1] — positif = aimé plus que la moyenne. */
  score: number
  /** Masse d'observations derrière ce score. */
  evidence: number
  level: 'très fort' | 'fort' | 'moyen' | 'occasionnel' | 'rare'
  /** `true` si la valeur vient d'une correction manuelle. */
  adjusted: boolean
}

export type Depth = 'vierge' | 'esquisse' | 'net' | 'précis'

export interface Insight {
  /** Titre court de la remarque. */
  text: string
  /** Films qui la justifient — l'utilisateur doit pouvoir vérifier. */
  movies: Movie[]
}

export interface TasteProfile {
  genres: Affinity[]
  moods: Affinity[]
  /** Ce que Venn sait, en toutes lettres. Jamais un pourcentage. */
  depth: Depth
  depthLabel: string
  /** Nombre d'avis explicites — le seul chiffre qui veuille dire quelque chose. */
  verdicts: number
  /** Masse totale de signaux, tous types confondus. */
  evidence: number
  /** Humeurs dominantes, pour « Ton cinéma idéal ». */
  traits: Affinity[]
  /** Phrase de portrait, ou `null` si la matière ne suffit pas. */
  sentence: string | null
  /** Affiches qui représentent la personne. */
  representative: Movie[]
  /** « Ton côté inattendu » — uniquement des remarques vérifiables. */
  insights: Insight[]
}

/* -------------------------------------------------------------- collecte */

interface Observation {
  movie: Movie
  value: number
  weight: number
}

/**
 * Traduit tous les signaux en observations comparables.
 *
 * Un même film peut être noté ET favori ET choisi : on garde le signal le plus
 * fort plutôt que de les additionner, sinon un seul film pèserait autant que
 * trois.
 */
function observe(signals: Signals): Observation[] {
  const best = new Map<string, Observation>()

  const add = (id: string, value: number, weight: number) => {
    const movie = MOVIES_BY_ID.get(id)
    if (!movie) return
    const current = best.get(id)
    if (current && current.weight >= weight) return
    best.set(id, { movie, value, weight })
  }

  for (const id of signals.seen) add(id, 0.1, WEIGHT.seen)
  for (const id of signals.refused) add(id, -0.25, WEIGHT.refused)
  for (const id of signals.chosen) add(id, 0.5, WEIGHT.chosen)
  for (const id of signals.favorites) add(id, 0.85, WEIGHT.favorite)
  for (const [id, verdict] of Object.entries(signals.ratings)) {
    add(id, VERDICT_VALUE[verdict], WEIGHT.verdict)
  }

  return [...best.values()]
}

/** Moyenne pondérée des observations : le niveau d'exigence de la personne. */
function baseline(obs: Observation[]): number {
  const total = obs.reduce((a, o) => a + o.weight, 0)
  if (total === 0) return 0
  return obs.reduce((a, o) => a + o.value * o.weight, 0) / total
}

/**
 * Paliers calés sur ce que le rétrécissement produit réellement.
 *
 * Avec un seuil haut à 0.35, un portrait de quinze avis affichait « fort »
 * partout : le sommet de l'échelle était inatteignable, et les cinq premiers
 * genres se ressemblaient tous. Les bornes ci-dessous couvrent l'amplitude
 * effectivement observée.
 */
function levelOf(score: number): Affinity['level'] {
  if (score >= 0.28) return 'très fort'
  if (score >= 0.16) return 'fort'
  if (score >= 0.06) return 'moyen'
  if (score >= -0.1) return 'occasionnel'
  return 'rare'
}

/**
 * Affinité pour un axe (genres ou humeurs).
 *
 * `pick` extrait les étiquettes d'un film. On compare la moyenne des films
 * portant l'étiquette à la moyenne générale de la personne, puis on rétrécit
 * selon le nombre d'observations.
 */
function affinities(
  obs: Observation[],
  pick: (m: Movie) => string[],
  label: (key: string) => { label: string; emoji?: string },
  adjustments: Record<string, number>,
): Affinity[] {
  const mean = baseline(obs)
  const acc = new Map<string, { sum: number; weight: number }>()

  for (const o of obs) {
    for (const key of pick(o.movie)) {
      const a = acc.get(key) ?? { sum: 0, weight: 0 }
      a.sum += o.value * o.weight
      a.weight += o.weight
      acc.set(key, a)
    }
  }

  const out: Affinity[] = []
  const keys = new Set([...acc.keys(), ...Object.keys(adjustments)])

  for (const key of keys) {
    const a = acc.get(key)
    const adjust = adjustments[key]
    let score = 0
    let evidence = a?.weight ?? 0

    if (a && a.weight > 0) {
      const local = a.sum / a.weight
      // Rétrécissement : tant que les preuves manquent, on reste près de zéro.
      score = (local - mean) * (a.weight / (a.weight + SHRINK))
    }

    // La correction manuelle l'emporte : c'est la personne qui parle d'elle.
    if (adjust !== undefined) {
      score = adjust
      evidence = Math.max(evidence, MIN_OBSERVATIONS)
    }

    if (evidence < MIN_OBSERVATIONS && adjust === undefined) continue

    const meta = label(key)
    out.push({
      key,
      label: meta.label,
      emoji: meta.emoji,
      score: Math.max(-1, Math.min(1, score)),
      evidence,
      level: levelOf(score),
      adjusted: adjust !== undefined,
    })
  }

  return out.sort((a, b) => b.score - a.score)
}

/* ------------------------------------------------------------ profondeur */

const DEPTHS: { min: number; depth: Depth; label: string }[] = [
  { min: 22, depth: 'précis', label: 'Venn te connaît bien' },
  { min: 10, depth: 'net', label: 'Venn commence à bien te cerner' },
  { min: 3, depth: 'esquisse', label: 'Venn commence à te découvrir' },
  { min: 0, depth: 'vierge', label: 'Venn ne te connaît pas encore' },
]

/**
 * La profondeur se compte en signaux forts, pas en pourcentage.
 *
 * Afficher « profil complété à 73,4 % » serait une précision inventée : il
 * n'existe pas de portrait « complet » dont on pourrait mesurer une fraction.
 */
function depthOf(obs: Observation[], verdicts: number): { depth: Depth; label: string } {
  const strong = verdicts + obs.filter((o) => o.weight >= WEIGHT.favorite).length * 0.5
  return DEPTHS.find((d) => strong >= d.min)!
}

/* ---------------------------------------------------------------- phrase */

const MOOD_PHRASE: Record<string, string> = {
  drole: 'qui font rire',
  intense: 'qui ne relâchent jamais la tension',
  facile: 'qui se laissent regarder sans effort',
  mindfuck: 'qui retournent le cerveau',
  emotion: 'qui serrent la gorge',
  stressant: 'qui tiennent en haleine',
  spectaculaire: 'qui en mettent plein la vue',
  intelligent: 'qui donnent à réfléchir',
  chill: 'où l’on se pose',
  surprenant: 'qui prennent à contre-pied',
}

/** Phrase de portrait. Renvoie `null` plutôt qu'une généralité creuse. */
function portrait(genres: Affinity[], moods: Affinity[]): string | null {
  const topMoods = moods.filter((m) => m.score >= 0.12).slice(0, 2)
  const topGenres = genres.filter((g) => g.score >= 0.12).slice(0, 2)
  if (!topMoods.length && !topGenres.length) return null

  const moodPart = topMoods.map((m) => MOOD_PHRASE[m.key]).filter(Boolean)
  const genrePart = topGenres.map((g) => genreWithArticle(g.key))

  if (moodPart.length && genrePart.length) {
    return `Tu vas vers ${genrePart.join(' et ')}, et surtout vers les films ${moodPart.join(' et ')}.`
  }
  if (moodPart.length) return `Tu sembles aimer les films ${moodPart.join(' et ')}.`
  return `Tu vas surtout vers ${genrePart.join(' et ')}.`
}

/* ------------------------------------------------------- côté inattendu */

/**
 * « Ton côté inattendu ».
 *
 * Chaque remarque doit être défendable devant l'utilisateur, films à l'appui.
 * Une remarque fausse coûte bien plus cher qu'une absence de remarque : elle
 * détruit la confiance dans tout le reste du portrait.
 */
function findInsights(signals: Signals, obs: Observation[], genres: Affinity[]): Insight[] {
  const out: Insight[] = []
  const loved = Object.entries(signals.ratings)
    .filter(([, v]) => v === 'loved')
    .map(([id]) => MOVIES_BY_ID.get(id))
    .filter((m): m is Movie => !!m)

  // 1. Un genre peu fréquenté, mais dont les rares films sont adorés.
  const dominant = new Set(genres.slice(0, 2).map((g) => g.key))
  for (const g of genres) {
    if (dominant.has(g.key)) continue
    const inGenre = loved.filter((m) => m.genres.includes(g.key))
    const engaged = obs.filter((o) => o.movie.genres.includes(g.key))
    if (inGenre.length >= 2 && engaged.length <= 5) {
      out.push({
        text: `Tu regardes peu ${genreWithArticle(g.key)}, mais tu as adoré ${inGenre.length} de ces films.`,
        movies: inGenre.slice(0, 3),
      })
      break
    }
  }

  // 2. Des films longs, malgré tout.
  const catalogMean = MOVIES.reduce((a, m) => a + (m.runtime ?? 0), 0) / MOVIES.length
  const longLoved = loved.filter((m) => (m.runtime ?? 0) >= catalogMean + 20)
  if (loved.length >= 4 && longLoved.length / loved.length >= 0.5) {
    out.push({
      text: 'Tu sembles aimer les films longs quand ils t’embarquent vraiment.',
      movies: longLoved.slice(0, 3),
    })
  }

  // 3. Un genre où tout ce qui est vu est aimé, sans exception.
  for (const g of genres) {
    const engaged = obs.filter((o) => o.movie.genres.includes(g.key) && o.weight >= WEIGHT.verdict)
    if (engaged.length >= 3 && engaged.every((o) => o.value > 0)) {
      out.push({
        text: `Tu n’as jamais été déçu par ${genreWithArticle(g.key)}.`,
        movies: engaged.slice(0, 3).map((o) => o.movie),
      })
      break
    }
  }

  return out.slice(0, 2)
}

/* --------------------------------------------------------------- entrée */

const genreMeta = (key: string) => ({ label: key })
const moodMeta = (key: string) => ({
  label: MOOD_LABELS[key]?.label ?? key,
  emoji: MOOD_LABELS[key]?.emoji,
})

export function buildProfile(signals: Signals): TasteProfile {
  const obs = observe(signals)
  const verdicts = Object.keys(signals.ratings).length

  const genres = affinities(obs, (m) => m.genres, genreMeta, filterKeys(signals.adjustments, GENRE_KEYS))
  const moods = affinities(obs, (m) => m.moods, moodMeta, filterKeys(signals.adjustments, MOOD_KEYS))
  const { depth, label } = depthOf(obs, verdicts)

  // Films représentatifs : d'abord les coups de cœur explicites, puis les
  // favoris. On ne « devine » jamais un film représentatif à partir du score —
  // montrer un film que la personne n'a pas choisi sonnerait faux.
  const representative = [
    ...Object.entries(signals.ratings)
      .filter(([, v]) => v === 'loved')
      .map(([id]) => id),
    ...[...signals.favorites],
    ...signals.chosen,
  ]
    .filter((id, i, all) => all.indexOf(id) === i)
    .map((id) => MOVIES_BY_ID.get(id))
    .filter((m): m is Movie => !!m)
    .slice(0, 5)

  return {
    genres,
    moods,
    depth,
    depthLabel: label,
    verdicts,
    evidence: obs.reduce((a, o) => a + o.weight, 0),
    traits: moods.filter((m) => m.score >= 0.12).slice(0, 4),
    sentence: depth === 'vierge' ? null : portrait(genres, moods),
    representative,
    insights: depth === 'vierge' ? [] : findInsights(signals, obs, genres),
  }
}

const GENRE_KEYS = new Set(MOVIES.flatMap((m) => m.genres))
const MOOD_KEYS = new Set(Object.keys(MOOD_LABELS))

const filterKeys = (map: Record<string, number>, allowed: Set<string>) =>
  Object.fromEntries(Object.entries(map).filter(([k]) => allowed.has(k)))

/* ------------------------------------------------------------ profil duo */

export interface DuoTaste {
  /** Films que les deux ont aimés ou adorés. */
  agreements: Movie[]
  /** Films sur lesquels ils se sont franchement opposés. */
  clashes: Movie[]
  /** Ce qui marche pour eux DEUX, pas la somme de leurs goûts. */
  genres: Affinity[]
  moods: Affinity[]
  /** Nombre de films sur lesquels les deux se sont prononcés. */
  shared: number
  depth: Depth
  depthLabel: string
  sentences: string[]
}

const DUO_DEPTHS: { min: number; depth: Depth; label: string }[] = [
  { min: 10, depth: 'précis', label: 'Venn connaît bien votre duo' },
  { min: 5, depth: 'net', label: 'Venn commence à cerner votre duo' },
  { min: 2, depth: 'esquisse', label: 'Venn découvre votre duo' },
  { min: 0, depth: 'vierge', label: 'Venn ne connaît pas encore votre duo' },
]

/**
 * Ce que le duo aime ENSEMBLE.
 *
 * Le point important : on ne moyenne pas deux profils. On ne regarde que les
 * films sur lesquels les DEUX se sont prononcés, et on retient le moins
 * enthousiaste des deux avis. Un film adoré par l'un et détesté par l'autre
 * n'est pas « à moitié bon » pour le duo : c'est un mauvais film pour le duo.
 */
export function buildDuoTaste(a: Signals, b: Signals): DuoTaste {
  const shared: Observation[] = []
  const agreements: Movie[] = []
  const clashes: Movie[] = []

  for (const [id, va] of Object.entries(a.ratings)) {
    const vb = b.ratings[id]
    if (!vb) continue
    const movie = MOVIES_BY_ID.get(id)
    if (!movie) continue

    const worst = Math.min(VERDICT_VALUE[va], VERDICT_VALUE[vb])
    shared.push({ movie, value: worst, weight: WEIGHT.verdict })

    if (worst >= VERDICT_VALUE.liked) agreements.push(movie)
    else if (Math.abs(VERDICT_VALUE[va] - VERDICT_VALUE[vb]) >= 1.2) clashes.push(movie)
  }

  // Les films choisis ensemble comptent, mais moins qu'un avis donné après coup.
  const together = a.chosen.filter((id) => b.chosen.includes(id))
  for (const id of together) {
    if (shared.some((o) => o.movie.id === id)) continue
    const movie = MOVIES_BY_ID.get(id)
    if (movie) shared.push({ movie, value: 0.4, weight: WEIGHT.chosen })
  }

  const genres = affinities(shared, (m) => m.genres, genreMeta, {})
  const moods = affinities(shared, (m) => m.moods, moodMeta, {})
  const { depth, label } = DUO_DEPTHS.find((d) => agreements.length + together.length >= d.min)!

  const sentences: string[] = []
  const topGenres = genres.filter((g) => g.score >= 0.12).slice(0, 3)
  if (topGenres.length) {
    sentences.push(
      `Vous vous retrouvez surtout sur ${topGenres.map((g) => genreWithArticle(g.key)).join(', ')}.`,
    )
  }
  const topMoods = moods.filter((m) => m.score >= 0.12).slice(0, 2)
  if (topMoods.length) {
    sentences.push(
      `Ensemble, vous aimez les films ${topMoods.map((m) => MOOD_PHRASE[m.key]).filter(Boolean).join(' et ')}.`,
    )
  }
  if (clashes.length >= 2) {
    sentences.push(`Vous êtes rarement d’accord sur ${clashes.length} films — Venn en tient compte.`)
  }

  return {
    agreements,
    clashes,
    genres,
    moods,
    shared: shared.length,
    depth,
    depthLabel: label,
    sentences,
  }
}
