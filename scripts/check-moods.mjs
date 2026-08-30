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
import { MOODS, MOOD_IDS } from './movies.moods.mjs'
import { MOVIES } from './movies.seed.mjs'

/** « On se pose » et « ça secoue » ne peuvent pas coexister. */
const CALME = ['chill', 'facile']
const SECOUE = ['intense', 'stressant', 'mindfuck']

const MIN_MOODS = 2
const MAX_MOODS = 3

const errors = []
const known = new Set(MOOD_IDS)
const seeds = new Set(MOVIES.map((m) => m.wiki))

/* ------------------------------------------------------------ couverture */

for (const { wiki } of MOVIES) {
  if (!MOODS[wiki]) errors.push(`${wiki} : aucune humeur`)
}
for (const wiki of Object.keys(MOODS)) {
  if (!seeds.has(wiki)) errors.push(`${wiki} : clé orpheline, absente du catalogue`)
}

/* --------------------------------------------------------- cohérence */

for (const [wiki, moods] of Object.entries(MOODS)) {
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
for (const moods of Object.values(MOODS)) for (const m of moods) counts[m]++

const line = MOOD_IDS.map((id) => `${id} ${counts[id]}`).join(' · ')
console.log(`✓ Humeurs : ${MOVIES.length} films, aucune contradiction.`)
console.log(`  ${line}`)

// Un axe vide rendrait une demande impossible à satisfaire.
const empty = MOOD_IDS.filter((id) => counts[id] === 0)
if (empty.length) {
  console.error(`\n✗ Humeur(s) proposée(s) à l'écran mais sur aucun film : ${empty.join(', ')}`)
  process.exit(1)
}
