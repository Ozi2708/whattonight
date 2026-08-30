#!/usr/bin/env node
/**
 * Génère src/data/movies.json à partir de scripts/movies.seed.mjs.
 *
 * Pipeline :
 *   1. Wikipédia EN  → identifiant Wikidata (résolution des redirections incluse)
 *   2. Wikidata      → ID TMDB exact, durée, réalisateur, titre FR, article FR
 *   3a. TMDB (si TMDB_API_KEY) → affiche HD, backdrop, note, genres, synopsis FR
 *   3b. sinon Wikipédia        → affiche (basse def) + synopsis FR
 *
 * Passer par Wikidata évite toute recherche floue sur TMDB : l'ID est exact.
 *
 * Usage :
 *   npm run fetch:movies
 *   npm run fetch:movies -- --provider=wikipedia
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MOVIES } from './movies.seed.mjs'
import { MOODS } from './movies.moods.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'src/data/movies.json')
const UA = 'Venn/0.2 (personal project; contact via app repo)'

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]

/**
 * Mode « au mieux », utilisé pendant le build de production.
 *
 * Sans clé TMDB, on ne fait rien : le movies.json versionné est déjà bon.
 * Avec une clé, on tente l'enrichissement — mais aucune panne réseau ne doit
 * faire échouer un déploiement. En cas de problème, on garde les données
 * existantes et on l'écrit dans le journal.
 */
const OPTIONAL = process.argv.includes('--optional')

/* ------------------------------------------------------------------ utils */

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const chunk = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getJSON(url, { retries = 6 } = {}) {
  for (let attempt = 0; ; attempt++) {
    let waitMs = Math.min(500 * 2 ** attempt, 15_000)
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
      if (res.status === 404) return null
      if (res.status === 429 || res.status >= 500) {
        // Wikimedia renvoie un Retry-After (en secondes) qu'il faut respecter,
        // sinon on se fait throttler en boucle.
        const after = Number(res.headers.get('retry-after'))
        if (Number.isFinite(after) && after > 0) waitMs = after * 1000 + 500
        throw new Error(`HTTP ${res.status}`)
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
      return await res.json()
    } catch (err) {
      if (attempt >= retries) throw err
      await sleep(waitMs)
    }
  }
}

/** Exécute `worker` sur chaque item avec au plus `limit` requêtes en parallèle. */
async function pool(items, limit, worker) {
  const out = new Array(items.length)
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++
        out[i] = await worker(items[i], i)
      }
    }),
  )
  return out
}

const cleanImage = (url) => (url ? url.split('?')[0] : null)

/** Retire la parenthèse de désambiguïsation des libellés Wikidata/Wikipédia. */
const cleanTitle = (t) =>
  t ? t.replace(/\s*\((?:film|\d{4} film|film,? ?\d{4})\)\s*$/i, '').trim() : t

/**
 * P2047 est tantôt en minutes, tantôt en secondes selon la fiche Wikidata
 * (Oppenheimer y est stocké en 10809). Aucun long métrage ne dépasse 600
 * minutes, donc au-delà on est forcément en secondes.
 */
function parseRuntime(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n > 600 ? n / 60 : n)
}

/* ------------------------------------------------- 1. Wikipédia → Wikidata */

async function resolveWikidataIds(titles) {
  const map = new Map() // titre du seed -> { qid, resolvedTitle }
  for (const batch of chunk(titles, 40)) {
    const url =
      'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2' +
      '&prop=pageprops&ppprop=wikibase_item&redirects=1&origin=*&titles=' +
      encodeURIComponent(batch.join('|'))
    const data = await getJSON(url)

    // `redirects` et `normalized` relient le titre demandé au titre final.
    const alias = new Map()
    for (const n of data?.query?.normalized ?? []) alias.set(n.to, n.from)
    for (const r of data?.query?.redirects ?? []) {
      alias.set(r.to, alias.get(r.from) ?? r.from)
    }

    for (const page of data?.query?.pages ?? []) {
      const requested = alias.get(page.title) ?? page.title
      if (page.missing || !page.pageprops?.wikibase_item) continue
      map.set(requested, { qid: page.pageprops.wikibase_item, resolvedTitle: page.title })
    }
  }
  return map
}

/* ------------------------------------------------------------ 2. Wikidata */

