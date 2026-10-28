#!/usr/bin/env bash
# D-102 : performance des RPC d'administration sur 1 000 familles générées (sans Docker, comme db-test.sh). Échoue si une RPC dépasse 300 ms.
# Usage : ./scripts/db-admin-perf.sh   (variables : FAMILIES=1000, LIMIT_MS=300)
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd); DB=taskmate_perf; FAMILIES=${FAMILIES:-1000}; LIMIT_MS=${LIMIT_MS:-300}
pg_lsclusters | grep -q online || pg_ctlcluster 16 main start
as_pg() { su postgres -c "$1"; }
as_pg "psql -qX -c 'drop database if exists $DB' -c 'create database $DB' postgres" >/dev/null 2>&1
as_pg "psql -qX -v ON_ERROR_STOP=1 -f $ROOT/scripts/supabase-shim.sql $DB" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do as_pg "psql -qX -v ON_ERROR_STOP=1 -f $f $DB" >/dev/null 2>&1; done

as_pg "psql -qX -v ON_ERROR_STOP=1 -d $DB" >/dev/null <<SQL
set session_replication_role = replica;  -- données générées en masse : aucun déclencheur (journal d'activité, notifications)
insert into auth.users (id, email, is_anonymous, last_sign_in_at) values ('00000000-0000-0000-0000-00000000ad01', 'admin@perf', false, now());
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000ad01');
insert into public.families (id, name, created_at, timezone) values ('00000000-0000-0000-0000-00000000fa00', 'Admin', now(), 'Asia/Ho_Chi_Minh');
insert into public.members (id, family_id, user_id, role, display_name) values ('00000000-0000-0000-0000-00000000ad02', '00000000-0000-0000-0000-00000000fa00', '00000000-0000-0000-0000-00000000ad01', 'parent', 'Admin');
insert into public.catalog_quizzes (id, country, grade, subject, week_label, title, status)
  select gen_random_uuid(), 'VN', g::text, s, 'Tuần ' || w, 'Quiz ' || g || s || w, 'published'
  from generate_series(1, 9) g, unnest(array['maths', 'anglais']) s, generate_series(1, 2) w;
create temp table fam as select gen_random_uuid() as id, i from generate_series(1, $FAMILIES) i;
insert into public.families (id, name, created_at) select id, 'Gia đình ' || i, now() - (random() * 120) * interval '1 day' from fam;
create temp table par as select gen_random_uuid() as uid, gen_random_uuid() as mid, f.id as fid, f.i, p from fam f, generate_series(1, 2) p;
insert into auth.users (id, email, is_anonymous, last_sign_in_at) select uid, 'parent' || i || '-' || p || '@perf', false, now() - random() * interval '60 days' from par;
insert into public.members (id, family_id, user_id, role, display_name, created_at, last_active_at)
  select mid, fid, uid, 'parent', 'P' || p, now() - (random() * 120) * interval '1 day', case when random() < 0.8 then now() - (random() * 45) * interval '1 day' end from par;
create temp table kid as select gen_random_uuid() as cid, gen_random_uuid() as uid, gen_random_uuid() as mid, f.id as fid, f.i, k from fam f, generate_series(1, 2) k;
insert into public.children (id, family_id, name, birth_date, country, grade) select cid, fid, 'E' || k, '2014-01-01', 'VN', (1 + (i + k) % 9)::text from kid;
insert into auth.users (id, is_anonymous) select uid, false from kid;
insert into public.members (id, family_id, user_id, role, child_id, display_name, last_active_at)
  select mid, fid, uid, 'child', cid, 'E' || k, case when random() < 0.7 then now() - (random() * 40) * interval '1 day' end from kid;
insert into public.devices (member_id, platform, web_push_subscription) select mid, 'web', jsonb_build_object('endpoint', 'https://p/' || mid, 'keys', jsonb_build_object('p256dh', 'k', 'auth', 'a')) from par where random() < 0.6;
insert into public.member_activity_days (member_id, day)
  select distinct m.id, ((now() at time zone 'Asia/Ho_Chi_Minh')::date - (random() * 29)::int) from public.members m, generate_series(1, 15) where m.id <> '00000000-0000-0000-0000-00000000ad02';
insert into public.tasks (family_id, child_id, title, date, created_by, created_at, completed_at, completed_by, validated_at, validated_by)
  select fid, cid, title, current_date, pid, created, case when done then created + interval '1 hour' end, case when done then mid end,
         case when done and ok then created + interval '2 hours' end, case when done and ok then pid end
  from (
    select k.fid, k.cid, k.mid, 'T' || g as title, (select mid from par where fid = k.fid limit 1) as pid,
           now() - (random() * 90) * interval '1 day' as created, random() < 0.7 as done, random() < 0.6 as ok
    from kid k, generate_series(1, 30) g
  ) z;
insert into public.quiz_attempts (family_id, child_id, catalog_id, status, submitted_at, validated_at, validated_by)
  select k.fid, k.cid, q.id, 'validated', now() - (random() * 40) * interval '1 day', now() - (random() * 40) * interval '1 day', (select mid from par where fid = k.fid limit 1)
  from kid k join lateral (select id from public.catalog_quizzes order by random() limit 2) q on true;
insert into public.ai_usage (family_id, member_id, day, status, model, input_tokens, output_tokens, created_at)
  select fid, mid, current_date, 'success', 'gpt-test', 1000, 500, now() - (random() * 40) * interval '1 day' from par where p = 1 and random() < 0.8;
analyze;
SQL

echo "Famille(s) générée(s) : $(as_pg "psql -qXtA -d $DB -c 'select count(*) from public.families'") ; tâches : $(as_pg "psql -qXtA -d $DB -c 'select count(*) from public.tasks'")"
ANYFAM=$(as_pg "psql -qXtA -d $DB -c \"select id from public.families where name like '% 7' limit 1\"")
as_pg "psql -qX -v ON_ERROR_STOP=1 -d $DB" <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000ad01', true);
do \$\$
declare t0 timestamptz; ms numeric; worst numeric := 0; r record; bad boolean := false; anyfam uuid;
begin
  anyfam := '$ANYFAM'::uuid;
  for r in select * from (values
    ('admin_stats_overview', 'select public.admin_stats_overview()'),
    ('admin_stats_series', 'select public.admin_stats_series()'),
    ('admin_stats_usage', 'select public.admin_stats_usage()'),
    ('admin_families (page 1, tri par activité)', 'select public.admin_families(''' || '' || ''', ''last_active_at'', ''desc'', 1)'),
    ('admin_families (recherche e-mail)', 'select public.admin_families(''parent5'', ''name'', ''asc'', 1)'),
    ('admin_families (page 20, tri par nom)', 'select public.admin_families('''', ''name'', ''asc'', 20)'),
    ('admin_family_detail', 'select public.admin_family_detail(''' || anyfam || ''')'),
    ('admin_health', 'select public.admin_health()')) as v(label, q)
  loop
    t0 := clock_timestamp();
    execute r.q;
    ms := extract(epoch from clock_timestamp() - t0) * 1000;
    raise notice '% : % ms', rpad(r.label, 44), round(ms, 1);
    worst := greatest(worst, ms);
    if ms > $LIMIT_MS then bad := true; end if;
  end loop;
  raise notice 'pire cas : % ms (limite $LIMIT_MS ms)', round(worst, 1);
  if bad then raise exception 'une RPC dépasse $LIMIT_MS ms'; end if;
end \$\$;
rollback;
SQL
