-- D-061 « supports multiples » : type de support enregistré sur le jeu, drapeaux de questions, règle de publication côté serveur,
-- confirmation des réponses par le parent, relance gratuite après correction du type. Rien de tout cela n'est lisible par l'enfant (D-059).
-- Fixtures : famille 1 = parent 11, enfant A (user 13, profil 201), enfant B (user 14, profil 202) ; famille 2 = parent 21, enfant C (221).
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
create function tests.n(q text) returns bigint language plpgsql as $$
declare c bigint;
begin
  execute q;
  get diagnostics c = row_count;
  return c;
end $$;
-- toutes les questions d'un jeu, avec la réponse actuelle (ou une valeur imposée) : charge utile de confirm_quiz_answers
create function tests.confirm_all(p_set uuid) returns jsonb language sql stable as $$
  select jsonb_agg(jsonb_build_object('question_id', q.id, 'correct', k.correct_index)) from public.quiz_questions q join public.quiz_answer_keys k on k.question_id = q.id where q.set_id = p_set
$$;
grant execute on all functions in schema tests to authenticated, anon, service_role;

insert into auth.users (id, email, is_anonymous) values (tests.u(11), 'p1@test', false), (tests.u(13), null, false), (tests.u(14), null, false), (tests.u(21), 'pb@test', false);
insert into public.families (id, name, timezone) values (tests.u(1), 'A', 'Asia/Ho_Chi_Minh'), (tests.u(2), 'B', 'Asia/Ho_Chi_Minh');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2009-03-01'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01'), (tests.u(221), tests.u(2), 'Cam', '2012-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'),
  (tests.u(114), tests.u(1), tests.u(14), 'child', tests.u(202), 'Khang'), (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'Cha B');
select * from no_plan();

-- ───────────── structure ─────────────
select is((select count(*)::int from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'quiz_material_kind'), 1, 'type quiz_material_kind');
select is((select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'quiz_material_kind'), array['exam', 'exam_key', 'course', 'list'], 'valeurs : examen, examen avec corrigé, cours, liste');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'quiz_answer_keys' and column_name in ('to_verify', 'confirmed')), 2, 'drapeaux de réponse dans la table de la CLÉ');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name in ('quiz_sets', 'quiz_questions') and column_name in ('to_verify', 'confirmed')), 0, '…et JAMAIS sur les tables lisibles par l''enfant (sets, questions)');
-- aucune fonction enfant ne renvoie un drapeau de réponse
select ok(pg_get_function_result('public.child_quiz_questions(uuid)'::regprocedure) !~ '(verify|confirmed|kind)', 'child_quiz_questions : aucun drapeau « à vérifier »/confirmé/type');
select ok(pg_get_function_result('public.child_quiz_sets()'::regprocedure) !~ '(verify|confirmed)', 'child_quiz_sets : aucun drapeau');
select ok(pg_get_function_result('public.child_quiz_result(uuid)'::regprocedure) !~ '(verify|confirmed)', 'child_quiz_result : aucun drapeau');

-- ───────────── parent : brouillon généré (type examen détecté par l'IA) ─────────────
select tests.login(11);
select lives_ok($$select public.create_quiz_draft(tests.u(301), tests.u(201), 'Examen de maths', 'Toán', '[
  {"prompt":"Limite de (x+1)/(x−2) en +∞ ?","choices":["0","1","2","+∞"],"correct":1,"explanation":null,"number":5,"needs_figure":false,"to_verify":false},
  {"prompt":"D''après la courbe, f est croissante sur ?","choices":["[0;1]","[1;2]","[2;3]"],"correct":0,"explanation":null,"number":6,"needs_figure":true,"to_verify":false},
  {"prompt":"Racine de x² = 9 ?","choices":["3","4","9"],"correct":0,"explanation":"x = ±3","number":null,"needs_figure":false,"to_verify":true}]'::jsonb,
  'exam', true)$$, 'parent: enregistre un examen détecté par l''IA');
