-- =====================================================================
--  Venn — schéma V2
--  À coller tel quel dans Supabase → SQL Editor → Run.
--  Idempotent : réexécutable sans risque.
-- =====================================================================

-- ---------------------------------------------------------------- profils
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null,
  avatar_emoji text not null default '🍿',
  -- Duo affiché par défaut. Un utilisateur peut en avoir plusieurs (ami,
  -- frère, colocataire) : la V2 n'en montre qu'un, le modèle en supporte N.
  active_duo_id uuid,
  created_at   timestamptz not null default now()
);

-- --------------------------------------------------- bibliothèque perso
-- Vu et favori restent strictement personnels : Valentin peut avoir vu
-- Interstellar sans que ce soit le cas de Manon.
create table if not exists public.library_items (
  user_id    uuid not null references auth.users on delete cascade,
  movie_id   text not null,
  seen       boolean not null default false,
  favorite   boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

-- ------------------------------------------------------------------ duos
create table if not exists public.duos (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.duo_members (
  duo_id    uuid not null references public.duos on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (duo_id, user_id)
);

create table if not exists public.invites (
  code       text primary key,
  duo_id     uuid not null references public.duos on delete cascade,
  created_by uuid not null references auth.users on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz
);

-- ------------------------------------------------------------- sessions
create table if not exists public.sessions (
  id              uuid primary key default gen_random_uuid(),
  duo_id          uuid not null references public.duos on delete cascade,
  created_by      uuid not null references auth.users on delete cascade,
  status          text not null default 'collecting', -- collecting | ready | decided
  submitted_count int  not null default 0,
  result_movie_id text,
  created_at      timestamptz not null default now()
);

create index if not exists sessions_duo_idx on public.sessions (duo_id, created_at desc);

create table if not exists public.session_wishes (
  session_id   uuid not null references public.sessions on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  wishes       jsonb not null,
  submitted_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- ------------------------------------------ signaux « profil de goûts »
-- Collecte brute uniquement : aucune intelligence pour l'instant, mais les
-- données seront là le jour où on en voudra une.
create table if not exists public.taste_signals (
  id         bigserial primary key,
  user_id    uuid not null references auth.users on delete cascade,
  kind       text not null,  -- 'chosen' | 'refused' | 'genre' | 'mood'
  movie_id   text,
  value      text,
  created_at timestamptz not null default now()
);

create index if not exists taste_signals_user_idx on public.taste_signals (user_id, created_at desc);

-- =====================================================================
--  Fonctions
-- =====================================================================

-- Membre d'un duo ? Fonction dédiée pour éviter la récursion des politiques
-- RLS (une politique sur duo_members qui interroge duo_members boucle).
create or replace function public.is_duo_member(p_duo uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.duo_members where duo_id = p_duo and user_id = p_user
  );
$$;

-- Crée un duo si besoin, puis un code d'invitation court.
create or replace function public.create_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duo      uuid;
  v_code     text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i          int;
begin
  if auth.uid() is null then
    raise exception 'non authentifié';
  end if;

  -- Un duo « en attente » (un seul membre) est réutilisé plutôt que d'en
  -- empiler un nouveau à chaque code généré.
  select d.id into v_duo
  from public.duos d
  join public.duo_members m on m.duo_id = d.id
  where m.user_id = auth.uid()
  group by d.id
  having count(*) = 1
  limit 1;

  if v_duo is null then
    insert into public.duos default values returning id into v_duo;
    insert into public.duo_members (duo_id, user_id) values (v_duo, auth.uid());
  end if;

  -- Code lisible à voix haute : ni 0/O ni 1/I, qui se confondent.
  -- 32^6 ≈ 1 milliard de combinaisons, pour une validité de 24 h.
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.invites where code = v_code);
  end loop;

  insert into public.invites (code, duo_id, created_by, expires_at)
  values (v_code, v_duo, auth.uid(), now() + interval '24 hours');

  update public.profiles set active_duo_id = v_duo where id = auth.uid();

  return v_code;
end;
$$;

-- Rejoint un duo à partir d'un code. Toute la validation est ici : les
-- invitations ne sont jamais lisibles directement, donc pas énumérables.
create or replace function public.join_duo(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_count  int;
begin
  if auth.uid() is null then
    raise exception 'non authentifié';
  end if;

  select * into v_invite
  from public.invites
  where code = upper(trim(p_code)) and expires_at > now()
  for update;

  if not found then
    raise exception 'code invalide ou expiré';
  end if;

  if v_invite.created_by = auth.uid() then
    raise exception 'ce code est le vôtre';
  end if;

  select count(*) into v_count from public.duo_members where duo_id = v_invite.duo_id;
  if v_count >= 2 and not public.is_duo_member(v_invite.duo_id, auth.uid()) then
    raise exception 'ce duo est complet';
  end if;

  insert into public.duo_members (duo_id, user_id)
  values (v_invite.duo_id, auth.uid())
  on conflict do nothing;

  update public.invites set used_at = now() where code = v_invite.code;
  update public.profiles set active_duo_id = v_invite.duo_id where id = auth.uid();

  return v_invite.duo_id;
end;
$$;

-- Qui a terminé ? Renvoie l'avancement SANS révéler le contenu des envies :
-- c'est ce qui permet d'afficher « Manon : en attente » sans rien divulguer.
create or replace function public.session_progress(p_session uuid)
returns table (user_id uuid, display_name text, avatar_emoji text, submitted boolean)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, p.display_name, p.avatar_emoji, (w.user_id is not null)
  from public.sessions s
  join public.duo_members m on m.duo_id = s.duo_id
  join public.profiles p    on p.id = m.user_id
  left join public.session_wishes w on w.session_id = s.id and w.user_id = m.user_id
  where s.id = p_session
    and public.is_duo_member(s.duo_id, auth.uid());
$$;

-- Tient à jour le compteur et le statut de la session.
create or replace function public.bump_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_done  int;
  v_total int;
begin
  select count(*) into v_done from public.session_wishes where session_id = new.session_id;
  select count(*) into v_total
  from public.duo_members m
  join public.sessions s on s.duo_id = m.duo_id
  where s.id = new.session_id;

  update public.sessions
  set submitted_count = v_done,
      status = case when v_done >= v_total then 'ready' else 'collecting' end
  where id = new.session_id and status <> 'decided';

  return new;
end;
$$;

drop trigger if exists on_wish_saved on public.session_wishes;
create trigger on_wish_saved
  after insert or update on public.session_wishes
  for each row execute function public.bump_session();

-- Crée le profil dès l'inscription (y compris anonyme).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Invité'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
--  Row Level Security
-- =====================================================================

alter table public.profiles      enable row level security;
alter table public.library_items enable row level security;
alter table public.duos          enable row level security;
alter table public.duo_members   enable row level security;
alter table public.invites       enable row level security;
alter table public.sessions      enable row level security;
alter table public.session_wishes enable row level security;
alter table public.taste_signals enable row level security;

-- profils : le sien, et ceux des personnes avec qui on partage un duo.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.duo_members mine
      join public.duo_members theirs on theirs.duo_id = mine.duo_id
      where mine.user_id = auth.uid() and theirs.user_id = public.profiles.id
    )
  );

drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  with check (id = auth.uid());

-- bibliothèque : écriture strictement personnelle.
-- Lecture ouverte aux membres du duo, parce que « un film que nous n'avons
-- jamais vu » impose de connaître ce que l'autre a déjà vu. Autrement dit :
-- votre partenaire peut voir vos films vus et vos favoris. C'est un choix
-- assumé pour un produit fait pour deux personnes qui décident ensemble.
drop policy if exists library_own on public.library_items;

drop policy if exists library_read on public.library_items;
create policy library_read on public.library_items for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.duo_members mine
      join public.duo_members theirs on theirs.duo_id = mine.duo_id
      where mine.user_id = auth.uid() and theirs.user_id = public.library_items.user_id
    )
  );

