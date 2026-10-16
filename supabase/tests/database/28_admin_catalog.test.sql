-- D-080 espace ADMINISTRATEUR + catalogue de QCM : identité admin, tables fermées (RLS sans politique, aucun droit client), rôle admin vérifié côté base,
-- publication bornée (D-061 + dates), dépublication libre, IA (cible admin, relance gratuite).
-- Fixtures : famille 1 = parent 11 (ADMIN), enfant A (user 13, profil 201) ; famille 2 = parent 21 (parent ordinaire), enfant C (user 23, profil 203).
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
-- lecture « propriétaire » d'une valeur (les tables du catalogue ne sont lisibles par aucun rôle client, même admin)
create function tests.val(q text) returns text language plpgsql security definer as $$
declare r text;
begin execute q into r; return r; end $$;
grant execute on all functions in schema tests to authenticated, anon, service_role;

insert into auth.users (id, email, is_anonymous) values (tests.u(11), 'admin@test', false), (tests.u(13), null, false), (tests.u(21), 'pb@test', false), (tests.u(23), null, false);
insert into public.families (id, name, timezone) values (tests.u(1), 'A', 'Asia/Ho_Chi_Minh'), (tests.u(2), 'B', 'Asia/Ho_Chi_Minh');
insert into public.children (id, family_id, name, birth_date) values (tests.u(201), tests.u(1), 'Minh', '2009-03-01'), (tests.u(203), tests.u(2), 'Lan', '2010-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'),
  (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'Cha B'), (tests.u(123), tests.u(2), tests.u(23), 'child', tests.u(203), 'Lan');
select * from no_plan();

-- ───────────── structure : tables fermées ─────────────
select is((select count(*)::int from pg_class where oid in ('public.platform_admins'::regclass, 'public.catalog_quizzes'::regclass, 'public.catalog_questions'::regclass,
           'public.catalog_answer_keys'::regclass, 'public.child_subjects'::regclass) and relrowsecurity), 5, 'les 5 nouvelles tables ont la RLS');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('platform_admins', 'catalog_quizzes', 'catalog_questions', 'catalog_answer_keys', 'child_subjects')),
          0, 'aucune politique : rien n''est lisible ni modifiable directement');
select is((select bool_or(has_table_privilege(r, t, p))
           from unnest(array['public.platform_admins', 'public.catalog_quizzes', 'public.catalog_questions', 'public.catalog_answer_keys', 'public.child_subjects']) t,
                unnest(array['anon', 'authenticated']) r, unnest(array['select', 'insert', 'update', 'delete']) p), false, 'aucun droit de table pour anon ni authenticated');
select is((select count(*)::int from public.platform_admins), 0, 'la migration ne crée AUCUN administrateur');
select ok(pg_get_function_result('public.is_platform_admin()'::regprocedure) = 'boolean', 'is_platform_admin : un booléen, rien d''autre');
select is((select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('catalog_require_admin', 'quiz_attempt_items', 'catalog_for_child', 'catalog_editable',
           'catalog_check_slot', 'catalog_make_layout', 'catalog_new_attempt') and has_function_privilege('authenticated', p.oid, 'execute')), 0, 'aides internes : non appelables par un client');

-- ───────────── personne n'est admin par défaut ─────────────
select tests.login(11);
select is(public.is_platform_admin(), false, 'avant inscription : même le parent 11 n''est pas admin');
select throws_ok($$select public.catalog_list()$$, '42501', 'forbidden', 'non admin : catalog_list refusé');
select throws_ok($$select public.catalog_create_quiz(tests.u(900), 'VN', '5', 'maths', 'Tuần 1', 'T')$$, '42501', 'forbidden', 'non admin : création refusée');
select throws_ok($$select public.ai_target_admin()$$, '42501', 'forbidden', 'non admin : ai_target_admin refusé');
select throws_ok($$insert into public.platform_admins (user_id) values (tests.u(11))$$, '42501', null, 'un utilisateur ne peut pas s''ajouter lui-même aux admins');
select throws_ok($$select * from public.platform_admins$$, '42501', null, 'platform_admins illisible par un client');

