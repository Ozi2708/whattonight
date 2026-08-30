# Venn — V3

Venn aide deux personnes à trouver rapidement quelque chose dont elles ont
**toutes les deux** envie. La V3 couvre les films : 100 titres triés sur le
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

## La règle d'or

> **Le profil complète l'envie du soir. Il ne la contredit jamais.**

Venn apprend vos goûts durables. Mais quelqu'un qui adore les thrillers peut
très bien vouloir « un truc drôle et facile » un vendredi soir — et Venn doit
l'écouter, pas lui rappeler ses habitudes.

Cette règle n'est pas une intention, c'est une propriété du code
(`src/movies/matching.ts`). Trois verrous :

1. **Masquage par axe** — si la soirée nomme des humeurs, les humeurs
   habituelles se taisent. Idem pour les genres. Le profil ne parle que là où
   la soirée est muette.
2. **Influence plus petite que le plus petit écart** — l'apport du profil est
   calibré sur les écarts réellement présents dans le pool, de sorte que deux
   apports opposés ne puissent en couvrir que 90 %. Un film qui correspond
   moins à ce qui vient d'être demandé ne peut donc jamais passer devant.
3. **Aucun effet sur la sélection** — le profil classe le pool, il ne décide
   pas qui y entre.

Vérifié par balayage : 1 024 configurations, 32 280 paires réellement
départagées, **zéro inversion**, marge la plus serrée 7,2×.

## Les humeurs

Les genres viennent de TMDB. Les humeurs — 😂 drôle, 🌙 chill, 😱 stressant… —
sont écrites à la main dans `scripts/movies.moods.mjs`. C'est la donnée sur
laquelle repose tout le croisement, donc la règle est explicite :

> **Une humeur décrit ce que ça fait au spectateur, pas le rythme ni
> l'esthétique du film.**

Cette distinction manquait, et une erreur systématique s'y était glissée :
« chill » avait été posé sur des films lents et léchés — *Drive*, *Blade
Runner 2049*, *Aftersun*, *Moonlight*. Lents, oui ; reposants, non. Demander
« on se pose » et recevoir *Drive* trahit la demande.

Deux incompatibilités sont donc vérifiées par `npm run moods:check`, qui
tourne en tête du build :

- `chill` / `facile` ⟂ `intense` / `stressant` / `mindfuck`

Un film ne peut pas à la fois se regarder fatigué et tenir en haleine. Une
contradiction fait échouer le build plutôt que d'atteindre l'écran.

Conséquence assumée : ce catalogue penche vers le drame et le thriller, donc
peu de titres méritent « chill » — huit, plus onze « faciles ». Mieux vaut un
choix restreint mais juste.

`npm run moods:sync` applique une correction d'humeur au catalogue généré
sans retélécharger les 100 films.

## Ce que Venn apprend

| Signal | Poids | Pourquoi |
| --- | --- | --- |
| Avis après visionnage (😍 👍 😐 👎) | 1 | Quelqu'un a vu le film et le dit |
| Favori | 0,55 | Fort, mais moins explicite |
| Film retenu après une roulette | 0,30 | Un choix, pas un jugement |
| Film vu | 0,12 | Vu ≠ aimé |
| Roulette relancée | 0,08 | « Pas ce soir » plus souvent que « je déteste » |

Les affinités sont mesurées **en écart à la moyenne de la personne**, jamais en
volume : 62 des 100 films sont des drames, les compter ferait de tout le monde
un amateur de drame. Et chaque affinité est rétrécie tant que les preuves
manquent — un western adoré ne fait pas un amateur de westerns.

Le portrait est visible et **corrigeable** dans Profil → « Ton ADN cinéma ».
Ce que l'utilisateur corrige prime sur ce que Venn a déduit.

## Le profil du duo

Ce n'est pas la moyenne de deux profils. Ne comptent que les films sur lesquels
les **deux** se sont prononcés, et c'est le moins enthousiaste des deux avis
qui est retenu : un film adoré par l'un et détesté par l'autre n'est pas à
moitié bon pour le duo, c'est un mauvais film pour le duo.

## La roulette

Elle reste centrale, mais elle a changé de rôle : elle ne tire plus au hasard
parmi des films autorisés, elle départage des candidats que Venn juge déjà
bons. Le tirage est pondéré (rapport ≈ 9 pour 1 entre le meilleur et le moins
bon), et **aucun film du pool n'est inatteignable**.

Environ un tirage sur sept est un **wildcard** : un film qui répond pleinement
à l'envie du soir tout en sortant des habitudes du duo. Sans ça, Venn ne
proposerait que ce qu'il sait déjà être aimé, et enfermerait les gens dans leur
passé.

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
