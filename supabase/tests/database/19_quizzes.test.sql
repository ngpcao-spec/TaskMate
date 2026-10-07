-- D-055 / D-059 « Révisions » : l'enfant ne voit JAMAIS une bonne réponse, une explication ni un « juste/faux » par question avant la validation du parent,
-- ni par essais successifs ; après validation, la correction dépend du réglage posé par le parent à la validation (désactivé par défaut) ;
-- mélange serveur à chaque tentative ; un enfant ne voit rien de l'autre (D-052) ; score calculé par le serveur ; double envoi ; relance par le parent.
-- Fixtures : famille 1 = parents 11 et 12, enfant A = Minh (user 13, profil 201), enfant B = Khang (user 14, profil 202) ; famille 2 = parent 21.
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
create function tests.n(q text) returns bigint language plpgsql as $$
declare c bigint;
begin
  execute q;
  get diagnostics c = row_count;
  return c;
end $$;
-- Réponses « parfaites » ou « avec erreur » d'une tentative, calculées d'après le mélange du serveur (lu en superutilisateur) :
-- `wrong_for` = question dont on choisit volontairement une mauvaise réponse (null = aucune).
create function tests.answers(p_attempt uuid, wrong_for uuid default null) returns jsonb language sql stable as $$
  select jsonb_agg(jsonb_build_object('question_id', q.id, 'choice',
    case when q.id = wrong_for
      then (select (e.ord - 1)::int from jsonb_array_elements_text(l.layout->'choices'->(q.id::text)) with ordinality e(value, ord) where (e.value)::int <> k.correct_index order by e.ord limit 1)
      else (select (e.ord - 1)::int from jsonb_array_elements_text(l.layout->'choices'->(q.id::text)) with ordinality e(value, ord) where (e.value)::int = k.correct_index) end))
  from public.quiz_attempt_layouts l join public.quiz_attempts a on a.id = l.attempt_id
  join public.quiz_questions q on q.set_id = a.set_id join public.quiz_answer_keys k on k.question_id = q.id
  where l.attempt_id = p_attempt
$$;
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, email, is_anonymous) values
  (tests.u(11), 'p1@test', false), (tests.u(12), 'p2@test', false), (tests.u(13), null, false), (tests.u(14), null, false), (tests.u(21), 'pb@test', false);
insert into public.families (id, name) values (tests.u(1), 'Famille A'), (tests.u(2), 'Famille B');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2009-03-01'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01'), (tests.u(221), tests.u(2), 'Cam', '2012-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(112), tests.u(1), tests.u(12), 'parent', null, 'Mẹ'),
  (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'), (tests.u(114), tests.u(1), tests.u(14), 'child', tests.u(202), 'Khang'),
  (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'Cha B');
select * from no_plan();

-- ───────────── structure : RLS partout, anciens RPC supprimés (non-régression), colonnes de retour sans fuite ─────────────
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'quiz\_%' and not c.relrowsecurity), 0, 'toutes les tables quiz_* ont la RLS');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'quiz\_%'), 7, '7 tables quiz_*');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('check_quiz_answer', 'start_quiz_practice', 'finish_quiz_practice')), 0, 'NON-RÉGRESSION : les RPC d''entraînement n''existent plus');
select throws_ok($$select * from public.check_quiz_answer(tests.u(1), tests.u(1), 0)$$, '42883', null, 'check_quiz_answer : fonction inexistante');
select throws_ok($$select public.start_quiz_practice(tests.u(1), tests.u(1))$$, '42883', null, 'start_quiz_practice : fonction inexistante');
select throws_ok($$select * from public.finish_quiz_practice(tests.u(1))$$, '42883', null, 'finish_quiz_practice : fonction inexistante');
select is((select count(*)::int from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'quiz_attempt_kind'), 0, 'NON-RÉGRESSION : plus de type « entraînement / évaluation »');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'quiz_attempts' and column_name = 'kind'), 0, 'quiz_attempts n''a plus de colonne kind');
select ok(pg_get_function_result('public.child_quiz_questions(uuid)'::regprocedure) !~ '(correct|explanation|is_correct|score)', 'child_quiz_questions : aucune colonne de bonne réponse, explication, juste/faux ni score');
select ok(pg_get_function_result('public.child_quiz_sets()'::regprocedure) !~ '(correct|explanation|is_correct|score)', 'child_quiz_sets : aucune fuite');
select ok(pg_get_function_result('public.child_quiz_history(uuid)'::regprocedure) !~ '(correct|explanation|is_correct)', 'child_quiz_history : aucune fuite');
select ok(pg_get_function_result('public.child_quiz_questions(uuid)'::regprocedure) !~ 'attempt_id', 'child_quiz_questions : pas d''identifiants internes superflus');

