import { decadeOf, elide, genreWithArticle, moodAdjective, type Work } from './catalog'
import type { DuoTaste, TasteProfile } from './taste'

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
  /** Goûts durables. Complète l'envie du soir ; ne la contredit jamais. */
  taste?: TasteProfile | null
}

export interface ScoredMovie {
  movie: Work
  /** Score commun dans [0,1] — c'est lui qui classe le pool. */
  score: number
  /** Score individuel, par `userId`. Sert à expliquer le résultat. */
  perUser: Record<string, number>
  /**
   * Part du score due à la seule envie du soir, sans les profils. C'est elle,
   * et elle seule, qui décide de l'appartenance au pool — les goûts durables
   * ne peuvent que réordonner ce que la soirée a déjà validé.
   */
  tonight: number
  /**
   * Avis des goûts durables sur ce film, dans [-1, 1]. Valeur brute : ce que
   * Venn en pense, indépendamment du poids qu'on lui accorde ensuite.
   */
  profile: number
  /**
   * Bon pour ce soir, mais en dehors des habitudes du duo. Proposé de temps en
   * temps pour éviter d'enfermer les gens dans ce qu'ils connaissent déjà.
   */
  wildcard: boolean
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
  eligible: Work[]
  pool: ScoredMovie[]
  commonGround: CommonGround
  funnel: Funnel
  /** Non vide seulement quand aucun film ne passe les contraintes. */
  relaxations: Relaxation[]
}

/* ----------------------------------------------------------- contraintes */