async function fetchWikidata(qids) {
  const values = qids.map((q) => `wd:${q}`).join(' ')
  const query = `
    SELECT ?film ?tmdb ?imdb ?runtime ?titleFr ?titleEn ?frArticle
           (GROUP_CONCAT(DISTINCT ?directorLabel; separator=", ") AS ?directors)
    WHERE {
      VALUES ?film { ${values} }
      OPTIONAL { ?film wdt:P4947 ?tmdb }
      OPTIONAL { ?film wdt:P345 ?imdb }
      OPTIONAL { ?film wdt:P2047 ?runtime }
      OPTIONAL { ?film rdfs:label ?titleFr FILTER(lang(?titleFr) = "fr") }
      OPTIONAL { ?film rdfs:label ?titleEn FILTER(lang(?titleEn) = "en") }
      # Wikidata a migré beaucoup de noms propres vers le libellé multilingue
      # "mul" : sans ce COALESCE, la moitié des réalisateurs ressort vide.
      OPTIONAL { ?film wdt:P57 ?director .
                 OPTIONAL { ?director rdfs:label ?dFr  FILTER(lang(?dFr)  = "fr") }
                 OPTIONAL { ?director rdfs:label ?dMul FILTER(lang(?dMul) = "mul") }
                 OPTIONAL { ?director rdfs:label ?dEn  FILTER(lang(?dEn)  = "en") }
                 BIND(COALESCE(?dFr, ?dMul, ?dEn) AS ?directorLabel) }
      OPTIONAL { ?frArticle schema:about ?film ;
                            schema:isPartOf <https://fr.wikipedia.org/> }
    }
    GROUP BY ?film ?tmdb ?imdb ?runtime ?titleFr ?titleEn ?frArticle`

  const data = await getJSON(
    'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query),
  )

  const map = new Map()
  for (const row of data?.results?.bindings ?? []) {
    const qid = row.film.value.split('/').pop()
    // Une entité peut apparaître plusieurs fois (durées multiples) : on garde la 1re.
    if (map.has(qid)) continue
    map.set(qid, {
      tmdbId: row.tmdb ? Number(row.tmdb.value) : null,
      imdbId: row.imdb?.value ?? null,
      runtime: parseRuntime(row.runtime?.value),
      titleFr: row.titleFr?.value ?? null,
      titleEn: row.titleEn?.value ?? null,
      director: row.directors?.value || null,
      frArticle: row.frArticle ? decodeURIComponent(row.frArticle.value.split('/wiki/').pop()) : null,
    })
  }
  return map
}

/* ----------------------------------------------------------- 3a. via TMDB */

const TMDB_IMG = 'https://image.tmdb.org/t/p'

async function fromTMDB(entry, key) {
  const { tmdbId } = entry.wd
  if (!tmdbId) return null

  const base = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${key}`
  const fr = await getJSON(`${base}&language=fr-FR&append_to_response=credits`)
  if (!fr) return null

  let overview = fr.overview?.trim()
  if (!overview) {
    const en = await getJSON(`${base}&language=en-US`)
    overview = en?.overview?.trim() || null
  }

  const director =
    fr.credits?.crew?.find((c) => c.job === 'Director')?.name ?? entry.wd.director ?? null

  return {
    title: cleanTitle(fr.title || entry.wd.titleFr || entry.seed.wiki),
    originalTitle: cleanTitle(fr.original_title || entry.wd.titleEn || entry.seed.wiki),
    runtime: fr.runtime || entry.wd.runtime || null,
    genres: fr.genres?.length ? fr.genres.map((g) => normalizeGenre(g.name)) : entry.seed.genres,
    rating: fr.vote_average ? Math.round(fr.vote_average * 10) / 10 : null,
    director,
    overview,
    poster: fr.poster_path ? `${TMDB_IMG}/w780${fr.poster_path}` : null,
    posterSmall: fr.poster_path ? `${TMDB_IMG}/w342${fr.poster_path}` : null,
    backdrop: fr.backdrop_path ? `${TMDB_IMG}/w1280${fr.backdrop_path}` : null,
    tmdbId,
  }
}

/* ------------------------------------------------------ 3b. via Wikipédia */

/**
 * L'intro Wikipédia fait souvent plusieurs paragraphes : on la ramène à la
 * taille d'un pitch, coupé sur une fin de phrase.
 */
function trimOverview(text, max = 360) {
  const flat = (text ?? '').replace(/\s*\n+\s*/g, ' ').trim()
  if (!flat) return null
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return stop > max * 0.5 ? cut.slice(0, stop + 1) : cut.trimEnd() + '…'
}

/**
 * Récupère résumé + image de tête pour un lot d'articles.
 * On passe par l'API `action=query` (20 titres par requête) plutôt que par
 * l'endpoint REST `page/summary` : 100 appels unitaires déclenchaient des 429.
 * Retourne une Map titre demandé -> { title, extract, image }.
 */
async function wikiBatch(lang, titles) {
  const map = new Map()
  for (const batch of chunk([...new Set(titles)], 20)) {
    const url =
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2` +
      '&redirects=1&prop=extracts|pageimages&exintro=1&explaintext=1&exlimit=20' +
      '&piprop=original|thumbnail&pithumbsize=500&pilimit=20&pilicense=any&titles=' +
      encodeURIComponent(batch.join('|'))
    const data = await getJSON(url)

    const alias = new Map()
    for (const n of data?.query?.normalized ?? []) alias.set(n.to, n.from)
    for (const r of data?.query?.redirects ?? []) alias.set(r.to, alias.get(r.from) ?? r.from)

    for (const page of data?.query?.pages ?? []) {
      if (page.missing) continue
      map.set(alias.get(page.title) ?? page.title, {
        title: page.title,
        extract: page.extract?.trim() || null,
        image: cleanImage(page.original?.source ?? page.thumbnail?.source),
      })
    }
    await sleep(1200) // courtoisie envers l'API
  }
  return map
}

