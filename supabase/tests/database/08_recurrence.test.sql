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

-- jour local de la famille A (fuseau par défaut Asia/Ho_Chi_Minh)
create function tests.today() returns date language sql as $$ select (now() at time zone 'Asia/Ho_Chi_Minh')::date $$;

-- ═══ création : 14 occurrences sur 14 jours glissants ═══
select tests.login(11);
insert into public.recurrences (id, family_id, child_id, title, category, time_kind, start_time, end_time, points, rule, starts_on, created_by)
values (tests.u(801), tests.u(1), tests.u(201), 'Làm bài tập', 'study', 'range', '19:00', '19:45', 15, 'daily', tests.today() - 30, tests.u(111));
select is((select count(*)::int from public.tasks where recurrence_id = tests.u(801)), 14, 'daily: 14 occurrences matérialisées');
select is((select min(date) from public.tasks where recurrence_id = tests.u(801)), tests.today(), 'daily: la première est aujourd''hui (jour local famille)');
select is((select max(date) from public.tasks where recurrence_id = tests.u(801)), tests.today() + 13, 'daily: la dernière est dans 13 jours');
select is((select count(*)::int from public.tasks where recurrence_id = tests.u(801) and title = 'Làm bài tập' and category = 'study' and start_time = '19:00' and end_time = '19:45' and points = 15 and child_id = tests.u(201) and created_by = tests.u(111)), 14, 'daily: champs copiés depuis la récurrence');
select is((select count(*)::int from public.activity_log where type = 'task_assigned' and (payload->>'task_id')::uuid in (select id from public.tasks where recurrence_id = tests.u(801))), 0, 'daily: pas de push « tâche assignée » pour les occurrences générées');

-- ═══ idempotence ═══
select tests.logout();
select is(public.generate_all_recurrences(), 0, 'idempotence: relancer ne crée rien');
select is(public.generate_all_recurrences(), 0, 'idempotence: deuxième relance idem');
select is((select count(*)::int from public.tasks where recurrence_id = tests.u(801)), 14, 'idempotence: toujours 14, aucun doublon');
select throws_ok($$insert into public.tasks (family_id, child_id, title, date, recurrence_id, created_by) values (tests.u(1), tests.u(201), 'dup', tests.today(), tests.u(801), tests.u(111))$$, '23505', null, 'idempotence: (recurrence_id, date) unique');
-- le lendemain : une seule nouvelle occurrence (fenêtre glissante)
select is(public.generate_all_recurrences(now() + interval '1 day'), 1, 'fenêtre glissante: le lendemain crée uniquement le nouveau jour');
delete from public.tasks where recurrence_id = tests.u(801) and date = tests.today() + 14; -- remet le décor pour la suite

-- ═══ jours de semaine choisis ═══
select tests.login(11);
insert into public.recurrences (id, family_id, child_id, title, time_kind, rule, weekdays, starts_on, created_by)
values (tests.u(802), tests.u(1), tests.u(202), 'Dọn phòng', 'anytime', 'weekdays', array[1, 3, 5], tests.today(), tests.u(111));
select is((select count(*)::int from public.tasks where recurrence_id = tests.u(802)),
          (select count(*)::int from generate_series(tests.today(), tests.today() + 13, interval '1 day') g where extract(isodow from g)::int in (1, 3, 5)),
          'weekdays: uniquement lundi/mercredi/vendredi');
select is((select count(*)::int from public.tasks where recurrence_id = tests.u(802) and extract(isodow from date)::int not in (1, 3, 5)), 0, 'weekdays: aucun autre jour');
select throws_ok($$insert into public.recurrences (family_id, child_id, title, time_kind, rule, starts_on, created_by) values (tests.u(1), tests.u(201), 'x', 'anytime', 'weekdays', current_date, tests.u(111))$$, '23514', null, 'weekdays: liste de jours obligatoire (CHECK)');

-- ═══ bornes starts_on / ends_on ═══
insert into public.recurrences (id, family_id, child_id, title, time_kind, rule, starts_on, ends_on, created_by)
values (tests.u(803), tests.u(1), tests.u(201), 'Bornée', 'anytime', 'daily', tests.today() + 3, tests.today() + 5, tests.u(111));
select is((select count(*)::int from public.tasks where recurrence_id = tests.u(803)), 3, 'bornes: 3 jours entre starts_on et ends_on');
select is((select min(date) from public.tasks where recurrence_id = tests.u(803)), tests.today() + 3, 'bornes: pas avant starts_on');

