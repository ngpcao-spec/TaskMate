-- D-080 côté FAMILLE du catalogue : classe de l'enfant (parent seul), matières activées, décalage ±1 semaine (borné), distribution à l'enfant (publié + classe + pays
-- + matière activée + jour LOCAL), évaluation (progression, envoi, validation), clés visibles du parent UNIQUEMENT pour une tentative soumise de SON enfant,
-- jamais pour l'enfant ; la date limite ne bloque jamais ; dépublier ne supprime aucune tentative ; aucune donnée de frère/sœur.
-- Fixtures : famille 1 = parent 11 (ADMIN), enfant A (user 13, profil 201), enfant B (user 14, profil 202) ; famille 2 = parent 21, enfant C (user 23, profil 203).
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
create function tests.today(fam int) returns date language sql stable security definer as $$ select public.family_today(tests.u(fam)) $$;
create function tests.val(q text) returns text language plpgsql security definer as $$
declare r text;
begin execute q into r; return r; end $$;
-- position AFFICHÉE d'un choix dans une question de la tentative, d'après son texte
create function tests.pos(p_attempt uuid, p_prompt text, p_choice text) returns int language sql stable as $$
  select array_position(choices, p_choice) - 1 from public.child_quiz_questions(p_attempt) where prompt = p_prompt
$$;
create function tests.qid(p_attempt uuid, p_prompt text) returns uuid language sql stable as $$
  select question_id from public.child_quiz_questions(p_attempt) where prompt = p_prompt
$$;
grant execute on all functions in schema tests to authenticated, anon, service_role;

insert into auth.users (id, email, is_anonymous) values (tests.u(11), 'admin@test', false), (tests.u(13), null, false), (tests.u(14), null, false), (tests.u(21), 'pb@test', false), (tests.u(23), null, false);
insert into public.families (id, name, timezone) values (tests.u(1), 'A', 'Asia/Ho_Chi_Minh'), (tests.u(2), 'B', 'Asia/Ho_Chi_Minh');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2009-03-01'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01'), (tests.u(203), tests.u(2), 'Lan', '2010-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'),
  (tests.u(114), tests.u(1), tests.u(14), 'child', tests.u(202), 'Khang'), (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'Cha B'),
  (tests.u(123), tests.u(2), tests.u(23), 'child', tests.u(203), 'Lan');
insert into public.platform_admins (user_id) values (tests.u(11));
select * from no_plan();

