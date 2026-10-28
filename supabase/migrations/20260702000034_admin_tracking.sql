-- D-102 — Suivi des utilisateurs (administrateur de la plateforme, lecture seule).
--   * `members.last_active_at` + `touch_activity()` (appelée à l'ouverture de l'app et au retour au premier plan) : au plus UNE écriture par heure et par membre
--     (une seconde seulement quand le jour de la plateforme change, pour que chaque jour d'activité soit compté).
--   * `member_activity_days` (membre, jour) : l'historique minimal qui permet le graphique « membres actifs par jour » (une seule date ne le permet pas).
--     RLS activée, AUCUN droit client, aucune politique : seules les RPC `security definer` l'écrivent et la lisent.
--   * RPC d'administration `admin_stats_overview / admin_stats_series / admin_stats_usage / admin_families / admin_family_detail / admin_health` :
--     toutes commencent par `catalog_require_admin()`, calculent leurs agrégats EN SQL, ne renvoient JAMAIS de contenu (tâches, récompenses, réponses, identifiants
--     ou prénoms d'enfants, avatars). Enfants : seulement nombre, pays, classe. Parents : e-mail du parent créateur, nombre de parents.
--   * « Jour » de la plateforme = jour d'Asia/Ho_Chi_Minh (fuseau de l'administrateur) ; la fenêtre « 7 j / 30 j » est glissante.
--   * Les fonctions internes vivent dans le schéma `private` (sans droit client) ; aucun marqueur de test, aucun compte exclu des statistiques.

-- ───────────────────────── Dernière activité ─────────────────────────
alter table public.members add column last_active_at timestamptz;

create table public.member_activity_days (
  member_id uuid not null references public.members (id) on delete cascade,
  day date not null,
  primary key (member_id, day)
);
create index member_activity_days_day on public.member_activity_days (day);
alter table public.member_activity_days enable row level security;
revoke all on public.member_activity_days from anon, authenticated;
-- aucune politique, aucun droit : ni parent ni enfant ne lit ni n'écrit cette table

-- Rétro-remplissage : max(dernière connexion, dernier appareil vu, dernière activité enregistrée).
update public.members m set last_active_at = sub.t
from (
  select x.id,
         (select max(v) from (values
            ((select u.last_sign_in_at from auth.users u where u.id = x.user_id)),
            ((select max(d.last_seen_at) from public.devices d where d.member_id = x.id)),
            ((select max(a.created_at) from public.activity_log a where a.actor_member_id = x.id))
          ) as t (v)) as t
  from public.members x
) sub
where sub.id = m.id and sub.t is not null;

-- Jours connus : les jours où le membre a agi (journal d'activité) et le jour de sa dernière activité.
insert into public.member_activity_days (member_id, day)
select a.actor_member_id, (a.created_at at time zone 'Asia/Ho_Chi_Minh')::date
from public.activity_log a where a.actor_member_id is not null
group by 1, 2
on conflict do nothing;
insert into public.member_activity_days (member_id, day)
select m.id, (m.last_active_at at time zone 'Asia/Ho_Chi_Minh')::date from public.members m where m.last_active_at is not null
on conflict do nothing;

create index families_created on public.families (created_at);
create index members_last_active on public.members (last_active_at) where last_active_at is not null;
create index tasks_created on public.tasks (created_at);
create index tasks_completed on public.tasks (completed_at) where completed_at is not null;
create index tasks_validated on public.tasks (validated_at) where validated_at is not null;
create index reward_requests_created on public.reward_requests (created_at);
create index quiz_attempts_submitted on public.quiz_attempts (submitted_at) where submitted_at is not null;
create index quiz_attempts_validated on public.quiz_attempts (validated_at) where validated_at is not null;
create index ai_usage_created on public.ai_usage (created_at);
create index avatar_usage_created on public.avatar_usage (created_at);

-- ───────────────────────── touch_activity (tout membre connecté) ─────────────────────────
create function public.touch_activity() returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.members;
  today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  me := public.require_member();
  -- au plus une écriture par heure ; une de plus seulement si le jour de la plateforme a changé depuis la dernière
  update public.members set last_active_at = now()
  where id = me.id
    and (last_active_at is null
         or last_active_at < now() - interval '1 hour'
         or (last_active_at at time zone 'Asia/Ho_Chi_Minh')::date <> today);
  if found then
    insert into public.member_activity_days (member_id, day) values (me.id, today) on conflict do nothing;
  end if;
end $$;
revoke all on function public.touch_activity() from public, anon;
grant execute on function public.touch_activity() to authenticated;

-- ───────────────────────── Vue interne : une ligne par famille ─────────────────────────
-- Jamais exposée : lue seulement par les RPC d'administration (`security definer`). Aucun prénom d'enfant, aucun contenu.
create view private.admin_family_base as
with creators as (
  select distinct on (m.family_id) m.family_id, m.user_id
  from public.members m
  where m.role = 'parent' and m.deleted_at is null
  order by m.family_id, m.created_at, m.id
),
mstats as (
  select m.family_id,
         count(*) filter (where m.role = 'parent' and m.revoked_at is null and m.deleted_at is null) as parents,
         max(m.last_active_at) as last_active_at
  from public.members m group by m.family_id
),
cstats as (
  select c.family_id,
         count(*) as children,
         coalesce(jsonb_agg(jsonb_build_object('country', c.country, 'grade', c.grade) order by c.sort_order, c.birth_date), '[]'::jsonb) as classes,
         coalesce(array_agg(distinct c.country) filter (where c.country is not null), '{}') as countries
  from public.children c where c.deleted_at is null group by c.family_id
),
notif as (
  select distinct m.family_id
  from public.devices d join public.members m on m.id = d.member_id
  where d.revoked_at is null and m.revoked_at is null and (d.expo_push_token is not null or d.web_push_subscription is not null)
)
select f.id as family_id,
       f.name,
       f.created_at,
       u.email as creator_email,
       coalesce(c.countries, '{}') as countries,
       coalesce(ms.parents, 0) as parents,
       coalesce(c.children, 0) as children,
       coalesce(c.classes, '[]'::jsonb) as classes,
       ms.last_active_at,
       case
         when ms.last_active_at is null then 'dormant'
         when ms.last_active_at >= now() - interval '7 days' then 'active'
         when ms.last_active_at >= now() - interval '30 days' then 'inactive'
         else 'dormant'
       end as status,
       (n.family_id is not null) as notifications
from public.families f
left join creators cr on cr.family_id = f.id
left join auth.users u on u.id = cr.user_id
left join mstats ms on ms.family_id = f.id
left join cstats c on c.family_id = f.id
left join notif n on n.family_id = f.id
where f.deleted_at is null;
revoke all on private.admin_family_base from public, anon, authenticated;

-- ───────────────────────── Usage (interne) ─────────────────────────
-- Compteurs d'usage depuis `p_since`, pour toute la plateforme ou une famille. Des NOMBRES seulement.
create function private.admin_usage(p_since timestamptz, p_family uuid default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'tasks_created', (select count(*) from public.tasks t where t.created_at >= p_since and t.recurrence_id is null and (p_family is null or t.family_id = p_family)),
    'tasks_generated', (select count(*) from public.tasks t where t.created_at >= p_since and t.recurrence_id is not null and (p_family is null or t.family_id = p_family)),
    'tasks_completed', (select count(*) from public.tasks t where t.completed_at >= p_since and (p_family is null or t.family_id = p_family)),
    'tasks_validated', (select count(*) from public.tasks t where t.validated_at >= p_since and (p_family is null or t.family_id = p_family)),
    'quizzes_submitted', (select count(*) from public.quiz_attempts a where a.catalog_id is not null and a.submitted_at >= p_since and (p_family is null or a.family_id = p_family)),
    'quizzes_validated', (select count(*) from public.quiz_attempts a where a.catalog_id is not null and a.validated_at >= p_since and (p_family is null or a.family_id = p_family)),
    'reward_requests', (select count(*) from public.reward_requests r where r.created_at >= p_since and (p_family is null or r.family_id = p_family)),
    'ai_calls', (select count(*) from public.ai_usage u where u.created_at >= p_since and (p_family is null or u.family_id = p_family)),
    'ai_failed', (select count(*) from public.ai_usage u where u.created_at >= p_since and u.status = 'failed' and (p_family is null or u.family_id = p_family)),
    'avatar_calls', (select count(*) from public.avatar_usage u where u.created_at >= p_since and (p_family is null or u.family_id = p_family)),
    'avatar_failed', (select count(*) from public.avatar_usage u where u.created_at >= p_since and u.status = 'failed' and (p_family is null or u.family_id = p_family))
  )
$$;
revoke all on function private.admin_usage(timestamptz, uuid) from public, anon, authenticated;

-- ───────────────────────── Indicateurs ─────────────────────────
create function public.admin_stats_overview() returns jsonb
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
    'families_with_notifications', (select count(*) from private.admin_family_base where notifications)
  );
end $$;

create function public.admin_stats_series() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  week0 date := date_trunc('week', ((now() at time zone 'Asia/Ho_Chi_Minh')::date)::timestamp)::date;
begin
  perform public.catalog_require_admin();
  return jsonb_build_object(
    -- nouvelles familles par semaine (lundi → dimanche), 12 dernières semaines, la plus ancienne d'abord
    'weeks', (
      select jsonb_agg(jsonb_build_object('week_start', w.d, 'families', coalesce(c.n, 0)) order by w.d)
      from (select (week0 - 7 * k)::date as d from generate_series(0, 11) as k) w
      left join (
        select date_trunc('week', (f.created_at at time zone 'Asia/Ho_Chi_Minh'))::date as wk, count(*) as n
        from public.families f
        where f.deleted_at is null and f.created_at >= ((week0 - 77)::timestamp at time zone 'Asia/Ho_Chi_Minh')
        group by 1
      ) c on c.wk = w.d),
    -- membres actifs par jour (parents / enfants), 30 derniers jours, le plus ancien d'abord
    'days', (
      select jsonb_agg(jsonb_build_object('day', d.day, 'parents', coalesce(a.parents, 0), 'children', coalesce(a.children, 0)) order by d.day)
      from (select (today - k)::date as day from generate_series(0, 29) as k) d
      left join (
        select ad.day,
               count(*) filter (where m.role = 'parent') as parents,
               count(*) filter (where m.role = 'child') as children
        from public.member_activity_days ad join public.members m on m.id = ad.member_id
        where ad.day >= today - 29
        group by ad.day
      ) a on a.day = d.day)
  );
end $$;

create function public.admin_stats_usage() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.catalog_require_admin();
  return jsonb_build_object(
    'd7', private.admin_usage(now() - interval '7 days'),
    'd30', private.admin_usage(now() - interval '30 days'),
    -- quiz du catalogue soumis / validés par pays, classe, matière (identifiants de classification seulement)
    'quiz_by_class', (
      select coalesce(jsonb_agg(r order by (r->>'submitted_30d')::int desc, r->>'country', r->>'grade', r->>'subject'), '[]'::jsonb)
      from (
        select jsonb_build_object('country', z.country, 'grade', z.grade, 'subject', z.subject,
                 'submitted_7d', count(*) filter (where a.submitted_at >= now() - interval '7 days'),
                 'validated_7d', count(*) filter (where a.validated_at >= now() - interval '7 days'),
                 'submitted_30d', count(*) filter (where a.submitted_at >= now() - interval '30 days'),
                 'validated_30d', count(*) filter (where a.validated_at >= now() - interval '30 days')) as r
        from public.quiz_attempts a join public.catalog_quizzes z on z.id = a.catalog_id
        where a.submitted_at >= now() - interval '30 days' or a.validated_at >= now() - interval '30 days'
        group by z.country, z.grade, z.subject
      ) q),
    -- appels IA par fonction et modèle (jetons quand ils existent : aucune grille de prix n'est stockée, donc pas de coût en euros)
    'ai_by_model', (
      select coalesce(jsonb_agg(r order by (r->>'calls_30d')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object('kind', k.kind, 'model', coalesce(k.model, ''),
                 'calls_7d', count(*) filter (where k.created_at >= now() - interval '7 days'),
                 'calls_30d', count(*),
                 'failed_30d', count(*) filter (where k.status = 'failed'),
                 'input_tokens_30d', coalesce(sum(k.input_tokens), 0),
                 'output_tokens_30d', coalesce(sum(k.output_tokens), 0)) as r
        from (
          select 'questions' as kind, u.model, u.created_at, u.status, u.input_tokens, u.output_tokens from public.ai_usage u where u.created_at >= now() - interval '30 days'
          union all
          select 'avatar', v.model, v.created_at, v.status, null::int, null::int from public.avatar_usage v where v.created_at >= now() - interval '30 days'
        ) k
        group by k.kind, k.model
      ) m)
  );
end $$;

-- ───────────────────────── Liste des familles ─────────────────────────
create function public.admin_families(p_search text default '', p_sort text default 'last_active_at', p_dir text default 'desc', p_page int default 1) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  page_size constant int := 50;
  q text := btrim(coalesce(p_search, ''));
  -- l'expression de tri vient d'une LISTE FERMÉE (jamais du client)
  col text := case p_sort
    when 'name' then 'lower(name)'
    when 'creator_email' then 'lower(creator_email)'
    when 'parents' then 'parents'
    when 'children' then 'children'
    when 'created_at' then 'created_at'
    when 'status' then 'last_active_at'
    when 'notifications' then 'notifications'
    else 'last_active_at' end;
  dir text := case when lower(coalesce(p_dir, '')) = 'asc' then 'asc' else 'desc' end;
  page int := greatest(coalesce(p_page, 1), 1);
  pattern text;
  total int;
  rows jsonb;
begin
  perform public.catalog_require_admin();
  if char_length(q) > 100 then q := left(q, 100); end if;
  pattern := '%' || replace(replace(replace(lower(q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  select count(*) into total from private.admin_family_base b
  where q = '' or lower(b.name) like pattern escape '\' or lower(coalesce(b.creator_email, '')) like pattern escape '\';
  execute format($f$
    select coalesce(jsonb_agg(to_jsonb(x) order by x.rn), '[]'::jsonb) from (
      select row_number() over (order by %1$s %2$s nulls last, family_id) as rn,
             family_id, name, creator_email, countries, parents, children, classes, created_at, last_active_at, status, notifications
      from private.admin_family_base b
      where $1 = '' or lower(b.name) like $2 escape '\' or lower(coalesce(b.creator_email, '')) like $2 escape '\'
      order by %1$s %2$s nulls last, family_id
      limit %3$s offset %4$s
    ) x $f$, col, dir, page_size, (page - 1) * page_size)
  into rows using q, pattern;
  return jsonb_build_object('total', total, 'page', page, 'page_size', page_size, 'rows', rows);
end $$;

create function public.admin_family_detail(p_family uuid) returns jsonb
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
    'usage_30d', private.admin_usage(now() - interval '30 days', p_family)
  );
end $$;

-- ───────────────────────── Santé ─────────────────────────
create function public.admin_health() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare jobs jsonb := null;
begin
  perform public.catalog_require_admin();
  begin
    if to_regclass('cron.job') is not null and to_regclass('cron.job_run_details') is not null then
      execute $q$
        select coalesce(jsonb_agg(jsonb_build_object('jobname', j.jobname, 'schedule', j.schedule, 'active', j.active, 'last_run_at', r.start_time, 'last_status', r.status)
                                  order by j.jobname), '[]'::jsonb)
        from cron.job j
        left join lateral (select d.start_time, d.status from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1) r on true $q$
      into jobs;
    end if;
  exception when others then
    jobs := null; -- pg_cron illisible pour ce rôle : « inconnu », jamais une erreur
  end;
  return jsonb_build_object(
    'db_size_bytes', pg_database_size(current_database()),
    'active_devices', (select count(*) from public.devices d join public.members m on m.id = d.member_id
                       where d.revoked_at is null and m.revoked_at is null and (d.expo_push_token is not null or d.web_push_subscription is not null)),
    'cron', jobs
  );
end $$;

-- ───────────────────────── Droits ─────────────────────────
do $$
declare f text;
begin
  foreach f in array array['admin_stats_overview()', 'admin_stats_series()', 'admin_stats_usage()', 'admin_families(text, text, text, int)', 'admin_family_detail(uuid)', 'admin_health()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
