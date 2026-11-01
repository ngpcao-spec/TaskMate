-- D-104 — V2 « Panda », lot 1 : le compagnon de l'enfant (nom, trait, stade selon l'âge, énergie ⚡, niveau d'amitié).
--   * `companions` : une ligne par enfant (nom, trait, décalage de stade choisi par l'ENFANT). `companion_energy` : historique IMMUABLE de l'énergie,
--     comme `point_transactions` (id fourni par l'appelant = idempotence). Lecture : l'enfant lit SES lignes (D-052), les parents celles de leur famille.
--     AUCUNE écriture client directe : tout passe par les RPC (les RPC de tâches et de quiz existantes alimentent l'énergie, sans changer leur
--     signature ni ce qu'elles font des points).
--   * Énergie : tâche cochée PAR L'ENFANT +5 ; décochée ou refusée −5 (seulement s'il en restait pour cette tâche : le total ne passe jamais sous 0) ;
--     quiz de révision VALIDÉ par le parent +10 (une fois par tentative). L'énergie est enregistrée même sans compagnon créé.
--   * Stade = fonction SQL `companion_stage` (mêmes cas que `domain/panda.ts`) : âge révolu au 1er septembre de l'année scolaire en cours, calculé sur le
--     JOUR LOCAL de la famille. Niveau d'amitié = `companion_level` (mêmes seuils que `friendshipLevel`).
--   * Suppression de la famille : les deux tables partent en CASCADE avec les enfants (le drapeau `app.deleting_family` de delete_family() autorise
--     la suppression dans le journal immuable) : aucune modification de delete_family.

create type public.companion_trait as enum ('curious', 'persistent', 'kind', 'brave', 'funny', 'calm');
create type public.companion_energy_reason as enum ('task_checked', 'task_unchecked', 'task_rejected', 'quiz_validated');

create table public.companions (
  child_id uuid primary key,
  family_id uuid not null,
  name text not null check (char_length(name) between 1 and 20),
  trait public.companion_trait not null,
  -- choisi par l'ENFANT seulement (jamais imposé par le parent) : −1 = plus jeune, +1 = plus grand
  stage_offset smallint not null default 0 check (stage_offset between -1 and 1),
  created_at timestamptz not null default now(),
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade
);

create table public.companion_energy (
  id uuid primary key,
  child_id uuid not null,
  family_id uuid not null,
  amount int not null check (amount <> 0),
  reason public.companion_energy_reason not null,
  source_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade
);
create index companion_energy_child on public.companion_energy (child_id, created_at);
create index companion_energy_source on public.companion_energy (source_id, reason);

-- journal immuable (même garde que point_transactions ; DELETE permis seulement pendant delete_family())
create trigger companion_energy_immutable
  before update or delete on public.companion_energy
  for each row execute function public.forbid_mutation();
create trigger companion_energy_no_truncate
  before truncate on public.companion_energy
  for each statement execute function public.forbid_mutation();

alter table public.companions enable row level security;
alter table public.companion_energy enable row level security;
revoke all on public.companions from anon, authenticated;
revoke all on public.companion_energy from anon, authenticated;
grant select on public.companions to authenticated;
grant select on public.companion_energy to authenticated;
-- lecture : parents de la famille ; un enfant ne voit QUE le sien (D-052). Aucune policy d'écriture.
create policy companions_select on public.companions for select to authenticated
  using (family_id = public.my_family_id() and (public.is_parent() or child_id = public.my_child_id()));
create policy companion_energy_select on public.companion_energy for select to authenticated
  using (family_id = public.my_family_id() and (public.is_parent() or child_id = public.my_child_id()));

-- ───────────────────────── Règles pures (SQL) ─────────────────────────
-- Stade 1..4 : âge révolu au 1er septembre de l'année scolaire (1er sept → 31 août) qui contient `p_today` (le JOUR LOCAL de la famille).
-- < 6 → 1 (bé) ; 6–10 → 2 (nhí) ; 11–14 → 3 (teen) ; ≥ 15 → 4 (đồng hành). Décalage de l'enfant ajouté puis stade borné à 1..4.
create function public.companion_stage(p_birth date, p_today date, p_offset int default 0) returns int
language sql immutable as $$
  with ref as (
    select make_date(extract(year from p_today)::int - case when extract(month from p_today) >= 9 then 0 else 1 end, 9, 1) as d
  ), a as (
    select extract(year from age(ref.d, p_birth))::int as years from ref
  )
  select greatest(1, least(4,
    case when a.years < 6 then 1 when a.years <= 10 then 2 when a.years <= 14 then 3 else 4 end
    + greatest(-1, least(1, coalesce(p_offset, 0)))
  )) from a
$$;
revoke all on function public.companion_stage(date, date, int) from public, anon;
grant execute on function public.companion_stage(date, date, int) to authenticated;

-- Niveau d'amitié : 1 à 0, 2 à 50, 3 à 150, 4 à 300, 5 à 500, puis un niveau de plus tous les 300.
create function public.companion_level(p_total int) returns int
language sql immutable as $$
  select case when t < 50 then 1 when t < 150 then 2 when t < 300 then 3 when t < 500 then 4 else 5 + (t - 500) / 300 end
  from (select greatest(0, coalesce(p_total, 0)) as t) x
$$;
revoke all on function public.companion_level(int) from public, anon;
grant execute on function public.companion_level(int) to authenticated;

create function public.companion_next_level_at(p_total int) returns int
language sql immutable as $$
  select case public.companion_level(p_total) when 1 then 50 when 2 then 150 when 3 then 300 when 4 then 500
           else 500 + 300 * (public.companion_level(p_total) - 4) end
$$;
revoke all on function public.companion_next_level_at(int) from public, anon;
grant execute on function public.companion_next_level_at(int) to authenticated;

-- ───────────────────────── Écriture de l'énergie (interne) ─────────────────────────
create function public.companion_add_energy(p_family uuid, p_child uuid, p_amount int, p_reason public.companion_energy_reason, p_source uuid, p_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.companion_energy (id, family_id, child_id, amount, reason, source_id)
  values (p_id, p_family, p_child, p_amount, p_reason, p_source)
  on conflict (id) do nothing
$$;
revoke all on function public.companion_add_energy(uuid, uuid, int, public.companion_energy_reason, uuid, uuid) from public, anon, authenticated;

-- énergie restant pour UNE tâche (cochée − décochée − refusée) : ne sert qu'à ne jamais retirer plus que ce qui a été donné
create function public.companion_task_energy(p_child uuid, p_task uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::int from public.companion_energy
  where child_id = p_child and source_id = p_task and reason in ('task_checked', 'task_unchecked', 'task_rejected')
$$;
revoke all on function public.companion_task_energy(uuid, uuid) from public, anon, authenticated;

-- ───────────────────────── RPC de tâches : mêmes règles qu'avant + énergie ─────────────────────────
-- (corps repris de la migration 8, une seule ligne ajoutée à chaque fonction ; signatures, points et droits inchangés)
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
    -- D-104 : +5 ⚡ quelle que soit la catégorie (id fourni par l'appelant : rejeu sans doublon)
    perform public.companion_add_energy(t.family_id, t.child_id, 5, 'task_checked', t.id, p_tx_id);
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
declare me public.members; t public.tasks; credited int; avail int;
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
    -- on reprend ce qui a été crédité pour cette tâche (même si ses points ont changé depuis)
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
  -- D-104 : −5 ⚡, seulement s'il restait de l'énergie pour cette tâche (jamais sous 0)
  if public.companion_task_energy(t.child_id, t.id) > 0 then
    perform public.companion_add_energy(t.family_id, t.child_id, -5, 'task_unchecked', t.id, p_tx_id);
  end if;
end $$;

create or replace function public.reject_task(p_task_id uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; t public.tasks; v_note text := nullif(btrim(p_note), '');
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
  -- D-104 : −5 ⚡, seulement s'il restait de l'énergie pour cette tâche
  if public.companion_task_energy(t.child_id, t.id) > 0 then
    perform public.companion_add_energy(t.family_id, t.child_id, -5, 'task_rejected', t.id, gen_random_uuid());
  end if;
  perform public.log_activity(t.family_id, t.child_id, me.id, 'task_rejected',
    jsonb_build_object('task_id', t.id, 'title', t.title, 'note', v_note));
end $$;

-- ───────────────────────── Quiz : +10 ⚡ à la validation par le parent (corps repris de la migration 29) ─────────────────────────
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
  -- D-104 : +10 ⚡ une seule fois par tentative (même garde que le statut ci-dessus, doublée sur la source)
  if not exists (select 1 from public.companion_energy e where e.source_id = a.id and e.reason = 'quiz_validated') then
    perform public.companion_add_energy(a.family_id, a.child_id, 10, 'quiz_validated', a.id, gen_random_uuid());
  end if;
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
      pts := 0;  -- aucun point crédité (sous 50 % ou déjà récompensé) : la notification ne promet rien
    end if;
    select z.title, z.subject into qt, qs from public.catalog_quizzes z where z.id = a.catalog_id;
  else
    select s.title, s.subject into qt, qs from public.quiz_sets s where s.id = a.set_id;
  end if;
  perform public.log_activity(a.family_id, a.child_id, me.id, 'quiz_validated',
    jsonb_build_object('attempt_id', a.id, 'quiz_id', coalesce(a.catalog_id, a.set_id), 'title', coalesce(qt, ''), 'subject', coalesce(qs, ''),
                       'score', r.score, 'total', r.total, 'points', pts, 'show_correction', coalesce(p_show_correction, false)));
end $$;

-- ───────────────────────── RPC du compagnon ─────────────────────────
-- Interne : l'enfant lui-même OU un parent de sa famille ; sinon `forbidden` (aucune fuite sur l'existence d'un enfant d'une autre famille).
create function public.companion_authorize(p_child uuid) returns public.members
language plpgsql stable security definer set search_path = public as $$
declare me public.members;
begin
  me := public.require_member();
  if me.role = 'child' and me.child_id is distinct from p_child then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.children c where c.id = p_child and c.family_id = me.family_id and c.deleted_at is null) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return me;
end $$;
revoke all on function public.companion_authorize(uuid) from public, anon, authenticated;

create function public.companion_state(p_child uuid) returns jsonb
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
    'stage', public.companion_stage(ch.birth_date, today, coalesce(c.stage_offset, 0)),
    'stage_offset', coalesce(c.stage_offset, 0),
    'energy_total', total,
    'level', lvl,
    'next_level_at', public.companion_next_level_at(total));
end $$;
revoke all on function public.companion_state(uuid) from public, anon;
grant execute on function public.companion_state(uuid) to authenticated;

-- Crée ou met à jour le nom et le trait (l'enfant pour lui-même, ou un parent de la famille). Ne touche JAMAIS au décalage de stade.
create function public.companion_setup(p_child uuid, p_name text, p_trait public.companion_trait) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; v_name text := btrim(p_name);
begin
  me := public.companion_authorize(p_child);
  if v_name is null or char_length(v_name) not between 1 and 20 or p_trait is null then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  insert into public.companions (child_id, family_id, name, trait) values (p_child, me.family_id, v_name, p_trait)
  on conflict (child_id) do update set name = excluded.name, trait = excluded.trait;
end $$;
revoke all on function public.companion_setup(uuid, text, public.companion_trait) from public, anon;
grant execute on function public.companion_setup(uuid, text, public.companion_trait) to authenticated;

-- Décalage de stade : l'ENFANT seulement, pour lui-même (jamais un parent, jamais un frère/une sœur).
create function public.companion_set_stage_offset(p_child uuid, p_offset int) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public.require_member();
  if me.role <> 'child' or me.child_id is distinct from p_child then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_offset is null or p_offset not between -1 and 1 then raise exception 'invalid_input' using errcode = 'P0001'; end if;
  update public.companions set stage_offset = p_offset where child_id = p_child and family_id = me.family_id;
  if not found then raise exception 'companion_not_found' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.companion_set_stage_offset(uuid, int) from public, anon;
grant execute on function public.companion_set_stage_offset(uuid, int) to authenticated;
