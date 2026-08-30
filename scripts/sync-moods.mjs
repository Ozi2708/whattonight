/**
 * Applique les humeurs de `movies.moods.mjs` au catalogue déjà généré.
 *
 * Corriger une humeur ne devrait pas obliger à retélécharger 100 films depuis
 * Wikipédia, Wikidata et TMDB — c'est long, c'est fragile, et ça mélange deux
 * choses sans rapport : des données factuelles récupérées ailleurs, et un
 * jugement éditorial écrit ici.
 *
 * Ce script ne touche QUE le champ `moods`. Tout le reste du fichier est
 * recopié à l'identique.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { MOODS, MOOD_IDS } from './movies.moods.mjs'

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const FILE = new URL('../src/data/movies.json', import.meta.url)
const catalog = JSON.parse(readFileSync(FILE, 'utf8'))

const byId = new Map(Object.entries(MOODS).map(([wiki, moods]) => [slug(wiki), moods]))

let changed = 0
const missing = []

for (const item of catalog.items) {
  const moods = byId.get(item.id)
  if (!moods) {
    missing.push(item.id)
    continue
  }
  if (JSON.stringify(item.moods) !== JSON.stringify(moods)) {
    console.log(`  ${item.title}`)
    console.log(`    avant : ${(item.moods ?? []).join(', ') || '—'}`)
    console.log(`    après : ${moods.join(', ')}`)
    item.moods = [...moods]
    changed++
  }
}

if (missing.length) {
  console.error(`\n✗ Aucune humeur trouvée pour : ${missing.join(', ')}`)
  process.exit(1)
}

catalog.moods = [...MOOD_IDS]
writeFileSync(FILE, JSON.stringify(catalog, null, 2) + '\n')

console.log(
  changed === 0
    ? '✓ Humeurs déjà à jour dans le catalogue.'
    : `\n✓ ${changed} film(s) mis à jour dans src/data/movies.json.`,
)
