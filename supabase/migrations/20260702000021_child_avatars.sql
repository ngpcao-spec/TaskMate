-- D-071 — Avatar « dessin animé » de l'enfant, généré par une IA à partir de son portrait (Edge Function `generate-avatar`).
-- Cette migration ne contient AUCUNE clé et AUCUNE photo : le portrait envoyé à l'IA n'est jamais conservé (ni ici, ni en stockage, ni dans le
-- journal) ; seul le DESSIN produit est enregistré. Elle porte :
--  * `child_avatars` : le consentement du parent (`ai_allowed`), l'avatar courant et un avatar « candidat » en attente de validation ;
--  * `avatar_usage` : journal d'usage (aucun contenu) servant au quota quotidien ;
--  * les RPC : autorisation de l'appelant (parent de la famille OU l'enfant lui-même), quota et enregistrement du candidat (clé service seulement),
--    validation / abandon / suppression de l'avatar.
-- Aucune écriture directe par un client : tout passe par les RPC ci-dessous. Suppression de la famille / de l'enfant / du membre : en cascade
-- (aucune modification de `delete_family` nécessaire).

create table public.child_avatars (
  child_id uuid primary key,
  family_id uuid not null,
  -- consentement du PARENT : sans lui, aucun portrait ne peut partir vers l'IA
  ai_allowed boolean not null default false,
  consent_by uuid references public.members (id) on delete set null,
  consent_at timestamptz,
  -- WebP en base64 (sans préfixe) : l'avatar courant, et le candidat généré en attente de « Dùng ảnh này »
  image_b64 text check (image_b64 is null or (char_length(image_b64) <= 400000 and image_b64 like 'UklGR%')),
  candidate_b64 text check (candidate_b64 is null or (char_length(candidate_b64) <= 400000 and candidate_b64 like 'UklGR%')),
  version int not null default 0,
  updated_at timestamptz not null default now(),
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade
);

alter table public.child_avatars enable row level security;
revoke all on public.child_avatars from anon, authenticated;
-- le candidat n'est JAMAIS lisible directement (la fonction le renvoie à celui qui vient de le générer)
grant select (child_id, family_id, ai_allowed, image_b64, version, updated_at) on public.child_avatars to authenticated;
-- lecture : parents de la famille ; un enfant ne voit QUE le sien (D-052)
create policy child_avatars_select on public.child_avatars for select to authenticated
  using (family_id = public.my_family_id() and (public.is_parent() or child_id = public.my_child_id()));

create table public.avatar_usage (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_id uuid not null,
  member_id uuid not null references public.members (id) on delete cascade,
  -- jour LOCAL de la famille (jamais dérivé de l'UTC)
  day date not null,
  status text not null default 'started' check (status in ('started', 'success', 'failed')),
  failure text check (failure is null or char_length(failure) <= 40),
  model text check (model is null or char_length(model) <= 80),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade
);
create index avatar_usage_child_day on public.avatar_usage (child_id, day);
create index avatar_usage_family_day on public.avatar_usage (family_id, day);

alter table public.avatar_usage enable row level security;
revoke all on public.avatar_usage from anon, authenticated;
grant select on public.avatar_usage to authenticated;
create policy avatar_usage_select on public.avatar_usage for select to authenticated
  using (family_id = public.my_family_id() and public.is_parent());

-- Un enfant supprimé (suppression douce) perd aussi son avatar : on ne garde pas l'image d'un enfant qui n'est plus dans la famille.
create function public.avatar_purge_on_child_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    delete from public.child_avatars where child_id = new.id;
  end if;
  return new;
end $$;
revoke all on function public.avatar_purge_on_child_delete() from public, anon, authenticated;
create trigger children_avatar_purge after update of deleted_at on public.children
  for each row execute function public.avatar_purge_on_child_delete();

-- Interne : l'appelant doit être un parent de la famille de l'enfant, OU cet enfant lui-même. Renvoie son membership.
create function public.avatar_authorize(p_child uuid) returns public.members
language plpgsql stable security definer set search_path = public as $$
declare me public.members;
begin
  me := public.require_member();
  if me.role = 'child' and me.child_id is distinct from p_child then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.children c where c.id = p_child and c.family_id = me.family_id and c.deleted_at is null) then
    raise exception 'child_not_found' using errcode = 'P0002';
  end if;
  return me;
end $$;
revoke all on function public.avatar_authorize(uuid) from public, anon, authenticated;

