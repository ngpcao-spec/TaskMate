-- M1 — RPC (SPEC §5.2, §5.8) + vue des soldes + expiration.
-- Toutes les fonctions sont security definer, atomiques, idempotentes sur l'id fourni par le client.

-- ───────────────────────── Solde ─────────────────────────
create function public.child_balance(p_child uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::int from public.point_transactions
  where child_id = p_child and family_id = public.my_family_id()
$$;
create function public.child_reserved(p_child uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(cost), 0)::int from public.reward_requests
  where child_id = p_child and family_id = public.my_family_id()
    and status = 'pending' and expires_at > now()
$$;
-- Exécutables par authenticated (requis par la vue) mais bornés à la famille de l'appelant : pas de fuite inter-familles.
revoke all on function public.child_balance(uuid), public.child_reserved(uuid) from public, anon;
grant execute on function public.child_balance(uuid), public.child_reserved(uuid) to authenticated;

-- balance = Σ delta ; reserved = Σ coût des demandes en attente ; available = balance − reserved.
create view public.child_balances as
  select c.id as child_id, c.family_id,
         public.child_balance(c.id) as balance,
         public.child_reserved(c.id) as reserved,
         public.child_balance(c.id) - public.child_reserved(c.id) as available
  from public.children c
  where c.deleted_at is null and c.family_id = public.my_family_id();
revoke all on public.child_balances from anon, authenticated;
grant select on public.child_balances to authenticated;

-- ───────────────────────── Aides internes ─────────────────────────
create function public.require_member() returns public.members
language plpgsql stable security definer set search_path = public as $$
declare m public.members;
begin
  select * into m from public.members
  where user_id = auth.uid() and revoked_at is null and deleted_at is null;
  if not found then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return m;
end $$;
revoke all on function public.require_member() from public, anon, authenticated;

create function public.log_activity(p_family uuid, p_child uuid, p_actor uuid, p_type text, p_payload jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.activity_log (family_id, child_id, actor_member_id, type, payload)
  values (p_family, p_child, p_actor, p_type, coalesce(p_payload, '{}'::jsonb))
$$;
revoke all on function public.log_activity(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;

-- ───────────────────────── Tâches ─────────────────────────
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
  if t.completed_at is not null then return; end if;  -- no-op : déjà faite

  update public.tasks set completed_at = now(), completed_by = me.id where id = t.id;
  if t.points > 0 then
    insert into public.point_transactions (id, family_id, child_id, delta, reason, ref_id, created_by)
    values (p_tx_id, t.family_id, t.child_id, t.points, 'task_completed', t.id, me.id)
    on conflict (id) do nothing;
  end if;
  perform public.log_activity(t.family_id, t.child_id, me.id, 'task_completed',
    jsonb_build_object('task_id', t.id, 'title', t.title, 'points', t.points));
end $$;

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

  -- on reprend exactement ce qui a été crédité pour cette tâche (même si ses points ont changé depuis)
  select coalesce(sum(delta), 0) into credited from public.point_transactions
  where ref_id = t.id and reason in ('task_completed', 'task_uncompleted');

  if credited > 0 then
    perform 1 from public.children where id = t.child_id for update;  -- sérialise avec request_reward
    avail := public.child_balance(t.child_id) - public.child_reserved(t.child_id);
    if avail - credited < 0 then
      raise exception 'insufficient_balance' using errcode = 'P0001';
    end if;
    insert into public.point_transactions (id, family_id, child_id, delta, reason, ref_id, created_by)
    values (p_tx_id, t.family_id, t.child_id, -credited, 'task_uncompleted', t.id, me.id)
    on conflict (id) do nothing;
  end if;
  update public.tasks set completed_at = null, completed_by = null where id = t.id;
end $$;

-- ───────────────────────── Récompenses ─────────────────────────
create function public.request_reward(p_reward_id uuid, p_request_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; r public.rewards; existing public.reward_requests;
begin
  me := public.require_member();
  if me.role <> 'child' then raise exception 'forbidden' using errcode = '42501'; end if;

  select * into existing from public.reward_requests where id = p_request_id;
  if found then
    if existing.requested_by = me.id then return; end if;  -- rejeu idempotent
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into r from public.rewards
  where id = p_reward_id and family_id = me.family_id and deleted_at is null
    and (child_id is null or child_id = me.child_id);
  if not found then raise exception 'reward_not_found' using errcode = 'P0002'; end if;

  perform 1 from public.children where id = me.child_id for update;  -- sérialise les demandes simultanées
  if public.child_balance(me.child_id) - public.child_reserved(me.child_id) < r.cost then
    raise exception 'insufficient_balance' using errcode = 'P0001';
  end if;

  insert into public.reward_requests (id, family_id, child_id, reward_id, reward_title, cost,
                                      requested_by, expires_at)
  values (p_request_id, me.family_id, me.child_id, r.id, r.title, r.cost, me.id, now() + interval '7 days');
  perform public.log_activity(me.family_id, me.child_id, me.id, 'reward_requested',
    jsonb_build_object('request_id', p_request_id, 'title', r.title, 'cost', r.cost));
end $$;

create function public.cancel_reward_request(p_request_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; q public.reward_requests;
begin
  me := public.require_member();
  select * into q from public.reward_requests
  where id = p_request_id and family_id = me.family_id for update;
  if not found then raise exception 'request_not_found' using errcode = 'P0002'; end if;
  if me.role <> 'child' or q.requested_by <> me.id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if q.status = 'cancelled' then return; end if;
  if q.status <> 'pending' then raise exception 'not_pending' using errcode = 'P0001'; end if;
  update public.reward_requests set status = 'cancelled', decided_at = now() where id = q.id;
end $$;

create function public.approve_reward_request(p_request_id uuid, p_tx_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; q public.reward_requests;
begin
  me := public.require_member();
  if me.role <> 'parent' then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into q from public.reward_requests
  where id = p_request_id and family_id = me.family_id for update;
  if not found then raise exception 'request_not_found' using errcode = 'P0002'; end if;
  if q.status = 'approved' and exists (select 1 from public.point_transactions where id = p_tx_id) then
    return;  -- rejeu idempotent
  end if;
  if q.status <> 'pending' or q.expires_at <= now() then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  update public.reward_requests
  set status = 'approved', decided_by = me.id, decided_at = now() where id = q.id;
  insert into public.point_transactions (id, family_id, child_id, delta, reason, ref_id, created_by)
  values (p_tx_id, q.family_id, q.child_id, -q.cost, 'reward_redeemed', q.id, me.id);
  perform public.log_activity(q.family_id, q.child_id, me.id, 'reward_approved',
    jsonb_build_object('request_id', q.id, 'title', q.reward_title, 'cost', q.cost));
end $$;

create function public.reject_reward_request(p_request_id uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; q public.reward_requests;
begin
  me := public.require_member();
  if me.role <> 'parent' then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into q from public.reward_requests
  where id = p_request_id and family_id = me.family_id for update;
  if not found then raise exception 'request_not_found' using errcode = 'P0002'; end if;
  if q.status = 'rejected' then return; end if;
  if q.status <> 'pending' then raise exception 'not_pending' using errcode = 'P0001'; end if;
  update public.reward_requests
  set status = 'rejected', decided_by = me.id, decided_at = now(), decision_note = p_note where id = q.id;
  perform public.log_activity(q.family_id, q.child_id, me.id, 'reward_rejected',
    jsonb_build_object('request_id', q.id, 'title', q.reward_title, 'note', p_note));
end $$;

create function public.adjust_points(p_child_id uuid, p_delta int, p_note text, p_tx_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public.require_member();
  if me.role <> 'parent' then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_delta = 0 or coalesce(btrim(p_note), '') = '' then
    raise exception 'invalid_adjustment' using errcode = '22023';
  end if;
  perform 1 from public.children where id = p_child_id and family_id = me.family_id and deleted_at is null for update;
  if not found then raise exception 'child_not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.point_transactions where id = p_tx_id) then return; end if;  -- rejeu
  if public.child_balance(p_child_id) - public.child_reserved(p_child_id) + p_delta < 0 then
    raise exception 'insufficient_balance' using errcode = 'P0001';
  end if;
  insert into public.point_transactions (id, family_id, child_id, delta, reason, note, created_by)
  values (p_tx_id, me.family_id, p_child_id, p_delta, 'manual_adjust', p_note, me.id);
  perform public.log_activity(me.family_id, p_child_id, me.id, 'points_adjusted',
    jsonb_build_object('delta', p_delta, 'note', p_note));
end $$;

-- Expiration des demandes (7 jours) : libère la réservation. Appelée par pg_cron (horaire).
create function public.expire_reward_requests() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with e as (
    update public.reward_requests set status = 'expired', decided_at = now()
    where status = 'pending' and expires_at <= now()
    returning family_id, child_id, id, reward_title
  ), l as (
    insert into public.activity_log (family_id, child_id, type, payload)
    select family_id, child_id, 'reward_expired', jsonb_build_object('request_id', id, 'title', reward_title) from e
  )
  select count(*) into n from e;
  return n;
end $$;
revoke all on function public.expire_reward_requests() from public, anon, authenticated;

-- ───────────────────────── Famille, invitations, appareils ─────────────────────────
create function public.create_family(p_name text, p_display_name text,
                                     p_timezone text default 'Asia/Ho_Chi_Minh') returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid; mid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if exists (select 1 from public.members
             where user_id = auth.uid() and revoked_at is null and deleted_at is null) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  insert into public.families (name, timezone) values (p_name, p_timezone) returning id into fid;
  insert into public.members (family_id, user_id, role, display_name)
  values (fid, auth.uid(), 'parent', p_display_name) returning id into mid;
  insert into public.rewards (family_id, title, icon, cost, sort_order) values
    (fid, 'Chơi game 1 tiếng', 'gamepad-2', 100, 1),
    (fid, 'Xem phim yêu thích', 'film', 150, 2),
    (fid, 'Dùng điện thoại thêm 30 phút', 'smartphone', 200, 3),
    (fid, 'Đồ ăn vặt', 'cookie', 100, 4);
  return fid;
end $$;

create function public.create_invite(p_child_id uuid default null, p_role public.member_role default 'child')
returns text language plpgsql security definer set search_path = public as $$
declare
  me public.members; alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- sans 0/O/1/I
  c text; i int; tries int := 0;
begin
  me := public.require_member();
  if me.role <> 'parent' then raise exception 'forbidden' using errcode = '42501'; end if;
  if (p_role = 'child') <> (p_child_id is not null) then
    raise exception 'invalid_invite' using errcode = '22023';
  end if;
  if p_child_id is not null and not exists
     (select 1 from public.children where id = p_child_id and family_id = me.family_id and deleted_at is null) then
    raise exception 'child_not_found' using errcode = 'P0002';
  end if;
  -- un seul code actif par enfant : on révoque les précédents
  update public.invite_codes set revoked_at = now()
  where family_id = me.family_id and used_at is null and revoked_at is null
    and child_id is not distinct from p_child_id and role = p_role;
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.invite_codes (family_id, child_id, role, code, expires_at, created_by)
      values (me.family_id, p_child_id, p_role, c, now() + interval '24 hours', me.id);
      return c;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 20 then raise; end if;
    end;
  end loop;
end $$;

create function public.redeem_invite(p_code text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv public.invite_codes; mid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if exists (select 1 from public.members
             where user_id = auth.uid() and revoked_at is null and deleted_at is null) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  select * into inv from public.invite_codes
  where code = upper(btrim(p_code)) and used_at is null and revoked_at is null and expires_at > now()
  for update;
  if not found then raise exception 'invalid_code' using errcode = 'P0001'; end if;

  insert into public.members (family_id, user_id, role, child_id, display_name)
  values (inv.family_id, auth.uid(), inv.role, inv.child_id, p_display_name) returning id into mid;
  update public.invite_codes set used_at = now() where id = inv.id;
  return mid;
end $$;

create function public.register_device(p_token text, p_platform text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me public.members; did uuid;
begin
  me := public.require_member();
  select id into did from public.devices
  where member_id = me.id and expo_push_token = p_token and revoked_at is null;
  if found then
    update public.devices set last_seen_at = now() where id = did;
  else
    insert into public.devices (member_id, expo_push_token, platform) values (me.id, p_token, p_platform)
    returning id into did;
  end if;
  return did;
end $$;

-- Révoque l'appareil ET le membership : l'appareil perd tout accès dès la requête suivante (§5.8).
create function public.revoke_device(p_device_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; d public.devices; target public.members;
begin
  me := public.require_member();
  if me.role <> 'parent' then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into d from public.devices where id = p_device_id;
  if not found then raise exception 'device_not_found' using errcode = 'P0002'; end if;
  select * into target from public.members where id = d.member_id and family_id = me.family_id;
  if not found then raise exception 'device_not_found' using errcode = 'P0002'; end if;
  if target.id = me.id then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.devices set revoked_at = now() where member_id = target.id and revoked_at is null;
  update public.members set revoked_at = now() where id = target.id;
end $$;

-- ───────────────────────── Droits d'exécution ─────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'complete_task(uuid,uuid)', 'uncomplete_task(uuid,uuid)', 'request_reward(uuid,uuid)',
    'cancel_reward_request(uuid)', 'approve_reward_request(uuid,uuid)', 'reject_reward_request(uuid,text)',
    'adjust_points(uuid,int,text,uuid)', 'create_family(text,text,text)',
    'create_invite(uuid,public.member_role)', 'redeem_invite(text,text)',
    'register_device(text,text)', 'revoke_device(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ───────────────────────── pg_cron (si disponible : Supabase oui, Postgres nu non) ─────────────────────────
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('expire-reward-requests', '0 * * * *', 'select public.expire_reward_requests()');
  end if;
end $$;
