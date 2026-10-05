-- Jour de la semaine d'une récurrence : « T5 » (jeudi) = ISO 4, les occurrences tombent un JEUDI, jour local de la famille
-- (Asia/Ho_Chi_Minh, UTC+7), jamais décalées par l'UTC ni par le fuseau de la session. Dates fixes : 2026-07-02 est un jeudi.
begin;
create schema tests;
grant usage on schema tests to authenticated, anon;
create function tests.u(n int) returns uuid language sql immutable
  as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
insert into auth.users (id, email, is_anonymous) values (tests.u(11), 'p1@test', false);
insert into public.families (id, name, timezone) values (tests.u(1), 'A', 'Asia/Ho_Chi_Minh');
insert into public.children (id, family_id, name, birth_date) values (tests.u(201), tests.u(1), 'Minh', '2009-03-01');
insert into public.members (id, family_id, user_id, role, display_name) values (tests.u(111), tests.u(1), tests.u(11), 'parent', 'Ba');
select * from no_plan();

select is(extract(isodow from date '2026-07-02')::int, 4, 'repère: le 2 juillet 2026 est un jeudi (ISO 4)');
select is(to_char(date '2026-07-02', 'FMDay'), 'Thursday', 'repère: …et PostgreSQL le nomme Thursday');

-- série « jeudi » (ISO 4) bornée au passé réel de la suite → le déclencheur d'insertion (jour réel) ne génère rien
insert into public.recurrences (id, family_id, child_id, title, time_kind, rule, weekdays, starts_on, ends_on, created_by)
values (tests.u(901), tests.u(1), tests.u(201), 'Jeudi', 'anytime', 'weekdays', array[4], '2026-07-01', '2026-07-20', tests.u(111));
select is((select count(*)::int from public.tasks where recurrence_id = tests.u(901)), 0, 'repère: rien généré par le déclencheur (série terminée au regard du jour réel)');

-- 01:30 à Hô Chi Minh le jeudi 2 juillet (= mercredi 1er juillet 18:30 UTC) : fenêtre du 2 au 15 juillet
set local timezone = 'UTC';
select is(public.generate_recurrence(tests.u(901), timestamptz '2026-07-01 18:30:00+00'), 2, 'jeudi: 2 occurrences sur 14 jours');
select is((select array_agg(date order by date) from public.tasks where recurrence_id = tests.u(901)), array[date '2026-07-02', date '2026-07-09'], 'jeudi: les 2 et 9 juillet (le jour local, pas le 1er)');
select is((select count(*)::int from public.tasks where recurrence_id = tests.u(901) and extract(isodow from date)::int <> 4), 0, 'jeudi: chaque occurrence est un jeudi (ISO 4)');
select is((select count(*)::int from public.tasks where recurrence_id = tests.u(901) and to_char(date, 'FMDay') = 'Thursday'), 2, 'jeudi: chaque occurrence se nomme Thursday');

-- 17:00 UTC le 2 juillet = 00:00 le vendredi 3 juillet à Hô Chi Minh : la fenêtre glisse au 3, nouveau jeudi = le 16
select is(public.generate_recurrence(tests.u(901), timestamptz '2026-07-02 17:00:00+00'), 1, 'minuit local: seule la nouvelle occurrence (jeudi 16) est créée');
select is((select max(date) from public.tasks where recurrence_id = tests.u(901)), date '2026-07-16', 'minuit local: le 16 juillet (jeudi)');
-- 16:59 UTC le 2 juillet = 23:59 le jeudi 2 à Hô Chi Minh : encore jeudi local (en UTC aussi), rien de nouveau
select is(public.generate_recurrence(tests.u(901), timestamptz '2026-07-02 16:59:00+00'), 0, 'idempotence: relancer ne crée rien');

-- le fuseau de la SESSION ne décale rien (Los Angeles, Auckland)
delete from public.tasks where recurrence_id = tests.u(901);
set local timezone = 'America/Los_Angeles';
select is(public.generate_recurrence(tests.u(901), timestamptz '2026-07-01 18:30:00+00'), 2, 'session Los Angeles: mêmes 2 occurrences');
select is((select array_agg(date order by date) from public.tasks where recurrence_id = tests.u(901)), array[date '2026-07-02', date '2026-07-09'], 'session Los Angeles: toujours les 2 et 9 juillet (jeudis)');
delete from public.tasks where recurrence_id = tests.u(901);
set local timezone = 'Pacific/Auckland';
select is(public.generate_recurrence(tests.u(901), timestamptz '2026-07-01 18:30:00+00'), 2, 'session Auckland: mêmes 2 occurrences');
select is((select array_agg(date order by date) from public.tasks where recurrence_id = tests.u(901)), array[date '2026-07-02', date '2026-07-09'], 'session Auckland: toujours les 2 et 9 juillet (jeudis)');

-- plusieurs jours : lundi (1) et jeudi (4), tous les autres jours exclus
set local timezone = 'UTC';
insert into public.recurrences (id, family_id, child_id, title, time_kind, rule, weekdays, starts_on, ends_on, created_by)
values (tests.u(902), tests.u(1), tests.u(201), 'Lundi-jeudi', 'anytime', 'weekdays', array[1, 4], '2026-07-01', '2026-07-20', tests.u(111));
select is(public.generate_recurrence(tests.u(902), timestamptz '2026-07-01 18:30:00+00'), 4, 'lundi+jeudi: 4 occurrences (2 jeu, 6 lun, 9 jeu, 13 lun)');
select is((select array_agg(date order by date) from public.tasks where recurrence_id = tests.u(902)), array[date '2026-07-02', date '2026-07-06', date '2026-07-09', date '2026-07-13'], 'lundi+jeudi: 2, 6, 9 et 13 juillet');

select * from finish();
rollback;
