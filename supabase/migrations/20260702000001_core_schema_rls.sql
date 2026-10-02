-- M1 — schéma métier + RLS (SPEC §4, §5.7).
-- Règle : chaque table a sa RLS activée dans CETTE migration.
-- Aucun client n'écrit dans point_transactions / reward_requests / invite_codes / devices :
-- uniquement via les RPC (migration suivante).

create extension if not exists pgcrypto;

-- ───────────────────────── Enums ─────────────────────────
create type public.member_role as enum ('parent', 'child');
create type public.task_category as enum ('study', 'sport', 'chores', 'personal', 'other');
create type public.time_kind as enum ('range', 'deadline', 'anytime');
create type public.point_reason as enum ('task_completed', 'task_uncompleted', 'reward_redeemed', 'manual_adjust');
create type public.request_status as enum ('pending', 'approved', 'rejected', 'cancelled', 'expired');
create type public.recurrence_rule as enum ('daily', 'weekdays');

-- ───────────────────────── Trigger utilitaire ─────────────────────────
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ───────────────────────── Familles & identités ─────────────────────────
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  name text not null check (char_length(name) between 1 and 40),
  birth_date date not null,
  avatar text,
  color text,
  label text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, family_id)
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  user_id uuid not null references auth.users (id),
  role public.member_role not null,
  child_id uuid,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revoked_at timestamptz,
  unique (id, family_id),
  foreign key (child_id, family_id) references public.children (id, family_id),
  check ((role = 'child') = (child_id is not null))
);
-- un compte = au plus un membership actif
create unique index members_active_user on public.members (user_id)
  where revoked_at is null and deleted_at is null;

create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  child_id uuid,
  role public.member_role not null,
  code text not null check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references public.members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (child_id, family_id) references public.children (id, family_id),
  check ((role = 'child') = (child_id is not null))
);
create unique index invite_codes_active_code on public.invite_codes (code)
  where used_at is null and revoked_at is null;

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id),
  expo_push_token text,
  platform text check (platform in ('ios', 'android')),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────────────────── Données métier ─────────────────────────
create table public.recurrences (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  child_id uuid not null,
  title text not null check (char_length(title) between 1 and 80),
  category public.task_category not null default 'study',
  note text check (char_length(note) <= 500),
  time_kind public.time_kind not null,
  start_time time,
  end_time time,
  points int not null default 10 check (points >= 0),
  rule public.recurrence_rule not null,
  weekdays int[] check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7]),
  starts_on date not null,
  ends_on date,
  created_by uuid not null references public.members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (child_id, family_id) references public.children (id, family_id),
  check (
    (time_kind = 'range' and start_time is not null and end_time is not null and end_time > start_time)
    or (time_kind = 'deadline' and start_time is null and end_time is not null)
    or (time_kind = 'anytime' and start_time is null and end_time is null)
  )
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  child_id uuid not null,
  title text not null check (char_length(title) between 1 and 80),
  category public.task_category not null default 'study',
  note text check (char_length(note) <= 500),
  date date not null,
  -- 'deadline' : l'échéance « avant HH:MM » est stockée dans end_time (D-004)
  time_kind public.time_kind not null default 'anytime',
  start_time time,
  end_time time,
  points int not null default 10 check (points >= 0),
  completed_at timestamptz,
  completed_by uuid references public.members (id),
  recurrence_id uuid references public.recurrences (id),
  created_by uuid not null references public.members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (child_id, family_id) references public.children (id, family_id),
  unique (recurrence_id, date),
  check (
    (time_kind = 'range' and start_time is not null and end_time is not null and end_time > start_time)
    or (time_kind = 'deadline' and start_time is null and end_time is not null)
    or (time_kind = 'anytime' and start_time is null and end_time is null)
  )
);
create index tasks_child_date on public.tasks (child_id, date);
create index tasks_family_updated on public.tasks (family_id, updated_at);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  child_id uuid not null,
  title text not null check (char_length(title) between 1 and 80),
  icon text not null default 'target',
  target int not null check (target >= 1),
  progress int not null default 0 check (progress >= 0),
  unit text check (char_length(unit) <= 20),
  achieved_at timestamptz,
  created_by uuid not null references public.members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (child_id, family_id) references public.children (id, family_id)
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  title text not null check (char_length(title) between 1 and 80),
  icon text not null default 'gift',
  cost int not null check (cost > 0),
  child_id uuid,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, family_id),
  foreign key (child_id, family_id) references public.children (id, family_id)
);