function fromWikipedia(entry, wiki) {
  const en = wiki.en.get(entry.wd?.resolvedTitle ?? entry.seed.wiki) ?? null
  const fr = entry.wd?.frArticle ? (wiki.fr.get(entry.wd.frArticle) ?? null) : null

  const poster = en?.image ?? null

  return {
    title: cleanTitle(entry.wd?.titleFr || fr?.title || entry.wd?.titleEn || entry.seed.wiki),
    originalTitle: cleanTitle(entry.wd?.titleEn || entry.seed.wiki),
    runtime: entry.wd?.runtime ?? null,
    genres: entry.seed.genres,
    rating: null, // pas de note fiable sans TMDB — on l'assume plutôt que d'inventer
    director: entry.wd?.director ?? null,
    overview: trimOverview(fr?.extract || en?.extract),
    poster,
    posterSmall: poster,
    backdrop: null,
    tmdbId: entry.wd?.tmdbId ?? null,
  }
}

/* ------------------------------------------------------------------ genres */

// TMDB renvoie "Science-Fiction" / "Guerre" etc. en fr-FR : on aligne juste
// quelques variantes pour que les filtres restent cohérents entre providers.
const GENRE_ALIASES = {
  'science fiction': 'Science-Fiction',
  'science-fiction': 'Science-Fiction',
  'aventure': 'Aventure',
  'familial': 'Familial',
  'téléfilm': 'Drame',
}

function normalizeGenre(name) {
  return GENRE_ALIASES[name.toLowerCase()] ?? name
}

/* -------------------------------------------------------------------- main */

/**
 * Une clé v3 TMDB fait exactement 32 caractères hexadécimaux. Vérifier le
 * format évite d'enchaîner 100 appels voués au 401 — et attrape le cas d'un
 * texte de remplacement laissé tel quel, qui est passé inaperçu une fois.
 */
function validateKey(key) {
  if (!key) return null
  if (/^[0-9a-f]{32}$/i.test(key)) return key
  console.warn(
    `⚠ TMDB_API_KEY ignorée : « ${key.slice(0, 6)}… » (${key.length} caractères) ` +
      "n'est pas une clé v3 valide — 32 caractères hexadécimaux attendus.",
  )
  return null
}