-- ───────────── parent : composition ─────────────
select tests.login(11);
select lives_ok($$insert into public.quiz_sets (id, family_id, child_id, title, subject, created_by) values (tests.u(301), tests.u(1), tests.u(201), 'Fractions', 'Toán', tests.u(111))$$, 'parent: crée un jeu (brouillon) pour A');
select lives_ok($$insert into public.quiz_sets (id, family_id, child_id, title, created_by) values (tests.u(302), tests.u(1), tests.u(201), 'Vide', tests.u(111))$$, 'parent: crée un second jeu');
select throws_ok($$insert into public.quiz_sets (id, family_id, child_id, title, status, created_by) values (tests.u(303), tests.u(1), tests.u(201), 'Triche', 'published', tests.u(111))$$, '42501', null, 'parent: on ne crée pas un jeu déjà publié');
select throws_ok($$update public.quiz_sets set status = 'published' where id = tests.u(301)$$, '42501', null, 'parent: le statut ne se change pas par écriture directe');
select throws_ok($$insert into public.quiz_sets (id, family_id, child_id, title, created_by) values (tests.u(304), tests.u(1), tests.u(221), 'Autre famille', tests.u(111))$$, null, null, 'parent: pas de jeu pour l''enfant d''une autre famille');
select throws_ok($$insert into public.quiz_sets (id, family_id, child_id, title, created_by) values (tests.u(305), tests.u(1), tests.u(201), '   ', tests.u(111))$$, '23514', null, 'titre vide refusé');

select lives_ok($$select public.upsert_quiz_question(tests.u(401), tests.u(301), 0, 'Combien font 1/2 + 1/4 ?', array['1/6', '3/4', '2/6'], 1, 'Même dénominateur : 2/4 + 1/4')$$, 'question 1 (3 choix)');
select lives_ok($$select public.upsert_quiz_question(tests.u(402), tests.u(301), 1, 'Quelle fraction vaut 0,5 ?', array['1/2', '1/3', '1/4', '2/3'], 0, null)$$, 'question 2 (4 choix, sans explication)');
select lives_ok($$select public.upsert_quiz_question(tests.u(403), tests.u(301), 2, 'Plus grande fraction ?', array['1/8', '1/4', '1/2'], 2, 'Plus le dénominateur est petit…')$$, 'question 3');
select lives_ok($$select public.upsert_quiz_question(tests.u(403), tests.u(301), 2, 'Quelle est la plus grande fraction ?', array['1/8', '1/4', '1/2'], 2, 'Plus le dénominateur est petit…')$$, 'question 3 : modifiable (même id, idempotent)');
select throws_ok($$select public.upsert_quiz_question(tests.u(410), tests.u(301), 3, 'Deux choix', array['a', 'b'], 0, null)$$, 'P0001', 'invalid_choices', '2 choix refusés');
select throws_ok($$select public.upsert_quiz_question(tests.u(410), tests.u(301), 3, 'Cinq choix', array['a', 'b', 'c', 'd', 'e'], 0, null)$$, 'P0001', 'invalid_choices', '5 choix refusés');
select throws_ok($$select public.upsert_quiz_question(tests.u(410), tests.u(301), 3, 'Doublons', array['a', 'A ', 'c'], 0, null)$$, 'P0001', 'duplicate_choices', 'choix en double refusés');
select throws_ok($$select public.upsert_quiz_question(tests.u(410), tests.u(301), 3, 'Hors plage', array['a', 'b', 'c'], 3, null)$$, 'P0001', 'invalid_correct', 'bonne réponse hors plage refusée');
select throws_ok($$select public.upsert_quiz_question(tests.u(410), tests.u(301), 3, '  ', array['a', 'b', 'c'], 0, null)$$, 'P0001', 'invalid_question', 'énoncé vide refusé');
select throws_ok($$select public.upsert_quiz_question(tests.u(410), tests.u(301), 3, 'Choix vide', array['a', '', 'c'], 0, null)$$, 'P0001', 'invalid_choices', 'choix vide refusé');
select throws_ok($$select public.set_quiz_status(tests.u(302), 'published')$$, 'P0001', 'no_questions', 'publier un jeu sans question refusé');
select is((select array_agg(position order by position) from public.quiz_questions where set_id = tests.u(301)), array[0, 1, 2], 'positions 0,1,2');
select lives_ok($$select public.reorder_quiz_questions(tests.u(301), array[tests.u(403), tests.u(401), tests.u(402)])$$, 'parent: réordonne');
select is((select array_agg(id order by position) from public.quiz_questions where set_id = tests.u(301)), array[tests.u(403), tests.u(401), tests.u(402)], 'nouvel ordre appliqué');
select lives_ok($$select public.reorder_quiz_questions(tests.u(301), array[tests.u(401), tests.u(402), tests.u(403)])$$, 'parent: remet l''ordre initial');
select is((select correct_index from public.quiz_answer_keys where question_id = tests.u(401)), 1::smallint, 'parent: lit la clé');
select lives_ok($$select public.upsert_quiz_question(tests.u(404), tests.u(301), 3, 'À supprimer', array['a', 'b', 'c'], 0, null)$$, 'question 4');
select lives_ok($$select public.delete_quiz_question(tests.u(404))$$, 'parent: supprime une question (brouillon)');
select lives_ok($$select public.delete_quiz_question(tests.u(404))$$, 'suppression rejouée : sans effet');
select is((select count(*)::int from public.quiz_questions where set_id = tests.u(301)), 3, '3 questions restantes');

