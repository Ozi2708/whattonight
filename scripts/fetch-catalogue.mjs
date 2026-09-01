/**
 * Génère le catalogue complet à partir de `catalogue.seed.json`.
 *
 * Différence majeure avec `fetch-movies.mjs` : les identifiants TMDB sont déjà
 * connus et figés dans la graine. Plus de résolution Wikipédia → Wikidata →
 * TMDB, plus de recherche floue, donc plus aucune dérive possible. Une seule
 * fiche à récupérer par œuvre.
 *
 *   node scripts/fetch-catalogue.mjs            # tout
 *   node scripts/fetch-catalogue.mjs --from=200 # reprend au 200e
 *
 * La clé TMDB est obligatoire ici : sans identifiants résolus, il n'y a rien à
 * récupérer. Elle reste une variable de build et n'entre jamais dans le bundle.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SEED = resolve(HERE, 'catalogue.seed.json')
const CACHE = resolve(HERE, '.catalogue-cache.json')
const OUT = resolve(ROOT, 'src/data/catalogue.json')

const IMG = 'https://image.tmdb.org/t/p'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ────────────────────────────────────────────────────────────────── clé */

async function loadKey() {
  const fromEnv = process.env.TMDB_API_KEY?.trim()
  if (fromEnv) return fromEnv
  const envFile = resolve(ROOT, '.env.local')
  if (!existsSync(envFile)) return null
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i < 0) continue
    if (line.slice(0, i).trim().replace(/^﻿/, '') === 'TMDB_API_KEY') {
      return line.slice(i + 1).trim()
    }
  }
  return null
}

const OPTIONAL = process.argv.includes('--optional')

const KEY = await loadKey()
if (!/^[0-9a-f]{32}$/i.test(KEY ?? '')) {
  const message =
    'Clé TMDB v3 absente ou invalide — renseigne TMDB_API_KEY dans .env.local ' +
    "ou dans l'environnement."
  // Le catalogue est versionné et complet : un build sans clé doit passer,
  // sinon personne ne peut plus construire l'app sans secret.
  if (OPTIONAL && existsSync(OUT)) {
    console.warn(`⚠ ${message}\n  Le catalogue déjà publié est conservé tel quel.`)
    process.exit(0)
  }
  console.error(`✗ ${message}`)
  process.exit(1)
}

/* ─────────────────────────────────────────────────────────── utilitaires */

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

async function tmdb(path, params = '') {
  const url = `https://api.themoviedb.org/3/${path}?api_key=${KEY}&language=fr-FR${params}`
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url)
    if (res.ok) return res.json()
    if (res.status === 429) {
      const after = Number(res.headers.get('retry-after'))
      await sleep(Number.isFinite(after) && after > 0 ? after * 1000 + 500 : 2000)
      continue
    }
    if (res.status === 404) return null
    await sleep(600 * (attempt + 1))
  }
  return null
}

/* ──────────────────────────────────────────────────────── récupération */

async function fetchOne(entry) {
  const kind = entry.type === 'tv' ? 'tv' : 'movie'
  // `append_to_response` : une seule requête au lieu de deux.
  const d = await tmdb(`${kind}/${entry.tmdbId}`, '&append_to_response=credits')
  if (!d) return null

  const isTv = kind === 'tv'
  const crew = d.credits?.crew ?? []
  const director = isTv
    ? (d.created_by?.[0]?.name ?? crew.find((c) => c.job === 'Director')?.name ?? null)
    : (crew.find((c) => c.job === 'Director')?.name ?? null)

  // Durée : pour un film c'est la sienne ; pour une série, celle d'un épisode
  // — souvent absente chez TMDB, on le laisse à `null` plutôt que d'inventer.
  const runtime = isTv ? (d.episode_run_time?.[0] ?? null) : (d.runtime ?? null)

  return {
    tmdbId: d.id,
    kind,
    title: (isTv ? d.name : d.title) || entry.title,
    originalTitle: (isTv ? d.original_name : d.original_title) || entry.title,
    year: Number((isTv ? d.first_air_date : d.release_date)?.slice(0, 4)) || entry.year,
    runtime,
    director,
    overview: d.overview?.trim() || null,
    rating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
    poster: d.poster_path ? `${IMG}/w500${d.poster_path}` : null,
    posterSmall: d.poster_path ? `${IMG}/w342${d.poster_path}` : null,
    backdrop: d.backdrop_path ? `${IMG}/w1280${d.backdrop_path}` : null,
    seasons: isTv ? (d.number_of_seasons ?? null) : null,
    episodes: isTv ? (d.number_of_episodes ?? null) : null,
    ended: isTv ? d.status === 'Ended' || d.status === 'Canceled' : null,
  }
}