-- ───────────── catalogue préparé par l'admin ─────────────
select tests.login(11);
select lives_ok($$select public.create_catalog_draft(tests.u(701), 'VN', '5', 'hist_geo', 'Tuần 1', 'Lịch sử 1', '[
  {"prompt":"Capitale ?","choices":["Hà Nội","Huế","Sài Gòn"],"correct":0,"explanation":"Hà Nội est la capitale"},
  {"prompt":"Fleuve ?","choices":["Rouge","Noir","Blanc","Vert"],"correct":0},
  {"prompt":"Océan ?","choices":["Pacifique","Atlantique","Indien"],"correct":1}]'::jsonb)$$, '701 : VN / 5 / hist_geo (publié ensuite)');
select lives_ok($$select public.create_catalog_draft(tests.u(702), 'VN', '5', 'maths', 'Tuần 1', 'Toán 1', '[{"prompt":"1+1","choices":["1","2","3"],"correct":1}]'::jsonb)$$, '702 : maths, futur');
select lives_ok($$select public.create_catalog_draft(tests.u(703), 'VN', '5', 'hist_geo', 'Tuần 2', 'Brouillon', '[{"prompt":"x","choices":["a","b","c"],"correct":0}]'::jsonb)$$, '703 : brouillon');
select lives_ok($$select public.create_catalog_draft(tests.u(704), 'FR', '5E', 'hist_geo', 'Tuần 1', 'Autre pays', '[{"prompt":"x","choices":["a","b","c"],"correct":0}]'::jsonb)$$, '704 : FR');
select lives_ok($$select public.create_catalog_draft(tests.u(705), 'VN', '6', 'hist_geo', 'Tuần 1', 'Autre classe', '[{"prompt":"x","choices":["a","b","c"],"correct":0}]'::jsonb)$$, '705 : classe 6');
select lives_ok($$select public.create_catalog_draft(tests.u(706), 'VN', '5', 'anglais', 'Tuần 1', 'English', '[{"prompt":"x","choices":["a","b","c"],"correct":0}]'::jsonb)$$, '706 : anglais (non activé)');
select lives_ok($$select public.create_catalog_draft(tests.u(707), 'VN', '5', 'hist_geo', 'Tuần 3', 'Lịch sử 3', '[{"prompt":"y","choices":["a","b","c"],"correct":2}]'::jsonb)$$, '707 : hist_geo semaine 3 (futur)');
select lives_ok($$select public.create_catalog_draft(tests.u(708), 'VN', '5', 'hist_geo', 'Tuần 4', 'Lịch sử 4 (papier)', '[
  {"prompt":"p1","choices":["a","b","c","d"],"correct":1,"number":1},{"prompt":"p2","choices":["a","b","c","d"],"correct":2,"number":2}]'::jsonb, 'exam')$$, '708 : examen papier');
select lives_ok($$select public.catalog_set_paper(tests.u(708), true, true)$$, '708 : feuille seule');
select lives_ok($$select public.catalog_confirm_answers(tests.u(708), (select jsonb_agg(jsonb_build_object('question_id', q.id, 'correct', q.correct_index)) from public.catalog_questions_admin(tests.u(708)) q))$$, '708 : réponses confirmées');
select lives_ok($$select public.catalog_set_dates(tests.u(701), tests.today(1) - 1, tests.today(1) + 5)$$, '701 dates : disponible hier');
select lives_ok($$select public.catalog_set_dates(tests.u(702), tests.today(1) + 7, tests.today(1) + 13)$$, '702 dates : dans 7 jours');
select lives_ok($$select public.catalog_set_dates(tests.u(704), tests.today(1) - 1, tests.today(1) + 5)$$, '704 dates');
select lives_ok($$select public.catalog_set_dates(tests.u(705), tests.today(1) - 1, tests.today(1) + 5)$$, '705 dates');
select lives_ok($$select public.catalog_set_dates(tests.u(706), tests.today(1) - 1, tests.today(1) + 5)$$, '706 dates');
select lives_ok($$select public.catalog_set_dates(tests.u(707), tests.today(1) + 7, tests.today(1) + 13)$$, '707 dates : dans 7 jours');
select lives_ok($$select public.catalog_set_dates(tests.u(708), tests.today(1) - 1, tests.today(1) - 1)$$, '708 dates : échéance dépassée');
select lives_ok($$select public.catalog_set_status(tests.u(701), 'published')$$, '701 publié');
select lives_ok($$select public.catalog_set_status(tests.u(702), 'published')$$, '702 publié');
select lives_ok($$select public.catalog_set_status(tests.u(704), 'published')$$, '704 publié');
select lives_ok($$select public.catalog_set_status(tests.u(705), 'published')$$, '705 publié');
select lives_ok($$select public.catalog_set_status(tests.u(706), 'published')$$, '706 publié');
select lives_ok($$select public.catalog_set_status(tests.u(707), 'published')$$, '707 publié');
select lives_ok($$select public.catalog_set_status(tests.u(708), 'published')$$, '708 publié');

-- ───────────── classe et matières : le PARENT seul ─────────────
select tests.login(13);
select throws_ok($$select public.set_child_class(tests.u(201), 'VN', '5')$$, '42501', 'forbidden', 'enfant: ne règle pas sa classe');
select throws_ok($$select public.set_child_subject(tests.u(201), 'hist_geo', true)$$, '42501', 'forbidden', 'enfant: n''active pas de matière');
select throws_ok($$select public.shift_child_subject(tests.u(201), 'hist_geo', 1)$$, '42501', 'forbidden', 'enfant: ne décale pas');
select throws_ok($$update public.children set country = 'VN', grade = '5' where id = tests.u(201)$$, '42501', null, 'enfant: pas d''écriture directe de la classe');
select throws_ok($$insert into public.child_subjects (child_id, family_id, subject) values (tests.u(201), tests.u(1), 'hist_geo')$$, '42501', null, 'enfant: pas d''écriture directe des matières');

select tests.login(11);
select throws_ok($$update public.children set country = 'VN', grade = '5' where id = tests.u(201)$$, '42501', null, 'parent: pas d''écriture directe de la classe non plus (RPC seulement)');
select throws_ok($$insert into public.child_subjects (child_id, family_id, subject) values (tests.u(201), tests.u(1), 'hist_geo')$$, '42501', null, 'parent: pas d''écriture directe des matières non plus');
select tests.login(21);
select throws_ok($$select public.set_child_class(tests.u(201), 'VN', '5')$$, 'P0002', 'child_not_found', 'autre famille: pas l''enfant d''autrui (classe)');
select throws_ok($$select public.set_child_subject(tests.u(201), 'hist_geo', true)$$, 'P0002', 'child_not_found', 'autre famille: pas l''enfant d''autrui (matière)');
select throws_ok($$select * from public.parent_catalog_overview(tests.u(201))$$, 'P0002', 'child_not_found', 'autre famille: pas la vue d''un autre enfant');

select tests.login(11);
select throws_ok($$select public.set_child_class(tests.u(201), 'XX', '5')$$, 'P0001', 'invalid_country', 'pays inconnu refusé');
select throws_ok($$select public.set_child_class(tests.u(201), 'VN', '')$$, 'P0001', 'invalid_grade', 'classe vide refusée');
select lives_ok($$select public.set_child_class(tests.u(201), 'VN', '5')$$, 'parent: classe de A');
select lives_ok($$select public.set_child_class(tests.u(202), 'VN', '5')$$, 'parent: classe de B');
select lives_ok($$select public.set_child_subject(tests.u(201), 'hist_geo', true)$$, 'parent: A active hist_geo');
select lives_ok($$select public.set_child_subject(tests.u(201), 'maths', true)$$, 'parent: A active maths');
select lives_ok($$select public.set_child_subject(tests.u(201), 'maths', true)$$, 'rejeu idempotent');
select lives_ok($$select public.set_child_subject(tests.u(202), 'hist_geo', true)$$, 'parent: B active hist_geo');
select throws_ok($$select public.set_child_subject(tests.u(201), 'Maths!', true)$$, 'P0001', 'invalid_subject', 'matière invalide refusée');
select throws_ok($$select public.set_child_subject(tests.u(203), 'hist_geo', true)$$, 'P0002', 'child_not_found', 'parent: pas l''enfant d''une autre famille');
select is((select count(*)::int from public.parent_child_subjects(tests.u(201))), 2, 'A : 2 matières');
select is((select count(*)::int from public.parent_child_subjects(tests.u(202))), 1, 'B : 1 matière');
select throws_ok($$select * from public.parent_child_subjects(tests.u(203))$$, 'P0002', 'child_not_found', 'parent: pas les matières d''un enfant d''une autre famille');
select tests.login(21);
select lives_ok($$select public.set_child_class(tests.u(203), 'VN', '5')$$, 'parent B: classe de C');
select lives_ok($$select public.set_child_subject(tests.u(203), 'hist_geo', true)$$, 'parent B: C active hist_geo');

-- tables fermées
select tests.login(11);
select throws_ok($$select * from public.catalog_quizzes$$, '42501', null, 'parent (même admin): table du catalogue illisible directement');
select throws_ok($$select * from public.child_subjects$$, '42501', null, 'parent: child_subjects illisible directement');
select tests.login(13);
select throws_ok($$select * from public.catalog_questions$$, '42501', null, 'enfant: questions du catalogue illisibles');
select throws_ok($$select * from public.catalog_answer_keys$$, '42501', null, 'enfant: CLÉS illisibles');

-- ───────────── distribution à l'enfant ─────────────
select tests.login(13);
select is((select array_agg(quiz_id order by quiz_id) from public.child_catalog_quizzes()), array[tests.u(701), tests.u(708)],
          'A: voit 701 et 708 SEULEMENT (ni futur, ni brouillon, ni autre pays, ni autre classe, ni matière non activée)');
select ok(pg_get_function_result('public.child_catalog_quizzes()'::regprocedure) !~ '(correct|explanation|verify|confirmed|is_correct|key)', 'child_catalog_quizzes : aucune clé, aucun drapeau (score/total : seulement après validation, test 31)');
select is((select count(*)::int from public.children where id = tests.u(202)), 0, 'A ne voit pas le profil de son frère');
select tests.login(14);
select is((select array_agg(quiz_id order by quiz_id) from public.child_catalog_quizzes()), array[tests.u(701), tests.u(708)], 'B: mêmes quiz (même classe, hist_geo)');
select tests.login(23);
select is((select array_agg(quiz_id order by quiz_id) from public.child_catalog_quizzes()), array[tests.u(701), tests.u(708)], 'C (autre famille): ses propres droits, mêmes quiz');

-- aucune classe réglée ⇒ rien
select tests.login(11);
select lives_ok($$select public.set_child_class(tests.u(202), null, null)$$, 'parent: efface la classe de B');
select tests.login(14);
select is((select count(*)::int from public.child_catalog_quizzes()), 0, 'B sans classe: aucun quiz');
select tests.login(11);
select lives_ok($$select public.set_child_class(tests.u(202), 'VN', '5')$$, 'parent: rétablit la classe de B');

-- jour LOCAL de la famille : mise à disposition = aujourd'hui → disponible ; demain → non
select lives_ok($$select public.catalog_set_dates(tests.u(702), tests.today(1), tests.today(1) + 6)$$, 'admin: 702 disponible aujourd''hui (jour local)');
select tests.login(13);
select ok((select bool_or(quiz_id = tests.u(702)) from public.child_catalog_quizzes()), 'A: 702 (maths) disponible le jour local même');
select tests.login(11);
select lives_ok($$select public.catalog_set_dates(tests.u(702), tests.today(1) + 1, tests.today(1) + 6)$$, 'admin: 702 demain');
select tests.login(13);
select ok(not coalesce((select bool_or(quiz_id = tests.u(702)) from public.child_catalog_quizzes()), false), 'A: 702 pas encore disponible (demain)');

-- ───────────── décalage ±1 semaine, borné ─────────────
select throws_ok($$select public.shift_child_subject(tests.u(201), 'hist_geo', -1)$$, '42501', 'forbidden', 'enfant: ne décale pas');
select tests.login(11);
select throws_ok($$select public.shift_child_subject(tests.u(201), 'hist_geo', 2)$$, 'P0001', 'invalid_shift', 'décalage de 2 refusé (±1 seulement)');
select throws_ok($$select public.shift_child_subject(tests.u(201), 'anglais', -1)$$, 'P0001', 'subject_not_active', 'matière non activée: pas de décalage');
select lives_ok($$select public.shift_child_subject(tests.u(201), 'hist_geo', -1)$$, 'parent: A recule hist_geo d''une semaine');
select is((select week_offset from public.parent_child_subjects(tests.u(201)) where subject = 'hist_geo'), -1, 'décalage = −1');
select tests.login(13);
select is((select array_agg(quiz_id order by quiz_id) from public.child_catalog_quizzes()), array[tests.u(701), tests.u(707), tests.u(708)], 'A: 707 (prévu dans 7 jours) disponible grâce au −1');
select is((select due_on from public.child_catalog_quizzes() where quiz_id = tests.u(707)), tests.today(1) + 13 - 7, 'échéance décalée de la même semaine');
select tests.login(14);
select is((select array_agg(quiz_id order by quiz_id) from public.child_catalog_quizzes()), array[tests.u(701), tests.u(708)], 'B: pas de décalage (par enfant)');
select tests.login(11);
select lives_ok($$select public.shift_child_subject(tests.u(201), 'hist_geo', -1)$$, '−2');
select lives_ok($$select public.shift_child_subject(tests.u(201), 'hist_geo', -1)$$, '−3');
select lives_ok($$select public.shift_child_subject(tests.u(201), 'hist_geo', -1)$$, '−4');
select throws_ok($$select public.shift_child_subject(tests.u(201), 'hist_geo', -1)$$, 'P0001', 'invalid_shift', '−5 refusé (borné à −4)');
select lives_ok($$select public.shift_child_subject(tests.u(201), 'hist_geo', 1)$$, '−3');
select lives_ok($$select public.shift_child_subject(tests.u(201), 'hist_geo', 1)$$, '−2');
select lives_ok($$select public.shift_child_subject(tests.u(201), 'hist_geo', 1)$$, '−1');
select lives_ok($$select public.shift_child_subject(tests.u(201), 'hist_geo', 1)$$, '0');
select is((select week_offset from public.parent_child_subjects(tests.u(201)) where subject = 'hist_geo'), 0, 'retour à 0');
select tests.login(13);
select is((select array_agg(quiz_id order by quiz_id) from public.child_catalog_quizzes()), array[tests.u(701), tests.u(708)], 'A: 707 de nouveau hors de portée');

-- ───────────── évaluation ─────────────
select lives_ok($$select public.start_catalog_evaluation(tests.u(701), tests.u(801))$$, 'A: démarre 701');
select lives_ok($$select public.start_catalog_evaluation(tests.u(701), tests.u(801))$$, 'rejeu idempotent');
select throws_ok($$select public.start_catalog_evaluation(tests.u(701), tests.u(802))$$, 'P0001', 'evaluation_already_taken', 'A: une seule évaluation (le parent relance)');
select throws_ok($$select public.start_catalog_evaluation(tests.u(702), tests.u(803))$$, 'P0002', 'set_not_found', 'A: pas un quiz pas encore disponible');
select throws_ok($$select public.start_catalog_evaluation(tests.u(703), tests.u(803))$$, 'P0002', 'set_not_found', 'A: pas un brouillon');
select throws_ok($$select public.start_catalog_evaluation(tests.u(704), tests.u(803))$$, 'P0002', 'set_not_found', 'A: pas un autre pays');
select throws_ok($$select public.start_catalog_evaluation(tests.u(705), tests.u(803))$$, 'P0002', 'set_not_found', 'A: pas une autre classe');
select throws_ok($$select public.start_catalog_evaluation(tests.u(706), tests.u(803))$$, 'P0002', 'set_not_found', 'A: pas une matière non activée');
select throws_ok($$select public.start_catalog_evaluation(tests.u(707), tests.u(803))$$, 'P0002', 'set_not_found', 'A: pas un quiz décalé hors de portée');
select tests.login(14);
select throws_ok($$select public.start_catalog_evaluation(tests.u(701), tests.u(801))$$, '42501', 'forbidden', 'B: ne reprend pas la tentative de son frère');
select throws_ok($$select * from public.child_quiz_questions(tests.u(801))$$, 'P0002', 'attempt_not_found', 'B: ne lit pas les questions de la tentative de son frère');
select lives_ok($$select public.start_catalog_evaluation(tests.u(701), tests.u(804))$$, 'B: démarre 701 (tentative à lui)');
select tests.login(23);
select lives_ok($$select public.start_catalog_evaluation(tests.u(701), tests.u(805))$$, 'C: démarre 701 (autre famille)');

select tests.login(13);
select is((select count(*)::int from public.child_quiz_questions(tests.u(801))), 3, 'A: 3 questions');
select ok(pg_get_function_result('public.child_quiz_questions(uuid)'::regprocedure) !~ '(correct|explanation|verify|confirmed)', 'child_quiz_questions : aucune clé');
select lives_ok($$select public.save_quiz_progress(tests.u(801), tests.qid(tests.u(801), 'Capitale ?'), tests.pos(tests.u(801), 'Capitale ?', 'Hà Nội'))$$, 'A: enregistre une réponse');
select is((select answered_count from public.child_catalog_quizzes() where quiz_id = tests.u(701)), 1, 'A: 1 réponse enregistrée');
select tests.login(14);
select throws_ok($$select public.save_quiz_progress(tests.u(801), tests.u(999), 0)$$, '42501', 'forbidden', 'B: n''écrit pas dans la tentative de son frère');
select is((select answered_count from public.child_catalog_quizzes() where quiz_id = tests.u(701)), 0, 'B: ses réponses à lui (0), pas celles de son frère');

-- le parent ne voit RIEN des clés avant l'envoi
select tests.login(11);
select throws_ok($$select public.parent_attempt_review(tests.u(801))$$, 'P0001', 'not_submitted', 'parent: pas de clé avant l''envoi de l''enfant');
select is((select answered_count from public.parent_catalog_overview(tests.u(201)) where quiz_id = tests.u(701)), 1, 'parent: ne voit qu''un NOMBRE de réponses');
select tests.login(13);
select throws_ok($$select public.parent_attempt_review(tests.u(801))$$, '42501', 'forbidden', 'enfant: jamais d''accès à la revue du parent');
select lives_ok($$select public.submit_quiz_evaluation(tests.u(801), jsonb_build_array(
  jsonb_build_object('question_id', tests.qid(tests.u(801), 'Fleuve ?'), 'choice', tests.pos(tests.u(801), 'Fleuve ?', 'Rouge')),
  jsonb_build_object('question_id', tests.qid(tests.u(801), 'Océan ?'), 'choice', tests.pos(tests.u(801), 'Océan ?', 'Pacifique'))))$$, 'A: envoie (Capitale via la progression)');
select is(public.child_quiz_result(tests.u(801))->>'status', 'submitted', 'A: en attente de validation');
select ok(public.child_quiz_result(tests.u(801))::text !~ '(correct_index|explanation|to_verify|confirmed|score)', 'A: aucune fuite avant validation');

select tests.login(11);
select lives_ok($$select public.parent_attempt_review(tests.u(801))$$, 'parent: voit les réponses d''une tentative SOUMISE de son enfant');
select is(jsonb_array_length(public.parent_attempt_review(tests.u(801))->'questions'), 3, '…3 questions');
select is((select (x->>'correct_index')::int from jsonb_array_elements(public.parent_attempt_review(tests.u(801))->'questions') x where x->>'prompt' = 'Capitale ?'), 0, '…bonne réponse de « Capitale ? » (indice d''origine)');
select is((select (x->>'is_correct')::boolean from jsonb_array_elements(public.parent_attempt_review(tests.u(801))->'questions') x where x->>'prompt' = 'Océan ?'), false, '…« Océan ? » ratée');
select is(public.parent_attempt_review(tests.u(801))->>'score', '2', '…score 2');
select throws_ok($$select public.parent_attempt_review(tests.u(804))$$, 'P0001', 'not_submitted', 'parent: pas la tentative non envoyée de B');
select tests.login(21);
select throws_ok($$select public.parent_attempt_review(tests.u(801))$$, 'P0002', 'attempt_not_found', 'autre parent: jamais la revue d''un enfant d''une autre famille');
select throws_ok($$select * from public.parent_catalog_attempts(tests.u(201))$$, 'P0002', 'child_not_found', 'autre parent: pas l''historique d''un autre enfant');
select tests.login(23);
select lives_ok($$select public.submit_quiz_evaluation(tests.u(805), '[]'::jsonb)$$, 'C: envoie (rien répondu)');
select tests.login(11);
select throws_ok($$select public.parent_attempt_review(tests.u(805))$$, 'P0002', 'attempt_not_found', 'parent A: jamais la revue de C, d''une autre famille');
select tests.login(21);
select lives_ok($$select public.parent_attempt_review(tests.u(805))$$, 'parent de C: voit la sienne');

-- validation (show_correction décidé par le parent) et résultat de l'enfant
select tests.login(11);
select is((select count(*)::int from public.parent_catalog_attempts(tests.u(201)) where status = 'submitted'), 1, 'parent: 1 à valider pour A');
select is((select count(*)::int from public.parent_catalog_attempts(tests.u(202))), 1, 'B : sa propre tentative (en cours) seulement');
select lives_ok($$select public.validate_quiz_attempt(tests.u(801), true)$$, 'parent: valide avec correction');
select tests.login(13);
select is(public.child_quiz_result(tests.u(801))->>'status', 'validated', 'A: validé');
select is((public.child_quiz_result(tests.u(801))->>'score')::int, 2, 'A: score 2');
select is(jsonb_array_length(public.child_quiz_result(tests.u(801))->'questions'), 3, 'A: correction visible (activée par le parent)');
select is((select count(*)::int from public.child_quiz_history(tests.u(701))), 1, 'A: 1 résultat dans l''historique');
select tests.login(14);
select is((select count(*)::int from public.child_quiz_history(tests.u(701))), 0, 'B: aucun résultat de son frère');
select throws_ok($$select public.child_quiz_result(tests.u(801))$$, 'P0002', 'attempt_not_found', 'B: pas le résultat de son frère');

-- relance par le PARENT seul
select tests.login(13);
select throws_ok($$select public.relaunch_catalog_evaluation(tests.u(701), tests.u(201), tests.u(811))$$, '42501', 'forbidden', 'enfant: ne relance pas');
select tests.login(11);
select lives_ok($$select public.relaunch_catalog_evaluation(tests.u(701), tests.u(201), tests.u(811))$$, 'parent: relance pour A');
select lives_ok($$select public.relaunch_catalog_evaluation(tests.u(701), tests.u(201), tests.u(811))$$, 'rejeu idempotent');
select throws_ok($$select public.relaunch_catalog_evaluation(tests.u(701), tests.u(201), tests.u(812))$$, 'P0001', 'attempt_in_progress', 'une seule tentative en cours');
select throws_ok($$select public.relaunch_catalog_evaluation(tests.u(701), tests.u(203), tests.u(813))$$, 'P0002', 'child_not_found', 'parent: pas pour un enfant d''une autre famille');
select throws_ok($$select public.relaunch_catalog_evaluation(tests.u(707), tests.u(201), tests.u(814))$$, 'P0002', 'set_not_found', 'parent: pas un quiz hors de portée');

-- la date limite ne bloque JAMAIS ; examen papier « feuille seule » : lettres seulement
select tests.login(13);
select lives_ok($$select public.start_catalog_evaluation(tests.u(708), tests.u(818))$$, 'A: démarre 708 APRÈS son échéance');
select is((select count(*)::int from public.child_quiz_questions(tests.u(818)) where prompt = ''), 2, 'feuille seule : aucun énoncé envoyé');
select is((select string_agg(distinct c, '' order by c) from public.child_quiz_questions(tests.u(818)) q, unnest(q.choices) c), 'ABCD', 'feuille seule : des lettres A–D uniquement');
select is((select array_agg(origin_number order by "position") from public.child_quiz_questions(tests.u(818))), array[1, 2], 'jeu papier : par numéro d''origine, jamais mélangé');
select lives_ok($$select public.submit_quiz_evaluation(tests.u(818), '[]'::jsonb)$$, 'A: envoie après l''échéance');
select is(public.child_quiz_result(tests.u(818))->>'status', 'submitted', '…accepté');

-- dépublier ne supprime AUCUNE tentative
select tests.login(11);
select lives_ok($$select public.catalog_set_status(tests.u(701), 'draft')$$, 'admin: dépublie 701');
select is(tests.val(format('select count(*)::int from public.quiz_attempts where catalog_id = %L', tests.u(701))), '4', '…les 4 tentatives restent');
select throws_ok($$select public.catalog_delete_quiz(tests.u(701))$$, 'P0001', 'set_has_attempts', 'un quiz ayant des tentatives n''est pas supprimable');
select throws_ok($$select public.catalog_upsert_question(null, tests.u(701), 9, 'Q', array['a','b','c'], 0, null)$$, 'P0001', 'set_has_attempts', 'ni modifiable');
select tests.login(13);
select ok(not coalesce((select bool_or(quiz_id = tests.u(701)) from public.child_catalog_quizzes()), false), 'A: 701 dépublié n''est plus proposé');
select is(public.child_quiz_result(tests.u(801))->>'status', 'validated', 'A: son résultat validé reste lisible');
select tests.login(11);
select is((select count(*)::int from public.parent_catalog_attempts(tests.u(201))), 3, 'parent: l''historique de A est intact (801, 811, 818)');

-- désactiver une matière retire ses quiz
select lives_ok($$select public.catalog_set_dates(tests.u(702), tests.today(1) - 1, tests.today(1) + 5)$$, 'admin: 702 disponible');
select tests.login(13);
select ok((select bool_or(quiz_id = tests.u(702)) from public.child_catalog_quizzes()), 'A: maths proposé');
select tests.login(11);
select lives_ok($$select public.set_child_subject(tests.u(201), 'maths', false)$$, 'parent: désactive maths pour A');
select tests.login(13);

select ok(not coalesce((select bool_or(quiz_id = tests.u(702)) from public.child_catalog_quizzes()), false), 'A: maths retiré');

select * from finish();
rollback;