async function loadEnvKey() {
  if (process.env.TMDB_API_KEY) return process.env.TMDB_API_KEY.trim()
  for (const file of ['.env.local', '.env']) {
    try {
      const raw = await readFile(resolve(ROOT, file), 'utf8')
      const m = raw.match(/^\s*TMDB_API_KEY\s*=\s*(.+)$/m)
      if (m && m[1].trim()) return m[1].trim().replace(/^["']|["']$/g, '')
    } catch {
      /* fichier absent : on continue */
    }
  }
  return null
}

async function main() {
  const wanted = arg('provider') ?? 'auto'
  const key = wanted === 'wikipedia' ? null : validateKey(await loadEnvKey())
  const provider = key ? 'tmdb' : 'wikipedia'

  if (wanted === 'tmdb' && !key) {
    console.error('✖ --provider=tmdb demandé mais TMDB_API_KEY est absent (.env.local).')
    process.exit(1)
  }

  if (OPTIONAL && !key) {
    console.log('→ Pas de TMDB_API_KEY : on garde le movies.json versionné.')
    return
  }

  console.log(`→ Source : ${provider}${provider === 'wikipedia' ? ' (affiches basse définition)' : ''}`)
  console.log('→ Résolution Wikidata…')

  const qidMap = await resolveWikidataIds(MOVIES.map((m) => m.wiki))
  const missing = MOVIES.filter((m) => !qidMap.has(m.wiki))
  if (missing.length) {
    console.warn(`⚠ ${missing.length} article(s) Wikipédia introuvable(s) :`)
    for (const m of missing) console.warn(`   · ${m.wiki}`)
  }

  const qids = [...new Set([...qidMap.values()].map((v) => v.qid))]
  const wdMap = new Map()
  for (const batch of chunk(qids, 50)) {
    for (const [k, v] of await fetchWikidata(batch)) wdMap.set(k, v)
  }

  const entries = MOVIES.map((seed) => {
    const resolved = qidMap.get(seed.wiki)
    const wd = resolved ? { ...wdMap.get(resolved.qid), resolvedTitle: resolved.resolvedTitle } : null
    return { seed, wd }
  })

  // Toujours pré-chargé : sert de source principale sans clé, et de filet de
  // sécurité si un film n'a pas d'ID TMDB.
  console.log('→ Wikipédia (affiches + synopsis)…')
  const wiki = {
    en: await wikiBatch('en', entries.map((e) => e.wd?.resolvedTitle ?? e.seed.wiki)),
    fr: await wikiBatch('fr', entries.map((e) => e.wd?.frArticle).filter(Boolean)),
  }

  console.log(`→ Récupération des fiches (${entries.length})…`)
  let done = 0
  const items = await pool(entries, 5, async (entry) => {
    let data = null
    try {
      if (provider === 'tmdb' && entry.wd) data = await fromTMDB(entry, key)
    } catch (err) {
      console.warn(`\n⚠ TMDB ${entry.seed.wiki} : ${err.message} — repli Wikipédia`)
    }
    if (!data) data = fromWikipedia(entry, wiki)
    process.stdout.write(`\r   ${++done}/${entries.length}`)
    if (!data) return null
    return {
      id: slug(entry.seed.wiki),
      year: entry.seed.year,
      ...data,
      genres: [...new Set(data.genres ?? entry.seed.genres)].slice(0, 3),
      // Annotation éditoriale : aucune source externe ne la fournit.
      moods: MOODS[entry.seed.wiki] ?? [],
    }
  })
  process.stdout.write('\n')

  const clean = items.filter(Boolean)
  const noPoster = clean.filter((m) => !m.poster)
  const noRuntime = clean.filter((m) => !m.runtime)
  if (noPoster.length) {
    console.warn(`⚠ ${noPoster.length} film(s) sans affiche : ${noPoster.map((m) => m.title).join(', ')}`)
  }
  if (noRuntime.length) {
    console.warn(`⚠ ${noRuntime.length} film(s) sans durée : ${noRuntime.map((m) => m.title).join(', ')}`)
  }

  const genres = [...new Set(clean.flatMap((m) => m.genres))].sort((a, b) =>
    a.localeCompare(b, 'fr'),
  )

  if (OPTIONAL && (clean.length < 100 || noPoster.length > 10)) {
    console.warn(
      `⚠ Récupération incomplète (${clean.length} films, ${noPoster.length} sans affiche) : ` +
        'on conserve les données existantes plutôt que de les dégrader.',
    )
    return
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(
    OUT,
    JSON.stringify({ generatedAt: new Date().toISOString(), source: provider, genres, items: clean }, null, 2),
    'utf8',
  )

  console.log(`✓ ${clean.length} films écrits dans src/data/movies.json`)
  console.log(`  genres : ${genres.join(', ')}`)
  if (provider === 'wikipedia') {
    console.log('\n  Pour des affiches HD + les notes : ajoute TMDB_API_KEY dans .env.local puis relance.')
  }
}

main().catch((err) => {
  console.error(err)
  // Un déploiement ne doit jamais tomber parce qu'une API tierce est lente.
  if (OPTIONAL) {
    console.warn('⚠ Enrichissement TMDB abandonné : le build continue avec les données versionnées.')
    process.exit(0)
  }
  process.exit(1)
})