/** Un film est éligible s'il satisfait les contraintes de TOUT LE MONDE. */
function satisfies(movie: Work, participants: Participant[]): boolean {
  for (const p of participants) {
    const c = p.wishes.constraints

    // La durée d'une soirée ne se compare pas à celle d'un épisode : la
    // contrainte ne vaut que pour les films. Sinon une limite de durée ferait
    // disparaître toutes les séries, dont la durée d'épisode est presque
    // toujours inconnue.
    if (movie.kind === 'movie' && c.maxRuntime != null) {
      // Une durée inconnue ne doit pas passer un plafond en douce.
      if (movie.runtime == null || movie.runtime > c.maxRuntime) return false
    }

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

/** Score de l'envie du soir seule — le profil n'y entre pas. */
function tonightScore(movie: Work, p: Participant): number {
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
 * LA RÈGLE D'OR, EN CODE.
 *
 *   « Le profil complète l'envie du soir. Il ne la contredit jamais. »
 *
 * Trois verrous.
 *
 * 1. MASQUAGE PAR AXE. Si la personne a nommé des humeurs ce soir, ses
 *    humeurs habituelles sont ignorées ; idem pour les genres. Le profil ne
 *    parle QUE là où la soirée est muette. Quelqu'un qui aime les thrillers et
 *    demande une comédie n'obtiendra donc jamais un thriller « parce qu'il
 *    aime ça d'habitude ».
 *
 * 2. INFLUENCE PLUS PETITE QUE LE PLUS PETIT ÉCART (cf. `profileScale`).
 *
 * 3. AUCUN EFFET SUR LA SÉLECTION. Le profil ne décide pas qui entre dans le
 *    pool, seulement dans quel ordre (cf. `buildPool`).
 */

/** Plafond absolu de l'influence du profil, quels que soient les écarts. */
const PROFILE_WEIGHT = 0.12

/**
 * Coup de pouce aux œuvres du canon.
 *
 * Elles sont choisies et étiquetées à la main ; le réservoir, non. À envie du
 * soir égale, autant proposer celle dont on répond. Le bonus passe par le même
 * terme borné que le profil, donc il hérite de la même garantie : il ne peut
 * pas faire passer devant une œuvre qui correspond moins à ce qui a été
 * demandé ce soir.
 */
const CANON_BONUS = 0.3

/**
 * Échelle appliquée au profil, calculée sur le pool lui-même.
 *
 * Le verrou 2 avait d'abord été posé sur une constante « plus petite que le
 * plus petit écart ». C'était faux d'un facteur deux : ce qui sépare deux
 * films, c'est la DIFFÉRENCE de leurs apports de profil, donc jusqu'au double
 * du plafond. Un balayage de 24 000 paires a sorti 154 inversions — des films
 * remontés au-dessus d'autres qui correspondaient pourtant mieux à ce qui
 * venait d'être demandé.
 *
 * On calcule donc l'échelle à partir du plus petit écart réellement présent :
 * deux apports opposés ne peuvent alors couvrir que 90 % de cet écart. La
 * garantie ne dépend plus d'un réglage heureux, elle tient par construction.
 */
function profileScale(tonights: number[]): number {
  const distinct = [...new Set(tonights)].sort((a, b) => a - b)
  let smallest = Infinity
  for (let i = 1; i < distinct.length; i++) {
    smallest = Math.min(smallest, distinct[i] - distinct[i - 1])
  }
  // Tous à égalité : rien à contredire, le profil peut trancher librement.
  if (!Number.isFinite(smallest)) return PROFILE_WEIGHT
  // 0.45 × écart : deux apports opposés valent au plus 0.9 × écart.
  return Math.min(PROFILE_WEIGHT, 0.45 * smallest)
}

/**
 * Renvoie `null` quand Venn n'a rien à dire sur ce film pour cette personne.
 *
 * Distinction essentielle : « je ne sais pas » n'est pas « ça m'est égal ». En
 * renvoyant 0 pour un profil vide, le `min` du score de duo ramenait tout à
 * zéro dès qu'une des deux personnes était nouvelle — c'est-à-dire presque
 * toujours au début — et le profil de l'autre ne servait plus à rien.
 */
function profileValue(movie: Work, p: Participant): number | null {
  const taste = p.taste
  if (!taste) return null
  const { preferences: pref } = p.wishes
  // « Surprends-moi » est une demande explicite de sortir des sentiers battus :
  // rappeler ses habitudes irait contre ce qui vient d'être demandé.
  if (pref.surprise) return null

  const parts: number[] = []

  // Verrou 1 : chaque axe se tait dès que la soirée s'est exprimée dessus.
  if (pref.genres.length === 0) {
    for (const g of movie.genres) {
      const hit = taste.genres.find((a) => a.key === g)
      if (hit) parts.push(hit.score)
    }
  }
  if (pref.moods.length === 0) {
    for (const m of movie.moods) {
      const hit = taste.moods.find((a) => a.key === m)
      if (hit) parts.push(hit.score)
    }
  }

  if (!parts.length) return null
  const mean = parts.reduce((a, b) => a + b, 0) / parts.length
  return Math.max(-1, Math.min(1, mean))
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
  eligible: Work[],
  participants: Participant[],
  rnd: () => number,
): ScoredMovie[] {
  const raw = shuffle(eligible, rnd).map((movie) => {
    const perUser: Record<string, number> = {}
    const profiles: number[] = []
    for (const p of participants) {
      perUser[p.userId] = tonightScore(movie, p)
      const value = profileValue(movie, p)
      // Seuls ceux sur qui Venn a une opinion entrent dans le calcul.
      if (value !== null) profiles.push(value)
    }
    // Profil et curation partagent le même terme : c'est ce qui leur fait
    // partager la même borne, et donc la même garantie.
    const signed = pairSigned(profiles) + (movie.canon ? CANON_BONUS : 0)
    return {
      movie,
      perUser,
      tonight: pairScore(Object.values(perUser)),
      // Le profil du duo se lit comme celui d'une personne : c'est le moins
      // bien servi qui commande, pas la moyenne.
      profile: Math.max(-1, Math.min(1, signed)),
    }
  })

  const scale = profileScale(raw.map((r) => r.tonight))

  const scored: ScoredMovie[] = raw
    .map((r) => ({
      ...r,
      score: Math.max(0, Math.min(1, r.tonight + scale * r.profile)),
      wildcard: false,
    }))
    .sort((a, b) => b.score - a.score)

  // Verrou 3 de la règle d'or : l'appartenance au pool se décide sur la SEULE
  // envie du soir. Les goûts durables réordonnent, ils n'ouvrent ni ne ferment
  // la porte — sinon une habitude pourrait écarter ce qui vient d'être demandé.
  const pool = scored.filter((s) => s.tonight >= THRESHOLD)
  const chosen =
    pool.length >= POOL_MIN
      ? pool
      : [...scored].sort((a, b) => b.tonight - a.tonight).slice(0, Math.min(POOL_MIN, scored.length))

  return markWildcards(chosen)
}

/**
 * Moyenne signée « à la Venn » : dominée par la personne la moins servie.
 * Un film que l'un adore et que l'autre fuit n'est pas un demi-bon film.
 */
function pairSigned(values: number[]): number {
  if (!values.length) return 0
  const min = Math.min(...values)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return 0.65 * min + 0.35 * mean
}

/**
 * Les wildcards.
 *
 * Un wildcard n'est PAS un mauvais film qu'on glisse au hasard : c'est un film
 * qui répond pleinement à l'envie du soir tout en sortant des habitudes du
 * duo. Sans ça, Venn ne proposerait éternellement que ce qu'il sait déjà être
 * aimé, et enfermerait les gens dans leur propre passé.
 */
function markWildcards(pool: ScoredMovie[]): ScoredMovie[] {
  if (pool.length < 6) return pool
  const tonights = pool.map((s) => s.tonight).sort((a, b) => a - b)
  const medianTonight = tonights[Math.floor(tonights.length / 2)]

  return pool.map((s) => ({
    ...s,
    // Bon pour ce soir, mais en dehors de ce que le duo choisit d'habitude.
    wildcard: s.tonight >= medianTonight && s.profile < -0.05,
  }))
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
function findRelaxations(movies: Work[], participants: Participant[]): Relaxation[] {
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
export function match(movies: Work[], participants: Participant[], seed = ''): MatchResult {
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
export function explain(
  scored: ScoredMovie,
  participants: Participant[],
  duoTaste?: DuoTaste | null,
): string[] {
  const { movie } = scored
  const reasons: string[] = []

  // Le wildcard s'annonce d'abord : c'est une proposition volontairement
  // décalée, et la présenter comme une évidence serait malhonnête.
  if (scored.wildcard) {
    reasons.push('Un peu à côté de vos habitudes — Venn tente le coup')
  }

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

  // Ce que le duo a déjà aimé ensemble. Uniquement si c'est vrai et vérifiable :
  // il faut un genre partagé ET des films réellement notés par les deux.
  if (duoTaste && duoTaste.agreements.length >= 2) {
    const shared = movie.genres.find((g) =>
      duoTaste.genres.some((a) => a.key === g && a.score >= 0.12),
    )
    if (shared) {
      reasons.push(`Vous avez déjà aimé ${genreWithArticle(shared)} ensemble`)
    }
  }

  // Les goûts durables ne sont invoqués que là où la soirée n'a rien imposé —
  // le même verrou que dans le calcul, répété dans l'explication.
  for (const p of participants) {
    if (p.wishes.preferences.surprise || !p.taste) continue
    if (p.wishes.preferences.moods.length) continue
    const mood = movie.moods.find((m) =>
      p.taste!.moods.some((a) => a.key === m && a.score >= 0.2),
    )
    if (mood) {
      reasons.push(`${p.name} aime généralement ce qui est ${moodAdjective(mood)}`)
      break
    }
  }

  return reasons.slice(0, 5)
}

/**
 * Le degré de correspondance, en mots.
 *
 * La V2 affichait « 63 % · Match correct ». Deux chiffres significatifs
 * suggéraient une mesure ; il n'y en a pas. Le score est un classement, pas une
 * probabilité de plaire — l'afficher au pour cent près, c'était habiller une
 * intuition en résultat scientifique. Ne restent que des paliers assumés, et
 * rien du tout quand le film n'est qu'un choix acceptable de plus.
 */
export function matchLabel(scored: ScoredMovie): { text: string; tone: 'gold' | 'violet' } | null {
  if (scored.wildcard) return { text: 'Wildcard', tone: 'violet' }
  if (scored.score >= 0.85) return { text: 'Perfect match', tone: 'gold' }
  if (scored.score >= 0.72) return { text: 'Excellent match', tone: 'gold' }
  if (scored.score >= 0.6) return { text: 'Bon compromis', tone: 'gold' }
  return null
}
