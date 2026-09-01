-- ============================================================================
--  Venn — migration V5
--
--  À coller dans le SQL Editor de Supabase, puis Run. Rejouable sans risque.
--  Une seule colonne : les services de streaming auxquels on est abonné.
-- ============================================================================

-- Lisible par les membres du duo, comme le reste du profil. C'est indispensable
-- à l'union : on regarde sur un seul écran, donc un film disponible chez l'un
-- est regardable par les deux. C'est le seul endroit de Venn où le duo ne
-- cherche pas une intersection mais une union.
alter table public.profiles
  add column if not exists services text[] not null default '{}';
