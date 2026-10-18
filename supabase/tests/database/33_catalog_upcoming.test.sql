-- D-086 : semaines futures de l'écran « Ôn tập » : métadonnées SEULES des quiz pas encore ouverts (catalog_upcoming_for_child), jamais le contenu.
-- Fixtures : famille 1 = parent 11, enfant A (user 13, profil 201), enfant B (user 14, profil 202) ; famille 2 = parent 21, enfant C (user 23, profil 203).
begin;
create schema tests;
grant usage on schema tests to authenticated, anon, service_role;
create function tests.u(n int) returns uuid language sql immutable
  as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create function tests.login(n int) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', tests.u(n)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
end $$;
create function tests.val(q text) returns text language plpgsql security definer as $$
declare r text;
begin execute q into r; return r; end $$;
-- tentative SOUMISE d'un enfant sur un quiz du catalogue, avec son résultat (fixture posée par le propriétaire de la base)
create function tests.submitted(att int, fam int, child int, quiz int, sc int, tt int) returns void language plpgsql security definer as $$
begin
  insert into public.quiz_attempts (id, family_id, child_id, catalog_id, status, submitted_at) values (tests.u(att), tests.u(fam), tests.u(child), tests.u(quiz), 'submitted', now());
  insert into public.quiz_results (attempt_id, family_id, child_id, score, total) values (tests.u(att), tests.u(fam), tests.u(child), sc, tt);
end $$;
grant execute on all functions in schema tests to authenticated, anon, service_role;

insert into auth.users (id, email, is_anonymous) values (tests.u(11), 'p1@test', false), (tests.u(13), null, false), (tests.u(14), null, false), (tests.u(21), 'pb@test', false), (tests.u(23), null, false);
insert into public.families (id, name, timezone) values (tests.u(1), 'A', 'Asia/Ho_Chi_Minh'), (tests.u(2), 'B', 'Asia/Ho_Chi_Minh');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2009-03-01'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01'), (tests.u(203), tests.u(2), 'Lan', '2010-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'),
  (tests.u(114), tests.u(1), tests.u(14), 'child', tests.u(202), 'Khang'), (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'Cha B'),
  (tests.u(123), tests.u(2), tests.u(23), 'child', tests.u(203), 'Lan');
-- m = lundi de la semaine COURANTE (jour local de la famille) : les dates des fixtures en dérivent, le test ne dépend pas du jour où il tourne.
create function tests.m() returns date language sql stable security definer as $$ select date_trunc('week', public.family_today(tests.u(1))::timestamp)::date $$;
grant execute on function tests.m() to authenticated, anon, service_role;
insert into public.catalog_quizzes (id, country, grade, subject, week_label, title, status, release_on, due_on) values
  -- ouvert depuis le début de la semaine
  (tests.u(701), 'VN', '7', 'hist_geo', 'Tuần 1', 'Ouvert',        'published', tests.m(),      tests.m() + 6),
  -- semaine suivante : pas encore ouvert
  (tests.u(702), 'VN', '7', 'hist_geo', 'Tuần 2', 'Semaine +1',    'published', tests.m() + 7,  tests.m() + 13),
  -- dans deux semaines : visible du parent seulement
  (tests.u(703), 'VN', '7', 'hist_geo', 'Tuần 3', 'Semaine +2',    'published', tests.m() + 14, tests.m() + 20),
  -- autres cases : brouillon, autre classe, sans question, matière non activée
  (tests.u(704), 'VN', '7', 'hist_geo', 'Tuần 4', 'Brouillon',     'draft',     tests.m() + 7,  tests.m() + 13),
  (tests.u(705), 'VN', '6', 'hist_geo', 'Tuần 2', 'Autre classe',  'published', tests.m() + 7,  tests.m() + 13),
  (tests.u(706), 'VN', '7', 'hist_geo', 'Tuần 5', 'Sans question', 'published', tests.m() + 7,  tests.m() + 13),
  (tests.u(707), 'VN', '7', 'maths',    'Tuần 2', 'Maths',         'published', tests.m() + 7,  tests.m() + 13);
insert into public.catalog_questions (quiz_id, position, prompt, choices) values
  (tests.u(701), 0, 'Q1', array['a','b','c','d']), (tests.u(702), 0, 'Q1', array['a','b','c','d']), (tests.u(703), 0, 'Q1', array['a','b','c','d']),
  (tests.u(704), 0, 'Q1', array['a','b','c','d']), (tests.u(705), 0, 'Q1', array['a','b','c','d']), (tests.u(707), 0, 'Q1', array['a','b','c','d']);
update public.children set country = 'VN', grade = '7' where id = tests.u(201);
insert into public.child_subjects (child_id, family_id, subject) values (tests.u(201), tests.u(1), 'hist_geo');
select * from no_plan();