select is((select material_kind::text from public.quiz_sets where id = tests.u(301)), 'exam', 'type enregistré : examen');
select is((select kind_detected from public.quiz_sets where id = tests.u(301)), true, '…détecté par l''IA');
select is((select status::text from public.quiz_sets where id = tests.u(301)), 'draft', 'toujours un brouillon');
select is((select array_agg(origin_number order by position) from public.quiz_questions where set_id = tests.u(301)), array[5, 6, null]::int[], 'numéros d''origine conservés');
select is((select array_agg(needs_figure order by position) from public.quiz_questions where set_id = tests.u(301)), array[false, true, false], 'drapeau « dépend d''une figure »');
select is((select array_agg(k.to_verify order by q.position) from public.quiz_questions q join public.quiz_answer_keys k on k.question_id = q.id where q.set_id = tests.u(301)), array[false, true, true], 'INVARIANT : dépend d''une figure ⇒ réponse à vérifier (même si la fonction envoie false)');
select is((select count(*)::int from public.quiz_questions q join public.quiz_answer_keys k on k.question_id = q.id where q.set_id = tests.u(301) and k.confirmed), 0, 'aucune réponse confirmée à la création');
select throws_ok($$select public.create_quiz_draft(tests.u(399), tests.u(201), 't', null, '[{"prompt":"x","choices":["a","b","c"],"correct":0,"number":0}]'::jsonb)$$, 'P0001', 'invalid_number', 'numéro 0 refusé');
select throws_ok($$select public.create_quiz_draft(tests.u(399), tests.u(201), 't', null, '[{"prompt":"x","choices":["a","b","c"],"correct":0,"number":1000}]'::jsonb)$$, 'P0001', 'invalid_number', 'numéro 1000 refusé');
select throws_ok($$select public.create_quiz_draft(tests.u(399), tests.u(201), 't', null, '[{"prompt":"x","choices":["a","b","c"],"correct":0,"number":"5"}]'::jsonb)$$, 'P0001', 'invalid_number', 'numéro texte refusé');
select throws_ok($$select public.create_quiz_draft(tests.u(399), tests.u(201), 't', null, '[{"prompt":"x","choices":["a","b","c"],"correct":0}]'::jsonb, 'quiz')$$, '22P02', null, 'type inconnu refusé');
select is((select count(*)::int from public.quiz_sets where id = tests.u(399)), 0, 'un rejet n''enregistre rien');

-- ───────────── règle de publication : refusée tant qu'une réponse n'est pas confirmée ─────────────
select throws_ok($$select public.set_quiz_status(tests.u(301), 'published')$$, 'P0001', 'answers_to_verify', 'examen détecté par l''IA : publication REFUSÉE (réponses à vérifier)');
select is((select status::text from public.quiz_sets where id = tests.u(301)), 'draft', '…le jeu reste un brouillon');
-- confirmation partielle (la 1re seulement) : toujours refusé
select lives_ok($$select public.confirm_quiz_answers(tests.u(301), (select jsonb_build_array(jsonb_build_object('question_id', id, 'correct', 1)) from public.quiz_questions where set_id = tests.u(301) and origin_number = 5))$$, 'confirmation partielle (Câu 5 → B)');
select is((select k.correct_index::int from public.quiz_questions q join public.quiz_answer_keys k on k.question_id = q.id where q.set_id = tests.u(301) and q.origin_number = 5), 1, 'la réponse choisie devient la clé');
select throws_ok($$select public.set_quiz_status(tests.u(301), 'published')$$, 'P0001', 'answers_to_verify', 'toujours refusé tant qu''une question signalée n''est pas confirmée');
-- confirmer les deux autres sans lever le signalement n'est pas possible : confirmer LÈVE le signalement
select lives_ok($$select public.confirm_quiz_answers(tests.u(301), tests.confirm_all(tests.u(301)))$$, 'le parent confirme TOUTES les réponses');
select is((select count(*)::int from public.quiz_answer_keys k join public.quiz_questions q on q.id = k.question_id where q.set_id = tests.u(301) and (k.to_verify or not k.confirmed)), 0, 'tout est confirmé, plus rien à vérifier');
select lives_ok($$select public.set_quiz_status(tests.u(301), 'published')$$, 'publication autorisée une fois tout confirmé');

