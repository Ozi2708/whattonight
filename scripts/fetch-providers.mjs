/**
 * Où regarder chaque œuvre, en France.
 *
 * Fichier séparé du catalogue, volontairement : le catalogue ne bouge que
 * quand on l'édite, les disponibilités changent tous les jours. Les mélanger
 * obligerait à tout régénérer pour rafraîchir une ligne.
 *
 * ⚠ ATTRIBUTION OBLIGATOIRE
 * Les données viennent de JustWatch via TMDB. TMDB exige que la source soit
 * créditée visiblement — le non-respect entraîne la révocation de la clé.
 * L'app affiche « Disponibilités fournies par JustWatch » sur chaque fiche.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const CATALOGUE = resolve(ROOT, 'src/data/catalogue.json')
const OUT = resolve(ROOT, 'src/data/providers.json')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const OPTIONAL = process.argv.includes('--optional')

async function loadKey() {
  const fromEnv = process.env.TMDB_API_KEY?.trim()
  if (fromEnv) return fromEnv
  const envFile = resolve(ROOT, '.env.local')
  if (!existsSync(envFile)) return null
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i > 0 && line.slice(0, i).trim().replace(/^﻿/, '') === 'TMDB_API_KEY') {
      return line.slice(i + 1).trim()
    }
  }
  return null
}

const KEY = await loadKey()
if (!/^[0-9a-f]{32}$/i.test(KEY ?? '')) {
  const msg = 'Clé TMDB absente ou invalide — impossible de rafraîchir les disponibilités.'
  if (OPTIONAL && existsSync(OUT)) {
    console.warn(`⚠ ${msg}\n  Les disponibilités déjà publiées sont conservées.`)
    process.exit(0)
  }
  console.error(`✗ ${msg}`)
  process.exit(1)
}

/**
 * TMDB distingue « Netflix » de « Netflix Standard with Ads », « HBO Max » de
 * « HBO Max Amazon Channel », et renvoie trois entrées pour Paramount+. Pour
 * l'utilisateur, c'est un seul service. Sans ce regroupement, l'écran de
 * profil demanderait de cocher vingt et une cases.
 */
const FAMILLES = [
  ['netflix', /^netflix/i],
  ['prime', /^amazon prime video/i],
  ['disney', /^disney/i],
  ['max', /^(hbo )?max/i],
  ['canal', /^(canal\+|cine\+|ocs)/i],
  ['appletv', /^apple tv\+?( plus)?$/i],
  ['paramount', /^paramount/i],
  ['mubi', /^mubi/i],
  ['arte', /^arte/i],
  ['crunchyroll', /^crunchyroll/i],
  ['universcine', /^universcin/i],
  ['sfr', /^sfr/i],
  ['molotov', /^molotov/i],
]

const famille = (nom) => FAMILLES.find(([, re]) => re.test(nom))?.[0] ?? null

async function providersFor(kind, id) {
  const url = `https://api.themoviedb.org/3/${kind}/${id}/watch/providers?api_key=${KEY}`
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url)
    if (res.ok) return (await res.json()).results?.FR ?? null
    if (res.status === 404) return null
    if (res.status === 429) {
      const after = Number(res.headers.get('retry-after'))
      await sleep(Number.isFinite(after) && after > 0 ? after * 1000 + 500 : 2000)
      continue
    }
    await sleep(500 * (attempt + 1))
  }
  return null
}

const items = JSON.parse(readFileSync(CATALOGUE, 'utf8')).items
const map = {}
let abonnement = 0
let locationSeule = 0
let nulle = 0

for (let i = 0; i < items.length; i++) {
  const w = items[i]
  const fr = await providersFor(w.kind === 'series' ? 'tv' : 'movie', w.tmdbId)
  await sleep(35)

  const flat = [...new Set((fr?.flatrate ?? []).map((p) => famille(p.provider_name)).filter(Boolean))]
  // On ne retient de la location/achat qu'un booléen : le détail change trop
  // souvent et ne sert qu'à dire « payant, mais disponible ».
  const payant = Boolean((fr?.rent ?? []).length || (fr?.buy ?? []).length)

  if (flat.length) abonnement++
  else if (payant) locationSeule++
  else nulle++

  // On n'écrit que ce qui apporte une information.
  if (flat.length || payant) map[w.id] = payant && !flat.length ? { s: flat, p: 1 } : { s: flat }

  if ((i + 1) % 100 === 0) process.stdout.write(`  … ${i + 1} / ${items.length}\n`)
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(
  OUT,
  JSON.stringify(
    {
      source: 'JustWatch via TMDB',
      region: 'FR',
      updatedAt: new Date().toISOString().slice(0, 10),
      familles: FAMILLES.map(([id]) => id),
      works: map,
    },
    null,
    0,
  ) + '\n',
)

console.log(`\n✓ ${items.length} œuvres`)
console.log(`  en abonnement          ${abonnement}`)
console.log(`  location ou achat seul ${locationSeule}`)
console.log(`  nulle part             ${nulle}`)

const parService = {}
for (const v of Object.values(map)) for (const s of v.s) parService[s] = (parService[s] ?? 0) + 1
console.log('\nPar service :')
Object.entries(parService)
  .sort((a, b) => b[1] - a[1])
  .forEach(([s, n]) => console.log(`  ${String(n).padStart(4)}  ${s}`))