-- Journal immuable : id généré côté client (idempotence).
create table public.point_transactions (
  id uuid primary key,
  family_id uuid not null references public.families (id),
  child_id uuid not null,
  delta int not null check (delta <> 0),
  reason public.point_reason not null,
  ref_id uuid,
  note text,
  created_by uuid not null references public.members (id),
  created_at timestamptz not null default now(),
  foreign key (child_id, family_id) references public.children (id, family_id)
);
create index point_transactions_child_created on public.point_transactions (child_id, created_at);

create function public.forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'immutable_journal' using errcode = '42501';
end $$;
create trigger point_transactions_immutable
  before update or delete on public.point_transactions
  for each row execute function public.forbid_mutation();
create trigger point_transactions_no_truncate
  before truncate on public.point_transactions
  for each statement execute function public.forbid_mutation();

create table public.reward_requests (
  id uuid primary key,
  family_id uuid not null references public.families (id),
  child_id uuid not null,
  reward_id uuid not null references public.rewards (id),
  reward_title text not null,
  cost int not null check (cost > 0),
  status public.request_status not null default 'pending',
  requested_by uuid not null references public.members (id),
  decided_by uuid references public.members (id),
  decided_at timestamptz,
  decision_note text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (child_id, family_id) references public.children (id, family_id)
);
create index reward_requests_child_status on public.reward_requests (child_id, status);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  child_id uuid,
  actor_member_id uuid references public.members (id),
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_family_created on public.activity_log (family_id, created_at desc);

-- updated_at automatique
do $$
declare t text;
begin
  foreach t in array array['families', 'children', 'members', 'invite_codes', 'devices', 'recurrences',
                           'tasks', 'goals', 'rewards', 'reward_requests'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
                   t || '_updated_at', t);
  end loop;
end $$;

-- ───────────────────────── Helpers d'identité (security definer) ─────────────────────────
-- Résolvent le membership actif de l'appelant. Un membre révoqué n'a plus aucun accès (§5.8).
create function public.my_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.members
  where user_id = auth.uid() and revoked_at is null and deleted_at is null
$$;
create function public.my_family_id() returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from public.members
  where user_id = auth.uid() and revoked_at is null and deleted_at is null
$$;
create function public.my_role() returns public.member_role
language sql stable security definer set search_path = public as $$
  select role from public.members
  where user_id = auth.uid() and revoked_at is null and deleted_at is null
$$;
create function public.my_child_id() returns uuid
language sql stable security definer set search_path = public as $$
  select child_id from public.members
  where user_id = auth.uid() and revoked_at is null and deleted_at is null
$$;
create function public.is_parent() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'parent', false)
$$;

-- ───────────────────────── Gardes de colonnes ─────────────────────────
-- Un enfant ne peut ni fixer les points d'une tâche (≠ 10) ni les modifier (§5.7).
create function public.tasks_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_parent() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.points <> 10 then
      raise exception 'points_forbidden' using errcode = '42501';
    end if;
  else
    if new.points <> old.points or new.family_id <> old.family_id or new.created_by <> old.created_by then
      raise exception 'points_forbidden' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger tasks_guard before insert or update on public.tasks
  for each row execute function public.tasks_guard();

-- Objectif atteint : posé par le serveur, journalisé pour notifier le parent (M9).
create function public.goals_achieved() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.progress >= new.target and new.achieved_at is null then
    new.achieved_at := now();
    insert into public.activity_log (family_id, child_id, actor_member_id, type, payload)
    values (new.family_id, new.child_id, public.my_member_id(), 'goal_achieved',
            jsonb_build_object('goal_id', new.id, 'title', new.title));
  elsif new.progress < new.target then
    new.achieved_at := null;
  end if;
  return new;
end $$;
create trigger goals_achieved before insert or update on public.goals
  for each row execute function public.goals_achieved();

