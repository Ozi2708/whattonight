/**
 * Vérifie le moteur de compatibilité sur l'exemple de la spécification.
 * Lancement : npx tsx scripts/check-matching.ts
 */
import { MOVIES, moodLabel } from '../src/movies/catalog'
import { match, explain, matchLabel, type Participant } from '../src/movies/matching'

const valentin: Participant = {
  userId: 'v',
  name: 'Valentin',
  seen: new Set(['inception', 'interstellar']),
  favorites: new Set(['blade-runner-2049']),
  wishes: {
    constraints: { maxRuntime: 150, excludedGenres: [], unseenOnly: true, decades: [] },
    preferences: { genres: ['Thriller', 'Science-Fiction'], moods: ['intense'], surprise: false },
  },
}

const manon: Participant = {
  userId: 'm',
  name: 'Manon',
  seen: new Set(['parasite']),
  favorites: new Set(),
  wishes: {
    constraints: { maxRuntime: 120, excludedGenres: [], unseenOnly: true, decades: [] },
    preferences: {
      genres: ['Aventure', 'Comédie', 'Science-Fiction'],
      moods: ['facile'],
      surprise: false,
    },
  },
}

const duo = [valentin, manon]
const r = match(MOVIES, duo)

console.log('--- ENTONNOIR ---')
console.log(`total ${r.funnel.total} → jamais vus ${r.funnel.unseen} → contraintes ${r.funnel.constraints} → préférences ${r.funnel.preferences}`)

console.log('\n--- CONTRAINTE LA PLUS STRICTE RETENUE ---')
const overLimit = r.eligible.filter((m) => (m.runtime ?? 0) > 120)
console.log(`films > 2h dans le pool éligible : ${overLimit.length} (doit être 0 — Manon plafonne à 2h)`)
const seenByEither = r.eligible.filter((m) => valentin.seen.has(m.id) || manon.seen.has(m.id))
console.log(`films vus par l'un des deux : ${seenByEither.length} (doit être 0)`)

console.log('\n--- TERRAIN COMMUN ---')
console.log('genres :', r.commonGround.genres.join(', ') || '—')
console.log('humeurs :', r.commonGround.moods.map(moodLabel).join(', ') || '—')
console.log('durée max :', r.commonGround.maxRuntime, 'min')

console.log('\n--- TOP 8 DU POOL ---')
for (const s of r.pool.slice(0, 8)) {
  const l = matchLabel(s.score)
  console.log(
    `${(l ? l.percent + '%' : ' — ').padStart(4)} ${s.movie.title.padEnd(32)} ` +
      `V:${s.perUser.v.toFixed(2)} M:${s.perUser.m.toFixed(2)}  [${s.movie.genres.join('/')}]`,
  )
}

console.log('\n--- POURQUOI CE FILM ---')
for (const line of explain(r.pool[0], duo)) console.log('  ✓', line)

// Un film qui ne parle qu'à une seule personne doit être classé plus bas
// qu'un film qui parle aux deux : c'est tout l'intérêt du produit.
console.log('\n--- ÉQUILIBRE ---')
const worst = r.pool[r.pool.length - 1]
const gapTop = Math.abs(r.pool[0].perUser.v - r.pool[0].perUser.m)
const gapBottom = Math.abs(worst.perUser.v - worst.perUser.m)
console.log(`écart entre les deux, en tête : ${gapTop.toFixed(2)} / en queue : ${gapBottom.toFixed(2)}`)

console.log('\n--- CAS SANS AUCUN MATCH ---')
const impossible = match(MOVIES, [
  { ...valentin, wishes: { ...valentin.wishes, constraints: { maxRuntime: 90, excludedGenres: ['Drame'], unseenOnly: true, decades: [] } } },
  { ...manon, wishes: { ...manon.wishes, constraints: { maxRuntime: 90, excludedGenres: ['Animation', 'Comédie'], unseenOnly: true, decades: ['1990'] } } },
])
console.log(`éligibles : ${impossible.eligible.length}`)
for (const r2 of impossible.relaxations) console.log(`  · ${r2.label} → +${r2.gain} films`)
