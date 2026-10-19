-- D-089 : détail d'un quiz du catalogue pour le PARENT (parent_quiz_detail) : droits, attribution à l'enfant, ordre d'origine des choix, réponse de l'enfant mappée.
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
create function tests.m() returns date language sql stable security definer as $$ select date_trunc('week', public.family_today(tests.u(1))::timestamp)::date $$;
grant execute on function tests.m() to authenticated, anon, service_role;

-- 701 : quiz ouvert, 3 questions (ids fixes pour poser une disposition connue) ; 703 brouillon ; 704 pas encore ouvert ; 705 matière non activée ; 706 autre classe
insert into public.catalog_quizzes (id, country, grade, subject, week_label, title, status, release_on, due_on) values
  (tests.u(701), 'VN', '7', 'hist_geo', 'Tuần 1', 'Văn Lang', 'published', tests.m(), tests.m() + 6),
  (tests.u(703), 'VN', '7', 'hist_geo', 'Tuần 3', 'Brouillon', 'draft', tests.m(), tests.m() + 6),
  (tests.u(704), 'VN', '7', 'hist_geo', 'Tuần 4', 'Futur', 'published', tests.m() + 14, tests.m() + 20),
  (tests.u(705), 'VN', '7', 'maths', 'Tuần 1', 'Toán', 'published', tests.m(), tests.m() + 6),
  (tests.u(706), 'VN', '8', 'hist_geo', 'Tuần 1', 'Lớp 8', 'published', tests.m(), tests.m() + 6);
insert into public.catalog_questions (id, quiz_id, position, prompt, choices, needs_figure) values
  (tests.u(7011), tests.u(701), 0, 'Q1', array['a1','b1','c1','d1'], false),
  (tests.u(7012), tests.u(701), 1, 'Q2', array['a2','b2','c2','d2'], true),
  (tests.u(7013), tests.u(701), 2, 'Q3', array['a3','b3','c3','d3'], false),
  (tests.u(7031), tests.u(703), 0, 'Q', array['a','b','c','d'], false),
  (tests.u(7041), tests.u(704), 0, 'Q', array['a','b','c','d'], false),
  (tests.u(7051), tests.u(705), 0, 'Q', array['a','b','c','d'], false),
  (tests.u(7061), tests.u(706), 0, 'Q', array['a','b','c','d'], false);
insert into public.catalog_answer_keys (question_id, correct_index, explanation, to_verify, confirmed) values
  (tests.u(7011), 2, 'Vì c1', false, true), (tests.u(7012), 1, 'Vì b2', false, true), (tests.u(7013), 0, 'Vì a3', true, false),
  (tests.u(7031), 0, null, false, true), (tests.u(7041), 0, null, false, true), (tests.u(7051), 0, null, false, true), (tests.u(7061), 0, null, false, true);
update public.children set country = 'VN', grade = '7' where id in (tests.u(201), tests.u(202));
insert into public.child_subjects (child_id, family_id, subject) values (tests.u(201), tests.u(1), 'hist_geo'), (tests.u(202), tests.u(1), 'hist_geo');
-- disposition CONNUE d'une tentative (le mélange réel est aléatoire) : le test fixe la permutation affichée
create function tests.set_layout(att int) returns void language plpgsql security definer as $$
begin
  update public.quiz_attempt_layouts set layout = jsonb_build_object(
    'order', jsonb_build_array(tests.u(7013), tests.u(7011), tests.u(7012)),
    'choices', jsonb_build_object(tests.u(7011)::text, '[2,0,3,1]'::jsonb, tests.u(7012)::text, '[1,3,0,2]'::jsonb, tests.u(7013)::text, '[3,1,0,2]'::jsonb))
  where attempt_id = tests.u(att);
end $$;
grant execute on function tests.set_layout(int) to authenticated, anon, service_role;
select * from no_plan();

-- ───────────── droits : qui peut lire le détail ─────────────
select tests.login(11);
select lives_ok($$select public.parent_quiz_detail(tests.u(201), tests.u(701))$$, 'parent de la famille : lecture du quiz ouvert de SON enfant');
select is(jsonb_array_length(public.parent_quiz_detail(tests.u(201), tests.u(701))->'questions'), 3, '3 questions');
select is(public.parent_quiz_detail(tests.u(201), tests.u(701))->'attempt', 'null'::jsonb, 'pas commencé : aucune tentative');
select is((public.parent_quiz_detail(tests.u(201), tests.u(701))->'questions'->0->>'correct_index')::int, 2, 'aperçu : la bonne réponse est donnée au parent');
select is(public.parent_quiz_detail(tests.u(201), tests.u(701))->'questions'->0->'choices', '["a1","b1","c1","d1"]'::jsonb, 'choix dans l''ORDRE D''ORIGINE du catalogue');
select is(public.parent_quiz_detail(tests.u(201), tests.u(701))->'questions'->0->'choice_index', 'null'::jsonb, 'pas de réponse de l''enfant : null');
select is(public.parent_quiz_detail(tests.u(201), tests.u(701))->'questions'->1->>'needs_figure', 'true', 'drapeau « cần hình » transmis');
select is(public.parent_quiz_detail(tests.u(201), tests.u(701))->'questions'->2->>'to_verify', 'true', 'drapeau « à vérifier » transmis (parent seulement)');
select is(public.parent_quiz_detail(tests.u(201), tests.u(701))->'quiz'->>'release_on', tests.m()::text, 'dates effectives du quiz');
select is((public.parent_quiz_detail(tests.u(201), tests.u(701))->'quiz'->>'max_points')::int, tests.val('select public.quiz_points_for(1, 1)::text')::int, 'maximum du barème lu du serveur');

