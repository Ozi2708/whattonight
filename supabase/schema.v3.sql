-- ============================================================================
--  Venn — migration V3
--
--  À coller dans le SQL Editor de Supabase, puis Run. Rejouable sans risque.
--  Additif uniquement : rien n'est supprimé, rien n'est renommé, la V2
--  continue de fonctionner pendant le déploiement.
-- ============================================================================

-- ---------------------------------------------------------------- avis
--
-- Le signal le plus fort dont dispose Venn : quelqu'un a vu le film et prend
-- la peine de dire ce qu'il en a pensé. Un avis par personne et par film ; le
-- dernier écrase le précédent, on change d'avis.
create table if not exists public.ratings (
  user_id    uuid not null references auth.users on delete cascade,
  movie_id   text not null,
  verdict    text not null check (verdict in ('loved', 'liked', 'meh', 'disliked')),
  -- D'où vient l'avis : module de découverte, retour après visionnage, fiche.
  source     text not null default 'catalog',
  -- Soirée concernée, quand l'avis suit un film regardé ensemble.
  session_id uuid references public.sessions on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

create index if not exists ratings_user_idx on public.ratings (user_id, updated_at desc);

alter table public.ratings enable row level security;

-- Lecture croisée à l'intérieur d'un duo.
--
-- C'est indispensable au profil du duo : sans les avis de l'autre, Venn ne
-- peut pas savoir ce qui fonctionne pour vous DEUX. C'est le même arbitrage,
-- assumé, que pour library_items — vos avis sont visibles de la personne avec
-- qui vous partagez un duo, de personne d'autre.
drop policy if exists ratings_read on public.ratings;
create policy ratings_read on public.ratings for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.duo_members mine
      join public.duo_members theirs on theirs.duo_id = mine.duo_id
      where mine.user_id = auth.uid()
        and theirs.user_id = ratings.user_id
    )
  );

drop policy if exists ratings_write on public.ratings;
create policy ratings_write on public.ratings for insert
  with check (user_id = auth.uid());

drop policy if exists ratings_update on public.ratings;
create policy ratings_update on public.ratings for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ratings_delete on public.ratings;
create policy ratings_delete on public.ratings for delete
  using (user_id = auth.uid());

-- ------------------------------------------------- mode de la soirée
--
-- « Choisis pour nous » ou « On a une envie précise ». L'hôte tranche, et
-- l'invité doit voir le même formulaire — d'où une colonne plutôt qu'un état
-- local. Par défaut 'precise' : les sessions de la V2 restent valides.
alter table public.sessions
  add column if not exists mode text not null default 'precise'
  check (mode in ('quick', 'precise'));

-- --------------------------------------------- corrections du portrait
--
-- Quand quelqu'un dit à Venn « non, ça ce n'est pas moi », sa correction doit
-- primer sur la déduction et suivre l'appareil. Clé = genre ou humeur,
-- valeur = décalage dans [-1, 1].
alter table public.profiles
  add column if not exists taste_adjustments jsonb not null default '{}'::jsonb;

-- ------------------------------------------------------ soirées passées
--
-- Sert au retour « Alors, ce film ? ». On ne renvoie que ce qui est nécessaire
-- pour poser la question : un film, une date, la soirée concernée.
create or replace function public.duo_history(p_duo uuid, p_limit int default 12)
returns table (session_id uuid, movie_id text, decided_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select s.id, s.result_movie_id, s.created_at
  from public.sessions s
  where s.duo_id = p_duo
    and s.status = 'decided'
    and s.result_movie_id is not null
    and public.is_duo_member(s.duo_id, auth.uid())
  order by s.created_at desc
  limit p_limit;
$$;

grant execute on function public.duo_history(uuid, int) to anon, authenticated;
