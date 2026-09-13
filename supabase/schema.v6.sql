-- ============================================================================
--  Venn — migration V6
--
--  À coller dans le SQL Editor de Supabase, puis Run. Rejouable sans risque.
--  Une seule colonne : est-ce qu'on pioche dans la collection des 100 ?
-- ============================================================================

-- Même raison que `kind` en V4 : les deux personnes doivent chercher dans le
-- même vivier, sinon le croisement des envies ne veut plus rien dire. L'hôte
-- tranche à l'ouverture, et les deux téléphones lisent la même colonne.
-- Par défaut false : les soirées déjà ouvertes restent valides.
alter table public.sessions
  add column if not exists canon boolean not null default false;