-- ───────────── brouillon invisible pour l'enfant ─────────────
select tests.login(13);
select is(tests.n('select 1 from public.quiz_sets'), 0::bigint, 'A: ne voit AUCUN brouillon');
select is((select count(*)::int from public.child_quiz_sets()), 0, 'A: child_quiz_sets vide tant que rien n''est publié');
select throws_ok($$select public.start_quiz_evaluation(tests.u(301), tests.u(502))$$, 'P0002', 'set_not_found', 'A: pas d''évaluation sur un brouillon');

-- ───────────── publication ─────────────
select tests.login(11);
select lives_ok($$select public.set_quiz_status(tests.u(301), 'published')$$, 'parent: publie');
select lives_ok($$select public.set_quiz_status(tests.u(301), 'published')$$, 'publication rejouée : sans effet');

-- ───────────── enfant A : voit son jeu, JAMAIS la clé, aucune lecture directe ─────────────
select tests.login(13);
select is(tests.n('select 1 from public.quiz_sets'), 1::bigint, 'A: voit son jeu publié');
select is((select count(*)::int from public.child_quiz_sets()), 1, 'A: child_quiz_sets = 1');
select is((select question_count from public.child_quiz_sets()), 3, 'A: 3 questions annoncées');
select is((select can_start_evaluation from public.child_quiz_sets()), true, 'A: peut démarrer sa première évaluation');
select is(tests.n('select 1 from public.quiz_questions'), 0::bigint, 'A: AUCUN accès direct aux questions');
select is(tests.n('select 1 from public.quiz_answer_keys'), 0::bigint, 'A: la clé des réponses est illisible');
select is(tests.n('select 1 from public.quiz_results'), 0::bigint, 'A: aucun score lisible directement');
select is(tests.n('select 1 from public.quiz_answers'), 0::bigint, 'A: aucune réponse donnée (ni is_correct) lisible directement');
select is(tests.n('select 1 from public.quiz_attempt_layouts'), 0::bigint, 'A: les mélanges sont illisibles');
select is(tests.n('select explanation from public.quiz_answer_keys'), 0::bigint, 'A: aucune ligne de explanation lisible');
select is(tests.n('select correct_index from public.quiz_answer_keys'), 0::bigint, 'A: aucune ligne de correct_index lisible');
select is(tests.n('select is_correct from public.quiz_answers'), 0::bigint, 'A: aucune ligne de is_correct lisible');
select throws_ok($$insert into public.quiz_sets (id, family_id, child_id, title, created_by) values (tests.u(399), tests.u(1), tests.u(201), 'x', tests.u(113))$$, '42501', null, 'A: ne crée pas de jeu');
select is(tests.n($$update public.quiz_sets set title = 'piraté' where id = tests.u(301)$$), 0::bigint, 'A: ne modifie aucune ligne de jeu (RLS)');
select throws_ok($$insert into public.quiz_attempts (id, family_id, child_id, set_id) values (tests.u(598), tests.u(1), tests.u(201), tests.u(301))$$, '42501', null, 'A: pas d''écriture directe de tentative');
select throws_ok($$update public.quiz_attempts set show_correction = true where child_id = tests.u(201)$$, '42501', null, 'A: ne peut pas activer lui-même la correction');
select throws_ok($$insert into public.quiz_results (attempt_id, family_id, child_id, score, total) values (tests.u(598), tests.u(1), tests.u(201), 3, 3)$$, '42501', null, 'A: pas d''écriture directe de score');
select throws_ok($$select public.upsert_quiz_question(tests.u(499), tests.u(301), 9, 'Q', array['a', 'b', 'c'], 0, null)$$, '42501', 'forbidden', 'A: ne modifie pas les questions (RPC parent)');
select throws_ok($$select public.set_quiz_status(tests.u(301), 'draft')$$, '42501', 'forbidden', 'A: ne dépublie pas');
select throws_ok($$select public.validate_quiz_attempt(tests.u(502), true)$$, '42501', 'forbidden', 'A: ne valide pas');
select throws_ok($$select public.copy_quiz_set(tests.u(301), tests.u(398), tests.u(201))$$, '42501', 'forbidden', 'A: ne copie pas');
select throws_ok($$select public.relaunch_quiz_evaluation(tests.u(301), tests.u(597))$$, '42501', 'forbidden', 'A: ne relance pas une évaluation');

