-- D-084 : l'écran « Ôn tập » lit le maximum du barème (max_points) et ce que le quiz a déjà rapporté (points_awarded) dans les RPC existantes, sans recoder le barème.
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
insert into public.catalog_quizzes (id, country, grade, subject, week_label, title, status, release_on, due_on) values
  (tests.u(701), 'VN', '5', 'hist_geo', 'Tuần 1', 'Văn Lang', 'published', date '2026-10-05', date '2026-10-11'),
  (tests.u(702), 'VN', '5', 'maths', 'Tuần 1', 'Phân số', 'published', date '2026-10-05', date '2026-10-11'),
  (tests.u(703), 'VN', '5', 'anglais', 'Tuần 1', 'English', 'published', date '2026-10-05', date '2026-10-11');
insert into public.catalog_questions (quiz_id, position, prompt, choices) values
  (tests.u(701), 0, 'Q1', array['a','b','c','d']), (tests.u(702), 0, 'Q1', array['a','b','c','d']), (tests.u(703), 0, 'Q1', array['a','b','c','d']);
update public.children set country = 'VN', grade = '5' where id in (tests.u(201), tests.u(202));
insert into public.child_subjects (child_id, family_id, subject) values
  (tests.u(201), tests.u(1), 'hist_geo'), (tests.u(201), tests.u(1), 'maths'), (tests.u(201), tests.u(1), 'anglais'), (tests.u(202), tests.u(1), 'hist_geo'), (tests.u(202), tests.u(1), 'maths');
select * from no_plan();


-- ───────────── maximum du barème : lu de la MÊME fonction que le crédit ─────────────
select tests.login(13);
select is((select max_points from public.child_catalog_quizzes() where quiz_id = tests.u(701)), 8, 'enfant : max_points = 8');
select is((select max_points from public.child_catalog_quizzes() where quiz_id = tests.u(701)), tests.val('select public.quiz_points_for(16, 16)')::int, '…égal au barème à 100 % (même fonction que le crédit)');
select is((select points_awarded from public.child_catalog_quizzes() where quiz_id = tests.u(701)), 0, 'enfant : rien rapporté avant validation (0, jamais null)');
select tests.login(11);
select is((select max_points from public.parent_catalog_overview(tests.u(201)) where quiz_id = tests.u(701)), 8, 'parent : max_points = 8');
select is((select points_awarded from public.parent_catalog_overview(tests.u(201)) where quiz_id = tests.u(701)), 0, 'parent : rien rapporté avant validation');

-- ───────────── ce que le quiz a rapporté ─────────────
reset role;
select tests.submitted(801, 1, 201, 701, 49, 100);
select tests.submitted(802, 1, 201, 702, 50, 100);
select tests.submitted(803, 1, 202, 701, 79, 100);
select tests.login(11);
select lives_ok($$select public.validate_quiz_attempt(tests.u(801), false)$$, '49 % validé');
select lives_ok($$select public.validate_quiz_attempt(tests.u(802), false)$$, '50 % validé');
select lives_ok($$select public.validate_quiz_attempt(tests.u(803), false)$$, '79 % validé');
select tests.login(13);
select is((select points_awarded from public.child_catalog_quizzes() where quiz_id = tests.u(701)), 0, '49 % : +0');
select is((select points_awarded from public.child_catalog_quizzes() where quiz_id = tests.u(702)), 5, '50 % : +5');
-- relance à 90 % après 49 % : le quiz rapporte 8 ; une 3e tentative à 100 % ne s'ajoute pas
reset role;
select tests.submitted(805, 1, 201, 701, 90, 100);
select tests.submitted(806, 1, 201, 701, 100, 100);
select tests.login(11);
select lives_ok($$select public.validate_quiz_attempt(tests.u(805), false)$$, 'relance à 90 % validée');
select lives_ok($$select public.validate_quiz_attempt(tests.u(806), false)$$, '3e tentative à 100 % validée');
select tests.login(13);
select is((select points_awarded from public.child_catalog_quizzes() where quiz_id = tests.u(701)), 8, 'le quiz a rapporté 8 en tout (la 3e tentative n''ajoute rien)');
select is((select points_awarded from public.child_catalog_quizzes() where quiz_id = tests.u(702)), 5, 'les autres quiz restent à part');
select is((select sum(points_awarded)::int from public.child_catalog_quizzes()), 13, 'total des « +N » = solde de l''enfant (5 + 8)');
select tests.login(11);
select is((select points_awarded from public.parent_catalog_overview(tests.u(201)) where quiz_id = tests.u(701)), 8, 'parent : le même chiffre pour SON enfant');

-- ───────────── isolation (D-052) ─────────────
select tests.login(14);
select is((select points_awarded from public.child_catalog_quizzes() where quiz_id = tests.u(701)), 5, 'frère B : ses propres points (79 % = 5), pas ceux de A');
select is((select count(*)::int from public.child_catalog_quizzes() where points_awarded = 8), 0, 'B ne voit aucun chiffre de A');
select throws_ok($$select * from public.parent_catalog_overview(tests.u(201))$$, '42501', 'forbidden', 'un enfant ne peut pas lire l''aperçu parent');
select tests.login(21);
select throws_ok($$select * from public.parent_catalog_overview(tests.u(201))$$, 'P0002', 'child_not_found', 'parent d''une autre famille : refusé');
select throws_ok($$select * from public.child_catalog_quizzes()$$, '42501', 'forbidden', 'un parent n''a pas l''aperçu enfant');
select tests.login(23);
select is((select count(*)::int from public.child_catalog_quizzes()), 0, 'enfant d''une autre famille (sans classe) : rien');

-- ───────────── droits ─────────────
reset role;
select ok(not has_function_privilege('anon', 'public.child_catalog_quizzes()', 'execute'), 'anon : aucun accès (enfant)');
select ok(not has_function_privilege('anon', 'public.parent_catalog_overview(uuid)', 'execute'), 'anon : aucun accès (parent)');
select ok(has_function_privilege('authenticated', 'public.child_catalog_quizzes()', 'execute'), 'authenticated : accès (la fonction décide)');
select ok(has_function_privilege('authenticated', 'public.parent_catalog_overview(uuid)', 'execute'), 'authenticated : accès (la fonction décide)');

select * from finish();
rollback;