-- Consentement du parent : active / coupe la création d'avatar par IA pour UN enfant. Couper efface le candidat en attente (l'avatar courant reste).
create function public.set_avatar_ai_allowed(p_child uuid, p_allowed boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public.avatar_authorize(p_child);
  if me.role <> 'parent' then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_allowed is null then raise exception 'invalid_input' using errcode = 'P0001'; end if;
  insert into public.child_avatars (child_id, family_id, ai_allowed, consent_by, consent_at)
  values (p_child, me.family_id, p_allowed, case when p_allowed then me.id end, case when p_allowed then now() end)
  on conflict (child_id) do update
    set ai_allowed = excluded.ai_allowed,
        consent_by = excluded.consent_by,
        consent_at = excluded.consent_at,
        candidate_b64 = case when excluded.ai_allowed then public.child_avatars.candidate_b64 end,
        updated_at = now();
end $$;
revoke all on function public.set_avatar_ai_allowed(uuid, boolean) from public, anon;
grant execute on function public.set_avatar_ai_allowed(uuid, boolean) to authenticated;

-- Autorisation de l'appelant pour GÉNÉRER (exécutée avec SON jeton) : parent (enfant à désigner) ou enfant (lui-même), consentement obligatoire.
create function public.avatar_target(p_child uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.members; cid uuid; tz text;
begin
  me := public.require_member();
  cid := case when me.role = 'child' then me.child_id else p_child end;
  if cid is null then raise exception 'child_not_found' using errcode = 'P0002'; end if;
  me := public.avatar_authorize(cid);
  if not exists (select 1 from public.child_avatars a where a.child_id = cid and a.ai_allowed) then
    raise exception 'avatar_not_allowed' using errcode = 'P0001';
  end if;
  select timezone into tz from public.families where id = me.family_id;
  return jsonb_build_object('family_id', me.family_id, 'member_id', me.id, 'timezone', tz, 'child_id', cid);
end $$;
revoke all on function public.avatar_target(uuid) from public, anon;
grant execute on function public.avatar_target(uuid) to authenticated;

-- Réserve une génération (jour local de la famille) : atomique (verrou de la famille). Les essais ÉCHOUÉS ne comptent pas dans le quota
-- (un refus ou un délai dépassé ne « brûle » pas une tentative), mais le total d'essais du jour reste plafonné (p_hard).
create function public.avatar_reserve(p_family uuid, p_child uuid, p_member uuid, p_child_limit int, p_family_limit int, p_hard int, p_now timestamptz default now())
returns table (usage_id uuid, allowed boolean, used int)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare d date; n_child int; n_family int; n_all int; new_id uuid;
begin
  perform 1 from public.families f where f.id = p_family for update;
  if not found then raise exception 'family_not_found' using errcode = 'P0002'; end if;
  d := public.family_today(p_family, p_now);
  select count(*) filter (where status <> 'failed')::int, count(*)::int into n_child, n_all
    from public.avatar_usage u where u.child_id = p_child and u.day = d;
  select count(*) filter (where status <> 'failed')::int into n_family from public.avatar_usage u where u.family_id = p_family and u.day = d;
  if n_child >= p_child_limit or n_family >= p_family_limit or n_all >= p_hard then
    return query select null::uuid, false, n_child;
    return;
  end if;
  insert into public.avatar_usage (family_id, child_id, member_id, day) values (p_family, p_child, p_member, d) returning id into new_id;
  return query select new_id, true, n_child + 1;
end $$;
revoke all on function public.avatar_reserve(uuid, uuid, uuid, int, int, int, timestamptz) from public, anon, authenticated;
grant execute on function public.avatar_reserve(uuid, uuid, uuid, int, int, int, timestamptz) to service_role;

create function public.avatar_finish(p_id uuid, p_status text, p_failure text, p_model text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('success', 'failed') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  update public.avatar_usage set status = p_status, failure = left(p_failure, 40), model = left(p_model, 80), finished_at = now()
  where id = p_id and status = 'started';
end $$;
revoke all on function public.avatar_finish(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.avatar_finish(uuid, text, text, text) to service_role;

create function public.avatar_used_today(p_child uuid, p_family uuid, p_now timestamptz default now()) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.avatar_usage u
  where u.child_id = p_child and u.status <> 'failed' and u.day = public.family_today(p_family, p_now)
$$;
revoke all on function public.avatar_used_today(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.avatar_used_today(uuid, uuid, timestamptz) to service_role;

-- Enregistre le dessin produit par l'IA comme CANDIDAT (jamais directement comme avatar). Clé service seulement ; le consentement est revérifié.
create function public.avatar_save_candidate(p_child uuid, p_family uuid, p_b64 text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.child_avatars set candidate_b64 = p_b64, updated_at = now()
  where child_id = p_child and family_id = p_family and ai_allowed;
  if not found then raise exception 'avatar_not_allowed' using errcode = 'P0001'; end if;
end $$;
revoke all on function public.avatar_save_candidate(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.avatar_save_candidate(uuid, uuid, text) to service_role;

-- « Dùng ảnh này » : le candidat devient l'avatar. Parent de la famille ou enfant lui-même ; le consentement doit toujours être actif.
create function public.confirm_child_avatar(p_child uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public.avatar_authorize(p_child);
  update public.child_avatars
  set image_b64 = candidate_b64, candidate_b64 = null, version = version + 1, updated_at = now()
  where child_id = p_child and ai_allowed and candidate_b64 is not null;
  if not found then raise exception 'no_candidate' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.confirm_child_avatar(uuid) from public, anon;
grant execute on function public.confirm_child_avatar(uuid) to authenticated;

create function public.discard_avatar_candidate(p_child uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public.avatar_authorize(p_child);
  update public.child_avatars set candidate_b64 = null, updated_at = now() where child_id = p_child and candidate_b64 is not null;
end $$;
revoke all on function public.discard_avatar_candidate(uuid) from public, anon;
grant execute on function public.discard_avatar_candidate(uuid) to authenticated;

-- Supprime l'avatar (et le candidat) : possible même si le parent a coupé l'autorisation.
create function public.remove_child_avatar(p_child uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public.avatar_authorize(p_child);
  update public.child_avatars set image_b64 = null, candidate_b64 = null, version = version + 1, updated_at = now() where child_id = p_child;
end $$;
revoke all on function public.remove_child_avatar(uuid) from public, anon;
grant execute on function public.remove_child_avatar(uuid) to authenticated;