-- Inscription de l'admin (hors client : comme la requête SQL manuelle du propriétaire).
reset role;
insert into public.platform_admins (user_id) values (tests.u(11));

-- ───────────── admin ─────────────
select tests.login(11);
select is(public.is_platform_admin(), true, 'admin : is_platform_admin vrai');
select tests.login(21);
select is(public.is_platform_admin(), false, 'autre parent : faux (ne voit que son propre statut)');
select tests.login(13);
select is(public.is_platform_admin(), false, 'enfant : faux');
select throws_ok($$select public.catalog_list()$$, '42501', 'forbidden', 'enfant : catalogue refusé');
select tests.login(21);
select throws_ok($$select public.catalog_list()$$, '42501', 'forbidden', 'autre parent : catalogue refusé');
select throws_ok($$select public.create_catalog_draft(tests.u(901), 'VN', '5', 'maths', 'Tuần 1', 'T', '[{"prompt":"Q","choices":["a","b"],"correct":0}]'::jsonb)$$, '42501', 'forbidden', 'autre parent : import refusé');
select throws_ok($$select public.catalog_set_status(tests.u(901), 'published')$$, '42501', 'forbidden', 'autre parent : publication refusée');
select throws_ok($$select public.catalog_questions_admin(tests.u(901))$$, '42501', 'forbidden', 'autre parent : clés refusées');
select throws_ok($$select public.ai_target_admin()$$, '42501', 'forbidden', 'autre parent : ai_target_admin refusé');
select throws_ok($$select * from public.catalog_answer_keys$$, '42501', null, 'autre parent : table des clés illisible');

select tests.login(11);
-- clés de case
select throws_ok($$select public.catalog_create_quiz(tests.u(900), 'XX', '5', 'maths', 'Tuần 1', 'T')$$, 'P0001', 'invalid_country', 'pays inconnu refusé');
select throws_ok($$select public.catalog_create_quiz(tests.u(900), 'VN', '', 'maths', 'Tuần 1', 'T')$$, 'P0001', 'invalid_grade', 'classe vide refusée');
select throws_ok($$select public.catalog_create_quiz(tests.u(900), 'VN', '5', 'Maths!', 'Tuần 1', 'T')$$, 'P0001', 'invalid_subject', 'matière invalide refusée');
select throws_ok($$select public.catalog_create_quiz(tests.u(900), 'VN', '5', 'maths', '', 'T')$$, 'P0001', 'invalid_week', 'semaine vide refusée');
select throws_ok($$select public.catalog_create_quiz(tests.u(900), 'VN', '5', 'maths', 'Tuần 1', '')$$, 'P0001', 'invalid_title', 'titre vide refusé');