-- ───────────── enfant B : ne voit RIEN de A ─────────────
select tests.login(14);
select is(tests.n('select 1 from public.quiz_sets'), 0::bigint, 'B: ne voit pas le jeu de A');
select is((select count(*)::int from public.child_quiz_sets()), 0, 'B: child_quiz_sets vide');
select throws_ok($$select public.start_quiz_evaluation(tests.u(301), tests.u(596))$$, 'P0002', 'set_not_found', 'B: ne passe pas l''évaluation de A');

-- ───────────── évaluation de A : un seul parcours, aucun retour pendant les questions ─────────────
select tests.login(13);
select lives_ok($$select public.start_quiz_evaluation(tests.u(301), tests.u(502))$$, 'A: démarre l''évaluation');
select lives_ok($$select public.start_quiz_evaluation(tests.u(301), tests.u(502))$$, 'démarrage rejoué : idempotent');
select throws_ok($$select public.start_quiz_evaluation(tests.u(301), tests.u(595))$$, 'P0001', 'evaluation_already_taken', 'A: pas de seconde évaluation sans le parent');
select is((select count(*)::int from public.child_quiz_questions(tests.u(502))), 3, 'A: reçoit les 3 questions de SA tentative');
select is((select array_agg("position" order by "position") from public.child_quiz_questions(tests.u(502))), array[0, 1, 2], 'A: positions 0, 1, 2 dans l''ordre mélangé');
select tests.login(14);
select throws_ok($$select * from public.child_quiz_questions(tests.u(502))$$, 'P0002', 'attempt_not_found', 'B: ne lit pas les questions de la tentative de A');
select throws_ok($$select public.submit_quiz_evaluation(tests.u(502), '[]'::jsonb)$$, '42501', 'forbidden', 'B: ne soumet pas la tentative de A');
select throws_ok($$select public.start_quiz_evaluation(tests.u(301), tests.u(502))$$, '42501', 'forbidden', 'B: ne réutilise pas l''id de tentative de A');
select tests.login(13);
-- le mélange serveur est une vraie permutation (vérifié en superutilisateur, claim de A conservée)
reset role;
select is((select count(*)::int from public.child_quiz_questions(tests.u(502)) g join public.quiz_questions q on q.id = g.question_id
           where (select array_agg(x order by x) from unnest(g.choices) x) = (select array_agg(x order by x) from unnest(q.choices) x)), 3,
          'mélange: chaque question garde exactement ses choix (permutation)');
select is((select array_agg(g.question_id order by g."position") from public.child_quiz_questions(tests.u(502)) g),
          (select array(select (e.value)::uuid from public.quiz_attempt_layouts l, jsonb_array_elements_text(l.layout->'order') with ordinality e(value, ord) where l.attempt_id = tests.u(502) order by e.ord)),
          'mélange: l''ordre servi est celui du serveur');
