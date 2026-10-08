-- D-062 « supports multiples », côté enfant : support papier, feuille de réponses seule, numéros d'origine, figures. Le jeu papier n'est jamais mélangé
-- (les lettres restent celles de la feuille), la feuille seule n'envoie QUE des lettres, et rien du côté « clé » (à vérifier, confirmée) n'atteint l'enfant.
-- Fixtures : famille 1 = parent 11, enfant A (user 13, profil 201), enfant B (user 14, profil 202) ; famille 2 = parent 21.
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
create function tests.confirm_all(p_set uuid) returns jsonb language sql stable as $$
  select jsonb_agg(jsonb_build_object('question_id', q.id, 'correct', k.correct_index)) from public.quiz_questions q join public.quiz_answer_keys k on k.question_id = q.id where q.set_id = p_set
$$;
grant execute on all functions in schema tests to authenticated, anon, service_role;

insert into auth.users (id, email, is_anonymous) values (tests.u(11), 'p1@test', false), (tests.u(13), null, false), (tests.u(14), null, false), (tests.u(21), 'pb@test', false);
insert into public.families (id, name, timezone) values (tests.u(1), 'A', 'Asia/Ho_Chi_Minh'), (tests.u(2), 'B', 'Asia/Ho_Chi_Minh');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2009-03-01'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'),
  (tests.u(114), tests.u(1), tests.u(14), 'child', tests.u(202), 'Khang'), (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'Cha B');
select * from no_plan();

-- ───────────── structure ─────────────
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'quiz_sets' and column_name in ('paper_support', 'answer_sheet_only')), 2, 'quiz_sets : support papier + feuille seule');
select ok(pg_get_function_result('public.child_quiz_questions(uuid)'::regprocedure) ~ 'origin_number' and pg_get_function_result('public.child_quiz_questions(uuid)'::regprocedure) ~ 'needs_figure', 'child_quiz_questions : numéro d''origine et figure');
select ok(pg_get_function_result('public.child_quiz_questions(uuid)'::regprocedure) !~ '(verify|confirmed|correct|explanation)', 'child_quiz_questions : JAMAIS « à vérifier », confirmée, clé ni explication');
select ok(pg_get_function_result('public.child_quiz_sets()'::regprocedure) ~ 'paper_support' and pg_get_function_result('public.child_quiz_sets()'::regprocedure) !~ '(verify|confirmed|kind)', 'child_quiz_sets : réglage papier, aucun drapeau de clé');

