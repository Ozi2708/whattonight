# Brancher le mode duo (Supabase)

Cinq étapes, une quinzaine de minutes. Tant que ce n'est pas fait, Venn
fonctionne en solo : roulette, Les 100, progression. Seul l'onglet Duo affiche
un message expliquant ce qui manque.

---

## 1. Créer le projet

Sur [supabase.com](https://supabase.com) → **New project**.

- Région : **Europe (Paris ou Frankfurt)**, pour la latence.
- Mot de passe de la base : généré et rangé dans un gestionnaire. Tu n'en auras
  pas besoin pour l'app, seulement pour un accès direct à la base.

Le projet met une ou deux minutes à démarrer.

## 2. Créer les tables

Dans le projet : **SQL Editor** → **New query**.

Colle l'intégralité de [`schema.sql`](./schema.sql), puis **Run**.

Le script est idempotent : tu peux le relancer sans rien casser. Il crée les
tables, les fonctions, les politiques de sécurité et active le temps réel.

Attendu : `Success. No rows returned`.

## 3. Autoriser les connexions anonymes

**Authentication** → **Sign In / Providers** → active **Anonymous sign-ins**.

C'est ce qui permet à Venn de ne demander qu'un prénom, sans e-mail ni mot de
passe. Sans cette option, l'app affichera une erreur explicite au lieu de
l'écran de bienvenue.

## 4. Récupérer les deux valeurs

**Project Settings** → **API** :

| Valeur dans Supabase                              | Variable                        |
| ------------------------------------------------- | ------------------------------- |
| **Project URL** (`https://xxxxx.supabase.co`)     | `VITE_SUPABASE_URL`             |
| **Publishable key** (`sb_publishable_…`)          | `VITE_SUPABASE_PUBLISHABLE_KEY` |

Si ton projet affiche encore l'ancien système (onglet « Legacy anon,
service_role »), la clé `anon` au format JWT fait exactement le même travail :
mets-la dans `VITE_SUPABASE_ANON_KEY`. L'app accepte les deux noms.

🚫 **Jamais** `sb_secret_…` ni `service_role`. Ces clés contournent toutes les
politiques RLS. Placée dans une variable `VITE_`, une clé secrète se
retrouverait dans le JavaScript public : n'importe qui pourrait lire et
modifier toute la base.

Ces deux valeurs sont **publiques par conception**. Elles finissent dans le
JavaScript envoyé aux navigateurs, c'est normal et sans danger : elles ne font
qu'identifier le projet. Toute la sécurité repose sur les politiques RLS
définies dans `schema.sql`.

La clé à ne **jamais** utiliser ici est la `service_role` : celle-là contourne
toutes les politiques.

## 5. Déclarer les variables

**En local** — dans `.env.local`, à la racine du projet :

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

**Sur Vercel** — Project → Settings → Environment Variables. Ajoute les deux,
pour les environnements Production, Preview et Development.

⚠️ Vite injecte les variables **au moment du build**. Après les avoir ajoutées
sur Vercel, il faut **redéployer** : les modifier ne suffit pas.

---

## Vérifier

1. Ouvre l'app, onglet **Duo**. L'écran « pas encore branché » doit avoir
   disparu au profit de « Comment tu t'appelles ? ».
2. Entre un prénom.
3. **Créer un code**, note-le.
4. Sur un second téléphone (ou une fenêtre de navigation privée), refais un
   prénom puis **J'ai reçu un code**.
5. Les deux écrans doivent afficher le duo.

## Ce que voit l'autre personne

Un point à connaître avant de partager un duo : **ton partenaire peut lire tes
films vus et tes favoris.** C'est nécessaire au filtre « un film qu'aucun de
nous n'a vu », qui doit connaître les deux historiques.

En revanche, **tes envies du soir restent secrètes** jusqu'à ce que vous ayez
répondu tous les deux — et ça, c'est la base de données qui l'impose, pas
l'interface. Même en bricolant l'application, on ne peut pas les lire en
avance.

## Coût

Le palier gratuit de Supabase couvre très largement cet usage : deux
utilisateurs, quelques centaines de lignes. Les projets gratuits sont mis en
pause après une semaine sans activité, et se réveillent au premier appel.


## Migration V3

La V3 ajoute les avis, le mode de soirée et les corrections de portrait.
Colle **`supabase/schema.v3.sql`** dans le SQL Editor, puis Run. Le script est
additif et rejouable : rien n’est supprimé, la V2 continue de fonctionner
pendant le déploiement.

Tant qu’il n’est pas appliqué :

- « On a une envie précise » fonctionne normalement ;
- « Choisis pour nous » affiche un message qui renvoie ici, plutôt que de
  servir silencieusement autre chose ;
- les avis et le profil du duo restent locaux à l’appareil.

## Migration V4

Une seule colonne : ce qu'on regarde ce soir, un film ou une série.
Colle **`supabase/schema.v4.sql`** dans le SQL Editor, puis Run.

Tant qu'elle n'est pas appliquée, les soirées film fonctionnent normalement et
une soirée série affiche un message qui renvoie ici — plutôt que de servir
silencieusement un film à la place.