select is((select count(distinct public.quiz_make_layout(tests.u(301)))::int from generate_series(1, 12)), 12, 'mélange: chaque tirage est différent (12 tirages sur 12)');
select tests.login(13);
select throws_ok($$select public.submit_quiz_evaluation(tests.u(502), '[{"question_id":"00000000-0000-0000-0000-000000000999","choice":0}]'::jsonb)$$, 'P0001', 'invalid_answers', 'question étrangère refusée');
select throws_ok($$select public.submit_quiz_evaluation(tests.u(502), '[{"question_id":"00000000-0000-0000-0000-000000000401","choice":9}]'::jsonb)$$, 'P0001', 'invalid_answers', 'choix hors plage refusé');
select throws_ok($$select public.submit_quiz_evaluation(tests.u(502), '[{"question_id":"00000000-0000-0000-0000-000000000401","choice":1},{"question_id":"00000000-0000-0000-0000-000000000401","choice":1}]'::jsonb)$$, 'P0001', 'invalid_answers', 'réponse en double refusée');
select throws_ok($$select public.submit_quiz_evaluation(tests.u(502), '{"a":1}'::jsonb)$$, 'P0001', 'invalid_answers', 'format invalide refusé');
select is((select status::text from public.quiz_attempts where id = tests.u(502)), 'in_progress', 'les envois invalides n''ont rien enregistré (aucun essai gratuit)');
-- Q1 juste, Q2 FAUSSE, Q3 juste : positions affichées calculées d'après le mélange du serveur ; un champ « is_correct » envoyé par le client est ignoré
reset role;
select set_config('tests.sub502', tests.answers(tests.u(502), tests.u(402))::text, true);
select tests.login(13);
select lives_ok($$select public.submit_quiz_evaluation(tests.u(502), current_setting('tests.sub502')::jsonb)$$, 'A: soumet l''évaluation (positions affichées)');
select lives_ok($$select public.submit_quiz_evaluation(tests.u(502), '[{"question_id":"00000000-0000-0000-0000-000000000402","choice":0,"is_correct":true}]'::jsonb)$$, 'A: second envoi ignoré (double envoi)');
select is((select status::text from public.quiz_attempts where id = tests.u(502)), 'submitted', 'état: soumis');
select throws_ok($$select * from public.child_quiz_questions(tests.u(502))$$, 'P0001', 'attempt_closed', 'ESSAIS SUCCESSIFS: les questions ne sont plus servies une fois la tentative envoyée');
select throws_ok($$select public.start_quiz_evaluation(tests.u(301), tests.u(594))$$, 'P0001', 'evaluation_already_taken', 'ESSAIS SUCCESSIFS: pas de nouvelle tentative par l''enfant');
select is(((public.child_quiz_result(tests.u(502))) ? 'score'), false, 'A: AUCUN score avant validation');
select is(((public.child_quiz_result(tests.u(502))) ? 'missed'), false, 'A: aucune liste de questions ratées avant validation');
select is(((public.child_quiz_result(tests.u(502))) ? 'questions'), false, 'A: AUCUNE correction avant validation');
select is((public.child_quiz_result(tests.u(502)))->>'status', 'submitted', 'A: voit seulement « soumis »');
select ok((public.child_quiz_result(tests.u(502)))::text !~ '(correct|explanation|is_correct|chosen)', 'A: le résultat avant validation ne contient aucun mot de correction');
select is((select count(*)::int from public.child_quiz_history(tests.u(301))), 0, 'A: historique vide tant que rien n''est validé');
select is(tests.n('select 1 from public.quiz_results'), 0::bigint, 'A: toujours aucun score lisible');
select is((select evaluation_status::text from public.child_quiz_sets()), 'submitted', 'A: liste: évaluation « soumise »');
select is((select can_start_evaluation from public.child_quiz_sets()), false, 'A: ne peut plus démarrer');

-- ───────────── parent : relecture et validation (correction DÉSACTIVÉE par défaut) ─────────────
select tests.login(12);
select is(tests.n('select 1 from public.quiz_attempts where set_id = tests.u(301)'), 1::bigint, 'parent 2: voit la tentative de la famille');
select is((select score from public.quiz_results where attempt_id = tests.u(502)), 2, 'score calculé par le serveur: 2/3 (la triche is_correct est ignorée)');
select is((select total from public.quiz_results where attempt_id = tests.u(502)), 3, '…sur 3');
select is((select count(*)::int from public.quiz_answers where attempt_id = tests.u(502)), 3, 'une seule série de réponses');
select is((select count(*)::int from public.quiz_answers where attempt_id = tests.u(502) and not is_correct), 1, 'détail par question: 1 fausse');
select is((select is_correct from public.quiz_answers where attempt_id = tests.u(502) and question_id = tests.u(402)), false, '…la question 2');
select is((select choice_index <> 0 from public.quiz_answers where attempt_id = tests.u(502) and question_id = tests.u(402)), true, 'réponse stockée en indice D''ORIGINE (≠ bonne réponse 0)');
select throws_ok($$select public.validate_quiz_attempt(tests.u(999))$$, 'P0002', 'attempt_not_found', 'validation d''une tentative inconnue refusée');
select lives_ok($$select public.validate_quiz_attempt(tests.u(502))$$, 'parent: valide SANS activer la correction (défaut)');
select is((select show_correction from public.quiz_attempts where id = tests.u(502)), false, 'réglage enregistré côté serveur: correction désactivée');
select lives_ok($$select public.validate_quiz_attempt(tests.u(502), true)$$, 'validation rejouée : sans effet');
select is((select show_correction from public.quiz_attempts where id = tests.u(502)), false, '…le réglage posé à la validation ne change plus');
select tests.login(13);
select is(((public.child_quiz_result(tests.u(502)))->>'score')::int, 2, 'A: voit son score APRÈS validation');
select is(jsonb_array_length((public.child_quiz_result(tests.u(502)))->'missed'), 1, 'A: voit la liste des questions RATÉES (1)');
select is((((public.child_quiz_result(tests.u(502)))->'missed')->0)->>'prompt', 'Quelle fraction vaut 0,5 ?', 'A: …énoncé de la question ratée');
select is(((public.child_quiz_result(tests.u(502)))->>'show_correction')::boolean, false, 'A: le résultat indique que la correction est désactivée');
reset role;
select is((((public.child_quiz_result(tests.u(502)))->'missed')->0)->>'chosen_text',
          (select q.choices[a.choice_index + 1] from public.quiz_answers a join public.quiz_questions q on q.id = a.question_id where a.attempt_id = tests.u(502) and a.question_id = tests.u(402)),
          'A: …avec SA réponse (texte)');
