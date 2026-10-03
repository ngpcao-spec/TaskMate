-- Fixtures communes (ids lisibles : tests.u(n)).
--   familles : 1 = A (test), 2 = B (étrangère)
--   users    : 11 parent1, 12 parent2, 13 Minh, 14 Khang, 21 parent B
--   members  : 111, 112, 113 (Minh), 114 (Khang), 121 ; children : 201 Minh, 202 Khang, 221 (B)
--   rewards  : 401 Game(100), 402 Film(150), 421 (B) ; tasks : 301 (Minh, par parent), 302 (Khang, par Khang), 303 (Minh, par Minh), 321 (B)
begin;
create schema tests;
grant usage on schema tests to authenticated, anon;
create function tests.u(n int) returns uuid language sql immutable
  as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create function tests.login(n int) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', tests.u(n)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
-- exécute une requête (en tant que rôle courant) et renvoie le nombre de lignes touchées
create function tests.n(q text) returns bigint language plpgsql as $$
declare c bigint;
begin
  execute q;
  get diagnostics c = row_count;
  return c;
end $$;
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, email, is_anonymous) values
  (tests.u(11), 'p1@test', false), (tests.u(12), 'p2@test', false),
  (tests.u(13), null, true), (tests.u(14), null, true), (tests.u(21), 'pb@test', false);
insert into public.families (id, name) values (tests.u(1), 'A'), (tests.u(2), 'B');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2009-03-01'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01'),
  (tests.u(221), tests.u(2), 'Bé', '2012-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'),
  (tests.u(112), tests.u(1), tests.u(12), 'parent', null, 'Mẹ'),
  (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'),
  (tests.u(114), tests.u(1), tests.u(14), 'child', tests.u(202), 'Khang'),
  (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'PB');
insert into public.rewards (id, family_id, title, cost) values
  (tests.u(401), tests.u(1), 'Game', 100), (tests.u(402), tests.u(1), 'Film', 150),
  (tests.u(421), tests.u(2), 'Autre', 50);
insert into public.tasks (id, family_id, child_id, title, note, date, created_by) values
  (tests.u(301), tests.u(1), tests.u(201), 'Tâche Minh (parent)', 'note', '2026-07-02', tests.u(111)),
  (tests.u(302), tests.u(1), tests.u(202), 'Tâche Khang', 'secret?', '2026-07-02', tests.u(114)),
  (tests.u(303), tests.u(1), tests.u(201), 'Tâche Minh (perso)', null, '2026-07-02', tests.u(113)),
  (tests.u(321), tests.u(2), tests.u(221), 'Tâche B', null, '2026-07-02', tests.u(121));
select * from no_plan();

-- ═══ diagnostics() : parents seulement ═══
select tests.login(11);
select lives_ok($$select public.diagnostics()$$, 'diagnostics: le parent y accède');
select ok((select public.diagnostics() ? 'tables'), 'diagnostics: clé tables');
select ok((select public.diagnostics()->'tables' ? 'tasks'), 'diagnostics: la table tasks est listée');
select ok((select public.diagnostics()->'functions' ? 'validate_task'), 'diagnostics: la RPC validate_task est listée');
select ok((select public.diagnostics()->'functions' ? 'diagnostics'), 'diagnostics: elle se liste elle-même');
select is((select jsonb_array_length(public.diagnostics()->'tables_without_rls')), 0, 'diagnostics: toutes les tables du schéma public ont la RLS activée');
select ok((select public.diagnostics()->'extensions' ? 'pgcrypto'), 'diagnostics: extension pgcrypto présente');
select lives_ok($$select public.diagnostics()->'realtime_tables'$$, 'diagnostics: publication Realtime lisible (vide hors Supabase)');
select ok((select jsonb_typeof(public.diagnostics()->'cron_jobs') in ('array', 'null')), 'diagnostics: cron_jobs = tableau ou null (inconnu), jamais une erreur');

-- sur Supabase (pg_cron disponible), les deux tâches planifiées par les migrations existent ; ailleurs le test est vacuement vrai
select ok(
  not exists (select 1 from pg_available_extensions where name = 'pg_cron')
  or (select public.diagnostics()->'cron_jobs' ?& array['expire-reward-requests', 'generate-recurrences']),
  'diagnostics: tâches pg_cron planifiées (expiration des demandes, génération des récurrences) quand pg_cron existe');
select ok(
  not exists (select 1 from pg_publication where pubname = 'supabase_realtime')
  or (select public.diagnostics()->'realtime_tables' ?& array['tasks', 'goals', 'rewards', 'reward_requests', 'point_transactions', 'children']),
  'diagnostics: tables métier publiées en Realtime quand la publication existe');

-- négatifs
select tests.login(13);
select throws_ok($$select public.diagnostics()$$, '42501', 'forbidden', 'diagnostics: refusé à l''enfant');
select tests.login(21);
select lives_ok($$select public.diagnostics()$$, 'diagnostics: le parent d''une autre famille voit seulement des noms (aucune donnée de A)');
select ok(not (select public.diagnostics()::text like '%Minh%'), 'diagnostics: aucune donnée métier dans la réponse');
reset role;
set local role anon;
select throws_ok($$select public.diagnostics()$$, '42501', null, 'diagnostics: refusé à anon');
select throws_ok($$select public.schedule_cron_jobs()$$, '42501', null, 'schedule_cron_jobs: refusé à anon');
select tests.login(11);
select throws_ok($$select public.schedule_cron_jobs()$$, '42501', null, 'schedule_cron_jobs: refusé aux clients authentifiés');

-- le planificateur renvoie un objet exploitable même sans pg_cron (superutilisateur de test)
reset role;
select ok((select public.schedule_cron_jobs() ? 'ok'), 'schedule_cron_jobs: réponse structurée (ok true/false)');

select * from finish();
rollback;