drop policy if exists library_write on public.library_items;
create policy library_write on public.library_items for insert
  with check (user_id = auth.uid());

drop policy if exists library_modify on public.library_items;
create policy library_modify on public.library_items for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists library_delete on public.library_items;
create policy library_delete on public.library_items for delete
  using (user_id = auth.uid());

-- duos
drop policy if exists duos_read on public.duos;
create policy duos_read on public.duos for select
  using (public.is_duo_member(id, auth.uid()));

drop policy if exists duo_members_read on public.duo_members;
create policy duo_members_read on public.duo_members for select
  using (public.is_duo_member(duo_id, auth.uid()));

drop policy if exists duo_members_leave on public.duo_members;
create policy duo_members_leave on public.duo_members for delete
  using (user_id = auth.uid());

-- invitations : jamais lisibles directement (seul join_duo y accède).
drop policy if exists invites_own on public.invites;
create policy invites_own on public.invites for select
  using (created_by = auth.uid());

-- sessions : visibles et créables par les membres du duo.
drop policy if exists sessions_read on public.sessions;
create policy sessions_read on public.sessions for select
  using (public.is_duo_member(duo_id, auth.uid()));

drop policy if exists sessions_create on public.sessions;
create policy sessions_create on public.sessions for insert
  with check (created_by = auth.uid() and public.is_duo_member(duo_id, auth.uid()));

drop policy if exists sessions_update on public.sessions;
create policy sessions_update on public.sessions for update
  using (public.is_duo_member(duo_id, auth.uid()))
  with check (public.is_duo_member(duo_id, auth.uid()));

-- ENVIES : le point sensible.
-- On peut toujours lire les siennes. Celles de l'autre ne deviennent lisibles
-- QUE lorsque tout le monde a répondu. La confidentialité est donc garantie
-- par la base : même en bricolant le client, on ne peut pas jeter un œil.
drop policy if exists wishes_read on public.session_wishes;
create policy wishes_read on public.session_wishes for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.sessions s
      where s.id = session_wishes.session_id
        and public.is_duo_member(s.duo_id, auth.uid())
        and s.submitted_count >= (
          select count(*) from public.duo_members m where m.duo_id = s.duo_id
        )
    )
  );

drop policy if exists wishes_write on public.session_wishes;
create policy wishes_write on public.session_wishes for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.sessions s
      where s.id = session_id and public.is_duo_member(s.duo_id, auth.uid())
    )
  );

drop policy if exists wishes_update on public.session_wishes;
create policy wishes_update on public.session_wishes for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- signaux : personnels.
drop policy if exists signals_own on public.taste_signals;
create policy signals_own on public.taste_signals for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =====================================================================
--  Temps réel — pour voir « Manon a terminé » sans rafraîchir.
--  On diffuse `sessions` (compteur), jamais `session_wishes` : le contenu
--  des envies ne doit pas transiter avant que les deux aient répondu.
-- =====================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'sessions'
  ) then
    alter publication supabase_realtime add table public.sessions;
  end if;
end $$;