select tests.login(13);
select ok((public.child_quiz_result(tests.u(502)))::text !~ '(correct_index|explanation|is_correct|"questions")', 'SANS bonne réponse, sans explication, sans juste/faux par question (correction désactivée, APRÈS validation)');
select is(((public.child_quiz_result(tests.u(502))) ? 'questions'), false, 'pas de liste complète de questions');
select is((select count(*)::int from public.child_quiz_history(tests.u(301))), 1, 'A: historique = l''évaluation validée');
select is(tests.n('select 1 from public.quiz_answer_keys'), 0::bigint, 'A: clé toujours illisible après validation');
select is(tests.n('select 1 from public.quiz_answers'), 0::bigint, 'A: réponses (is_correct) toujours illisibles après validation');
select tests.login(14);
select throws_ok($$select public.child_quiz_result(tests.u(502))$$, 'P0002', 'attempt_not_found', 'B: ne voit pas le résultat de A, même validé');
select is((select count(*)::int from public.child_quiz_history(tests.u(301))), 0, 'B: aucun historique de A');

-- ───────────── relance par le parent : nouvelle tentative, nouveau mélange, historique conservé ─────────────
select tests.login(11);
select lives_ok($$select public.relaunch_quiz_evaluation(tests.u(301), tests.u(503))$$, 'parent: relance une évaluation');
select lives_ok($$select public.relaunch_quiz_evaluation(tests.u(301), tests.u(503))$$, 'relance rejouée : idempotent');
select throws_ok($$select public.relaunch_quiz_evaluation(tests.u(301), tests.u(593))$$, 'P0001', 'attempt_in_progress', 'pas de seconde relance tant qu''une tentative est ouverte');
select is((select count(*)::int from public.quiz_attempts where set_id = tests.u(301)), 2, 'historique conservé: 2 tentatives');
select is((select count(*)::int from public.quiz_attempt_layouts where attempt_id in (tests.u(502), tests.u(503))), 2, 'chaque tentative a SON mélange');
select tests.login(13);
select is((select evaluation_status::text from public.child_quiz_sets()), 'in_progress', 'A: voit la nouvelle tentative à passer');
select is((select count(*)::int from public.child_quiz_questions(tests.u(503))), 3, 'A: reçoit les questions de la nouvelle tentative');
select throws_ok($$select * from public.child_quiz_questions(tests.u(502))$$, 'P0001', 'attempt_closed', 'A: l''ancienne tentative reste fermée (aucune relecture)');
reset role;
select set_config('tests.sub503', tests.answers(tests.u(503))::text, true);
select tests.login(13);
select lives_ok($$select public.submit_quiz_evaluation(tests.u(503), current_setting('tests.sub503')::jsonb)$$, 'A: soumet la 2e évaluation (tout juste)');
select tests.login(11);
select is((select score from public.quiz_results where attempt_id = tests.u(503)), 3, '2e évaluation: 3/3 (le serveur convertit les positions affichées)');
select is((select score from public.quiz_results where attempt_id = tests.u(502)), 2, '1re évaluation conservée: 2/3');
select lives_ok($$select public.validate_quiz_attempt(tests.u(503), true)$$, 'parent: valide la 2e AVEC la correction');
select is((select show_correction from public.quiz_attempts where id = tests.u(503)), true, 'réglage enregistré: correction activée pour CETTE tentative');
-- correction activée : bonne réponse, explication, juste/faux, uniquement pour SA tentative
select tests.login(13);
select is(jsonb_array_length((public.child_quiz_result(tests.u(503)))->'questions'), 3, 'A: correction activée → les 3 questions');
select is(((public.child_quiz_result(tests.u(503))) ? 'missed'), false, '…et plus de liste « ratées » séparée');
select is((select count(*)::int from jsonb_array_elements((public.child_quiz_result(tests.u(503)))->'questions') e where (e->>'is_correct')::boolean), 3, 'A: juste/faux visibles (3 justes)');
select is((select count(*)::int from jsonb_array_elements((public.child_quiz_result(tests.u(503)))->'questions') e where e->>'explanation' is not null), 2, 'A: explications visibles (2 questions en ont une)');
reset role;
select is((select count(*)::int from jsonb_array_elements((public.child_quiz_result(tests.u(503)))->'questions') e
           where (e->'choices')->>((e->>'correct_index')::int) = (select q.choices[k.correct_index + 1] from public.quiz_questions q join public.quiz_answer_keys k on k.question_id = q.id where q.id = (e->>'question_id')::uuid)), 3,
          'A: la bonne réponse indiquée correspond au bon texte (positions du mélange de CETTE tentative)');
