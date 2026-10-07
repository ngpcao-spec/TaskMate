-- D-054 « Renouveler » : fin de série (ends_on, bornes incluses), jours ISO 1–7 (jeudi = 4 = Thursday, jamais 3), série créée par
-- un parent pour un ou plusieurs enfants, et ce qu'un enfant / un parent d'une autre famille ne peuvent PAS faire.
-- Dates fixes : le lundi 6 juillet 2026 démarre une semaine ; le 2 juillet 2026 est un jeudi. Fuseau famille : Asia/Ho_Chi_Minh.
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
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, email, is_anonymous) values (tests.u(11), 'p1@test', false), (tests.u(13), null, false), (tests.u(21), 'pb@test', false);
insert into public.families (id, name, timezone) values (tests.u(1), 'A', 'Asia/Ho_Chi_Minh'), (tests.u(2), 'B', 'Asia/Ho_Chi_Minh');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2009-03-01'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01'), (tests.u(221), tests.u(2), 'Cam', '2012-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'),
  (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'Cha B');
select * from no_plan();

-- 1) chaque jour ISO correspond au bon nom (garde-fou contre tout décalage d'un jour)
select is(to_char(d, 'FMDay'), n, format('ISO %s = %s', i, n))
from (values (1, 'Monday', date '2026-06-29'), (2, 'Tuesday', date '2026-06-30'), (3, 'Wednesday', date '2026-07-01'), (4, 'Thursday', date '2026-07-02'),
             (5, 'Friday', date '2026-07-03'), (6, 'Saturday', date '2026-07-04'), (7, 'Sunday', date '2026-07-05')) as t(i, n, d)
where extract(isodow from d)::int = i;
select is((select count(*)::int from (values (1, date '2026-06-29'), (2, date '2026-06-30'), (3, date '2026-07-01'), (4, date '2026-07-02'),
             (5, date '2026-07-03'), (6, date '2026-07-04'), (7, date '2026-07-05')) as t(i, d) where extract(isodow from d)::int = i), 7, 'les 7 jours ISO concordent');

-- 2) un parent crée deux séries (une par enfant) « jeudi », 4 semaines : du 2 au 29 juillet inclus (fin = début + 7·4 − 1)
select tests.login(11);
select lives_ok($$insert into public.recurrences (id, family_id, child_id, title, time_kind, start_time, end_time, rule, weekdays, starts_on, ends_on, created_by, points, category, note)
  values (tests.u(901), tests.u(1), tests.u(201), 'Piano', 'range', '08:00', '08:45', 'weekdays', array[4], '2026-07-02', '2026-07-29', tests.u(111), 15, 'personal', 'Gamme'),
         (tests.u(902), tests.u(1), tests.u(202), 'Piano', 'range', '08:00', '08:45', 'weekdays', array[4], '2026-07-02', '2026-07-29', tests.u(111), 15, 'personal', 'Gamme')$$,
  'parent: crée une série par enfant, avec fin de série');
reset role;
select is(public.generate_recurrence(tests.u(901), timestamptz '2026-07-01 18:30:00+00'), 2, 'jeudi: 14 premiers jours = 2 occurrences (les 2 et 9)');
select is(public.generate_recurrence(tests.u(901), timestamptz '2026-07-15 18:30:00+00'), 2, 'avancée de 2 semaines: les 16 et 23 (le 30 dépasse la fin du 29)');
select is(public.generate_recurrence(tests.u(901), timestamptz '2026-07-22 18:30:00+00'), 0, 'fin atteinte: rien après le 29 juillet (le 30 est un jeudi mais hors série)');
select is((select array_agg(date order by date) from public.tasks where recurrence_id = tests.u(901)),
          array[date '2026-07-02', date '2026-07-09', date '2026-07-16', date '2026-07-23'], 'série finie: 4 jeudis exactement');
select is((select count(*)::int from public.tasks where recurrence_id = tests.u(901) and extract(isodow from date)::int <> 4), 0, 'jamais un autre jour que jeudi (ISO 4, pas 3)');
select is(public.generate_recurrence(tests.u(902), timestamptz '2026-07-01 18:30:00+00'), 2, 'second enfant: sa propre série, ses propres tâches');
select is((select count(*)::int from public.tasks where recurrence_id = tests.u(902) and child_id = tests.u(202)), 2, 'les tâches du second enfant lui appartiennent');
select is((select count(*)::int from public.tasks where recurrence_id = tests.u(901) and child_id = tests.u(201)), 4, 'les tâches du premier enfant lui appartiennent');
-- les occurrences reprennent titre, catégorie, points, note, plage horaire, et repartent « à faire »
select is((select count(*)::int from public.tasks where recurrence_id = tests.u(901) and title = 'Piano' and category = 'personal' and points = 15 and note = 'Gamme'
           and start_time = '08:00' and end_time = '08:45' and completed_at is null and validated_at is null and rejection_note is null), 4, 'occurrences: mêmes champs, état « à faire »');