-- ───────────── enfant : SES quiz pas encore ouverts, une semaine d'avance au plus ─────────────
select tests.login(13);
select is((select array_agg(quiz_id order by release_on) from public.catalog_upcoming_for_child()), array[tests.u(702)], 'enfant A : seulement la semaine suivante (pas l''ouvert, pas la semaine +2)');
select is((select release_on from public.catalog_upcoming_for_child() where quiz_id = tests.u(702)), tests.m() + 7, '…ouverture effective');
select is((select due_on from public.catalog_upcoming_for_child() where quiz_id = tests.u(702)), tests.m() + 13, '…échéance effective');
select is((select max_points from public.catalog_upcoming_for_child() where quiz_id = tests.u(702)), tests.val('select public.quiz_points_for(16, 16)')::int, '…maximum du barème = même fonction que le crédit');
select is((select count(*)::int from public.catalog_upcoming_for_child() where quiz_id in (tests.u(704), tests.u(705), tests.u(706), tests.u(707))), 0, 'ni brouillon, ni autre classe, ni sans question, ni matière non activée');
select is((select count(*)::int from public.catalog_upcoming_for_child(tests.u(201))), 1, 'enfant : son propre identifiant accepté');
select throws_ok($$select * from public.catalog_upcoming_for_child(tests.u(202))$$, 'P0002', 'child_not_found', 'enfant : l''identifiant d''un frère/sœur est refusé');
select throws_ok($$select * from public.catalog_upcoming_for_child(tests.u(203))$$, 'P0002', 'child_not_found', 'enfant : l''identifiant d''une autre famille est refusé');

-- ───────────── structure : métadonnées seulement ─────────────
select is(pg_get_function_result('public.catalog_upcoming_for_child(uuid)'::regprocedure), 'TABLE(quiz_id uuid, subject text, week_label text, title text, release_on date, due_on date, max_points integer)', 'colonnes : métadonnées seulement');
select ok(pg_get_function_result('public.catalog_upcoming_for_child(uuid)'::regprocedure) !~* '(prompt|choice|correct|explanation|answer|key|confirm|verify|question|score|figure|source)', 'aucune colonne de question, de choix, de réponse, de corrigé ou de signalement');
select throws_ok($$select * from public.catalog_questions$$, '42501', null, 'enfant : questions du catalogue toujours illisibles');
select throws_ok($$select * from public.catalog_answer_keys$$, '42501', null, 'enfant : clés toujours illisibles');
select throws_ok($$select * from public.catalog_quizzes$$, '42501', null, 'enfant : table du catalogue toujours fermée');

-- ───────────── enfant sans classe ni matière : rien ─────────────
select tests.login(14);
select is((select count(*)::int from public.catalog_upcoming_for_child()), 0, 'enfant B (rien d''activé) : aucun quiz');
select throws_ok($$select * from public.catalog_upcoming_for_child(tests.u(201))$$, 'P0002', 'child_not_found', 'enfant B ne peut pas demander les quiz de A');

-- ───────────── parent : SES enfants, jusqu'à la dernière semaine publiée ─────────────
select tests.login(11);
select is((select array_agg(quiz_id order by release_on) from public.catalog_upcoming_for_child(tests.u(201))), array[tests.u(702), tests.u(703)], 'parent : semaine +1 ET semaine +2 de SON enfant');
select is((select count(*)::int from public.catalog_upcoming_for_child(tests.u(202))), 0, 'parent : un enfant sans matière activée → rien');
select throws_ok($$select * from public.catalog_upcoming_for_child()$$, 'P0002', 'child_not_found', 'parent : l''enfant est obligatoire');
select throws_ok($$select * from public.catalog_upcoming_for_child(tests.u(203))$$, 'P0002', 'child_not_found', 'parent : un enfant d''une autre famille est refusé');
select throws_ok($$select * from public.catalog_upcoming_for_child(tests.u(999))$$, 'P0002', 'child_not_found', 'parent : identifiant inconnu refusé');
select throws_ok($$select * from public.catalog_questions$$, '42501', null, 'parent : questions du catalogue toujours illisibles');

-- ───────────── décalage de l'enfant : dates effectives (7 × week_offset) ─────────────
select lives_ok($$select public.shift_child_subject(tests.u(201), 'hist_geo', 1)$$, 'parent : décale hist_geo d''une semaine pour A');
select is((select release_on from public.catalog_upcoming_for_child(tests.u(201)) where quiz_id = tests.u(702)), tests.m() + 14, 'décalage +1 : ouverture +7 jours');
select is((select due_on from public.catalog_upcoming_for_child(tests.u(201)) where quiz_id = tests.u(702)), tests.m() + 20, '…échéance +7 jours');
select is((select release_on from public.catalog_upcoming_for_child(tests.u(201)) where quiz_id = tests.u(701)), tests.m() + 7, 'le quiz ouvert devient « pas encore ouvert » (dates décalées)');
select tests.login(13);
select is((select array_agg(quiz_id order by release_on) from public.catalog_upcoming_for_child()), array[tests.u(701)], 'enfant A avec décalage : 701 (échéance m+13) oui ; 702 (échéance m+20) au-delà de la semaine suivante : non');
select tests.login(11);
select lives_ok($$select public.shift_child_subject(tests.u(201), 'hist_geo', -1)$$, 'retour à 0');

-- ───────────── autre famille ─────────────
select tests.login(21);
select throws_ok($$select * from public.catalog_upcoming_for_child(tests.u(201))$$, 'P0002', 'child_not_found', 'autre famille : refusé');
select tests.login(23);
select is((select count(*)::int from public.catalog_upcoming_for_child()), 0, 'enfant d''une autre famille : rien (sa propre classe n''est pas réglée)');

-- ───────────── droits ─────────────
reset role;
select ok(not has_function_privilege('anon', 'public.catalog_upcoming_for_child(uuid)', 'execute'), 'anon : aucun accès');
select ok(has_function_privilege('authenticated', 'public.catalog_upcoming_for_child(uuid)', 'execute'), 'authenticated : accès (la fonction décide)');
set local role anon;
select throws_ok($$select * from public.catalog_upcoming_for_child(tests.u(201))$$, '42501', null, 'anon : refusé');
reset role;

select * from finish();
rollback;