-- ═══ modification : futur non fait mis à jour, fait et passé intacts ═══
select tests.login(13);
select public.complete_task((select id from public.tasks where recurrence_id = tests.u(801) and date = tests.today()), tests.u(701));
select tests.login(11);
update public.recurrences set title = 'Bài tập mới', points = 20, start_time = '20:00', end_time = '20:30' where id = tests.u(801);
select is((select count(*)::int from public.tasks where recurrence_id = tests.u(801) and date > tests.today() and title = 'Bài tập mới' and points = 20 and start_time = '20:00'), 13, 'update: les 13 occurrences futures sont alignées');
select is((select title from public.tasks where recurrence_id = tests.u(801) and date = tests.today()), 'Làm bài tập', 'update: l''occurrence déjà faite reste intacte');
select is((select points from public.tasks where recurrence_id = tests.u(801) and date = tests.today()), 15, 'update: ses points aussi (déjà crédités)');

-- changer les jours : retire les occurrences devenues invalides, ajoute les nouvelles
update public.recurrences set rule = 'weekdays', weekdays = array[2, 4] where id = tests.u(801);
select is((select count(*)::int from public.tasks where recurrence_id = tests.u(801) and deleted_at is null and date > tests.today() and extract(isodow from date)::int not in (2, 4)), 0, 'jours modifiés: les autres jours futurs sont supprimés (soft)');
select is((select count(*)::int from public.tasks where recurrence_id = tests.u(801) and deleted_at is null and date > tests.today()),
          (select count(*)::int from generate_series(tests.today() + 1, tests.today() + 13, interval '1 day') g where extract(isodow from g)::int in (2, 4)), 'jours modifiés: exactement mardi/jeudi restants');
select is((select count(*)::int from public.tasks where recurrence_id = tests.u(801) and date = tests.today() and deleted_at is null), 1, 'jours modifiés: aujourd''hui (fait) est conservé même si le jour n''est plus dans la règle');

-- ═══ suppression de la série ═══
update public.recurrences set deleted_at = now() where id = tests.u(802);
select is((select count(*)::int from public.tasks where recurrence_id = tests.u(802) and deleted_at is null), 0, 'suppression: occurrences futures non faites supprimées');

-- ═══ fuseaux horaires : « aujourd'hui » = jour local de la famille ═══
select tests.logout();
update public.families set timezone = 'Pacific/Auckland' where id = tests.u(2);
insert into public.members (id, family_id, user_id, role, display_name) values (tests.u(122), tests.u(2), tests.u(21), 'parent', 'PB2') on conflict do nothing;
insert into public.recurrences (id, family_id, child_id, title, time_kind, rule, starts_on, created_by)
values (tests.u(811), tests.u(2), tests.u(221), 'Auckland', 'anytime', 'daily', '2026-01-01', tests.u(121));
delete from public.tasks where recurrence_id = tests.u(811);
-- 2026-07-01 20:00 UTC = 2026-07-02 08:00 à Auckland (UTC+12), 2026-07-02 03:00 à Hô Chi Minh
select is(public.generate_recurrence(tests.u(811), '2026-07-01 20:00:00+00'), 14, 'fuseau: 14 occurrences');
select is((select min(date) from public.tasks where recurrence_id = tests.u(811)), '2026-07-02'::date, 'fuseau: Auckland démarre le 2 juillet alors que l''UTC est encore le 1er');
update public.families set timezone = 'UTC' where id = tests.u(2);
delete from public.tasks where recurrence_id = tests.u(811);
select is(public.generate_recurrence(tests.u(811), '2026-07-01 20:00:00+00'), 14, 'fuseau: UTC');
select is((select min(date) from public.tasks where recurrence_id = tests.u(811)), '2026-07-01'::date, 'fuseau: en UTC la première occurrence est le 1er juillet');

-- ═══ droits ═══
select tests.login(13);
select throws_ok($$select public.generate_all_recurrences()$$, '42501', null, 'droits: un enfant ne peut pas lancer la génération');
select throws_ok($$select public.sync_recurrence(tests.u(801))$$, '42501', null, 'droits: ni la synchronisation');
select is(tests.n($$update public.recurrences set title = 'Hack' where id = tests.u(801)$$), 0::bigint, 'droits: un enfant ne modifie pas la récurrence (0 ligne)');
select tests.login(21);
select is(tests.n($$update public.recurrences set title = 'Hack' where id = tests.u(801)$$), 0::bigint, 'droits: pas de modification inter-familles');

select * from finish();
rollback;