-- 3) série à jours multiples (lundi + jeudi) bornée : bornes de début ET de fin incluses
insert into public.recurrences (id, family_id, child_id, title, time_kind, rule, weekdays, starts_on, ends_on, created_by)
values (tests.u(903), tests.u(1), tests.u(201), 'LJ', 'anytime', 'weekdays', array[1, 4], '2026-07-06', '2026-07-09', tests.u(111));
select is(public.generate_recurrence(tests.u(903), timestamptz '2026-07-05 18:30:00+00'), 2, 'lundi 6 (début inclus) et jeudi 9 (fin incluse)');
select is((select array_agg(date order by date) from public.tasks where recurrence_id = tests.u(903)), array[date '2026-07-06', date '2026-07-09'], 'bornes incluses');

-- 4) raccourcir une série retire les occurrences futures non faites au-delà de la nouvelle fin ; le fait reste
select tests.login(11);
select lives_ok($$update public.recurrences set ends_on = '2026-07-09' where id = tests.u(901)$$, 'parent: raccourcit la fin de série');
reset role;
-- le déclencheur s'exécute au jour réel ; on rejoue la synchronisation à une date fixe (le 10 juillet, heure locale famille)
select public.sync_recurrence(tests.u(901), timestamptz '2026-07-10 00:00:00+07');
select is((select count(*)::int from public.tasks where recurrence_id = tests.u(901) and deleted_at is null and date > '2026-07-09'), 0,
          'après raccourcissement: plus d''occurrence active après le 9 juillet (les futurs 16 et 23 retirés)');

-- 5) négatifs
select tests.login(13);
select throws_ok($$insert into public.recurrences (family_id, child_id, title, time_kind, rule, weekdays, starts_on, created_by)
  values (tests.u(1), tests.u(201), 'Enfant', 'anytime', 'weekdays', array[4], '2026-07-02', tests.u(113))$$, '42501', null, 'un enfant ne crée pas de série');
select lives_ok($$update public.recurrences set ends_on = '2030-01-01' where id = tests.u(901)$$, 'enfant: la mise à jour ne lève rien mais ne touche aucune ligne (RLS)');
reset role;
select is((select ends_on from public.recurrences where id = tests.u(901)), date '2026-07-09', 'un enfant ne modifie pas la fin d''une série');
select tests.login(13);
select tests.login(21);
select throws_ok($$insert into public.recurrences (family_id, child_id, title, time_kind, rule, weekdays, starts_on, created_by)
  values (tests.u(2), tests.u(201), 'Autre famille', 'anytime', 'weekdays', array[4], '2026-07-02', tests.u(121))$$, '23503', null, 'un parent ne cible pas l''enfant d''une autre famille');
select is((select count(*)::int from public.recurrences), 0, 'un parent d''une autre famille ne voit aucune série de la famille A');
select tests.login(11);
select throws_ok($$insert into public.recurrences (family_id, child_id, title, time_kind, rule, weekdays, starts_on, created_by)
  values (tests.u(1), tests.u(201), 'Jour 0', 'anytime', 'weekdays', array[0], '2026-07-02', tests.u(111))$$, '23514', null, 'jour 0 refusé (ISO 1–7)');
select throws_ok($$insert into public.recurrences (family_id, child_id, title, time_kind, rule, weekdays, starts_on, created_by)
  values (tests.u(1), tests.u(201), 'Jour 8', 'anytime', 'weekdays', array[8], '2026-07-02', tests.u(111))$$, '23514', null, 'jour 8 refusé (ISO 1–7)');
select throws_ok($$insert into public.recurrences (family_id, child_id, title, time_kind, rule, weekdays, starts_on, created_by)
  values (tests.u(1), tests.u(201), 'Vide', 'anytime', 'weekdays', array[]::int[], '2026-07-02', tests.u(111))$$, '23514', null, 'série « jours choisis » sans jour refusée');

select * from finish();
rollback;