-- import (brouillon) : réponse « à vérifier » et figure
select lives_ok($$select public.create_catalog_draft(tests.u(701), 'VN', '5', 'hist_geo', 'Tuần 1', 'Lịch sử', '[
  {"prompt":"Capitale ?","choices":["Hà Nội","Huế","Sài Gòn","Đà Nẵng"],"correct":0,"explanation":"Capitale","source":"SGK p.12"},
  {"prompt":"Fleuve ?","choices":["Rouge","Noir","Blanc","Vert"],"correct":0,"to_verify":true},
  {"prompt":"Voir la carte","choices":["a","b","c"],"correct":1,"needs_figure":true}]'::jsonb)$$, 'admin : importe le brouillon 701');
select is(tests.val('select status::text from public.catalog_quizzes where id = tests.u(701)'), 'draft', 'le brouillon est un brouillon');
select is(tests.val('select grade from public.catalog_quizzes where id = tests.u(701)'), '5', 'classe normalisée');
select is(tests.val('select count(*)::int from public.catalog_questions where quiz_id = tests.u(701)'), '3', '3 questions');
select is(tests.val('select count(*)::int from public.catalog_answer_keys k join public.catalog_questions q on q.id = k.question_id where q.quiz_id = tests.u(701) and k.to_verify'), '2', 'figure ⇒ à vérifier : 2 réponses à vérifier');
select is(tests.val('select source from public.catalog_questions where quiz_id = tests.u(701) and position = 0'), 'SGK p.12', 'la source est conservée');
select lives_ok($$select public.create_catalog_draft(tests.u(701), 'VN', '5', 'hist_geo', 'Tuần 1', 'Lịch sử', '[{"prompt":"x","choices":["a","b"],"correct":0}]'::jsonb)$$, 'rejeu idempotent');
select is(tests.val('select count(*)::int from public.catalog_questions where quiz_id = tests.u(701)'), '3', '…rien n''est dupliqué');
select throws_ok($$select public.create_catalog_draft(tests.u(702), 'VN', '5', 'hist_geo', 'Tuần 1', 'Autre', '[{"prompt":"x","choices":["a","b"],"correct":0}]'::jsonb)$$, 'P0001', 'catalog_slot_taken', 'case (pays, classe, matière, semaine) déjà prise');
select throws_ok($$select public.create_catalog_draft(tests.u(703), 'VN', '5', 'maths', 'Tuần 1', 'x', '[{"prompt":"x","choices":["a","a","b"],"correct":0}]'::jsonb)$$, 'P0001', 'duplicate_choices', 'choix en double refusés');
select throws_ok($$select public.create_catalog_draft(tests.u(703), 'VN', '5', 'maths', 'Tuần 1', 'x', '[{"prompt":"x","choices":["a","b","c"],"correct":3}]'::jsonb)$$, 'P0001', 'invalid_correct', 'bonne réponse hors choix refusée');
select throws_ok($$select public.create_catalog_draft(tests.u(703), 'VN', '5', 'maths', 'Tuần 1', 'x', '[]'::jsonb)$$, 'P0001', 'invalid_question', 'aucune question refusée');

-- publication : D-061 + dates
select throws_ok($$select public.catalog_set_status(tests.u(701), 'published')$$, 'P0001', 'answers_to_verify', 'publication REFUSÉE tant qu''une réponse est « à vérifier »');
select lives_ok($$select public.catalog_confirm_answers(tests.u(701), (select jsonb_agg(jsonb_build_object('question_id', q.id, 'correct', q.correct_index)) from public.catalog_questions_admin(tests.u(701)) q))$$, 'admin : confirme les réponses');
select is(tests.val('select count(*)::int from public.catalog_answer_keys k join public.catalog_questions q on q.id = k.question_id where q.quiz_id = tests.u(701) and (k.to_verify or not k.confirmed)'), '0', 'plus rien à vérifier, tout confirmé');
select throws_ok($$select public.catalog_set_status(tests.u(701), 'published')$$, 'P0001', 'dates_required', 'publication refusée sans dates');
select throws_ok($$select public.catalog_set_dates(tests.u(701), date '2026-09-14', date '2026-09-10')$$, 'P0001', 'invalid_dates', 'échéance avant la mise à disposition refusée');
select throws_ok($$select public.catalog_set_dates(tests.u(701), date '1999-01-01', date '2026-09-10')$$, 'P0001', 'invalid_dates', 'date hors bornes refusée');
select lives_ok($$select public.catalog_set_dates(tests.u(701), date '2026-09-07', date '2026-09-13')$$, 'admin : fixe mise à disposition + échéance');
select lives_ok($$select public.catalog_set_status(tests.u(701), 'published')$$, 'admin : publie');
select is(tests.val('select status::text from public.catalog_quizzes where id = tests.u(701)'), 'published', '…publié');
select throws_ok($$select public.catalog_set_dates(tests.u(701), null, null)$$, 'P0001', 'dates_required', 'un quiz publié ne peut pas perdre ses dates');
select lives_ok($$select public.catalog_set_dates(tests.u(701), date '2026-09-08', date '2026-09-14')$$, 'dates modifiables après publication');
select throws_ok($$select public.catalog_upsert_question(null, tests.u(701), 5, 'Q', array['a','b','c'], 0, null)$$, 'P0001', 'set_published', 'quiz publié : questions non modifiables');
select throws_ok($$select public.catalog_delete_quiz(tests.u(701))$$, 'P0001', 'set_published', 'quiz publié : non supprimable');

-- examen : réponses confirmées obligatoires (D-061)
select lives_ok($$select public.create_catalog_draft(tests.u(711), 'VN', '5', 'maths', 'Tuần 2', 'Examen', '[{"prompt":"1+1","choices":["1","2","3"],"correct":1,"number":1}]'::jsonb, 'exam')$$, 'admin : examen en brouillon');
select is(tests.val('select paper_support from public.catalog_quizzes where id = tests.u(711)'), 'true', 'examen ⇒ support papier par défaut (D-062)');
select lives_ok($$select public.catalog_set_dates(tests.u(711), date '2026-09-14', date '2026-09-20')$$, 'dates de l''examen');
select throws_ok($$select public.catalog_set_status(tests.u(711), 'published')$$, 'P0001', 'answers_not_confirmed', 'examen : réponses non confirmées refusées');
select lives_ok($$select public.catalog_confirm_answers(tests.u(711), (select jsonb_agg(jsonb_build_object('question_id', q.id, 'correct', q.correct_index)) from public.catalog_questions_admin(tests.u(711)) q))$$, 'confirmation de l''examen');
select lives_ok($$select public.catalog_set_status(tests.u(711), 'published')$$, 'examen confirmé : publié');
select lives_ok($$select public.catalog_set_status(tests.u(711), 'draft')$$, 'dépublier est libre');
select is(tests.val('select status::text from public.catalog_quizzes where id = tests.u(711)'), 'draft', '…redevenu brouillon');

-- saisie manuelle
select lives_ok($$select public.catalog_create_quiz(tests.u(721), 'FR', '6E', 'maths', 'Semaine 1', 'Fractions')$$, 'admin : case vide');
select throws_ok($$select public.catalog_set_status(tests.u(721), 'published')$$, 'P0001', 'no_questions', 'sans question : publication refusée');
select lives_ok($$select public.catalog_upsert_question(tests.u(722), tests.u(721), 0, '1/2 + 1/2 ?', array['1', '2', '1/4'], 0, 'Une unité')$$, 'admin : ajoute une question');
select is(tests.val('select confirmed from public.catalog_answer_keys where question_id = tests.u(722)'), 'true', 'réponse saisie à la main = confirmée');
select lives_ok($$select public.catalog_delete_quiz(tests.u(721))$$, 'admin : supprime un brouillon sans tentative');
select is(tests.val('select count(*)::int from public.catalog_quizzes where id = tests.u(721)'), '0', '…supprimé');
select is(tests.val('select count(*)::int from public.catalog_answer_keys where question_id = tests.u(722)'), '0', '…clés supprimées avec');
select is((select count(*)::int from public.catalog_list('VN', '5', null)), 2, 'filtre pays/classe');
select is((select count(*)::int from public.catalog_list('FR', null, null)), 0, 'filtre pays : FR vide');

-- ───────────── IA : cible admin et quota ─────────────
select is(((public.ai_target_admin())->>'timezone'), 'Asia/Ho_Chi_Minh', 'admin : ai_target_admin → famille et fuseau');
reset role;
set local role service_role;
select is((select allowed from public.ai_reserve(tests.u(1), tests.u(111), 5, now(), tests.u(711), false)), true, 'quota admin : 1re réservation sur le brouillon 711');
select lives_ok($$select public.ai_finish((select id from public.ai_usage where set_id = tests.u(711) limit 1), 'success', null, 'm', 1, 1)$$, 'journal : succès');
select is((select free from public.ai_reserve(tests.u(1), tests.u(111), 5, now(), tests.u(711), true)), true, 'relance gratuite pour un brouillon du catalogue sans tentative');

select * from finish();
rollback;