select throws_ok($$select public.parent_quiz_detail(tests.u(201), tests.u(703))$$, '42501', 'forbidden', 'quiz NON publié : refusé');
select throws_ok($$select public.parent_quiz_detail(tests.u(201), tests.u(704))$$, '42501', 'forbidden', 'quiz pas encore ouvert : refusé');
select throws_ok($$select public.parent_quiz_detail(tests.u(201), tests.u(705))$$, '42501', 'forbidden', 'matière non activée pour cet enfant : refusé');
select throws_ok($$select public.parent_quiz_detail(tests.u(201), tests.u(706))$$, '42501', 'forbidden', 'autre classe : refusé');
select throws_ok($$select public.parent_quiz_detail(tests.u(201), tests.u(999))$$, '42501', 'forbidden', 'quiz inconnu : refusé (même réponse)');
select throws_ok($$select public.parent_quiz_detail(tests.u(203), tests.u(701))$$, '42501', 'forbidden', 'enfant d''une AUTRE famille : refusé');
select throws_ok($$select public.parent_quiz_detail(tests.u(999), tests.u(701))$$, '42501', 'forbidden', 'enfant inconnu : refusé');
select tests.login(21);
select throws_ok($$select public.parent_quiz_detail(tests.u(201), tests.u(701))$$, '42501', 'forbidden', 'parent d''une autre famille : refusé');
select tests.login(13);
select throws_ok($$select public.parent_quiz_detail(tests.u(201), tests.u(701))$$, '42501', 'forbidden', 'enfant : refusé, y compris SON propre quiz');
select tests.login(14);
select throws_ok($$select public.parent_quiz_detail(tests.u(201), tests.u(701))$$, '42501', 'forbidden', 'le frère : refusé');
select throws_ok($$select public.parent_quiz_detail(tests.u(202), tests.u(701))$$, '42501', 'forbidden', '…même pour son propre identifiant');
select throws_ok($$select question_id from public.catalog_answer_keys limit 1$$, '42501', null, 'la clé de réponses n''est pas lisible par un enfant');
select throws_ok($$select id from public.catalog_questions limit 1$$, '42501', null, 'les questions du catalogue ne sont pas lisibles en direct');
reset role;
set local role anon;
select throws_ok($$select public.parent_quiz_detail(tests.u(201), tests.u(701))$$, '42501', null, 'anonyme : refusé');
reset role;

-- ───────────── tentative EN COURS : la réponse est rendue en indice d'ORIGINE ─────────────
select tests.login(13);
select lives_ok($$select public.start_catalog_evaluation(tests.u(701), tests.u(801))$$, 'A démarre le quiz');
reset role;
select tests.set_layout(801);
select tests.login(13);
-- A voit : Q3, Q1, Q2 ; Q3 : position affichée 1 ; Q1 : position affichée 0
select lives_ok($$select public.save_quiz_progress(tests.u(801), tests.u(7013), 1)$$, 'A coche la 2e réponse affichée de Q3');
select lives_ok($$select public.save_quiz_progress(tests.u(801), tests.u(7011), 0)$$, 'A coche la 1re réponse affichée de Q1');
select tests.login(11);
select is(public.parent_quiz_detail(tests.u(201), tests.u(701))->'attempt'->>'status', 'in_progress', 'tentative en cours');
select is((public.parent_quiz_detail(tests.u(201), tests.u(701))->'attempt'->>'answered')::int, 2, 'đã trả lời 2');
select is((public.parent_quiz_detail(tests.u(201), tests.u(701))->'questions'->0->>'choice_index')::int, 2, 'Q1 : position affichée 0 → indice d''origine 2 (pas 0)');
select is(public.parent_quiz_detail(tests.u(201), tests.u(701))->'questions'->1->'choice_index', 'null'::jsonb, 'Q2 : non répondue');
select is((public.parent_quiz_detail(tests.u(201), tests.u(701))->'questions'->2->>'choice_index')::int, 1, 'Q3 : position affichée 1 → origine 1 (permutation [3,1,0,2])');
select is(public.parent_quiz_detail(tests.u(201), tests.u(701))->'questions'->0->'is_correct', 'null'::jsonb, 'en cours : aucune correction calculée');
select is(public.parent_quiz_detail(tests.u(201), tests.u(701))->'questions'->0->'choices', '["a1","b1","c1","d1"]'::jsonb, 'choix toujours dans l''ordre d''origine, jamais l''ordre mélangé');

