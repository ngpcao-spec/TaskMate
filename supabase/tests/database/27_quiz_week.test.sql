-- D-079 « Quiz de la semaine » : date limite en jour local (jamais bloquante) et progression enregistrée au fil de l'eau (jamais lisible en direct,
-- aucune information de correction, écriture réservée à l'enfant propriétaire tant que la tentative est « en cours »).
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
-- position AFFICHÉE (0, 1, …) d'un choix dans une question de la tentative, d'après son texte
create function tests.pos(p_attempt uuid, p_prompt text, p_choice text) returns int language sql stable as $$
  select array_position(choices, p_choice) - 1 from public.child_quiz_questions(p_attempt) where prompt = p_prompt
$$;
create function tests.qid(p_attempt uuid, p_prompt text) returns uuid language sql stable as $$
  select question_id from public.child_quiz_questions(p_attempt) where prompt = p_prompt
$$;
-- jour local de la famille (appelable par les rôles de test : `family_today` n'est pas exposée)
create function tests.today(fam int) returns date language sql stable security definer as $$ select public.family_today(tests.u(fam)) $$;
grant execute on all functions in schema tests to authenticated, anon, service_role;

insert into auth.users (id, email, is_anonymous) values (tests.u(11), 'p1@test', false), (tests.u(13), null, false), (tests.u(14), null, false), (tests.u(21), 'pb@test', false), (tests.u(23), null, false);
insert into public.families (id, name, timezone) values (tests.u(1), 'A', 'Asia/Ho_Chi_Minh'), (tests.u(2), 'B', 'Asia/Ho_Chi_Minh');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2009-03-01'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01'), (tests.u(203), tests.u(2), 'Lan', '2010-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'),
  (tests.u(114), tests.u(1), tests.u(14), 'child', tests.u(202), 'Khang'), (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'Cha B'),
  (tests.u(123), tests.u(2), tests.u(23), 'child', tests.u(203), 'Lan');
select * from no_plan();

-- ───────────── structure ─────────────
select is((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'quiz_sets' and column_name = 'due_on'), 'date', 'quiz_sets.due_on : type date (jour local, jamais un timestamp)');
select is((select relrowsecurity from pg_class where oid = 'public.quiz_attempt_progress'::regclass), true, 'quiz_attempt_progress : RLS activée');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'quiz_attempt_progress'), 0, 'quiz_attempt_progress : aucune politique (jamais lisible en direct)');
select is((select has_table_privilege('authenticated', 'public.quiz_attempt_progress', 'select') or has_table_privilege('authenticated', 'public.quiz_attempt_progress', 'insert')
                 or has_table_privilege('anon', 'public.quiz_attempt_progress', 'select')), false, 'quiz_attempt_progress : aucun droit pour authenticated ni anon');
select ok(pg_get_function_result('public.child_quiz_sets()'::regprocedure) ~ 'due_on' and pg_get_function_result('public.child_quiz_sets()'::regprocedure) ~ 'answered_count', 'child_quiz_sets : date limite + nombre de réponses');
select ok(pg_get_function_result('public.child_quiz_sets()'::regprocedure) !~ '(verify|confirmed|kind|correct|score)', 'child_quiz_sets : aucun drapeau de clé, aucun score');
select ok(pg_get_function_result('public.child_quiz_progress(uuid)'::regprocedure) !~ '(correct|explanation|verify|confirmed|is_correct|score)', 'child_quiz_progress : aucune information de correction');
select ok(pg_get_function_result('public.quiz_progress_counts()'::regprocedure) !~ '(choice|question)', 'quiz_progress_counts : un NOMBRE par tentative, jamais le détail des réponses');

