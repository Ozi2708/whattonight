# Venn — V2

Venn aide deux personnes à trouver rapidement quelque chose dont elles ont
**toutes les deux** envie. La V2 couvre les films : 100 titres triés sur le
volet, 1990 → 2026.

```
    PERSONNE A          PERSONNE B
           \            /
            \          /
             [  VENN  ]
            terrain commun
```

Deux modes :

- **Solo** — la roulette de la V1, filtres personnels, aucun compte requis.
- **Duo** — chacun dit ce dont il a envie de son côté, Venn croise, et la
  roulette ne tourne que dans le terrain commun. Nécessite Supabase
  ([mise en route](./supabase/SETUP.md)).

## Démarrer

```bash
npm install
npm run dev
```

Les données sont déjà générées (`src/data/movies.json`) : l'app fonctionne
immédiatement, avec de vraies affiches. Sans Supabase, seul l'onglet Duo est
inactif — il explique alors ce qui manque.

## Affiches HD + notes (recommandé)

Par défaut les affiches viennent de Wikipédia : réelles, mais en basse
définition (~220 px), et sans note. Une clé TMDB gratuite apporte des affiches
HD, des images de fond, les notes et de vrais synopsis.

1. Crée une clé v3 sur https://www.themoviedb.org/settings/api
2. `cp .env.example .env.local` puis renseigne `TMDB_API_KEY`
3. `npm run fetch:movies`

`src/data/movies.json` est régénéré. Les identifiants de films sont stables :
la progression des utilisateurs est conservée.

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

## Le mode duo

### Contraintes ≠ préférences

C'est la distinction centrale du produit.

|                | Sens                           | Effet                      |
| -------------- | ------------------------------ | -------------------------- |
| **Contrainte** | « je ne veux vraiment pas ça » | filtre dur, non négociable |
| **Préférence** | « j'aimerais plutôt ça »       | score, jamais éliminatoire |

Une contrainte exprimée par l'un s'impose à l'autre : si Valentin plafonne à
2h30 et Manon à 2h, la limite commune devient 2h. Si Valentin refuse l'horreur,
aucun film d'horreur ne sortira, même si Manon adore ça.

Les préférences ne suppriment jamais rien. On ne prend donc **pas**
l'intersection stricte des goûts : un film qui ne parle qu'à une seule personne
reste jouable, simplement moins bien classé.

### Le score