-- ───────────── parent : créer les jeux ─────────────
select tests.login(11);
-- 401 : examen avec corrigé ; numéros dans le désordre, une question sans numéro, une qui dépend d'une figure
select lives_ok($$select public.create_quiz_draft(tests.u(401), tests.u(201), 'Examen A', 'Toán', '[
  {"prompt":"Question douze","choices":["d12a","d12b","d12c","d12d"],"correct":2,"number":12},
  {"prompt":"Question trois","choices":["t3a","t3b","t3c","t3d"],"correct":0,"number":3,"needs_figure":true},
  {"prompt":"Question cinq","choices":["c5a","c5b","c5c"],"correct":1,"number":5},
  {"prompt":"Sans numéro","choices":["s1","s2","s3"],"correct":0}]'::jsonb, 'exam_key', false)$$, 'parent: examen avec corrigé');
select is((select paper_support from public.quiz_sets where id = tests.u(401)), true, 'un type examen est un support papier par défaut');
select is((select answer_sheet_only from public.quiz_sets where id = tests.u(401)), false, '…sans « feuille seule » par défaut');
-- 402 : examen, énoncé + choix
select lives_ok($$select public.create_quiz_draft(tests.u(402), tests.u(201), 'Examen B', null, '[
  {"prompt":"Deux","choices":["x","y","z","w"],"correct":3,"explanation":"pourquoi","number":2},
  {"prompt":"Un","choices":["p","q","r"],"correct":0,"number":1}]'::jsonb, 'exam', false)$$, 'parent: examen sans corrigé');
-- 403 : cours (pas papier)
select lives_ok($$select public.create_quiz_draft(tests.u(403), tests.u(201), 'Cours', null, '[{"prompt":"Capitale ?","choices":["Hanoï","Hué","Saïgon"],"correct":0},{"prompt":"Fleuve ?","choices":["Rouge","Noir","Blanc"],"correct":0}]'::jsonb, 'course', false)$$, 'parent: cours');
select is((select paper_support from public.quiz_sets where id = tests.u(403)), false, 'un cours n''est pas un support papier');

-- réglage papier : cohérence, jamais d''écriture directe
select throws_ok($$select public.set_quiz_paper_support(tests.u(401), false, true)$$, 'P0001', 'invalid_paper', '« feuille seule » exige le support papier');
select throws_ok($$select public.set_quiz_paper_support(tests.u(401), null, false)$$, 'P0001', 'invalid_paper', 'valeur nulle refusée');
select throws_ok($$update public.quiz_sets set paper_support = false where id = tests.u(401)$$, '42501', null, 'parent: pas d''écriture directe du réglage papier');
select throws_ok($$update public.quiz_sets set answer_sheet_only = true where id = tests.u(401)$$, '42501', null, 'parent: pas d''écriture directe de « feuille seule »');
select lives_ok($$select public.set_quiz_paper_support(tests.u(401), true, true)$$, 'parent: 401 en « feuille seule »');
select is((select answer_sheet_only from public.quiz_sets where id = tests.u(401)), true, '…enregistré');
select throws_ok($$insert into public.quiz_sets (id, family_id, child_id, title, created_by, paper_support) values (tests.u(499), tests.u(1), tests.u(201), 't', tests.u(111), true)$$, '42501', null, 'parent: pas d''insertion directe avec le réglage papier');

-- changer le type remet la valeur par défaut ; la copie garde le réglage
select lives_ok($$select public.set_quiz_material_kind(tests.u(403), 'exam')$$, 'cours → examen');
select is((select paper_support from public.quiz_sets where id = tests.u(403)), true, '…devient support papier');
select lives_ok($$select public.set_quiz_material_kind(tests.u(403), 'list')$$, 'examen → liste');
select is((select paper_support or answer_sheet_only from public.quiz_sets where id = tests.u(403)), false, '…plus de papier');
select lives_ok($$select public.copy_quiz_set(tests.u(401), tests.u(409), tests.u(202))$$, 'parent: copie de 401 pour B');
select is((select paper_support and answer_sheet_only from public.quiz_sets where id = tests.u(409)), true, 'la copie garde « papier » + « feuille seule »');
select lives_ok($$select public.set_quiz_paper_support(tests.u(401), true, true)$$, 'réglage rejoué : idempotent');

-- publication (les règles D-061 restent en vigueur)
select throws_ok($$select public.set_quiz_status(tests.u(401), 'published')$$, 'P0001', 'answers_to_verify', '401 : la question de la figure est à vérifier → refusé');
select lives_ok($$select public.confirm_quiz_answers(tests.u(401), tests.confirm_all(tests.u(401)))$$, '401 confirmé');
select lives_ok($$select public.confirm_quiz_answers(tests.u(402), tests.confirm_all(tests.u(402)))$$, '402 confirmé');
select lives_ok($$select public.set_quiz_status(tests.u(401), 'published')$$, '401 publié');
select lives_ok($$select public.set_quiz_status(tests.u(402), 'published')$$, '402 publié');
select throws_ok($$select public.set_quiz_paper_support(tests.u(401), false, false)$$, 'P0001', 'set_published', 'un jeu publié ne change plus de réglage papier');

-- ───────────── enfant A : liste, démarrage, feuille de réponses ─────────────
select tests.login(13);
select is((select count(*)::int from public.child_quiz_sets()), 2, 'A: voit SES deux jeux publiés');
select is((select paper_support and answer_sheet_only from public.child_quiz_sets() where set_id = tests.u(401)), true, 'A: 401 = papier + feuille seule');
select is((select paper_support and not answer_sheet_only from public.child_quiz_sets() where set_id = tests.u(402)), true, 'A: 402 = papier avec énoncés');
select lives_ok($$select public.start_quiz_evaluation(tests.u(401), tests.u(501))$$, 'A: démarre la feuille 401');
select is((select array_agg(origin_number order by "position") from public.child_quiz_questions(tests.u(501))), array[3, 5, 12, null]::int[], 'feuille : ordre des NUMÉROS d''origine, sans numéro à la suite');
select is((select array_agg(distinct prompt) from public.child_quiz_questions(tests.u(501))), array['']::text[], 'feuille seule : AUCUN énoncé n''est envoyé');
select is((select choices from public.child_quiz_questions(tests.u(501)) where origin_number = 3), array['A', 'B', 'C', 'D'], 'feuille seule : des lettres (jamais le texte des choix), dans l''ordre');
select is((select choices from public.child_quiz_questions(tests.u(501)) where origin_number = 5), array['A', 'B', 'C'], 'feuille seule : 3 choix → A à C');
select is((select needs_figure from public.child_quiz_questions(tests.u(501)) where origin_number = 3), true, '« dépend d''une figure » visible de l''enfant');
select is((select needs_figure from public.child_quiz_questions(tests.u(501)) where origin_number = 5), false, '…et seulement pour cette question');
-- stable : pas de mélange d'une lecture à l'autre
select is((select array_agg(origin_number order by "position") from public.child_quiz_questions(tests.u(501))), array[3, 5, 12, null]::int[], 'ordre identique à la relecture (aucun mélange)');
select lives_ok($$select public.submit_quiz_evaluation(tests.u(501), jsonb_build_array(
  jsonb_build_object('question_id', (select question_id from public.child_quiz_questions(tests.u(501)) where origin_number = 3), 'choice', 0),
  jsonb_build_object('question_id', (select question_id from public.child_quiz_questions(tests.u(501)) where origin_number = 5), 'choice', 1),
  jsonb_build_object('question_id', (select question_id from public.child_quiz_questions(tests.u(501)) where origin_number = 12), 'choice', 0),
  jsonb_build_object('question_id', (select question_id from public.child_quiz_questions(tests.u(501)) where origin_number is null), 'choice', null)))$$, 'A: envoie sa feuille (lettres = indices d''origine)');
select throws_ok($$select * from public.child_quiz_questions(tests.u(501))$$, 'P0001', 'attempt_closed', 'A: plus de relecture après l''envoi');

-- ───────────── enfant A : 402, énoncé + choix, SANS mélange ─────────────
select lives_ok($$select public.start_quiz_evaluation(tests.u(402), tests.u(502))$$, 'A: démarre 402');
select is((select array_agg(origin_number order by "position") from public.child_quiz_questions(tests.u(502))), array[1, 2], 'papier avec énoncés : par numéro');
select is((select prompt from public.child_quiz_questions(tests.u(502)) where origin_number = 1), 'Un', 'énoncé présent');
select is((select choices from public.child_quiz_questions(tests.u(502)) where origin_number = 2), array['x', 'y', 'z', 'w'], 'choix dans l''ORDRE d''origine (lettres de la feuille)');
select lives_ok($$select public.submit_quiz_evaluation(tests.u(502), jsonb_build_array(
  jsonb_build_object('question_id', (select question_id from public.child_quiz_questions(tests.u(502)) where origin_number = 1), 'choice', 0),
  jsonb_build_object('question_id', (select question_id from public.child_quiz_questions(tests.u(502)) where origin_number = 2), 'choice', 1)))$$, 'A: envoie 402');

-- ───────────── parent : valide ─────────────
select tests.login(11);
select lives_ok($$select public.validate_quiz_attempt(tests.u(501), false)$$, 'parent: valide la feuille 401 (correction masquée)');
select lives_ok($$select public.validate_quiz_attempt(tests.u(502), true)$$, 'parent: valide 402 avec correction');
select is((select score from public.quiz_results where attempt_id = tests.u(501)), 2, 'score 401 calculé côté serveur : 2 / 4');
select is((select score from public.quiz_results where attempt_id = tests.u(502)), 1, 'score 402 : 1 / 2');

-- ───────────── enfant A : résultats ─────────────
select tests.login(13);
select is((public.child_quiz_result(tests.u(501))->>'score')::int, 2, 'A: score 401 après validation');
select is((public.child_quiz_result(tests.u(501))->>'answer_sheet_only')::boolean, true, '…le résultat sait que c''est une feuille seule');
select is(jsonb_array_length(public.child_quiz_result(tests.u(501))->'missed'), 2, 'feuille : 2 questions ratées (une fausse, une sans réponse)');
select is((select i->>'prompt' from jsonb_array_elements(public.child_quiz_result(tests.u(501))->'missed') i where (i->>'number')::int = 12), '', 'feuille : aucun énoncé dans le résultat');
select is((select i->>'chosen_text' from jsonb_array_elements(public.child_quiz_result(tests.u(501))->'missed') i where (i->>'number')::int = 12), 'A', 'feuille : sa réponse est la LETTRE choisie');
select ok(public.child_quiz_result(tests.u(501))::text !~ '(correct_index|explanation|to_verify|confirmed)', 'feuille, correction masquée : ni bonne réponse, ni explication, ni drapeau');
select ok(public.child_quiz_result(tests.u(501))::text !~ 'Question (douze|trois|cinq)', 'feuille : aucun énoncé du support dans le résultat');
select is((select count(*)::int from jsonb_array_elements(public.child_quiz_result(tests.u(501))->'missed') i where i->>'prompt' <> ''), 0, 'feuille : tous les énoncés du résultat sont vides');
select is((public.child_quiz_result(tests.u(502))->>'show_correction')::boolean, true, 'A: 402 validé avec correction');
select is((select i->>'prompt' from jsonb_array_elements(public.child_quiz_result(tests.u(502))->'questions') i where (i->>'number')::int = 2), 'Deux', '402 : énoncé de la correction');
select is((select (i->>'correct_index')::int from jsonb_array_elements(public.child_quiz_result(tests.u(502))->'questions') i where (i->>'number')::int = 2), 3, '402 : bonne réponse = D (indice d''origine, non mélangé)');
select is((select i->>'explanation' from jsonb_array_elements(public.child_quiz_result(tests.u(502))->'questions') i where (i->>'number')::int = 2), 'pourquoi', '402 : explication visible une fois la correction activée');

-- ───────────── aucune fuite, aucun accès croisé ─────────────
select tests.login(14);
select is((select count(*)::int from public.child_quiz_sets()), 0, 'B: aucun jeu de A (sa propre copie est encore un brouillon, invisible)');
select throws_ok($$select * from public.child_quiz_questions(tests.u(501))$$, 'P0002', 'attempt_not_found', 'B: ne lit pas les questions de A');
select throws_ok($$select public.child_quiz_result(tests.u(501))$$, 'P0002', 'attempt_not_found', 'B: ne lit pas le résultat de A');
select throws_ok($$select public.child_quiz_result(tests.u(502))$$, 'P0002', 'attempt_not_found', 'B: ne lit pas la correction de A');
select is((select count(*)::int from public.quiz_sets), 0, 'B: aucun jeu lisible en table (brouillons et jeux de A)');
select is((select count(*)::int from public.quiz_questions), 0, 'B: aucune question lisible en table');
select is((select count(*)::int from public.quiz_answer_keys), 0, 'B: aucune clé lisible');
select throws_ok($$select public.set_quiz_paper_support(tests.u(409), true, false)$$, '42501', 'forbidden', 'B: ne règle pas le support papier');

-- A : lectures directes interdites, aucun réglage
select tests.login(13);
select is((select count(*)::int from public.quiz_questions), 0, 'A: aucune question lisible en table (numéros et figures passent par la RPC)');
select is((select count(*)::int from public.quiz_answer_keys), 0, 'A: aucune clé lisible (à vérifier / confirmée jamais visibles)');
select throws_ok($$select public.set_quiz_paper_support(tests.u(402), false, false)$$, '42501', 'forbidden', 'A: ne règle pas le support papier');
select throws_ok($$update public.quiz_sets set answer_sheet_only = false where id = tests.u(401)$$, '42501', null, 'A: pas d''écriture directe sur un jeu');

-- autre famille
select tests.login(21);
select throws_ok($$select public.set_quiz_paper_support(tests.u(409), true, true)$$, 'P0002', 'set_not_found', 'autre famille: ne règle pas un jeu de A');
select is((select count(*)::int from public.quiz_sets), 0, 'autre famille: ne voit aucun jeu');

-- anonyme
reset role;
set local role anon;
select throws_ok($$select public.set_quiz_paper_support(tests.u(409), true, true)$$, '42501', null, 'anon: set_quiz_paper_support refusé');
select throws_ok($$select * from public.child_quiz_sets()$$, '42501', null, 'anon: child_quiz_sets refusé');
select throws_ok($$select * from public.child_quiz_questions(tests.u(501))$$, '42501', null, 'anon: child_quiz_questions refusé');

select * from finish();
rollback;