-- ───────────── parent : jeux ─────────────
select tests.login(11);
select lives_ok($$select public.create_quiz_draft(tests.u(701), tests.u(201), 'Quiz de la semaine', 'Toán', '[
  {"prompt":"Capitale ?","choices":["Hanoï","Hué","Saïgon"],"correct":0},
  {"prompt":"Fleuve ?","choices":["Rouge","Noir","Blanc","Vert"],"correct":0},
  {"prompt":"Océan ?","choices":["Pacifique","Atlantique","Indien"],"correct":1}]'::jsonb, 'course', false)$$, 'parent: quiz 701 (cours) pour A');
select is((select due_on from public.quiz_sets where id = tests.u(701)), null::date, 'un nouveau quiz n''a pas de date limite');
select lives_ok($$select public.create_quiz_draft(tests.u(702), tests.u(201), 'Quiz en retard', null, '[
  {"prompt":"Un ?","choices":["a","b","c"],"correct":0},{"prompt":"Deux ?","choices":["d","e","f"],"correct":2}]'::jsonb, 'course', false)$$, 'parent: quiz 702 pour A');
select lives_ok($$select public.create_quiz_draft(tests.u(703), tests.u(201), 'Examen papier', null, '[
  {"prompt":"Q1","choices":["x1","x2","x3","x4"],"correct":1,"number":1},{"prompt":"Q2","choices":["y1","y2","y3"],"correct":2,"number":2}]'::jsonb, 'exam', false)$$, 'parent: examen papier 703');
select lives_ok($$select public.create_quiz_draft(tests.u(704), tests.u(202), 'Quiz de B', null, '[{"prompt":"Pour B ?","choices":["a","b","c"],"correct":0}]'::jsonb, 'course', false)$$, 'parent: quiz 704 pour B');

-- date limite : jour local de la famille, bornes, jamais d'écriture directe
select lives_ok($$select public.set_quiz_due_on(tests.u(701), tests.today(1) + 3)$$, 'parent: fixe la date limite (brouillon)');
select is((select due_on from public.quiz_sets where id = tests.u(701)), tests.today(1) + 3, 'date limite = jour LOCAL de la famille + 3');
select throws_ok($$select public.set_quiz_due_on(tests.u(701), tests.today(1) - 30)$$, 'P0001', 'invalid_due_date', 'date trop ancienne refusée');
select throws_ok($$select public.set_quiz_due_on(tests.u(701), tests.today(1) + 800)$$, 'P0001', 'invalid_due_date', 'date trop lointaine refusée');
select is((select due_on from public.quiz_sets where id = tests.u(701)), tests.today(1) + 3, 'une date refusée ne change rien');
select throws_ok($$update public.quiz_sets set due_on = '2030-01-01' where id = tests.u(701)$$, '42501', null, 'parent: pas d''écriture directe de la date limite');
select throws_ok($$select public.set_quiz_due_on(tests.u(799), tests.today(1) + 1)$$, 'P0002', 'set_not_found', 'quiz inconnu');
select lives_ok($$select public.set_quiz_due_on(tests.u(701), tests.today(1) + 3)$$, 'date rejouée : idempotent');
select lives_ok($$select public.set_quiz_status(tests.u(701), 'published')$$, 'parent: publie 701');
select lives_ok($$select public.set_quiz_due_on(tests.u(701), tests.today(1) + 5)$$, 'parent: modifie la date APRÈS la publication');
select lives_ok($$select public.set_quiz_due_on(tests.u(702), tests.today(1) - 3)$$, 'parent: date limite déjà passée (retard)');
select lives_ok($$select public.set_quiz_status(tests.u(702), 'published')$$, 'parent: publie 702');
select lives_ok($$select public.confirm_quiz_answers(tests.u(703), (select jsonb_agg(jsonb_build_object('question_id', q.id, 'correct', k.correct_index)) from public.quiz_questions q join public.quiz_answer_keys k on k.question_id = q.id where q.set_id = tests.u(703)))$$, 'parent: confirme les réponses de 703');
select lives_ok($$select public.set_quiz_status(tests.u(703), 'published')$$, 'parent: publie 703 (examen papier)');
select lives_ok($$select public.set_quiz_status(tests.u(704), 'published')$$, 'parent: publie 704');
select lives_ok($$select public.copy_quiz_set(tests.u(701), tests.u(709), tests.u(202))$$, 'parent: copie 701 pour B');
select is((select due_on from public.quiz_sets where id = tests.u(709)), null::date, 'la copie repart SANS date limite');
select lives_ok($$select public.set_quiz_due_on(tests.u(701), null)$$, 'parent: efface la date limite');
select is((select due_on from public.quiz_sets where id = tests.u(701)), null::date, '…effacée');
select lives_ok($$select public.set_quiz_due_on(tests.u(701), tests.today(1) + 5)$$, 'parent: la remet');
-- parent : ne peut pas sauvegarder une progression (réservé à l'enfant)
select throws_ok($$select public.save_quiz_progress(tests.u(801), tests.u(1), 0)$$, '42501', 'forbidden', 'parent: n''écrit pas la progression');
select throws_ok($$select * from public.child_quiz_progress(tests.u(801))$$, '42501', 'forbidden', 'parent: ne passe pas par la RPC enfant');

-- ───────────── enfant A : liste et démarrage ─────────────
select tests.login(13);
select is((select due_on from public.child_quiz_sets() where set_id = tests.u(701)), tests.today(1) + 5, 'A: voit la date limite de SON quiz');
select is((select due_on from public.child_quiz_sets() where set_id = tests.u(702)), tests.today(1) - 3, 'A: voit aussi une date déjà passée');
select is((select answered_count from public.child_quiz_sets() where set_id = tests.u(701)), 0, 'A: 0 réponse enregistrée avant de commencer');
select throws_ok($$select public.set_quiz_due_on(tests.u(701), tests.today(1) + 1)$$, '42501', 'forbidden', 'A: ne fixe pas la date limite');
select lives_ok($$select public.start_quiz_evaluation(tests.u(701), tests.u(801))$$, 'A: démarre 701');
select lives_ok($$select public.start_quiz_evaluation(tests.u(702), tests.u(802))$$, 'A: démarre 702 APRÈS sa date limite (jamais bloquant)');

-- progression : enregistrement idempotent, reprise, aucune correction
select is((select count(*)::int from public.child_quiz_progress(tests.u(801))), 0, 'A: aucune réponse au départ');
select lives_ok($$select public.save_quiz_progress(tests.u(801), tests.qid(tests.u(801), 'Capitale ?'), tests.pos(tests.u(801), 'Capitale ?', 'Hanoï'))$$, 'A: enregistre la réponse 1 (la bonne, position affichée)');
select lives_ok($$select public.save_quiz_progress(tests.u(801), tests.qid(tests.u(801), 'Fleuve ?'), tests.pos(tests.u(801), 'Fleuve ?', 'Noir'))$$, 'A: enregistre la réponse 2 (une mauvaise)');
select lives_ok($$select public.save_quiz_progress(tests.u(801), tests.qid(tests.u(801), 'Fleuve ?'), tests.pos(tests.u(801), 'Fleuve ?', 'Noir'))$$, 'A: même réponse rejouée (file hors ligne) : idempotent');
select is((select count(*)::int from public.child_quiz_progress(tests.u(801))), 2, 'A: 2 réponses (pas de doublon)');
select is((select choice from public.child_quiz_progress(tests.u(801)) where question_id = tests.qid(tests.u(801), 'Capitale ?')), tests.pos(tests.u(801), 'Capitale ?', 'Hanoï'), 'A: relit SA réponse en position AFFICHÉE (reprise)');
select is((select answered_count from public.child_quiz_sets() where set_id = tests.u(701)), 2, 'A: la liste affiche 2 réponses enregistrées');
select lives_ok($$select public.save_quiz_progress(tests.u(801), tests.qid(tests.u(801), 'Fleuve ?'), tests.pos(tests.u(801), 'Fleuve ?', 'Rouge'))$$, 'A: change d''avis');
select is((select choice from public.child_quiz_progress(tests.u(801)) where question_id = tests.qid(tests.u(801), 'Fleuve ?')), tests.pos(tests.u(801), 'Fleuve ?', 'Rouge'), '…le changement est enregistré');
select lives_ok($$select public.save_quiz_progress(tests.u(801), tests.qid(tests.u(801), 'Fleuve ?'), null)$$, 'A: efface une réponse');
select is((select count(*)::int from public.child_quiz_progress(tests.u(801))), 1, '…il n''en reste qu''une');
select lives_ok($$select public.save_quiz_progress(tests.u(801), tests.qid(tests.u(801), 'Fleuve ?'), tests.pos(tests.u(801), 'Fleuve ?', 'Rouge'))$$, 'A: la remet');
select throws_ok($$select public.save_quiz_progress(tests.u(801), tests.qid(tests.u(801), 'Capitale ?'), 3)$$, 'P0001', 'invalid_answers', 'A: position hors choix (3 choix) refusée');
select throws_ok($$select public.save_quiz_progress(tests.u(801), tests.qid(tests.u(801), 'Capitale ?'), -1)$$, 'P0001', 'invalid_answers', 'A: position négative refusée');
select throws_ok($$select public.save_quiz_progress(tests.u(801), tests.u(9999), 0)$$, 'P0001', 'invalid_answers', 'A: question inconnue refusée');
select throws_ok($$select public.save_quiz_progress(tests.u(801), (select id from public.quiz_questions where set_id = tests.u(704) limit 1), 0)$$, 'P0001', 'invalid_answers', 'A: question d''un autre quiz refusée');
select is((select count(*)::int from public.child_quiz_progress(tests.u(801))), 2, 'A: les écritures refusées n''ont rien changé');
select throws_ok($$select count(*) from public.quiz_attempt_progress$$, '42501', null, 'A: aucune lecture directe de la progression (table fermée)');

-- ───────────── isolation : autre enfant, autre famille, parent, anonyme ─────────────
select tests.login(13);
select set_config('t.q801', tests.qid(tests.u(801), 'Capitale ?')::text, true);
select tests.login(14);
select throws_ok($$select public.save_quiz_progress(tests.u(801), current_setting('t.q801')::uuid, 0)$$, '42501', 'forbidden', 'B (autre enfant, même famille): n''écrit pas la progression de A');
select throws_ok($$select * from public.child_quiz_progress(tests.u(801))$$, 'P0002', 'attempt_not_found', 'B: ne relit pas la progression de A');
select is((select count(*)::int from public.child_quiz_sets()), 1, 'B: ne voit que SON quiz publié (704)');
select tests.login(23);
select throws_ok($$select public.save_quiz_progress(tests.u(801), current_setting('t.q801')::uuid, 0)$$, '42501', 'forbidden', 'C (autre famille): n''écrit pas la progression de A');
select throws_ok($$select * from public.child_quiz_progress(tests.u(801))$$, 'P0002', 'attempt_not_found', 'C: ne relit pas la progression de A');
select is((select count(*)::int from public.child_quiz_sets()), 0, 'C: aucun quiz');
select tests.login(11);
select throws_ok($$select count(*) from public.quiz_attempt_progress$$, '42501', null, 'parent: aucune lecture directe de la progression');
select is((select answered from public.quiz_progress_counts() where attempt_id = tests.u(801)), 2, 'parent: voit « 2 réponses » sur la tentative en cours de A');
select is((select answered from public.quiz_progress_counts() where attempt_id = tests.u(802)), 0, 'parent: « 0 réponse » sur 802 (commencée, rien répondu)');
select tests.login(21);
select is((select count(*)::int from public.quiz_progress_counts()), 0, 'parent d''une autre famille: ne voit aucune tentative');
reset role;
set local role anon;
select throws_ok($$select public.save_quiz_progress(tests.u(801), tests.u(1), 0)$$, '42501', null, 'anonyme: pas d''exécution de save_quiz_progress');
select throws_ok($$select * from public.child_quiz_progress(tests.u(801))$$, '42501', null, 'anonyme: pas d''exécution de child_quiz_progress');
select throws_ok($$select * from public.quiz_progress_counts()$$, '42501', null, 'anonyme: pas d''exécution de quiz_progress_counts');
select throws_ok($$select count(*) from public.quiz_attempt_progress$$, '42501', null, 'anonyme: aucune lecture directe de la progression');
select tests.login(13);
select throws_ok($$insert into public.quiz_attempt_progress (attempt_id, question_id, family_id, child_id, choice) values (tests.u(801), tests.qid(tests.u(801), 'Capitale ?'), tests.u(1), tests.u(201), 0)$$, '42501', null, 'A: pas d''écriture directe de la progression');

-- ───────────── envoi : le score est calculé sur les réponses ENVOYÉES, complétées par la progression ─────────────
-- Réponses enregistrées : Capitale = Hanoï (bonne), Fleuve = Rouge (bonne). L'envoi les laisse vides (null) : la progression les complète ;
-- Océan est répondu à l'envoi seulement (Atlantique = bonne).
select lives_ok($$select public.submit_quiz_evaluation(tests.u(801), jsonb_build_array(
  jsonb_build_object('question_id', tests.qid(tests.u(801), 'Capitale ?'), 'choice', null),
  jsonb_build_object('question_id', tests.qid(tests.u(801), 'Fleuve ?'), 'choice', null),
  jsonb_build_object('question_id', tests.qid(tests.u(801), 'Océan ?'), 'choice', tests.pos(tests.u(801), 'Océan ?', 'Atlantique'))))$$, 'A: envoie (deux réponses viennent de la progression)');
select tests.login(11);
select is((select score from public.quiz_results where attempt_id = tests.u(801)), 3, 'score 3 / 3 : positions affichées converties selon le mélange de CETTE tentative');
select is((select count(*)::int from public.quiz_answers where attempt_id = tests.u(801) and choice_index is not null), 3, '3 réponses enregistrées dans le résultat');
select is((select count(*)::int from public.quiz_progress_counts() where attempt_id = tests.u(801)), 0, 'parent: la tentative envoyée n''a plus de compteur');
reset role;
select is((select count(*)::int from public.quiz_attempt_progress where attempt_id = tests.u(801)), 0, 'la progression est effacée à l''envoi');
select tests.login(13);
select throws_ok($$select public.save_quiz_progress(tests.u(801), current_setting('t.q801')::uuid, 0)$$, 'P0001', 'attempt_closed', 'A: plus de sauvegarde une fois la tentative envoyée');
select throws_ok($$select * from public.child_quiz_progress(tests.u(801))$$, 'P0001', 'attempt_closed', 'A: plus de relecture de la progression une fois envoyée');
select is((select evaluation_status::text from public.child_quiz_sets() where set_id = tests.u(701)), 'submitted', 'A: la liste montre « envoyé »');
select is((select answered_count from public.child_quiz_sets() where set_id = tests.u(701)), 0, 'A: plus de compteur de progression une fois envoyé');
select lives_ok($$select public.submit_quiz_evaluation(tests.u(801), '[]'::jsonb)$$, 'A: second envoi ignoré (idempotent)');
select tests.login(11);
select lives_ok($$select public.validate_quiz_attempt(tests.u(801), false)$$, 'parent: valide');
select tests.login(13);
select throws_ok($$select public.save_quiz_progress(tests.u(801), current_setting('t.q801')::uuid, 0)$$, 'P0001', 'attempt_closed', 'A: plus de sauvegarde une fois validée');
select ok(public.child_quiz_result(tests.u(801))::text !~ '(correct_index|explanation|to_verify|confirmed)', 'A: correction masquée : aucune fuite par le résultat');

-- envoi après la date limite : jamais bloqué (702 : date limite il y a 3 jours)
select lives_ok($$select public.save_quiz_progress(tests.u(802), tests.qid(tests.u(802), 'Un ?'), tests.pos(tests.u(802), 'Un ?', 'a'))$$, 'A: sauvegarde APRÈS la date limite');
select lives_ok($$select public.submit_quiz_evaluation(tests.u(802), '[]'::jsonb)$$, 'A: envoie APRÈS la date limite');
select tests.login(11);
select is((select score from public.quiz_results where attempt_id = tests.u(802)), 1, 'retard : la progression est comptée (1 / 2)');

-- ───────────── support papier : positions = ordre d'origine (jamais mélangé) ─────────────
select tests.login(13);
select lives_ok($$select public.start_quiz_evaluation(tests.u(703), tests.u(803))$$, 'A: démarre l''examen papier 703');
select lives_ok($$select public.save_quiz_progress(tests.u(803), tests.qid(tests.u(803), 'Q1'), 1)$$, 'A: Q1 = B (position de la feuille)');
select lives_ok($$select public.save_quiz_progress(tests.u(803), tests.qid(tests.u(803), 'Q2'), 2)$$, 'A: Q2 = C');
select is((select array_agg(choice order by question_id) from public.child_quiz_progress(tests.u(803))), (select array_agg(c order by qid) from (select tests.qid(tests.u(803), 'Q1') qid, 1 c union all select tests.qid(tests.u(803), 'Q2'), 2) x), 'papier : les positions restituées sont celles de la feuille');
select throws_ok($$select public.save_quiz_progress(tests.u(803), tests.qid(tests.u(803), 'Q2'), 3)$$, 'P0001', 'invalid_answers', 'papier : la lettre D n''existe pas pour une question à 3 choix');
select lives_ok($$select public.submit_quiz_evaluation(tests.u(803), '[]'::jsonb)$$, 'A: envoie le papier avec la seule progression');
select tests.login(11);
select is((select score from public.quiz_results where attempt_id = tests.u(803)), 2, 'papier : B puis C = les deux bonnes → 2 / 2');

-- ───────────── suppression de la famille : purge de la progression ─────────────
select tests.login(21);
select lives_ok($$select public.create_quiz_draft(tests.u(711), tests.u(203), 'Quiz C', null, '[{"prompt":"Quoi ?","choices":["a","b","c"],"correct":0}]'::jsonb, 'course', false)$$, 'parent B: quiz 711 pour C');
select lives_ok($$select public.set_quiz_status(tests.u(711), 'published')$$, 'parent B: publie 711');
select tests.login(23);
select lives_ok($$select public.start_quiz_evaluation(tests.u(711), tests.u(811))$$, 'C: démarre');
select lives_ok($$select public.save_quiz_progress(tests.u(811), tests.qid(tests.u(811), 'Quoi ?'), 1)$$, 'C: enregistre une réponse');
reset role;
select is((select count(*)::int from public.quiz_attempt_progress where family_id = tests.u(2)), 1, 'famille B : 1 réponse enregistrée');
select tests.login(21);
select lives_ok($$select public.delete_family()$$, 'parent B: supprime sa famille');
reset role;
select is((select count(*)::int from public.quiz_attempt_progress where family_id = tests.u(2)), 0, 'delete_family : la progression est purgée');
select is((select count(*)::int from public.quiz_attempt_progress where family_id = tests.u(1)), 0, '…et celle de la famille A n''a pas été touchée (déjà vide : tout envoyé)');

select * from finish();
rollback;