Chaque film reçoit une note par personne (genres, humeurs, plus un petit bonus
si c'est un favori — trop petit pour être décisif à lui seul). Les deux notes
sont combinées en privilégiant délibérément **la moins bonne des deux** :

```
score = 0,65 × min(a, b) + 0,35 × moyenne(a, b)
```

Une moyenne simple laisserait gagner « excellent pour l'un, médiocre pour
l'autre ». C'est exactement ce qu'un produit qui s'appelle Venn ne doit pas
faire.

Le pourcentage n'est affiché qu'au-dessus de 60 % : en dessous, mieux vaut ne
rien annoncer qu'une fausse précision.

### Les humeurs

Aucune base de données ne fournit « mindfuck » ou « facile à regarder ». Ces
étiquettes sont un **jugement éditorial**, assumé comme tel, et vivent dans
[`scripts/movies.moods.mjs`](./scripts/movies.moods.mjs). Elles survivent à
toute régénération des données depuis TMDB.

### Quand rien ne correspond

Venn ne dit jamais « aucun résultat » et **ne retire jamais une contrainte tout
seul**. Il chiffre ce que chaque assouplissement rapporterait — « Si Manon
accepte jusqu'à 2h30 : +8 films » — et seule la personne concernée peut
l'accepter, depuis son propre téléphone.

### Un seul pilote, deux spectateurs

Une fois le terrain commun calculé, **seul l'hôte** — celui qui a ouvert la
session — lance la roulette. L'autre la voit défiler en direct et s'arrêter sur
le même film. Sans cette règle, chacun tirait de son côté et obtenait un film
différent, ce qui vide le duo de son sens.

Le tirage est diffusé par un message éphémère (Realtime broadcast) plutôt que
par la base : il n'y a rien à conserver, et cela évite d'ajouter des colonnes.
Le film retenu est tout de même persisté à l'arrivée, pour qui aurait manqué
l'animation — application en arrière-plan, réseau coupé.

L'invité garde ses actions personnelles (déjà vu, favori) mais ni « Relancer »
ni « C'est parti » : ce sont des décisions communes.

### Le secret des réponses

Tant que les deux n'ont pas répondu, personne ne voit les envies de l'autre.
Cette garantie est portée par une politique RLS PostgreSQL, pas par
l'interface : le serveur refuse de renvoyer la ligne. Bricoler le client n'y
change rien.

En revanche, les membres d'un duo **peuvent lire leurs films vus et favoris
respectifs** : le filtre « un film qu'aucun de nous n'a vu » a besoin des deux
historiques. Choix assumé, documenté dans `SETUP.md`.

## Application installable (PWA)

L'app s'installe depuis le navigateur, sans passer par un store.

- **Android / Chrome** : bouton « Installer » dans l'onglet Profil.
- **iOS / Safari** : aucune API d'installation n'existe, l'onglet Profil affiche
  donc la marche à suivre (Partager → Sur l'écran d'accueil).

Une fois installée, elle s'ouvre en plein écran et fonctionne **hors
connexion** : le shell est pré-caché, les affiches sont mises en cache au fur
et à mesure. Le mode duo, lui, a besoin du réseau.

L'installabilité exige du HTTPS — donc un build déployé, pas `localhost`.

```bash
npm run icons     # régénère les icônes depuis le tracé vectoriel
```

## Navigation

Onglets et panneaux sont adossés à l'historique du navigateur
(`src/core/navigation.ts`). Le retour Android — bouton comme swipe depuis le
bord, qui déclenchent le même `popstate` — referme le panneau ouvert, puis
revient à l'onglet précédent. Aucun geste n'est intercepté : c'est le
comportement système qui est respecté.

## Structure

```
src/
  core/          générique, réutilisable par les futurs modules
    types.ts       RouletteItem, CategoryId, CategoryState
    categories.ts  registre des modules (films, jeux, activités…)
    library.ts     vus / favoris / historique, persistés en localStorage
    librarySync.ts miroir vers Supabase (le local reste la source de vérité)
    picker.ts      tirage anti-répétition
    navigation.ts  historique : retour et swipe Android
    supabase.ts    client, ou null si non configuré
    account.ts     compte anonyme + profil
    duo.ts         duos, invitations, sessions, temps réel
  movies/        le module « films »
    catalog.ts     chargement + helpers
    filters.ts     filtres du mode solo
    matching.ts    le moteur de terrain commun
  components/    écrans et UI
supabase/
  schema.sql     tables, fonctions, RLS — à coller dans Supabase
  SETUP.md       la marche à suivre
```

Le cœur (`core/`) ne connaît rien aux films : il manipule des `RouletteItem`
(un id, un titre, une image) et un état par catégorie. Un duo est modélisé
comme un groupe de membres, pas comme une paire figée — rien n'empêchera un
troisième membre, ni plusieurs duos par personne.

## Vérifications

```bash
npx tsx scripts/check-matching.ts
```

Rejoue l'exemple de la spécification (Valentin × Manon) et vérifie que la
contrainte la plus stricte l'emporte, que rien de déjà vu ne passe, et que les
assouplissements proposés sont chiffrés.

## Choix produit

- **Anti-frustration** : le tirage évite les derniers résultats (fenêtre = la
  moitié du pool). Vérifié : zéro répétition immédiate dès 2 films éligibles, et
  une distribution plate sur 300 tirages.
- **Les contraintes priment toujours.** Si aucun film ne correspond, Venn
  propose des compromis chiffrés — il n'en retire jamais un tout seul.
- **Une durée inconnue ne passe pas** un filtre de durée en douce.
- **Onboarding minimal** : un prénom, pas d'e-mail ni de mot de passe. Le compte
  est donc lié à l'appareil ; un rattachement e-mail pourra s'ajouter plus tard.
- **Pas de plateformes de streaming** : volontairement hors périmètre.