-- ───────────────────────── Privilèges & RLS ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array['families', 'children', 'members', 'invite_codes', 'devices', 'recurrences',
                           'tasks', 'goals', 'rewards', 'point_transactions', 'reward_requests', 'activity_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- families
create policy families_select on public.families for select to authenticated
  using (id = public.my_family_id());
create policy families_update on public.families for update to authenticated
  using (id = public.my_family_id() and public.is_parent())
  with check (id = public.my_family_id() and public.is_parent());
grant update (name, timezone, deleted_at) on public.families to authenticated;

-- children (lecture famille ; écriture parent)
create policy children_select on public.children for select to authenticated
  using (family_id = public.my_family_id());
create policy children_insert on public.children for insert to authenticated
  with check (family_id = public.my_family_id() and public.is_parent());
create policy children_update on public.children for update to authenticated
  using (family_id = public.my_family_id() and public.is_parent())
  with check (family_id = public.my_family_id() and public.is_parent());
grant insert (id, family_id, name, birth_date, avatar, color, label, sort_order) on public.children to authenticated;
grant update (name, birth_date, avatar, color, label, sort_order, deleted_at) on public.children to authenticated;

-- members (lecture seule ; créés par RPC)
create policy members_select on public.members for select to authenticated
  using (family_id = public.my_family_id());

-- invite_codes (parent lit ; création/révocation par RPC)
create policy invite_codes_select on public.invite_codes for select to authenticated
  using (family_id = public.my_family_id() and public.is_parent());

-- devices (le membre voit les siens, le parent ceux de la famille ; écriture par RPC)
create policy devices_select on public.devices for select to authenticated
  using (
    member_id = public.my_member_id()
    or (public.is_parent() and exists (
      select 1 from public.members m where m.id = devices.member_id and m.family_id = public.my_family_id()))
  );

-- tasks
create policy tasks_select on public.tasks for select to authenticated
  using (family_id = public.my_family_id());
create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    family_id = public.my_family_id()
    and created_by = public.my_member_id()
    and (public.is_parent() or child_id = public.my_child_id())
  );
create policy tasks_update on public.tasks for update to authenticated
  using (family_id = public.my_family_id() and (public.is_parent() or created_by = public.my_member_id()))
  with check (family_id = public.my_family_id() and (public.is_parent() or child_id = public.my_child_id()));
-- completed_at / completed_by absents des grants : uniquement via RPC (§5.2)
grant insert (id, family_id, child_id, title, category, note, date, time_kind, start_time, end_time,
              points, recurrence_id, created_by) on public.tasks to authenticated;
grant update (child_id, title, category, note, date, time_kind, start_time, end_time, points, deleted_at)
  on public.tasks to authenticated;

-- recurrences (parent uniquement en V1 ; l'enfant lit)
create policy recurrences_select on public.recurrences for select to authenticated
  using (family_id = public.my_family_id());
create policy recurrences_insert on public.recurrences for insert to authenticated
  with check (family_id = public.my_family_id() and public.is_parent() and created_by = public.my_member_id());
create policy recurrences_update on public.recurrences for update to authenticated
  using (family_id = public.my_family_id() and public.is_parent())
  with check (family_id = public.my_family_id() and public.is_parent());
grant insert (id, family_id, child_id, title, category, note, time_kind, start_time, end_time, points,
              rule, weekdays, starts_on, ends_on, created_by) on public.recurrences to authenticated;
grant update (title, category, note, time_kind, start_time, end_time, points, rule, weekdays, starts_on,
              ends_on, deleted_at) on public.recurrences to authenticated;

-- goals (CRUD sur les siens pour l'enfant, tous pour le parent)
create policy goals_select on public.goals for select to authenticated
  using (family_id = public.my_family_id());
create policy goals_insert on public.goals for insert to authenticated
  with check (
    family_id = public.my_family_id()
    and created_by = public.my_member_id()
    and (public.is_parent() or child_id = public.my_child_id())
  );
create policy goals_update on public.goals for update to authenticated
  using (family_id = public.my_family_id() and (public.is_parent() or child_id = public.my_child_id()))
  with check (family_id = public.my_family_id() and (public.is_parent() or child_id = public.my_child_id()));
grant insert (id, family_id, child_id, title, icon, target, progress, unit, created_by) on public.goals to authenticated;
grant update (title, icon, target, progress, unit, deleted_at) on public.goals to authenticated;

-- rewards (lecture famille ; CRUD parent)
create policy rewards_select on public.rewards for select to authenticated
  using (family_id = public.my_family_id());
create policy rewards_insert on public.rewards for insert to authenticated
  with check (family_id = public.my_family_id() and public.is_parent());
create policy rewards_update on public.rewards for update to authenticated
  using (family_id = public.my_family_id() and public.is_parent())
  with check (family_id = public.my_family_id() and public.is_parent());
grant insert (id, family_id, title, icon, cost, child_id, sort_order) on public.rewards to authenticated;
grant update (title, icon, cost, child_id, sort_order, deleted_at) on public.rewards to authenticated;

-- point_transactions : lecture famille (solde du frère visible), aucune écriture directe
create policy point_transactions_select on public.point_transactions for select to authenticated
  using (family_id = public.my_family_id());

-- reward_requests : le parent voit tout, l'enfant les siennes ; écriture par RPC
create policy reward_requests_select on public.reward_requests for select to authenticated
  using (
    family_id = public.my_family_id()
    and (public.is_parent() or child_id = public.my_child_id())
  );

-- activity_log : parent uniquement
create policy activity_log_select on public.activity_log for select to authenticated
  using (family_id = public.my_family_id() and public.is_parent());