/* ────────────────────────────────────────────────────────────── passage */

const seed = JSON.parse(readFileSync(SEED, 'utf8'))
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}

const from = Number(process.argv.find((a) => a.startsWith('--from='))?.slice(7) ?? 0)

console.log(`Catalogue : ${seed.length} œuvres (${seed.filter((s) => s.type === 'movie').length} films, ${seed.filter((s) => s.type === 'tv').length} séries)`)

let fetched = 0
for (let i = from; i < seed.length; i++) {
  const e = seed[i]
  const k = `${e.type}:${e.tmdbId}`
  if (cache[k]) continue
  const got = await fetchOne(e)
  if (got) cache[k] = got
  else console.warn(`  ⚠ fiche introuvable : ${e.title} (${e.year}) — ${k}`)
  fetched++
  await sleep(40)
  if (fetched % 50 === 0) {
    writeFileSync(CACHE, JSON.stringify(cache))
    process.stdout.write(`  … ${i + 1} / ${seed.length}\n`)
  }
}
writeFileSync(CACHE, JSON.stringify(cache))

/* ───────────────────────────────────────────── identifiants stables */

/**
 * Les identifiants existants sont sacrés.
 *
 * `seen`, `favorites` et les avis sont stockés PAR identifiant, en local et
 * chez Supabase. Reslugger une œuvre ferait silencieusement disparaître la
 * progression de tout le monde : pas d'erreur, pas de message, juste une barre
 * revenue à zéro. On relit donc le catalogue déjà publié et on récupère
 * l'identifiant en place via l'identifiant TMDB.
 *
 * C'est le fichier de sortie lui-même qui sert de mémoire — il est versionné,
 * donc cette mémoire ne peut pas se perdre.
 */
const legacy = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')).items : []
const legacyById = new Map(legacy.filter((m) => m.tmdbId).map((m) => [`${m.kind}:${m.tmdbId}`, m.id]))

const used = new Set()
function idFor(entry, detail) {
  const kept = legacyById.get(`${entry.type === 'tv' ? 'series' : 'movie'}:${entry.tmdbId}`)
  let id = kept ?? slug(detail.title || entry.title)
  if (!id) id = `${entry.type}-${entry.tmdbId}`
  // Deux œuvres peuvent porter le même titre : on suffixe par l'année.
  if (used.has(id)) id = `${id}-${entry.year}`
  if (used.has(id)) id = `${id}-${entry.tmdbId}`
  used.add(id)
  return id
}

/* ─────────────────────────────────────────────────────────── assemblage */

const items = []
const perdus = []

for (const e of seed) {
  const d = cache[`${e.type}:${e.tmdbId}`]
  if (!d) {
    perdus.push(`${e.title} (${e.year})`)
    continue
  }
  items.push({
    id: idFor(e, d),
    kind: e.type === 'tv' ? 'series' : 'movie',
    // Le canon : la collection finie et complétable, celle qui compte pour la
    // progression. Le reste est le réservoir.
    canon: Boolean(e.canon),
    tmdbId: d.tmdbId,
    title: d.title,
    originalTitle: d.originalTitle,
    year: d.year,
    runtime: d.runtime,
    // Genres et humeurs viennent de la graine, pas de TMDB : ils sont dans le
    // vocabulaire fermé de Venn, et ceux que TMDB donne aux séries en sont
    // trop éloignés pour servir.
    genres: e.genres,
    moods: e.moods,
    rating: d.rating,
    director: d.director,
    overview: d.overview,
    poster: d.poster,
    posterSmall: d.posterSmall,
    backdrop: d.backdrop,
    seasons: d.seasons,
    episodes: d.episodes,
    ended: d.ended,
  })
}

