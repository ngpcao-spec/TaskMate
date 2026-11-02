-- D-106 — Interface V2 « style Finch », lot A1 : fondations et règles serveur.
--   * Interrupteur par famille `families.ui_version` ('v1' par défaut | 'v2'). Lecture : la famille lit SA ligne (policy existante `families_select`) ;
--     écriture : UNIQUEMENT `admin_set_ui_version` (administrateur de la plateforme, tracé dans `catalog_admin_log`). La colonne n'est PAS ajoutée aux
--     droits d'UPDATE des parents : un parent ne change jamais sa propre version.
--   * Énergie ⚡ (remplace le « +5 / +10 » de D-104, s'applique aussi en V1) : coche de l'ENFANT = +`tasks.points` ; décoche / refus = − ce qui a été
--     crédité pour cette tâche (rien s'il ne reste rien, jamais sous 0) ; quiz validé = + les points réellement attribués par `quiz_points_for`
--     (0 possible). L'historique existant n'est pas recalculé.
--   * Aventure : coût 60 (au lieu de 30). Amitié : paliers doublés (2 à 100, 3 à 300, 4 à 600, 5 à 1 000, puis +1 tous les 600). `min_level` inchangé.
--   * Icônes d'objectifs : `tasks.icon` / `recurrences.icon` (36 slugs, nul = icône de la catégorie côté client) ; une occurrence hérite de l'icône de
--     sa récurrence ; écriture par le parent seulement (policies existantes, colonne ajoutée aux droits de colonnes).
--   * Variante du panda : `companions.variant` ('boy' par défaut | 'girl'), réglée par `companion_setup` (aucun choix affiché pour l'instant).

-- ───────────────────────── 1. Interrupteur V1 / V2 ─────────────────────────
alter table public.families add column ui_version text not null default 'v1' check (ui_version in ('v1', 'v2'));
-- (aucun grant : `grant update (name, timezone, deleted_at)` de la migration 1 reste la seule écriture client sur families)

-- journal d'audit : il accueille aussi le changement de version d'une famille (aucune ligne existante modifiée)
alter table public.catalog_admin_log alter column quiz_id drop not null;
alter table public.catalog_admin_log add column family_id uuid;
alter table public.catalog_admin_log drop constraint catalog_admin_log_action_check;
alter table public.catalog_admin_log add constraint catalog_admin_log_action_check check (action in ('purge_quiz', 'set_ui_version'));
alter table public.catalog_admin_log add constraint catalog_admin_log_target_check check (
  (action = 'purge_quiz' and quiz_id is not null) or (action = 'set_ui_version' and family_id is not null));

-- Change la version d'interface d'une famille. Administrateur seulement (vérifié EN PREMIER) ; rejouable (même valeur = aucune trace en plus).
create function public.admin_set_ui_version(p_family uuid, p_version text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare admin uuid; f public.families;
begin
  admin := public.catalog_require_admin();
  if p_version is null or p_version not in ('v1', 'v2') then raise exception 'invalid_input' using errcode = 'P0001'; end if;
  select * into f from public.families where id = p_family and deleted_at is null for update;
  if not found then raise exception 'family_not_found' using errcode = 'P0002'; end if;
  if f.ui_version is distinct from p_version then
    update public.families set ui_version = p_version where id = f.id;
    insert into public.catalog_admin_log (admin_id, action, family_id, title, slot)
    values (admin, 'set_ui_version', f.id, p_version, jsonb_build_object('from', f.ui_version, 'to', p_version));
  end if;
  return jsonb_build_object('family_id', f.id, 'ui_version', p_version);
end $$;
revoke all on function public.admin_set_ui_version(uuid, text) from public, anon;
grant execute on function public.admin_set_ui_version(uuid, text) to authenticated;

-- fiche famille (D-102) : + la version d'interface (corps repris de la migration 34, un champ ajouté)
create or replace function public.admin_family_detail(p_family uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b private.admin_family_base;
begin
  perform public.catalog_require_admin();
  select * into b from private.admin_family_base where family_id = p_family;
  if not found then raise exception 'family_not_found' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'family_id', b.family_id, 'name', b.name, 'creator_email', b.creator_email, 'countries', to_jsonb(b.countries), 'parents', b.parents, 'children', b.children,
    'classes', b.classes, 'created_at', b.created_at, 'last_active_at', b.last_active_at, 'status', b.status, 'notifications', b.notifications,
    'active_devices', (select count(*) from public.devices d join public.members m on m.id = d.member_id
                       where m.family_id = p_family and d.revoked_at is null and (d.expo_push_token is not null or d.web_push_subscription is not null)),
    'usage_30d', private.admin_usage(now() - interval '30 days', p_family),
    'ui_version', (select f.ui_version from public.families f where f.id = p_family)
  );
end $$;

-- indicateurs (D-102) : + nombre de familles par version (nombres seulement ; corps repris de la migration 34)
create or replace function public.admin_stats_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  today_start timestamptz := (((now() at time zone 'Asia/Ho_Chi_Minh')::date)::timestamp at time zone 'Asia/Ho_Chi_Minh');
begin
  perform public.catalog_require_admin();
  return jsonb_build_object(
    'families', (select count(*) from public.families where deleted_at is null),
    'parents', (select count(*) from public.members m join public.families f on f.id = m.family_id and f.deleted_at is null
                where m.role = 'parent' and m.revoked_at is null and m.deleted_at is null),
    'children', (select count(*) from public.children c join public.families f on f.id = c.family_id and f.deleted_at is null where c.deleted_at is null),
    'new_families_7d', (select count(*) from public.families where deleted_at is null and created_at >= now() - interval '7 days'),
    'new_families_30d', (select count(*) from public.families where deleted_at is null and created_at >= now() - interval '30 days'),
    'active', (
      select jsonb_build_object(
        'today', jsonb_build_object('parents', count(*) filter (where m.role = 'parent' and m.last_active_at >= today_start),
                                    'children', count(*) filter (where m.role = 'child' and m.last_active_at >= today_start)),
        'd7', jsonb_build_object('parents', count(*) filter (where m.role = 'parent' and m.last_active_at >= now() - interval '7 days'),
                                 'children', count(*) filter (where m.role = 'child' and m.last_active_at >= now() - interval '7 days')),
        'd30', jsonb_build_object('parents', count(*) filter (where m.role = 'parent' and m.last_active_at >= now() - interval '30 days'),
                                  'children', count(*) filter (where m.role = 'child' and m.last_active_at >= now() - interval '30 days')))
      from public.members m where m.last_active_at >= now() - interval '30 days'),
    'families_with_notifications', (select count(*) from private.admin_family_base where notifications),
    'ui_versions', (select jsonb_build_object('v1', count(*) filter (where ui_version = 'v1'), 'v2', count(*) filter (where ui_version = 'v2'))
                    from public.families where deleted_at is null)
  );
end $$;

-- ───────────────────────── 2. Aventure et amitié ─────────────────────────
create or replace function public.adventure_cost() returns int language sql immutable as $$ select 60 $$;

-- Niveau d'amitié : 1 à 0, 2 à 100, 3 à 300, 4 à 600, 5 à 1 000, puis un niveau de plus tous les 600 (mêmes cas que `friendshipLevel`).
create or replace function public.companion_level(p_total int) returns int
language sql immutable as $$
  select case when t < 100 then 1 when t < 300 then 2 when t < 600 then 3 when t < 1000 then 4 else 5 + (t - 1000) / 600 end
  from (select greatest(0, coalesce(p_total, 0)) as t) x
$$;

create or replace function public.companion_next_level_at(p_total int) returns int
language sql immutable as $$
  select case public.companion_level(p_total) when 1 then 100 when 2 then 300 when 3 then 600 when 4 then 1000
           else 1000 + 600 * (public.companion_level(p_total) - 4) end
$$;

-- ───────────────────────── 3. Énergie = points (tâches et quiz) ─────────────────────────
-- (corps repris de la migration 35 ; seules les lignes d'énergie changent ; signatures, points et droits inchangés)
create or replace function public.complete_task(p_task_id uuid, p_tx_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; t public.tasks;
begin
  me := public.require_member();
  select * into t from public.tasks
  where id = p_task_id and family_id = me.family_id and deleted_at is null for update;
  if not found then raise exception 'task_not_found' using errcode = 'P0002'; end if;
  if me.role = 'child' and me.child_id <> t.child_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if t.completed_at is not null then return; end if;  -- no-op : déjà cochée

  if me.role = 'child' then
    update public.tasks
    set completed_at = now(), completed_by = me.id, rejection_note = null, rejected_at = null
    where id = t.id;
    -- D-106 : + les points de la tâche (rien pour une tâche à 0 point ; id fourni par l'appelant : rejeu sans doublon)
    if t.points > 0 then
      perform public.companion_add_energy(t.family_id, t.child_id, t.points, 'task_checked', t.id, p_tx_id);
    end if;
    perform public.log_activity(t.family_id, t.child_id, me.id, 'task_completed',
      jsonb_build_object('task_id', t.id, 'title', t.title, 'points', t.points));
  else
    update public.tasks
    set completed_at = now(), completed_by = me.id, validated_at = now(), validated_by = me.id,
        rejection_note = null, rejected_at = null
    where id = t.id;
    if t.points > 0 then
      insert into public.point_transactions (id, family_id, child_id, delta, reason, ref_id, created_by)
      values (p_tx_id, t.family_id, t.child_id, t.points, 'task_validated', t.id, me.id)
      on conflict (id) do nothing;
    end if;
    perform public.log_activity(t.family_id, t.child_id, me.id, 'task_validated',
      jsonb_build_object('task_id', t.id, 'title', t.title, 'points', t.points));
  end if;
end $$;

create or replace function public.uncomplete_task(p_task_id uuid, p_tx_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; t public.tasks; credited int; avail int; energy int;
begin
  me := public.require_member();
  select * into t from public.tasks
  where id = p_task_id and family_id = me.family_id and deleted_at is null for update;
  if not found then raise exception 'task_not_found' using errcode = 'P0002'; end if;
  if me.role = 'child' and me.child_id <> t.child_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if t.completed_at is null then return; end if;  -- no-op

  if t.validated_at is not null then
    if me.role = 'child' then raise exception 'already_validated' using errcode = 'P0001'; end if;
    select coalesce(sum(delta), 0) into credited from public.point_transactions
    where ref_id = t.id and reason in ('task_validated', 'task_unvalidated');
    if credited > 0 then
      perform 1 from public.children where id = t.child_id for update;  -- sérialise avec request_reward
      avail := public.child_balance(t.child_id) - public.child_reserved(t.child_id);
      if avail - credited < 0 then
        raise exception 'insufficient_balance' using errcode = 'P0001';
      end if;
      insert into public.point_transactions (id, family_id, child_id, delta, reason, ref_id, created_by)
      values (p_tx_id, t.family_id, t.child_id, -credited, 'task_unvalidated', t.id, me.id)
      on conflict (id) do nothing;
    end if;
  end if;
  update public.tasks
  set completed_at = null, completed_by = null, validated_at = null, validated_by = null
  where id = t.id;
  -- D-106 : on reprend exactement ce qui reste crédité pour CETTE tâche (y compris un ancien +5), jamais plus
  energy := public.companion_task_energy(t.child_id, t.id);
  if energy > 0 then
    perform public.companion_add_energy(t.family_id, t.child_id, -energy, 'task_unchecked', t.id, p_tx_id);
  end if;
end $$;

create or replace function public.reject_task(p_task_id uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; t public.tasks; v_note text := nullif(btrim(p_note), ''); energy int;
begin
  me := public.require_member();
  if me.role <> 'parent' then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into t from public.tasks
  where id = p_task_id and family_id = me.family_id and deleted_at is null for update;
  if not found then raise exception 'task_not_found' using errcode = 'P0002'; end if;
  if t.completed_at is null and t.rejected_at is not null and t.rejection_note is not distinct from v_note then
    return;  -- rejeu idempotent
  end if;
  if t.completed_at is null or t.validated_at is not null then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  update public.tasks
  set completed_at = null, completed_by = null, rejection_note = v_note, rejected_at = now()
  where id = t.id;
  -- D-106 : − ce qui reste crédité pour cette tâche
  energy := public.companion_task_energy(t.child_id, t.id);
  if energy > 0 then
    perform public.companion_add_energy(t.family_id, t.child_id, -energy, 'task_rejected', t.id, gen_random_uuid());
  end if;
  perform public.log_activity(t.family_id, t.child_id, me.id, 'task_rejected',
    jsonb_build_object('task_id', t.id, 'title', t.title, 'note', v_note));
end $$;

-- Quiz : + les points RÉELLEMENT attribués (barème `quiz_points_for`, une fois par quiz du catalogue ; 0 = aucune énergie).
create or replace function public.validate_quiz_attempt(p_attempt uuid, p_show_correction boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; a public.quiz_attempts; r public.quiz_results; pts int := 0; tx uuid; qt text; qs text;
begin
  me := public.quiz_require_parent();
  select * into a from public.quiz_attempts where id = p_attempt and family_id = me.family_id for update;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status = 'validated' then return; end if;  -- rejeu idempotent : aucune seconde notification
  if a.status <> 'submitted' then raise exception 'not_submitted' using errcode = 'P0001'; end if;
  update public.quiz_attempts set status = 'validated', validated_at = now(), validated_by = me.id, show_correction = coalesce(p_show_correction, false) where id = a.id;
  select * into r from public.quiz_results where attempt_id = a.id;
  if a.catalog_id is not null then
    pts := public.quiz_points_for(r.score, r.total);
    if pts > 0 and not exists (select 1 from public.quiz_attempts o where o.child_id = a.child_id and o.catalog_id = a.catalog_id and o.points_tx_id is not null) then
      perform 1 from public.children where id = a.child_id for update;  -- sérialise avec les demandes de récompense (même verrou que validate_task)
      tx := gen_random_uuid();
      insert into public.point_transactions (id, family_id, child_id, delta, reason, ref_id, note, created_by)
      values (tx, a.family_id, a.child_id, pts, 'quiz_validated', a.id, (select z.title from public.catalog_quizzes z where z.id = a.catalog_id), me.id);
      update public.quiz_attempts set points_awarded = pts, points_tx_id = tx where id = a.id;
    else
      pts := 0;  -- aucun point crédité (sous 50 % ou déjà récompensé) : ni notification qui promet, ni énergie
    end if;
    select z.title, z.subject into qt, qs from public.catalog_quizzes z where z.id = a.catalog_id;
  else
    select s.title, s.subject into qt, qs from public.quiz_sets s where s.id = a.set_id;
  end if;
  -- D-106 : énergie = points attribués, une seule fois par tentative
  if pts > 0 and not exists (select 1 from public.companion_energy e where e.source_id = a.id and e.reason = 'quiz_validated') then
    perform public.companion_add_energy(a.family_id, a.child_id, pts, 'quiz_validated', a.id, gen_random_uuid());
  end if;
  perform public.log_activity(a.family_id, a.child_id, me.id, 'quiz_validated',
    jsonb_build_object('attempt_id', a.id, 'quiz_id', coalesce(a.catalog_id, a.set_id), 'title', coalesce(qt, ''), 'subject', coalesce(qs, ''),
                       'score', r.score, 'total', r.total, 'points', pts, 'show_correction', coalesce(p_show_correction, false)));
end $$;

-- ───────────────────────── 4. Icônes d'objectifs ─────────────────────────
-- Liste FERMÉE des 36 icônes (mêmes slugs que `domain/goal-icons.ts` et que `assets/v2/goals/goal-<slug>.webp`).
create function public.goal_icon_slugs() returns text[] language sql immutable as $$
  select array[
    'reveil', 'brosse-a-dents', 'savon', 'douche', 'vetements', 'lit',
    'petit-dejeuner', 'boite-repas', 'diner', 'verre-eau', 'fruits', 'cartable',
    'devoirs', 'lecture', 'ecriture', 'maths', 'langues', 'dessin',
    'piano', 'football', 'natation', 'velo', 'course', 'yoga',
    'ranger', 'vaisselle', 'linge', 'poubelle', 'arroser', 'animal',
    'cuisiner', 'appeler', 'gentillesse', 'dormir-tot', 'sans-ecran', 'calme']
$$;
revoke all on function public.goal_icon_slugs() from public, anon;
grant execute on function public.goal_icon_slugs() to authenticated;

alter table public.tasks add column icon text check (icon is null or icon = any (public.goal_icon_slugs()));
alter table public.recurrences add column icon text check (icon is null or icon = any (public.goal_icon_slugs()));
-- écriture : parents seulement (policies `tasks_insert/update` et `recurrences_insert/update` réservées aux parents depuis les migrations 1 et 8)
grant insert (icon), update (icon) on public.tasks to authenticated;
grant insert (icon), update (icon) on public.recurrences to authenticated;

-- Occurrences d'une récurrence : héritent de son icône (corps repris de la migration 6, `icon` ajouté).
create or replace function public.generate_recurrence(p_recurrence uuid, p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare r public.recurrences; d date; today date; n int := 0; inserted int;
begin
  select * into r from public.recurrences where id = p_recurrence and deleted_at is null;
  if not found then return 0; end if;
  today := public.family_today(r.family_id, p_now);
  for d in select g::date from generate_series(today, today + 13, interval '1 day') g loop
    if public.recurrence_matches(r, d) then
      insert into public.tasks (family_id, child_id, title, category, note, date, time_kind, start_time, end_time,
                                points, recurrence_id, created_by, icon)
      values (r.family_id, r.child_id, r.title, r.category, r.note, d, r.time_kind, r.start_time, r.end_time,
              r.points, r.id, r.created_by, r.icon)
      on conflict (recurrence_id, date) do nothing;
      get diagnostics inserted = row_count;
      n := n + inserted;
    end if;
  end loop;
  return n;
end $$;

create or replace function public.sync_recurrence(p_recurrence uuid, p_now timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
declare r public.recurrences; today date;
begin
  select * into r from public.recurrences where id = p_recurrence;
  if not found then return; end if;
  today := public.family_today(r.family_id, p_now);

  update public.tasks t set deleted_at = now()
  where t.recurrence_id = r.id and t.deleted_at is null and t.completed_at is null and t.date >= today
    and (r.deleted_at is not null or not public.recurrence_matches(r, t.date));

  if r.deleted_at is null then
    update public.tasks t
    set title = r.title, category = r.category, note = r.note, time_kind = r.time_kind,
        start_time = r.start_time, end_time = r.end_time, points = r.points, icon = r.icon
    where t.recurrence_id = r.id and t.deleted_at is null and t.completed_at is null and t.date >= today;
    perform public.generate_recurrence(r.id, p_now);
  end if;
end $$;

-- ───────────────────────── 5. Variante du panda ─────────────────────────
alter table public.companions add column variant text not null default 'boy' check (variant in ('boy', 'girl'));

-- `companion_setup` reçoit la variante (facultative : nulle = inchangée, 'boy' à la création). Mêmes droits qu'avant (D-104).
drop function public.companion_setup(uuid, text, public.companion_trait);
create function public.companion_setup(p_child uuid, p_name text, p_trait public.companion_trait, p_variant text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; v_name text := btrim(p_name);
begin
  me := public.companion_authorize(p_child);
  if v_name is null or char_length(v_name) not between 1 and 20 or p_trait is null then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  if p_variant is not null and p_variant not in ('boy', 'girl') then raise exception 'invalid_input' using errcode = 'P0001'; end if;
  insert into public.companions (child_id, family_id, name, trait, variant) values (p_child, me.family_id, v_name, p_trait, coalesce(p_variant, 'boy'))
  on conflict (child_id) do update set name = excluded.name, trait = excluded.trait,
    variant = coalesce(p_variant, public.companions.variant);
end $$;
revoke all on function public.companion_setup(uuid, text, public.companion_trait, text) from public, anon;
grant execute on function public.companion_setup(uuid, text, public.companion_trait, text) to authenticated;

-- état du compagnon : + la variante (corps repris de la migration 35)
create or replace function public.companion_state(p_child uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.members; c public.companions; ch public.children; total int; lvl int; today date;
begin
  me := public.companion_authorize(p_child);
  select * into ch from public.children where id = p_child;
  select * into c from public.companions where child_id = p_child;
  select greatest(0, coalesce(sum(amount), 0))::int into total from public.companion_energy where child_id = p_child;
  lvl := public.companion_level(total);
  today := public.family_today(me.family_id);
  return jsonb_build_object(
    'has_companion', c.child_id is not null,
    'name', c.name,
    'trait', c.trait,
    'variant', coalesce(c.variant, 'boy'),
    'stage', public.companion_stage(ch.birth_date, today, coalesce(c.stage_offset, 0)),
    'stage_offset', coalesce(c.stage_offset, 0),
    'energy_total', total,
    'level', lvl,
    'next_level_at', public.companion_next_level_at(total));
end $$;

-- ───────────────────────── 6. Aventure en cours : heure de départ (lecture seule) ─────────────────────────
-- La V2 dessine le chemin du panda « ⚡ → ? » entre le départ et le lendemain matin (heure locale) : `active.departed_at` est ajouté à la réponse
-- (corps repris de la migration 36, un champ ajouté ; aucune règle ne change).
create or replace function public.adventure_state(p_child uuid) returns jsonb
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
    'active', case when act.id is null then null else jsonb_build_object('id', act.id, 'destination', act.destination_slug, 'departed_on', act.departed_on, 'returns_on', act.returns_on, 'departed_at', act.created_at) end,
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