select tests.login(13);
select ok((public.child_quiz_result(tests.u(502)))::text !~ '(correct_index|explanation|is_correct)', 'la 1re tentative (correction désactivée) reste sans correction');
select is((select count(*)::int from public.child_quiz_history(tests.u(301))), 2, 'A: historique = 2 évaluations validées');
select tests.login(14);
select throws_ok($$select public.child_quiz_result(tests.u(503))$$, 'P0002', 'attempt_not_found', 'B: ne voit pas la correction de A');
select is(tests.n('select 1 from public.quiz_attempts'), 0::bigint, 'B: aucune tentative de A visible');

-- ───────────── jeu publié ou avec tentatives : questions figées ─────────────
select tests.login(11);
select throws_ok($$select public.upsert_quiz_question(tests.u(401), tests.u(301), 0, 'Modifié', array['a', 'b', 'c'], 0, null)$$, 'P0001', 'set_published', 'jeu publié: questions non modifiables');
select lives_ok($$select public.set_quiz_status(tests.u(301), 'draft')$$, 'parent: dépublie');
select throws_ok($$select public.upsert_quiz_question(tests.u(401), tests.u(301), 0, 'Modifié', array['a', 'b', 'c'], 0, null)$$, 'P0001', 'set_has_attempts', 'jeu avec tentatives: questions figées (copier le jeu)');
select throws_ok($$select public.delete_quiz_question(tests.u(401))$$, 'P0001', 'set_has_attempts', '…suppression aussi');
select tests.login(13);
select is(tests.n('select 1 from public.quiz_sets'), 0::bigint, 'A: un jeu dépublié disparaît');
select is((select count(*)::int from public.child_quiz_sets()), 0, 'A: …de la liste aussi');

-- ───────────── copie vers l'autre enfant ─────────────
select tests.login(11);
select lives_ok($$select public.copy_quiz_set(tests.u(301), tests.u(311), tests.u(202))$$, 'parent: copie le jeu pour B');
select lives_ok($$select public.copy_quiz_set(tests.u(301), tests.u(311), tests.u(202))$$, 'copie rejouée : idempotente');
select is((select status::text from public.quiz_sets where id = tests.u(311)), 'draft', 'la copie est un BROUILLON');
select is((select child_id from public.quiz_sets where id = tests.u(311)), tests.u(202), '…pour B');
select is((select count(*)::int from public.quiz_questions where set_id = tests.u(311)), 3, '…avec les 3 questions');
select is((select count(*)::int from public.quiz_answer_keys k join public.quiz_questions q on q.id = k.question_id where q.set_id = tests.u(311)), 3, '…et les 3 clés');
select is((select count(*)::int from public.quiz_attempts where set_id = tests.u(311)), 0, '…sans aucune tentative (source intacte)');
select lives_ok($$select public.upsert_quiz_question(tests.u(405), tests.u(311), 3, 'Question ajoutée à la copie', array['a', 'b', 'c'], 1, null)$$, 'la copie (brouillon sans tentative) est éditable');
select lives_ok($$select public.set_quiz_status(tests.u(311), 'published')$$, 'parent: publie la copie');
select tests.login(14);
select is(tests.n('select 1 from public.quiz_sets'), 1::bigint, 'B: voit SA copie publiée');
select is((select question_count from public.child_quiz_sets()), 4, 'B: 4 questions');
select tests.login(13);
select is(tests.n('select 1 from public.quiz_sets'), 0::bigint, 'A: ne voit pas la copie de B');
select tests.login(11);
select lives_ok($$select public.set_quiz_status(tests.u(301), 'published')$$, 'parent: republie le jeu de A');
select tests.login(13);
select is(tests.n('select 1 from public.quiz_attempts'), 2::bigint, 'A: voit SES 2 tentatives (état seulement)');
select tests.login(14);
select is(tests.n('select 1 from public.quiz_attempts'), 0::bigint, 'B: toujours aucune tentative');