-- ───────────── tentative ENVOYÉE : réponses finales, score, concordance avec parent_attempt_review ─────────────
select tests.login(13);
-- Q1 : affichée 0 → origine 2 (juste) ; Q2 : affichée 3 → origine 2 (faux, la bonne est 1) ; Q3 : progression (affichée 1 → origine 1, faux, la bonne est 0)
select lives_ok($$select public.submit_quiz_evaluation(tests.u(801), '[{"question_id":"00000000-0000-0000-0000-000000007011","choice":0},{"question_id":"00000000-0000-0000-0000-000000007012","choice":3}]'::jsonb)$$, 'A envoie');
select tests.login(11);
select is(public.parent_quiz_detail(tests.u(201), tests.u(701))->'attempt'->>'status', 'submitted', 'Cần duyệt');
select is((public.parent_quiz_detail(tests.u(201), tests.u(701))->'attempt'->>'score') || '/' || (public.parent_quiz_detail(tests.u(201), tests.u(701))->'attempt'->>'total'), '1/3', 'score 1/3');
select is((select string_agg(coalesce(x->>'choice_index', '-') || ':' || (x->>'is_correct'), ' ' order by (x->>'position')::int) from jsonb_array_elements(public.parent_quiz_detail(tests.u(201), tests.u(701))->'questions') x),
          '2:true 2:false 1:false', 'réponses de l''enfant en indice d''origine, avec leur justesse');
select is((select string_agg((x->>'question_id') || ':' || coalesce(x->>'choice_index', '-') || ':' || (x->>'correct_index'), ' ' order by x->>'question_id') from jsonb_array_elements(public.parent_quiz_detail(tests.u(201), tests.u(701))->'questions') x),
          (select string_agg((x->>'question_id') || ':' || coalesce(x->>'choice_index', '-') || ':' || (x->>'correct_index'), ' ' order by x->>'question_id') from jsonb_array_elements(public.parent_attempt_review(tests.u(801))->'questions') x),
          'parent_quiz_detail et parent_attempt_review donnent la MÊME réponse de l''enfant et la même clé');
select is((select string_agg(x->>'choices', '|' order by x->>'question_id') from jsonb_array_elements(public.parent_attempt_review(tests.u(801))->'questions') x),
          (select string_agg(x->>'choices', '|' order by x->>'question_id') from jsonb_array_elements(public.parent_quiz_detail(tests.u(201), tests.u(701))->'questions') x),
          'parent_attempt_review rend aussi les choix dans l''ordre d''origine');
select is(public.parent_quiz_detail(tests.u(201), tests.u(701))->'attempt'->'show_correction', 'false', 'correction visible pour l''enfant : pas encore décidée');

-- ───────────── tentative VALIDÉE : points, correction ─────────────
select lives_ok($$select public.validate_quiz_attempt(tests.u(801), true)$$, 'le parent valide (correction visible)');
select is(public.parent_quiz_detail(tests.u(201), tests.u(701))->'attempt'->>'status', 'validated', 'Đã duyệt');
select is(public.parent_quiz_detail(tests.u(201), tests.u(701))->'attempt'->>'show_correction', 'true', 'correction visible mémorisée');
select is(public.parent_quiz_detail(tests.u(201), tests.u(701))->'attempt'->'points_awarded', 'null'::jsonb, '1/3 : aucun point (barème serveur)');
reset role;
select tests.submitted(802, 1, 202, 701, 3, 3);
select tests.login(11);
select lives_ok($$select public.validate_quiz_attempt(tests.u(802), false)$$, 'validation d''un 3/3');
select is((public.parent_quiz_detail(tests.u(202), tests.u(701))->'attempt'->>'points_awarded')::int, 8, '3/3 : +8 points, lus de la tentative');
select is((public.parent_quiz_detail(tests.u(202), tests.u(701))->'attempt'->>'answered')::int, 0, 'tentative de fixture sans réponse : 0 répondue');

-- ───────────── lecture seule : rien n'a été écrit par la lecture ─────────────
select is((select count(*)::int from public.quiz_attempts where catalog_id = tests.u(701)), 2, 'la lecture n''a créé aucune tentative');

select * from finish();
rollback;
