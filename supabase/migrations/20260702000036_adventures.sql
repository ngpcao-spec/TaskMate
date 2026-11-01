-- D-105 — V2 « Panda », lot 2 : les aventures du panda et le carnet de trouvailles.
--   * Catalogue (`adventure_destinations`, `adventure_discoveries`) : données de départ insérées ici, lisibles par tout client connecté, aucune écriture
--     client. Les noms affichés viennent de l'i18n (par slug).
--   * `child_adventures` (une aventure par départ ; une seule NON récupérée par enfant) et `child_discoveries` (le carnet) : l'enfant lit SES lignes
--     (D-052), les parents celles de leur famille ; AUCUNE écriture client : tout passe par `adventure_start` / `adventure_collect` (l'enfant seulement).
--   * Jauge = énergie totale (D-104) − `energy_mark` de la dernière aventure, bornée à 0..30. Partir ne retire AUCUNE énergie : le total et le niveau
--     d'amitié ne baissent jamais. Retour = lendemain en JOUR LOCAL de la famille. La trouvaille est tirée par le SERVEUR à la récupération.
--   * Les règles du lot 1 (stade, énergie, humeur, niveau) et toutes les RPC existantes sont inchangées.
--   * Suppression de la famille : CASCADE depuis `children` (delete_family() inchangée).

create table public.adventure_destinations (
  slug text primary key check (slug ~ '^[a-z0-9-]{1,40}$'),
  min_level int not null check (min_level >= 1),
  sort_order int not null
);

create table public.adventure_discoveries (
  slug text primary key check (slug ~ '^[a-z0-9-]{1,60}$'),
  destination_slug text not null references public.adventure_destinations (slug),
  sort_order int not null
);
create index adventure_discoveries_destination on public.adventure_discoveries (destination_slug, sort_order);

insert into public.adventure_destinations (slug, min_level, sort_order) values
  ('ha-long', 1, 1), ('hoi-an', 2, 2), ('mekong', 3, 3), ('da-lat', 4, 4), ('sa-pa', 5, 5), ('phong-nha', 6, 6);

insert into public.adventure_discoveries (slug, destination_slug, sort_order) values
  ('ha-long-coquillage', 'ha-long', 1), ('ha-long-perle', 'ha-long', 2), ('ha-long-jonque', 'ha-long', 3),
  ('ha-long-etoile-de-mer', 'ha-long', 4), ('ha-long-rocher', 'ha-long', 5), ('ha-long-flotteur', 'ha-long', 6),
  ('hoi-an-lanterne', 'hoi-an', 1), ('hoi-an-non-la', 'hoi-an', 2), ('hoi-an-banh-mi', 'hoi-an', 3),
  ('hoi-an-barque', 'hoi-an', 4), ('hoi-an-pont-couvert', 'hoi-an', 5), ('hoi-an-eventail', 'hoi-an', 6),
  ('mekong-noix-de-coco', 'mekong', 1), ('mekong-mangue', 'mekong', 2), ('mekong-sampan', 'mekong', 3),
  ('mekong-lotus', 'mekong', 4), ('mekong-poisson', 'mekong', 5), ('mekong-panier-de-fruits', 'mekong', 6),
  ('da-lat-fraise', 'da-lat', 1), ('da-lat-pomme-de-pin', 'da-lat', 2), ('da-lat-da-quy', 'da-lat', 3),
  ('da-lat-velo', 'da-lat', 4), ('da-lat-confiture', 'da-lat', 5),
  ('sa-pa-foulard', 'sa-pa', 1), ('sa-pa-fleur-de-pecher', 'sa-pa', 2), ('sa-pa-theiere', 'sa-pa', 3),
  ('phong-nha-cristal', 'phong-nha', 1), ('phong-nha-boussole', 'phong-nha', 2), ('phong-nha-lampe', 'phong-nha', 3),
  ('phong-nha-fougere', 'phong-nha', 4);

alter table public.adventure_destinations enable row level security;
alter table public.adventure_discoveries enable row level security;
revoke all on public.adventure_destinations from anon, authenticated;
revoke all on public.adventure_discoveries from anon, authenticated;
grant select on public.adventure_destinations to authenticated;
grant select on public.adventure_discoveries to authenticated;
create policy adventure_destinations_select on public.adventure_destinations for select to authenticated using (true);
create policy adventure_discoveries_select on public.adventure_discoveries for select to authenticated using (true);

create table public.child_adventures (
  id uuid primary key,
  child_id uuid not null,
  family_id uuid not null,
  destination_slug text not null references public.adventure_destinations (slug),
  -- jours LOCAUX de la famille (jamais dérivés de l'UTC)
  departed_on date not null,
  returns_on date not null check (returns_on > departed_on),
  -- énergie totale au départ : la jauge suivante se mesure à partir d'elle
  energy_mark int not null check (energy_mark >= 0),
  discovery_slug text references public.adventure_discoveries (slug),
  duplicate boolean not null default false,
  collected_at timestamptz,
  created_at timestamptz not null default now(),
  check ((collected_at is null) = (discovery_slug is null)),
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade
);
-- une seule aventure NON récupérée par enfant
create unique index child_adventures_one_active on public.child_adventures (child_id) where collected_at is null;
create index child_adventures_child_created on public.child_adventures (child_id, created_at desc);

create table public.child_discoveries (
  child_id uuid not null,
  family_id uuid not null,
  discovery_slug text not null references public.adventure_discoveries (slug),
  first_found_at timestamptz not null default now(),
  times_found int not null default 1 check (times_found >= 1),
  unique (child_id, discovery_slug),
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade
);

alter table public.child_adventures enable row level security;
alter table public.child_discoveries enable row level security;
revoke all on public.child_adventures from anon, authenticated;
revoke all on public.child_discoveries from anon, authenticated;
grant select on public.child_adventures to authenticated;
grant select on public.child_discoveries to authenticated;
-- lecture : parents de la famille ; un enfant ne voit QUE les siennes (D-052). Aucune policy d'écriture.
create policy child_adventures_select on public.child_adventures for select to authenticated
  using (family_id = public.my_family_id() and (public.is_parent() or child_id = public.my_child_id()));
create policy child_discoveries_select on public.child_discoveries for select to authenticated
  using (family_id = public.my_family_id() and (public.is_parent() or child_id = public.my_child_id()));

-- ───────────────────────── Règles (SQL) ─────────────────────────
create function public.adventure_cost() returns int language sql immutable as $$ select 30 $$;
revoke all on function public.adventure_cost() from public, anon;
grant execute on function public.adventure_cost() to authenticated;

-- Énergie totale actuelle d'un enfant (même calcul que `companion_state`, D-104 : jamais sous 0). Interne.
create function public.adventure_energy_total(p_child uuid) returns int
language sql stable security definer set search_path = public as $$
  select greatest(0, coalesce(sum(amount), 0))::int from public.companion_energy where child_id = p_child
$$;
revoke all on function public.adventure_energy_total(uuid) from public, anon, authenticated;

-- Jauge : énergie totale − marque de la DERNIÈRE aventure (0 sans aventure), bornée à 0..30. Interne.
create function public.adventure_gauge(p_child uuid) returns int
language sql stable security definer set search_path = public as $$
  select greatest(0, least(public.adventure_cost(),
    public.adventure_energy_total(p_child)
    - coalesce((select a.energy_mark from public.child_adventures a where a.child_id = p_child order by a.created_at desc, a.id limit 1), 0)))
$$;
revoke all on function public.adventure_gauge(uuid) from public, anon, authenticated;

-- ───────────────────────── RPC ─────────────────────────
-- Lecture : l'enfant lui-même ou un parent de sa famille (même garde que le compagnon, D-104).
create function public.adventure_state(p_child uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.members; today date; lvl int; gauge int; act public.child_adventures; last public.child_adventures; st text;
begin
  me := public.companion_authorize(p_child);
  today := public.family_today(me.family_id);
  lvl := public.companion_level(public.adventure_energy_total(p_child));
  gauge := public.adventure_gauge(p_child);
  select * into act from public.child_adventures where child_id = p_child and collected_at is null;
  select * into last from public.child_adventures where child_id = p_child and collected_at is not null order by collected_at desc, id limit 1;
  st := case
    when act.id is not null and today < act.returns_on then 'away'
    when act.id is not null then 'back'
    when gauge >= public.adventure_cost() then 'ready_to_go'
    else 'filling' end;
  return jsonb_build_object(
    'gauge', gauge,
    'cost', public.adventure_cost(),
    'state', st,
    'level', lvl,
    'today', today,
    'active', case when act.id is null then null else jsonb_build_object('id', act.id, 'destination', act.destination_slug, 'departed_on', act.departed_on, 'returns_on', act.returns_on) end,
    'last', case when last.id is null then null else jsonb_build_object('id', last.id, 'destination', last.destination_slug, 'discovery_slug', last.discovery_slug, 'duplicate', last.duplicate) end,
    'unlocked', coalesce((select jsonb_agg(d.slug order by d.sort_order) from public.adventure_destinations d where d.min_level <= lvl), '[]'::jsonb),
    'destinations', coalesce((select jsonb_agg(jsonb_build_object('slug', d.slug, 'min_level', d.min_level,
        'discoveries', coalesce((select jsonb_agg(x.slug order by x.sort_order) from public.adventure_discoveries x where x.destination_slug = d.slug), '[]'::jsonb))
        order by d.sort_order) from public.adventure_destinations d), '[]'::jsonb),
    'found', coalesce((select jsonb_agg(jsonb_build_object('slug', f.discovery_slug, 'times_found', f.times_found) order by f.first_found_at, f.discovery_slug)
        from public.child_discoveries f where f.child_id = p_child), '[]'::jsonb),
    'found_count', (select count(*)::int from public.child_discoveries f where f.child_id = p_child),
    'total_count', (select count(*)::int from public.adventure_discoveries));
end $$;
revoke all on function public.adventure_state(uuid) from public, anon;
grant execute on function public.adventure_state(uuid) to authenticated;

-- Interne : l'ENFANT lui-même, jamais un parent ni un frère/une sœur.
create function public.adventure_require_self(p_child uuid) returns public.members
language plpgsql stable security definer set search_path = public as $$
declare me public.members;
begin
  me := public.require_member();
  if me.role <> 'child' or me.child_id is distinct from p_child then raise exception 'forbidden' using errcode = '42501'; end if;
  return me;
end $$;
revoke all on function public.adventure_require_self(uuid) from public, anon, authenticated;

-- Départ (l'enfant pour lui-même) : rejouable avec le même id. Ordre des refus : aventure en cours (un double appui est ainsi reconnu), destination,
-- jauge. Partir ne retire AUCUNE énergie : on note seulement le total au départ (`energy_mark`).
create function public.adventure_start(p_child uuid, p_id uuid, p_destination text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.members; a public.child_adventures; dest public.adventure_destinations; today date; total int;
begin
  me := public.adventure_require_self(p_child);
  if p_id is null then raise exception 'invalid_input' using errcode = 'P0001'; end if;
  select * into a from public.child_adventures where id = p_id;
  if found then
    if a.child_id <> p_child then raise exception 'forbidden' using errcode = '42501'; end if;
    return jsonb_build_object('id', a.id, 'destination', a.destination_slug, 'departed_on', a.departed_on, 'returns_on', a.returns_on);  -- rejeu
  end if;
  perform 1 from public.children where id = p_child for update;  -- sérialise deux départs simultanés
  select * into dest from public.adventure_destinations where slug = p_destination;
  if not found then raise exception 'destination_not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.child_adventures where child_id = p_child and collected_at is null) then
    raise exception 'adventure_in_progress' using errcode = 'P0001';
  end if;
  total := public.adventure_energy_total(p_child);
  if public.companion_level(total) < dest.min_level then raise exception 'destination_locked' using errcode = 'P0001'; end if;
  if public.adventure_gauge(p_child) < public.adventure_cost() then raise exception 'gauge_not_full' using errcode = 'P0001'; end if;
  today := public.family_today(me.family_id);
  insert into public.child_adventures (id, child_id, family_id, destination_slug, departed_on, returns_on, energy_mark)
  values (p_id, p_child, me.family_id, dest.slug, today, today + 1, total)
  returning * into a;
  return jsonb_build_object('id', a.id, 'destination', a.destination_slug, 'departed_on', a.departed_on, 'returns_on', a.returns_on);
end $$;
revoke all on function public.adventure_start(uuid, uuid, text) from public, anon;
grant execute on function public.adventure_start(uuid, uuid, text) to authenticated;

-- Récupération (l'enfant pour lui-même) à partir de `returns_on` (jour local) : la trouvaille est tirée ICI, parmi celles de la destination que l'enfant
-- n'a pas encore ; s'il les a toutes, doublon (son compteur augmente). Rejouable : un second appel renvoie la même trouvaille, sans nouveau tirage.
create function public.adventure_collect(p_child uuid, p_adventure uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.members; a public.child_adventures; pick text; dup boolean := false;
begin
  me := public.adventure_require_self(p_child);
  select * into a from public.child_adventures where id = p_adventure and child_id = p_child for update;
  if not found then raise exception 'adventure_not_found' using errcode = 'P0002'; end if;
  if a.collected_at is not null then
    return jsonb_build_object('discovery_slug', a.discovery_slug, 'duplicate', a.duplicate, 'destination', a.destination_slug);  -- rejeu
  end if;
  if public.family_today(me.family_id) < a.returns_on then raise exception 'not_back_yet' using errcode = 'P0001'; end if;
  select d.slug into pick from public.adventure_discoveries d
  where d.destination_slug = a.destination_slug
    and not exists (select 1 from public.child_discoveries f where f.child_id = p_child and f.discovery_slug = d.slug)
  order by random() limit 1;
  if pick is null then
    dup := true;
    select d.slug into pick from public.adventure_discoveries d where d.destination_slug = a.destination_slug order by random() limit 1;
  end if;
  insert into public.child_discoveries (child_id, family_id, discovery_slug) values (p_child, a.family_id, pick)
  on conflict (child_id, discovery_slug) do update set times_found = public.child_discoveries.times_found + 1;
  update public.child_adventures set discovery_slug = pick, duplicate = dup, collected_at = now() where id = a.id;
  return jsonb_build_object('discovery_slug', pick, 'duplicate', dup, 'destination', a.destination_slug);
end $$;
revoke all on function public.adventure_collect(uuid, uuid) from public, anon;
grant execute on function public.adventure_collect(uuid, uuid) to authenticated;
