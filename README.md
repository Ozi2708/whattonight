# What Tonight? — V1 Films

« On regarde quoi ce soir ? » Une roulette qui décide du film à la place du couple
qui n'arrive pas à choisir. 100 films triés sur le volet, 1990 → 2026.

## Démarrer

```bash
npm install
npm run dev
```

Les données sont déjà générées (`src/data/movies.json`) : l'app fonctionne
immédiatement, avec de vraies affiches.

## Affiches HD + notes (recommandé)

Par défaut les affiches viennent de Wikipédia : elles sont réelles mais en basse
définition (~220 px), et il n'y a pas de note. Avec une clé TMDB gratuite on
obtient des affiches HD, des images de fond, les notes et de vrais synopsis.

1. Crée une clé v3 sur https://www.themoviedb.org/settings/api
2. `cp .env.example .env.local` puis renseigne `TMDB_API_KEY`
3. `npm run fetch:movies`

Le fichier `src/data/movies.json` est régénéré ; rien d'autre ne change, les
identifiants de films sont stables donc la progression de l'utilisateur est
conservée.

## Comment les données sont récupérées

`scripts/fetch-movies.mjs` part de `scripts/movies.seed.mjs` (100 titres
d'articles Wikipédia anglais) et enchaîne :

1. **Wikipédia EN** → identifiant Wikidata, redirections résolues
2. **Wikidata** → ID TMDB **exact**, durée, réalisateur, titre français
3. **TMDB** (si clé) → affiche HD, backdrop, note, genres, synopsis FR
   sinon **Wikipédia** → affiche + résumé

Passer par Wikidata évite toute recherche floue sur TMDB : on interroge l'ID
exact, donc aucun risque de tomber sur un remake ou un homonyme.

Pour modifier la sélection, éditer `movies.seed.mjs` puis relancer le script.

## Structure

```
src/
  core/          générique, réutilisable par les futurs modules
    types.ts       RouletteItem, CategoryId, CategoryState
    categories.ts  registre des modules (films, jeux, activités…)
    library.ts     vus / favoris / historique, persistés en localStorage
    picker.ts      tirage anti-répétition
  movies/        le module « films »
    catalog.ts     chargement + helpers
    filters.ts     genre / durée / époque
  components/    écrans et UI
```

Le cœur (`core/`) ne connaît rien aux films : il manipule des `RouletteItem`
(un id, un titre, une image) et un état par catégorie. Ajouter « Jeux vidéo »
revient à créer un `src/videogames/` et un écran, sans toucher à la roulette ni
au stockage.

## Choix produit

- **Anti-frustration** : le tirage évite les derniers résultats (fenêtre = la
  moitié du pool). Vérifié : zéro répétition immédiate dès 2 films éligibles, et
  une distribution plate sur 300 tirages.
- **Les filtres priment toujours.** Si aucun film ne correspond, l'app le dit et
  propose d'ouvrir les filtres — elle n'en retire jamais un toute seule.
- **Une durée inconnue ne passe pas** un filtre de durée en douce.
- **Pas de plateformes de streaming** : volontairement hors périmètre V1.