items.sort((a, b) =>
  a.kind === b.kind ? a.year - b.year || a.title.localeCompare(b.title, 'fr') : a.kind === 'movie' ? -1 : 1,
)

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(
  OUT,
  JSON.stringify(
    {
      source: 'tmdb',
      generatedAt: new Date().toISOString().slice(0, 10),
      genres: [...new Set(items.flatMap((i) => i.genres))].sort((a, b) => a.localeCompare(b, 'fr')),
      moods: [...new Set(items.flatMap((i) => i.moods))],
      items,
    },
    null,
    1,
  ) + '\n',
)

/* ───────────────────────────────────────────────────────────── rapport */

const films = items.filter((i) => i.kind === 'movie')
const series = items.filter((i) => i.kind === 'series')
const manque = (list, f) => list.filter(f).length

console.log(`\n✓ ${OUT.replace(ROOT + '\\', '')} — ${items.length} œuvres`)
console.log(`  films ${films.length} (canon ${items.filter((i) => i.canon).length}) · séries ${series.length}`)
if (perdus.length) {
  console.log(`\n  ⚠ ${perdus.length} sans fiche :`)
  perdus.slice(0, 10).forEach((p) => console.log('     · ' + p))
}

console.log('\nComplétude :')
const champs = [
  ['affiche', (i) => !i.poster],
  ['synopsis', (i) => !i.overview],
  ['note', (i) => i.rating == null],
  ['réalisateur / créateur', (i) => !i.director],
  ['image de fond', (i) => !i.backdrop],
]
for (const [nom, absent] of champs) {
  const n = manque(items, absent)
  console.log(`  ${nom.padEnd(24)} ${items.length - n} / ${items.length}${n ? `   (${n} manquant${n > 1 ? 's' : ''})` : ''}`)
}
console.log(`  ${'durée (films)'.padEnd(24)} ${films.length - manque(films, (i) => i.runtime == null)} / ${films.length}`)
console.log(`  ${'durée (épisode)'.padEnd(24)} ${series.length - manque(series, (i) => i.runtime == null)} / ${series.length}`)

// Un identifiant en double ferait fusionner deux œuvres dans la bibliothèque.
const ids = new Set(items.map((i) => i.id))
if (ids.size !== items.length) {
  console.error(`\n✗ ${items.length - ids.size} identifiant(s) en double — refus d'écrire un catalogue ambigu.`)
  process.exit(1)
}
console.log(`\n  identifiants uniques : ${ids.size} ✓`)

/**
 * Le contrôle qui compte vraiment.
 *
 * Un identifiant qui change, c'est une progression effacée sans un mot :
 * l'œuvre redevient « pas vue », les avis se détachent, la barre recule. Le
 * script refuse donc d'écrire plutôt que de laisser passer ça.
 */
const changed = []
for (const i of items) {
  const before = legacyById.get(`${i.kind}:${i.tmdbId}`)
  if (before && before !== i.id) changed.push(`${i.title} : ${before} → ${i.id}`)
}
if (changed.length) {
  console.error(`\n✗ ${changed.length} identifiant(s) déjà publié(s) ont changé :`)
  changed.slice(0, 10).forEach((c) => console.error('     · ' + c))
  console.error('  Ce serait une perte silencieuse de progression. Rien n’a été écrit.')
  process.exit(1)
}
console.log(`  identifiants déjà publiés, conservés : ${legacy.length} ✓`)
