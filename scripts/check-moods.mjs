/**
 * Contrôle des humeurs. Fait échouer le build en cas de faute.
 *
 * Les humeurs sont la seule donnée entièrement écrite à la main, et celle sur
 * laquelle repose tout le croisement de Venn. Une contradiction y est
 * invisible à la lecture — « intense, chill, stressant » se lit sans broncher —
 * mais se voit immédiatement à l'usage : on demande « on se pose » et Venn
 * propose Drive.
 *
 * D'où ce garde-fou. Les incompatibilités ne sont pas des recommandations :
 * ce sont des contradictions logiques. Un film ne peut pas à la fois se
 * regarder fatigué et tenir en haleine.
 */
/*
 * LA RÈGLE, puisque c'est ici qu'elle est appliquée :
 *
 *   UNE HUMEUR DÉCRIT CE QUE ÇA FAIT AU SPECTATEUR,
 *   PAS LE RYTHME NI L'ESTHÉTIQUE DE L'ŒUVRE.
 *
 *   drole          On le met POUR RIRE. L'humour domine du début à la fin.
 *   intense        Enjeux élevés, ça ne relâche pas.
 *   facile         Se regarde fatigué : simple à suivre, aucune tension
 *                  prolongée.
 *   mindfuck       Demande de reconstruire. On en parle après.
 *   emotion        Ça serre la gorge.
 *   stressant      Angoisse, peur, malaise.
 *   spectaculaire  Grand écran, images qui en mettent plein la vue.
 *   intelligent    Des idées, un propos, ça laisse à penser.
 *   chill          Apaisant. Rien ne vient nous secouer.
 *   surprenant     Prend à contre-pied.
 *
 * Pièges avérés : Drive est lent et léché mais contient un écrasement de
 * crâne — pas chill. Jurassic Park est grand public mais terrifiant — pas
 * facile. La vie est belle se passe pour moitié dans un camp — pas drôle.
 */
import { readFileSync } from 'node:fs'

const SEED = new URL('./catalogue.seed.json', import.meta.url)
const works = JSON.parse(readFileSync(SEED, 'utf8'))

export const MOOD_IDS = [
  'drole', 'intense', 'facile', 'mindfuck', 'emotion',
  'stressant', 'spectaculaire', 'intelligent', 'chill', 'surprenant',
]

const GENRE_IDS = [
  'Action', 'Animation', 'Aventure', 'Comédie', 'Crime', 'Drame', 'Familial',
  'Fantastique', 'Guerre', 'Histoire', 'Horreur', 'Musique', 'Mystère',
  'Romance', 'Science-Fiction', 'Thriller', 'Western',
]

/** « On se pose » et « ça secoue » ne peuvent pas coexister. */
const CALME = ['chill', 'facile']
const SECOUE = ['intense', 'stressant', 'mindfuck']

const MIN_MOODS = 2
const MAX_MOODS = 3

const errors = []
const known = new Set(MOOD_IDS)
const knownGenres = new Set(GENRE_IDS)
const seenIds = new Set()

/* --------------------------------------------------------- cohérence */

for (const w of works) {
  const wiki = `${w.title} (${w.year})`
  const moods = w.moods

  // Un identifiant en double ferait fusionner deux œuvres dans la bibliothèque.
  const idKey = `${w.type}:${w.tmdbId}`
  if (seenIds.has(idKey)) errors.push(`${wiki} : identifiant TMDB en double`)
  seenIds.add(idKey)

  if (!Array.isArray(w.genres) || w.genres.length === 0) {
    errors.push(`${wiki} : aucun genre`)
  }
  for (const g of w.genres ?? []) {
    if (!knownGenres.has(g)) errors.push(`${wiki} : genre inconnu « ${g} »`)
  }

  if (!Array.isArray(moods)) {
    errors.push(`${wiki} : les humeurs doivent être un tableau`)
    continue
  }
  if (moods.length < MIN_MOODS || moods.length > MAX_MOODS) {
    errors.push(`${wiki} : ${moods.length} humeur(s), il en faut ${MIN_MOODS} à ${MAX_MOODS}`)
  }
  if (new Set(moods).size !== moods.length) {
    errors.push(`${wiki} : humeur en double`)
  }
  for (const m of moods) {
    if (!known.has(m)) errors.push(`${wiki} : humeur inconnue « ${m} »`)
  }

  const calme = moods.filter((m) => CALME.includes(m))
  const secoue = moods.filter((m) => SECOUE.includes(m))
  if (calme.length && secoue.length) {
    errors.push(
      `${wiki} : contradiction — « ${calme.join(', ')} » (on se pose) ` +
        `avec « ${secoue.join(', ')} » (ça secoue). Un film ne peut pas être les deux.`,
    )
  }
}

/* ------------------------------------------------------------- rapport */

if (errors.length) {
  console.error(`\n✗ ${errors.length} problème(s) dans les humeurs :\n`)
  for (const e of errors) console.error('  · ' + e)
  console.error('\nVoir la règle en tête de scripts/movies.moods.mjs.\n')
  process.exit(1)
}

const counts = Object.fromEntries(MOOD_IDS.map((id) => [id, 0]))
for (const w of works) for (const m of w.moods) counts[m]++

const films = works.filter((w) => w.type === 'movie').length
const line = MOOD_IDS.map((id) => `${id} ${counts[id]}`).join(' · ')
console.log(`✓ Catalogue : ${films} films et ${works.length - films} séries, aucune contradiction.`)
console.log(`  ${line}`)

// Un axe vide rendrait une demande impossible à satisfaire.
const empty = MOOD_IDS.filter((id) => counts[id] === 0)
if (empty.length) {
  console.error(`\n✗ Humeur(s) proposée(s) à l'écran mais sur aucun film : ${empty.join(', ')}`)
  process.exit(1)
}
