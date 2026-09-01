-- ============================================================================
--  Venn — migration V4
--
--  À coller dans le SQL Editor de Supabase, puis Run. Rejouable sans risque.
--  Une seule colonne : ce qu'on regarde ce soir, un film ou une série.
-- ============================================================================

-- L'hôte tranche à l'ouverture de la soirée, comme pour le mode. Les deux
-- personnes doivent chercher la même chose, sinon le croisement des envies
-- ne veut plus rien dire. Par défaut 'movie' : les soirées déjà ouvertes
-- restent valides.
alter table public.sessions
  add column if not exists kind text not null default 'movie'
  check (kind in ('movie', 'series'));