-- ───────────── parent : toute la famille ; autre famille : rien ─────────────
select tests.login(11);
select is(tests.n('select 1 from public.quiz_sets'), 3::bigint, 'parent: voit les 3 jeux de la famille');
select is(tests.n('select 1 from public.quiz_attempts'), 2::bigint, 'parent: 2 tentatives');
select is(tests.n('select 1 from public.quiz_attempt_layouts'), 2::bigint, 'parent: voit les mélanges');
select tests.login(21);
select is(tests.n('select 1 from public.quiz_sets'), 0::bigint, 'autre famille: aucun jeu');
select is(tests.n('select 1 from public.quiz_questions'), 0::bigint, 'autre famille: aucune question');
select is(tests.n('select 1 from public.quiz_answer_keys'), 0::bigint, 'autre famille: aucune clé');
select is(tests.n('select 1 from public.quiz_attempts'), 0::bigint, 'autre famille: aucune tentative');
select is(tests.n('select 1 from public.quiz_results'), 0::bigint, 'autre famille: aucun score');
select is(tests.n('select 1 from public.quiz_answers'), 0::bigint, 'autre famille: aucune réponse');
select is(tests.n('select 1 from public.quiz_attempt_layouts'), 0::bigint, 'autre famille: aucun mélange');
select throws_ok($$select public.upsert_quiz_question(tests.u(405), tests.u(311), 3, 'Q', array['a', 'b', 'c'], 0, null)$$, 'P0002', 'set_not_found', 'autre famille: ne modifie pas');
select throws_ok($$select public.set_quiz_status(tests.u(301), 'draft')$$, 'P0002', 'set_not_found', 'autre famille: ne dépublie pas');
select throws_ok($$select public.copy_quiz_set(tests.u(301), tests.u(321), tests.u(221))$$, 'P0002', 'set_not_found', 'autre famille: ne copie pas');
select throws_ok($$select public.validate_quiz_attempt(tests.u(502), true)$$, 'P0002', 'attempt_not_found', 'autre famille: ne valide pas');
select throws_ok($$select public.relaunch_quiz_evaluation(tests.u(301), tests.u(593))$$, 'P0002', 'set_not_found', 'autre famille: ne relance pas');
select lives_ok($$insert into public.quiz_sets (id, family_id, child_id, title, created_by) values (tests.u(331), tests.u(2), tests.u(221), 'Jeu de B', tests.u(121))$$, 'autre famille: crée son propre jeu');
select lives_ok($$select public.upsert_quiz_question(tests.u(431), tests.u(331), 0, 'Q', array['a', 'b', 'c'], 0, null)$$, '…et sa question');

-- ───────────── rôles inversés ─────────────
select tests.login(11);
select throws_ok($$select * from public.child_quiz_sets()$$, '42501', 'forbidden', 'parent: n''utilise pas les RPC enfant');
select throws_ok($$select public.submit_quiz_evaluation(tests.u(503), '[]'::jsonb)$$, '42501', 'forbidden', 'parent: ne soumet pas pour l''enfant');
select throws_ok($$select * from public.child_quiz_questions(tests.u(503))$$, '42501', 'forbidden', 'parent: ne lit pas les questions « côté enfant »');

-- ───────────── anonyme ─────────────
reset role;
set local role anon;
select throws_ok($$select 1 from public.quiz_sets$$, '42501', null, 'anon: aucun accès aux jeux');
select throws_ok($$select * from public.quiz_answer_keys$$, '42501', null, 'anon: aucun accès aux clés');
select throws_ok($$select * from public.child_quiz_sets()$$, '42501', null, 'anon: aucune RPC');

-- ───────────── suppression de la famille : purge aussi les révisions ─────────────
select tests.login(21);
select lives_ok($$select public.delete_family()$$, 'autre famille: supprime sa famille');
reset role;
select is((select count(*)::int from public.quiz_sets where family_id = tests.u(2)), 0, 'delete_family: jeux purgés');
select is((select count(*)::int from public.quiz_questions where family_id = tests.u(2)), 0, 'delete_family: questions purgées');
select is((select count(*)::int from public.quiz_sets where family_id = tests.u(1)), 3, 'delete_family: la famille A est intacte');
select is((select count(*)::int from public.quiz_attempt_layouts where family_id = tests.u(1)), 2, 'delete_family: les mélanges de la famille A sont intacts');

select * from finish();
rollback;