-- ───────────── examen SANS signalement : seule la confirmation manque ─────────────
select lives_ok($$select public.create_quiz_draft(tests.u(302), tests.u(201), 'Devoir', null, '[
  {"prompt":"2+2 ?","choices":["3","4","5","6"],"correct":1,"number":1},{"prompt":"3+3 ?","choices":["5","6","7","8"],"correct":1,"number":2}]'::jsonb, 'exam_key', true)$$, 'examen avec corrigé, aucune question signalée');
select throws_ok($$select public.set_quiz_status(tests.u(302), 'published')$$, 'P0001', 'answers_not_confirmed', 'examen avec corrigé : réponses lues mais NON confirmées → publication refusée');
select lives_ok($$select public.confirm_quiz_answers(tests.u(302), tests.confirm_all(tests.u(302)))$$, 'confirmation');
select lives_ok($$select public.set_quiz_status(tests.u(302), 'published')$$, '…puis publication');

-- ───────────── cours : comportement actuel, sauf question signalée ─────────────
select lives_ok($$select public.create_quiz_draft(tests.u(303), tests.u(201), 'Leçon', null, '[{"prompt":"Capitale ?","choices":["Hanoï","Hué","Saïgon"],"correct":0}]'::jsonb, 'course', true)$$, 'cours détecté par l''IA');
select lives_ok($$select public.set_quiz_status(tests.u(303), 'published')$$, 'cours sans signalement : publication libre (comportement actuel)');
select lives_ok($$select public.create_quiz_draft(tests.u(304), tests.u(201), 'Leçon 2', null, '[{"prompt":"Q1 ?","choices":["a","b","c"],"correct":0,"to_verify":true}]'::jsonb, 'course', true)$$, 'cours avec une réponse incertaine');
select throws_ok($$select public.set_quiz_status(tests.u(304), 'published')$$, 'P0001', 'answers_to_verify', 'un TYPE détecté « cours » n''affaiblit pas le contrôle : question signalée = publication refusée');
select lives_ok($$select public.confirm_quiz_answers(tests.u(304), tests.confirm_all(tests.u(304)))$$, 'le parent confirme');
select lives_ok($$select public.set_quiz_status(tests.u(304), 'published')$$, '…publication autorisée');

-- ───────────── corriger le type : les règles suivent le type enregistré ─────────────
select lives_ok($$select public.create_quiz_draft(tests.u(305), tests.u(201), 'Mal détecté', null, '[{"prompt":"Q1 ?","choices":["a","b","c"],"correct":0}]'::jsonb, 'course', true)$$, 'jeu détecté « cours »');
select lives_ok($$select public.set_quiz_material_kind(tests.u(305), 'exam')$$, 'le parent corrige : examen');
select is((select material_kind::text || '/' || kind_detected::text from public.quiz_sets where id = tests.u(305)), 'exam/false', 'type enregistré corrigé, plus « détecté »');
select throws_ok($$select public.set_quiz_status(tests.u(305), 'published')$$, 'P0001', 'answers_not_confirmed', 'après correction en examen : confirmation requise');
select lives_ok($$select public.confirm_quiz_answers(tests.u(305), tests.confirm_all(tests.u(305)))$$, 'confirmation');
select lives_ok($$select public.set_quiz_status(tests.u(305), 'published')$$, 'publication');
select throws_ok($$select public.set_quiz_material_kind(tests.u(305), 'course')$$, 'P0001', 'set_published', 'type non modifiable sur un jeu publié');
select throws_ok($$select public.confirm_quiz_answers(tests.u(305), tests.confirm_all(tests.u(305)))$$, 'P0001', 'set_published', 'réponses non modifiables sur un jeu publié');
-- aucune écriture directe du type, des drapeaux ni de la confirmation
select throws_ok($$update public.quiz_sets set material_kind = 'course' where id = tests.u(301)$$, '42501', null, 'parent: pas d''écriture directe du type');
select throws_ok($$update public.quiz_answer_keys set confirmed = true$$, '42501', null, 'parent: pas d''écriture directe de la confirmation');
select throws_ok($$update public.quiz_questions set needs_figure = false$$, '42501', null, 'parent: pas d''écriture directe des drapeaux de question');
select throws_ok($$insert into public.quiz_sets (id, family_id, child_id, title, created_by, material_kind) values (tests.u(398), tests.u(1), tests.u(201), 'x', tests.u(111), 'exam')$$, '42501', null, 'parent: pas de type imposé à la création directe');

-- ───────────── validations de confirm_quiz_answers ─────────────
select lives_ok($$select public.create_quiz_draft(tests.u(306), tests.u(201), 'À confirmer', null, '[{"prompt":"Q1 ?","choices":["a","b","c"],"correct":0},{"prompt":"Q2 ?","choices":["a","b","c","d"],"correct":3}]'::jsonb, 'exam')$$, 'jeu de test');
select throws_ok($$select public.confirm_quiz_answers(tests.u(306), '[{"question_id":"00000000-0000-0000-0000-000000000999","correct":0}]'::jsonb)$$, 'P0001', 'invalid_question', 'question inconnue refusée');
select throws_ok($$select public.confirm_quiz_answers(tests.u(306), (select jsonb_build_array(jsonb_build_object('question_id', id, 'correct', 3)) from public.quiz_questions where set_id = tests.u(306) and position = 0))$$, 'P0001', 'invalid_correct', 'réponse hors plage refusée (3 choix)');
select throws_ok($$select public.confirm_quiz_answers(tests.u(306), (select jsonb_build_array(jsonb_build_object('question_id', id, 'correct', 0)) from public.quiz_questions where set_id = tests.u(301) limit 1))$$, 'P0001', 'invalid_question', 'question d''un AUTRE jeu refusée');
select throws_ok($$select public.confirm_quiz_answers(tests.u(306), '[]'::jsonb)$$, 'P0001', 'invalid_question', 'liste vide refusée');
select throws_ok($$select public.confirm_quiz_answers(tests.u(306), '{"a":1}'::jsonb)$$, 'P0001', 'invalid_question', 'format invalide refusé');
select is((select count(*)::int from public.quiz_answer_keys k join public.quiz_questions q on q.id = k.question_id where q.set_id = tests.u(306) and k.confirmed), 0, 'un rejet ne confirme rien (atomique)');
select throws_ok($$select public.confirm_quiz_answers(tests.u(306), (select jsonb_build_array(jsonb_build_object('question_id', id, 'correct', 1), jsonb_build_object('question_id', id, 'correct', 9)) from public.quiz_questions where set_id = tests.u(306) and position = 0))$$, 'P0001', 'invalid_correct', 'une réponse invalide parmi plusieurs');
select is((select count(*)::int from public.quiz_answer_keys k join public.quiz_questions q on q.id = k.question_id where q.set_id = tests.u(306) and k.confirmed), 0, '…aucune confirmation partielle n''est conservée');

-- ───────────── édition d'une question : la bonne réponse choisie à la main vaut confirmation ─────────────
select lives_ok($$select public.upsert_quiz_question(tests.u(890), tests.u(306), 2, 'Q3 ?', array['a', 'b', 'c'], 1, null)$$, 'saisie manuelle d''une nouvelle question');
select is((select k.confirmed from public.quiz_answer_keys k where k.question_id = tests.u(890)), true, 'une question saisie à la main est confirmée');
select lives_ok($$select public.upsert_quiz_question((select id from public.quiz_questions where set_id = tests.u(306) and position = 0), tests.u(306), 0, 'Q1 reformulée ?', array['a', 'b', 'c'], 0, null)$$, 'modifier seulement l''énoncé');
select is((select k.confirmed from public.quiz_answer_keys k join public.quiz_questions q on q.id = k.question_id where q.set_id = tests.u(306) and q.position = 0), false, '…ne confirme rien');
select lives_ok($$select public.upsert_quiz_question((select id from public.quiz_questions where set_id = tests.u(306) and position = 0), tests.u(306), 0, 'Q1 reformulée ?', array['a', 'b', 'c'], 2, null)$$, 'modifier la bonne réponse');
select is((select k.confirmed from public.quiz_answer_keys k join public.quiz_questions q on q.id = k.question_id where q.set_id = tests.u(306) and q.position = 0), true, '…la confirme');

-- ───────────── relance du même brouillon (correction du type) ─────────────
select lives_ok($$select public.create_quiz_draft(tests.u(307), tests.u(201), 'Doc', null, '[{"prompt":"Ancienne ?","choices":["a","b","c"],"correct":0}]'::jsonb, 'course', true)$$, 'génération initiale');
select lives_ok($$select public.create_quiz_draft(tests.u(307), tests.u(201), 'Doc', null, '[{"prompt":"Nouvelle 1 ?","choices":["a","b","c"],"correct":1,"number":1},{"prompt":"Nouvelle 2 ?","choices":["a","b","c"],"correct":2,"number":2}]'::jsonb, 'exam', false, true)$$, 'relance avec le type corrigé : remplace le brouillon');
select is((select count(*)::int from public.quiz_questions where set_id = tests.u(307)), 2, 'les anciennes questions sont remplacées');
select is((select material_kind::text from public.quiz_sets where id = tests.u(307)), 'exam', 'type corrigé');
select is((select count(*)::int from public.quiz_answer_keys k join public.quiz_questions q on q.id = k.question_id where q.set_id = tests.u(307)), 2, 'clés remplacées aussi (aucune orpheline)');
select throws_ok($$select public.create_quiz_draft(tests.u(307), tests.u(202), 'Doc', null, '[{"prompt":"x","choices":["a","b","c"],"correct":0}]'::jsonb, 'exam', false, true)$$, '42501', 'forbidden', 'relance refusée pour un AUTRE enfant');
select throws_ok($$select public.create_quiz_draft(tests.u(301), tests.u(201), 'Doc', null, '[{"prompt":"x","choices":["a","b","c"],"correct":0}]'::jsonb, 'exam', false, true)$$, 'P0001', 'set_published', 'relance refusée sur un jeu publié');
select throws_ok($$select public.create_quiz_draft(tests.u(396), tests.u(201), 'Doc', null, '[{"prompt":"x","choices":["a","b","c"],"correct":0}]'::jsonb, 'exam', false, true)$$, 'P0002', 'set_not_found', 'relance d''un jeu inexistant refusée');
select lives_ok($$select public.create_quiz_draft(tests.u(307), tests.u(201), 'Rejeu', null, '[{"prompt":"x","choices":["a","b","c"],"correct":0}]'::jsonb)$$, 'rejeu sans remplacement : idempotent');
select is((select count(*)::int from public.quiz_questions where set_id = tests.u(307)), 2, '…aucune modification');

-- ───────────── copie : type et drapeaux repris, toujours en brouillon ─────────────
select lives_ok($$select public.copy_quiz_set(tests.u(301), tests.u(310), tests.u(202))$$, 'copie de l''examen publié vers B');
select is((select material_kind::text || '/' || status::text from public.quiz_sets where id = tests.u(310)), 'exam/draft', 'copie : même type, brouillon');
select is((select count(*)::int from public.quiz_questions where set_id = tests.u(310) and (origin_number is not null)), 2, 'copie : numéros d''origine repris');
select is((select count(*)::int from public.quiz_questions where set_id = tests.u(310) and needs_figure), 1, 'copie : drapeau « figure » repris');
select is((select count(*)::int from public.quiz_answer_keys k join public.quiz_questions q on q.id = k.question_id where q.set_id = tests.u(310) and k.confirmed), 3, 'copie : confirmation reprise telle quelle');

-- ───────────── ENFANT : rien de tout cela n'est lisible ─────────────
select tests.login(13);
select is(tests.n('select 1 from public.quiz_answer_keys'), 0::bigint, 'enfant A: aucune clé (donc aucun drapeau de réponse)');
select is(tests.n('select 1 from public.quiz_questions'), 0::bigint, 'enfant A: aucune question en table (numéros, figures)');
select is(tests.n('select to_verify, confirmed from public.quiz_answer_keys'), 0::bigint, 'enfant A: ni « à vérifier » ni « confirmé » (0 ligne)');
select throws_ok($$select public.confirm_quiz_answers(tests.u(301), '[]'::jsonb)$$, '42501', 'forbidden', 'enfant: ne confirme pas');
select throws_ok($$select public.set_quiz_material_kind(tests.u(301), 'course')$$, '42501', 'forbidden', 'enfant: ne change pas le type');
select throws_ok($$select public.set_quiz_status(tests.u(301), 'draft')$$, '42501', 'forbidden', 'enfant: ne dépublie pas');
select throws_ok($$select public.create_quiz_draft(tests.u(395), tests.u(201), 't', null, '[{"prompt":"x","choices":["a","b","c"],"correct":0}]'::jsonb, 'exam', false, true)$$, '42501', 'forbidden', 'enfant: ne génère ni ne remplace');
select is((select count(*)::int from public.child_quiz_sets()), 5, 'enfant A: voit SES 5 jeux publiés via la RPC (rien du brouillon, rien de B)');
select tests.login(14);
select is(tests.n('select 1 from public.quiz_answer_keys'), 0::bigint, 'enfant B: aucune clé');
select is((select count(*)::int from public.child_quiz_sets()), 0, 'enfant B: ne voit rien de A (la copie est un brouillon)');
select tests.login(21);
select throws_ok($$select public.confirm_quiz_answers(tests.u(301), '[]'::jsonb)$$, 'P0002', 'set_not_found', 'autre famille: ne confirme pas');
select throws_ok($$select public.set_quiz_material_kind(tests.u(301), 'course')$$, 'P0002', 'set_not_found', 'autre famille: ne change pas le type');
select throws_ok($$select public.set_quiz_status(tests.u(301), 'draft')$$, 'P0002', 'set_not_found', 'autre famille: ne dépublie pas');
select throws_ok($$select public.create_quiz_draft(tests.u(307), tests.u(221), 'x', null, '[{"prompt":"x","choices":["a","b","c"],"correct":0}]'::jsonb, 'exam', false, true)$$, '42501', 'forbidden', 'autre famille: ne remplace pas un brouillon');
select is(tests.n('select 1 from public.quiz_answer_keys'), 0::bigint, 'autre famille: aucune clé');
reset role;
set local role anon;
select throws_ok($$select public.confirm_quiz_answers(tests.u(301), '[]'::jsonb)$$, '42501', null, 'anon: confirm_quiz_answers refusé');
select throws_ok($$select public.set_quiz_material_kind(tests.u(301), 'course')$$, '42501', null, 'anon: set_quiz_material_kind refusé');

-- ───────────── type modifiable seulement sans tentative ─────────────
select tests.login(14);
select tests.login(13);
select lives_ok($$select public.start_quiz_evaluation(tests.u(303), tests.u(501))$$, 'enfant A: démarre une évaluation (jeu « cours » publié)');
select tests.login(11);
select throws_ok($$select public.set_quiz_material_kind(tests.u(303), 'exam')$$, 'P0001', 'set_published', 'type d''un jeu publié : refusé');
select lives_ok($$select public.set_quiz_status(tests.u(303), 'draft')$$, 'dépublication');
select throws_ok($$select public.set_quiz_material_kind(tests.u(303), 'exam')$$, 'P0001', 'set_has_attempts', 'type d''un jeu avec tentative : refusé');

-- ───────────── relance gratuite (quota) : clé service ─────────────
reset role;
set local role service_role;
select is((select allowed from public.ai_reserve(tests.u(1), tests.u(111), 50, timestamptz '2026-07-02 03:00:00+00', tests.u(307), false)), true, 'génération initiale du jeu 307 : comptée');
select is(public.ai_usage_today(tests.u(1), timestamptz '2026-07-02 03:00:00+00'), 1, 'quota du jour : 1');
select lives_ok($$select public.ai_finish((select id from public.ai_usage where set_id = tests.u(307)), 'success', null, 'gpt-5.4-mini', 100, 100)$$, 'génération réussie');
select is((select free from public.ai_reserve(tests.u(1), tests.u(111), 50, timestamptz '2026-07-02 03:10:00+00', tests.u(307), true)), true, 'relance (type corrigé) : GRATUITE');
select is(public.ai_usage_today(tests.u(1), timestamptz '2026-07-02 03:10:00+00'), 1, '…le quota du jour n''a pas bougé');
select is((select count(*)::int from public.ai_usage where set_id = tests.u(307) and not counted), 1, '…la relance est journalisée (non comptée)');
select lives_ok($$select public.ai_finish((select id from public.ai_usage where set_id = tests.u(307) and not counted), 'success', null, 'gpt-5.4-mini', 100, 100)$$, 'relance réussie');
select is((select free from public.ai_reserve(tests.u(1), tests.u(111), 50, timestamptz '2026-07-02 03:20:00+00', tests.u(307), true)), false, 'une 2e relance n''est PAS gratuite');
select is(public.ai_usage_today(tests.u(1), timestamptz '2026-07-02 03:20:00+00'), 2, '…elle consomme du quota');

-- une relance gratuite ÉCHOUÉE ne consomme pas le droit (jeu 309, brouillon créé par le parent)
select is((select allowed from public.ai_reserve(tests.u(1), tests.u(111), 50, timestamptz '2026-07-02 04:00:00+00', tests.u(309), false)), true, 'jeu 309 : génération initiale');
select lives_ok($$select public.ai_finish((select id from public.ai_usage where set_id = tests.u(309)), 'success', null, 'm', 1, 1)$$, 'réussie');
select tests.login(11);
select lives_ok($$select public.create_quiz_draft(tests.u(309), tests.u(201), 'Jeu 309', null, '[{"prompt":"x","choices":["a","b","c"],"correct":0}]'::jsonb)$$, 'brouillon du jeu 309');
reset role;
set local role service_role;
select is((select free from public.ai_reserve(tests.u(1), tests.u(111), 50, timestamptz '2026-07-02 04:05:00+00', tests.u(309), true)), true, 'jeu 309 : 1re relance gratuite');
select lives_ok($$select public.ai_finish((select id from public.ai_usage where set_id = tests.u(309) and not counted), 'failed', 'ai_error', 'm', 0, 0)$$, 'cette relance ÉCHOUE');
select is((select free from public.ai_reserve(tests.u(1), tests.u(111), 50, timestamptz '2026-07-02 04:10:00+00', tests.u(309), true)), true, 'après un échec, la relance gratuite est conservée');

-- pas de relance gratuite : jeu jamais généré, autre famille, jeu publié, jeu avec tentative
select is((select free from public.ai_reserve(tests.u(1), tests.u(111), 50, timestamptz '2026-07-02 04:20:00+00', tests.u(397), true)), false, 'jeu jamais généré : pas gratuit');
select is((select free from public.ai_reserve(tests.u(2), tests.u(121), 50, timestamptz '2026-07-02 04:20:00+00', tests.u(307), true)), false, 'autre famille : le jeu 307 ne lui ouvre aucun droit');
select is((select allowed from public.ai_reserve(tests.u(1), tests.u(111), 50, timestamptz '2026-07-02 04:30:00+00', tests.u(305), false)), true, 'jeu 305 (publié) : génération comptée');
select lives_ok($$select public.ai_finish((select id from public.ai_usage where set_id = tests.u(305) order by created_at desc limit 1), 'success', null, 'm', 1, 1)$$, 'réussie');
select is((select free from public.ai_reserve(tests.u(1), tests.u(111), 50, timestamptz '2026-07-02 04:31:00+00', tests.u(305), true)), false, 'jeu PUBLIÉ : relance non gratuite');
select is((select allowed from public.ai_reserve(tests.u(1), tests.u(111), 50, timestamptz '2026-07-02 04:40:00+00', tests.u(303), false)), true, 'jeu 303 (avec tentative) : génération comptée');
select lives_ok($$select public.ai_finish((select id from public.ai_usage where set_id = tests.u(303) order by created_at desc limit 1), 'success', null, 'm', 1, 1)$$, 'réussie');
select is((select free from public.ai_reserve(tests.u(1), tests.u(111), 50, timestamptz '2026-07-02 04:41:00+00', tests.u(303), true)), false, 'jeu AVEC TENTATIVE : relance non gratuite');

-- limite atteinte : la relance gratuite passe, une génération normale non
select is((select allowed from public.ai_reserve(tests.u(1), tests.u(111), 1, timestamptz '2026-07-02 05:00:00+00', null, false)), false, 'limite atteinte : génération normale refusée');
select lives_ok($$select public.ai_finish((select id from public.ai_usage where set_id = tests.u(309) and not counted and status = 'started' order by created_at desc limit 1), 'failed', 'x', 'm', 0, 0)$$, 'nettoyage de la relance ouverte');
select is((select allowed and free from public.ai_reserve(tests.u(1), tests.u(111), 1, timestamptz '2026-07-02 05:10:00+00', tests.u(309), true)), true, 'limite atteinte : la relance gratuite passe quand même');
select tests.login(11);
select throws_ok($$select * from public.ai_reserve(tests.u(1), tests.u(111), 20, now(), tests.u(307), true)$$, '42501', null, 'client: ai_reserve toujours interdit (signature étendue)');

select * from finish();
rollback;
