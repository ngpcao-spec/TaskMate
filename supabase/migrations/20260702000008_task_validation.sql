-- C2 / SPEC v4 — seul le parent crée les tâches ; l'enfant coche ; les points ne sont crédités qu'à la validation parentale.

-- ───────────── 1. Journal : renommage des raisons (sans toucher aux lignes immuables) ─────────────
alter type public.point_reason rename value 'task_completed' to 'task_validated';
alter type public.point_reason rename value 'task_uncompleted' to 'task_unvalidated';

-- ───────────── 2. Colonnes de validation ─────────────
alter table public.tasks
  add column validated_at timestamptz,
  add column validated_by uuid references public.members (id),
  add column rejection_note text check (char_length(rejection_note) <= 200),
  add column rejected_at timestamptz;

-- Données existantes : toute tâche déjà cochée (points déjà crédités) devient validée.
update public.tasks set validated_at = completed_at, validated_by = completed_by where completed_at is not null;

alter table public.tasks
  add constraint tasks_validated_requires_completed check (validated_at is null or completed_at is not null);
create index tasks_pending_validation on public.tasks (child_id) where completed_at is not null and validated_at is null;

-- ───────────── 3. RLS : un enfant ne crée, ne modifie ni ne supprime plus aucune tâche ─────────────
drop trigger tasks_guard on public.tasks;
drop function public.tasks_guard();

drop policy tasks_insert on public.tasks;
drop policy tasks_update on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (family_id = public.my_family_id() and public.is_parent() and created_by = public.my_member_id());
create policy tasks_update on public.tasks for update to authenticated
  using (family_id = public.my_family_id() and public.is_parent())
  with check (family_id = public.my_family_id() and public.is_parent());
-- grants de colonnes inchangés : completed_*/validated_*/rejection_* restent hors de portée du client (RPC uniquement).

-- ───────────── 4. Solde : points de tâches en attente (informatif, jamais dans le solde) ─────────────
create function public.child_pending_task_points(p_child uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(points), 0)::int from public.tasks
  where child_id = p_child and family_id = public.my_family_id()
    and completed_at is not null and validated_at is null and deleted_at is null
$$;
revoke all on function public.child_pending_task_points(uuid) from public, anon;
grant execute on function public.child_pending_task_points(uuid) to authenticated;

create or replace view public.child_balances as
  select c.id as child_id, c.family_id,
         public.child_balance(c.id) as balance,
         public.child_reserved(c.id) as reserved,
         public.child_balance(c.id) - public.child_reserved(c.id) as available,
         public.child_pending_task_points(c.id) as pending_task_points
  from public.children c
  where c.deleted_at is null and c.family_id = public.my_family_id();

-- ───────────── 5. RPC (SPEC §5.2) ─────────────
drop function public.complete_task(uuid, uuid);
drop function public.uncomplete_task(uuid, uuid);

-- Enfant : coche → `pending`, AUCUN point. Parent : coche + valide dans la même transaction.
create function public.complete_task(p_task_id uuid, p_tx_id uuid) returns void
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

-- Enfant : seulement si `pending` (sinon `already_validated`). Parent : retire exactement les points crédités.
create function public.uncomplete_task(p_task_id uuid, p_tx_id uuid) returns void
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
end $$;

-- Parent : `pending` → `validated` + points (une seule fois, rejeu idempotent sur tx_id).
create function public.validate_task(p_task_id uuid, p_tx_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; t public.tasks;
begin
  me := public.require_member();
  if me.role <> 'parent' then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into t from public.tasks
  where id = p_task_id and family_id = me.family_id and deleted_at is null for update;
  if not found then raise exception 'task_not_found' using errcode = 'P0002'; end if;
  if t.validated_at is not null and exists (select 1 from public.point_transactions where id = p_tx_id) then
    return;  -- rejeu idempotent
  end if;
  if t.completed_at is null or t.validated_at is not null then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  update public.tasks set validated_at = now(), validated_by = me.id where id = t.id;
  if t.points > 0 then
    insert into public.point_transactions (id, family_id, child_id, delta, reason, ref_id, created_by)
    values (p_tx_id, t.family_id, t.child_id, t.points, 'task_validated', t.id, me.id);
  end if;
  perform public.log_activity(t.family_id, t.child_id, me.id, 'task_validated',
    jsonb_build_object('task_id', t.id, 'title', t.title, 'points', t.points));
end $$;

-- Parent : `pending` → `todo` avec motif ; aucun point.
create function public.reject_task(p_task_id uuid, p_note text default null) returns void
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
  perform public.log_activity(t.family_id, t.child_id, me.id, 'task_rejected',
    jsonb_build_object('task_id', t.id, 'title', t.title, 'note', v_note));
end $$;

do $$
declare f text;
begin
  foreach f in array array['complete_task(uuid,uuid)', 'uncomplete_task(uuid,uuid)', 'validate_task(uuid,uuid)', 'reject_task(uuid,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
