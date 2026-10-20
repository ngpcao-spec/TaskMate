-- D-091 : suppression DÉFINITIVE d'un QCM du catalogue par l'administrateur (même publié, commencé, validé), points conservés, audit, garde-fou du titre.
-- Fixtures : famille 1 = parent 11 (ADMIN), enfant A (user 13, profil 201), enfant B (user 14, profil 202) ; famille 2 = parent 21 (ordinaire), enfant C (user 23, profil 203).
-- QCM 701 (le test « Ngữ văn 7 · Ôn tập chung (bản thử) », Tuần 7) : A validé (8 points), B en cours (réponses enregistrées), C soumis (famille 2).
-- QCM 702 (même classe et matière, Tuần 8) et 703 (autre matière, Tuần 7) : NE DOIVENT PAS être touchés.
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
grant execute on all functions in schema tests to authenticated, anon, service_role;

insert into auth.users (id, email, is_anonymous) values (tests.u(11), 'admin@test', false), (tests.u(13), null, false), (tests.u(14), null, false), (tests.u(21), 'pb@test', false), (tests.u(23), null, false);
insert into public.families (id, name, timezone) values (tests.u(1), 'A', 'Asia/Ho_Chi_Minh'), (tests.u(2), 'B', 'Asia/Ho_Chi_Minh');
insert into public.children (id, family_id, name, birth_date, country, grade) values
  (tests.u(201), tests.u(1), 'Minh', '2013-03-01', 'VN', '7'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01', 'VN', '7'), (tests.u(203), tests.u(2), 'Lan', '2013-01-01', 'VN', '7');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'),
  (tests.u(114), tests.u(1), tests.u(14), 'child', tests.u(202), 'Khang'), (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'Cha B'),
  (tests.u(123), tests.u(2), tests.u(23), 'child', tests.u(203), 'Lan');
insert into public.platform_admins (user_id) values (tests.u(11));
insert into public.child_subjects (child_id, family_id, subject) values
  (tests.u(201), tests.u(1), 'langue_nationale'), (tests.u(201), tests.u(1), 'maths'), (tests.u(202), tests.u(1), 'langue_nationale'), (tests.u(203), tests.u(2), 'langue_nationale');

insert into public.catalog_quizzes (id, country, grade, subject, week_label, title, status, release_on, due_on) values
  (tests.u(701), 'VN', '7', 'langue_nationale', 'Tuần 7', 'Ngữ văn 7 · Ôn tập chung (bản thử)', 'published', current_date - 3, current_date + 3),
  (tests.u(702), 'VN', '7', 'langue_nationale', 'Tuần 8', 'Ngữ văn 7 · Tuần 8', 'published', current_date - 3, current_date + 3),
  (tests.u(703), 'VN', '7', 'maths', 'Tuần 7', 'Toán 7 · Tuần 7', 'published', current_date - 3, current_date + 3),
  (tests.u(704), 'VN', '7', 'anglais', 'Tuần 7', 'English draft', 'draft', null, null);
insert into public.catalog_questions (id, quiz_id, position, prompt, choices) values
  (tests.u(7011), tests.u(701), 0, 'Q1', array['a','b','c','d']), (tests.u(7012), tests.u(701), 1, 'Q2', array['a','b','c','d']),
  (tests.u(7021), tests.u(702), 0, 'Q1', array['a','b','c','d']), (tests.u(7031), tests.u(703), 0, 'Q1', array['a','b','c','d']),
  (tests.u(7041), tests.u(704), 0, 'Q1', array['a','b','c','d']);
insert into public.catalog_answer_keys (question_id, correct_index, confirmed) values
  (tests.u(7011), 0, true), (tests.u(7012), 1, true), (tests.u(7021), 0, true), (tests.u(7031), 0, true), (tests.u(7041), 0, false);

-- points déjà gagnés (journal immuable) : A a validé 701 (8 points) et 702 (5 points)
insert into public.point_transactions (id, family_id, child_id, delta, reason, ref_id, note, created_by) values
  (tests.u(901), tests.u(1), tests.u(201), 8, 'quiz_validated', tests.u(801), 'Ngữ văn 7 · Ôn tập chung (bản thử)', tests.u(111)),
  (tests.u(902), tests.u(1), tests.u(201), 5, 'quiz_validated', tests.u(811), 'Ngữ văn 7 · Tuần 8', tests.u(111));
insert into public.quiz_attempts (id, family_id, child_id, catalog_id, status, submitted_at, validated_at, validated_by, points_awarded, points_tx_id) values
  (tests.u(801), tests.u(1), tests.u(201), tests.u(701), 'validated', now(), now(), tests.u(111), 8, tests.u(901)),
  (tests.u(811), tests.u(1), tests.u(201), tests.u(702), 'validated', now(), now(), tests.u(111), 5, tests.u(902));
insert into public.quiz_attempts (id, family_id, child_id, catalog_id, status) values (tests.u(802), tests.u(1), tests.u(202), tests.u(701), 'in_progress');
insert into public.quiz_attempts (id, family_id, child_id, catalog_id, status, submitted_at) values (tests.u(803), tests.u(2), tests.u(203), tests.u(701), 'submitted', now());
insert into public.quiz_results (attempt_id, family_id, child_id, score, total) values
  (tests.u(801), tests.u(1), tests.u(201), 2, 2), (tests.u(803), tests.u(2), tests.u(203), 1, 2), (tests.u(811), tests.u(1), tests.u(201), 1, 1);
insert into public.quiz_answers (attempt_id, question_id, family_id, child_id, choice_index, is_correct) values
  (tests.u(801), tests.u(7011), tests.u(1), tests.u(201), 0, true), (tests.u(801), tests.u(7012), tests.u(1), tests.u(201), 1, true),
  (tests.u(803), tests.u(7011), tests.u(2), tests.u(203), 0, true), (tests.u(803), tests.u(7012), tests.u(2), tests.u(203), 3, false),
  (tests.u(811), tests.u(7021), tests.u(1), tests.u(201), 0, true);
insert into public.quiz_attempt_layouts (attempt_id, family_id, layout) values
  (tests.u(801), tests.u(1), '{}'::jsonb), (tests.u(802), tests.u(1), '{}'::jsonb), (tests.u(803), tests.u(2), '{}'::jsonb), (tests.u(811), tests.u(1), '{}'::jsonb);
insert into public.quiz_attempt_progress (attempt_id, question_id, family_id, child_id, choice) values (tests.u(802), tests.u(7011), tests.u(1), tests.u(202), 2);
insert into public.activity_log (family_id, child_id, actor_member_id, type, payload) values
  (tests.u(1), tests.u(201), tests.u(111), 'quiz_validated', jsonb_build_object('attempt_id', tests.u(801), 'quiz_id', tests.u(701), 'title', 'Ngữ văn 7 · Ôn tập chung (bản thử)', 'points', 8));
select * from no_plan();

-- ───────────── structure : journal d'audit fermé ─────────────
select is((select relrowsecurity from pg_class where oid = 'public.catalog_admin_log'::regclass), true, 'catalog_admin_log : RLS activée');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'catalog_admin_log'), 1, '…une seule politique (lecture)');
select is((select cmd from pg_policies where schemaname = 'public' and tablename = 'catalog_admin_log'), 'SELECT', '…en lecture seulement');
select is((select bool_or(has_table_privilege(r, 'public.catalog_admin_log', p)) from unnest(array['anon', 'authenticated']) r, unnest(array['insert', 'update', 'delete', 'truncate']) p),
          false, 'aucun droit d''écriture pour anon ni authenticated');
select is(has_table_privilege('anon', 'public.catalog_admin_log', 'select'), false, 'anon : pas de lecture');
select is((select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'catalog_quiz_counts' and has_function_privilege('authenticated', p.oid, 'execute')),
          0, 'compteurs internes : non appelables par un client');

-- ───────────── refus : non administrateurs, anonymes ─────────────
select tests.login(21);
select throws_ok($$select public.catalog_quiz_impact(tests.u(701))$$, '42501', 'forbidden', 'autre parent : impact refusé');
select throws_ok($$select public.catalog_purge_quiz(tests.u(701), 'Ngữ văn 7 · Ôn tập chung (bản thử)')$$, '42501', 'forbidden', 'autre parent : purge refusée même avec le bon titre');
select tests.login(13);
select throws_ok($$select public.catalog_quiz_impact(tests.u(701))$$, '42501', 'forbidden', 'enfant : impact refusé');
select throws_ok($$select public.catalog_purge_quiz(tests.u(701), 'Ngữ văn 7 · Ôn tập chung (bản thử)')$$, '42501', 'forbidden', 'enfant : purge refusée même avec le bon titre');
select throws_ok($$select public.catalog_quiz_counts(tests.u(701))$$, '42501', null, 'enfant : compteurs internes refusés');
reset role;
set local role anon;
select throws_ok($$select public.catalog_quiz_impact(tests.u(701))$$, '42501', null, 'anonyme : impact refusé');
select throws_ok($$select public.catalog_purge_quiz(tests.u(701), 'x')$$, '42501', null, 'anonyme : purge refusée');
reset role;
select is(tests.val('select count(*)::int from public.catalog_quizzes where id = ''' || tests.u(701) || ''''), '1', 'après tous les refus : le QCM existe toujours');
select is(tests.val('select count(*)::int from public.quiz_attempts where catalog_id = ''' || tests.u(701) || ''''), '3', '…et ses 3 tentatives aussi');
-- ce n'est pas la suppression d'un brouillon : le publié reste refusé par l'ancienne RPC
select tests.login(11);
select throws_ok($$select public.catalog_delete_quiz(tests.u(701))$$, 'P0001', 'set_published', 'catalog_delete_quiz : toujours réservée aux brouillons');

-- ───────────── impact (admin) ─────────────
select is(public.catalog_quiz_impact(tests.u(701))->>'title', 'Ngữ văn 7 · Ôn tập chung (bản thử)', 'impact : titre');
select is(public.catalog_quiz_impact(tests.u(701))->>'status', 'published', 'impact : statut');
select is(public.catalog_quiz_impact(tests.u(701))->>'week_label', 'Tuần 7', 'impact : semaine');
select is(public.catalog_quiz_impact(tests.u(701))->>'subject', 'langue_nationale', 'impact : matière');
select is(public.catalog_quiz_impact(tests.u(701))->>'grade', '7', 'impact : classe');
select is(public.catalog_quiz_impact(tests.u(701))->>'families', '2', 'impact : 2 familles');
select is(public.catalog_quiz_impact(tests.u(701))->>'children', '3', 'impact : 3 enfants');
select is(public.catalog_quiz_impact(tests.u(701))->>'attempts', '3', 'impact : 3 tentatives');
select is(public.catalog_quiz_impact(tests.u(701))->>'in_progress', '1', 'impact : 1 en cours');
select is(public.catalog_quiz_impact(tests.u(701))->>'submitted', '1', 'impact : 1 soumise');
select is(public.catalog_quiz_impact(tests.u(701))->>'validated', '1', 'impact : 1 validée');
select is(public.catalog_quiz_impact(tests.u(701))->>'points', '8', 'impact : 8 points déjà attribués (702 non compté)');
select is(public.catalog_quiz_impact(tests.u(704))->>'attempts', '0', 'impact d''un brouillon : aucune tentative');
select is(public.catalog_quiz_impact(tests.u(704))->>'points', '0', '…ni point');
select throws_ok($$select public.catalog_quiz_impact(tests.u(999))$$, 'P0002', 'set_not_found', 'impact d''un QCM inconnu : set_not_found');

-- ───────────── garde-fou : le titre exact ─────────────
select throws_ok($$select public.catalog_purge_quiz(tests.u(701), 'Ngữ văn 7')$$, 'P0001', 'confirm_mismatch', 'mauvais titre : refusé');
select throws_ok($$select public.catalog_purge_quiz(tests.u(701), '')$$, 'P0001', 'confirm_mismatch', 'titre vide : refusé');
select throws_ok($$select public.catalog_purge_quiz(tests.u(701), null)$$, 'P0001', 'confirm_mismatch', 'titre absent : refusé');
select throws_ok($$select public.catalog_purge_quiz(tests.u(701), 'NGỮ VĂN 7 · ÔN TẬP CHUNG (BẢN THỬ)')$$, 'P0001', 'confirm_mismatch', 'casse différente : refusé');
select throws_ok($$select public.catalog_purge_quiz(tests.u(701), 'Ngữ văn 7 · Ôn tập chung (bản thử) ')$$, 'P0001', 'confirm_mismatch', 'espace en trop : refusé (titre EXACT)');
select throws_ok($$select public.catalog_purge_quiz(tests.u(701), 'Ngữ văn 7 · Tuần 8')$$, 'P0001', 'confirm_mismatch', 'titre d''un AUTRE QCM : refusé');
select is(tests.val('select count(*)::int from public.catalog_quizzes where id = ''' || tests.u(701) || ''''), '1', 'refus : rien n''est supprimé (QCM)');
select is(tests.val('select count(*)::int from public.quiz_attempts where catalog_id = ''' || tests.u(701) || ''''), '3', '…ni les tentatives');
select is(tests.val('select count(*)::int from public.catalog_admin_log'), '0', '…et rien n''est journalisé');

-- ───────────── purge d'un QCM publié avec tentatives ─────────────
select is(tests.val('select count(*)::int from public.point_transactions'), '2', 'avant : 2 écritures de points');
select is(tests.val('select count(*)::int from public.activity_log'), '1', 'avant : 1 ligne d''activité');
select is(public.catalog_purge_quiz(tests.u(701), 'Ngữ văn 7 · Ôn tập chung (bản thử)')->>'purged', 'true', 'admin : purge le QCM publié avec le titre exact');
select is(tests.val('select count(*)::int from public.catalog_quizzes where id = ''' || tests.u(701) || ''''), '0', 'le QCM a disparu');
select is(tests.val('select count(*)::int from public.catalog_questions where quiz_id = ''' || tests.u(701) || ''''), '0', '…ses questions');
select is(tests.val('select count(*)::int from public.catalog_answer_keys where question_id in (''' || tests.u(7011) || ''', ''' || tests.u(7012) || ''')'), '0', '…ses clés');
select is(tests.val('select count(*)::int from public.quiz_attempts where catalog_id = ''' || tests.u(701) || ''''), '0', '…ses tentatives (en cours, soumise, validée)');
select is(tests.val('select count(*)::int from public.quiz_answers where attempt_id in (''' || tests.u(801) || ''', ''' || tests.u(803) || ''')'), '0', '…leurs réponses');
select is(tests.val('select count(*)::int from public.quiz_results where attempt_id in (''' || tests.u(801) || ''', ''' || tests.u(803) || ''')'), '0', '…leurs résultats');
select is(tests.val('select count(*)::int from public.quiz_attempt_layouts where attempt_id in (''' || tests.u(801) || ''', ''' || tests.u(802) || ''', ''' || tests.u(803) || ''')'), '0', '…leurs mélanges');
select is(tests.val('select count(*)::int from public.quiz_attempt_progress where attempt_id = ''' || tests.u(802) || ''''), '0', '…la progression enregistrée');

-- les points sont CONSERVÉS
select is(tests.val('select count(*)::int from public.point_transactions'), '2', 'points : aucune écriture supprimée');
select is(tests.val('select coalesce(sum(delta), 0)::int from public.point_transactions where child_id = ''' || tests.u(201) || ''''), '13', 'points : le solde de A reste 8 + 5');
select is(tests.val('select note from public.point_transactions where id = ''' || tests.u(901) || ''''), 'Ngữ văn 7 · Ôn tập chung (bản thử)', 'points : la ligne « quiz_validated » garde sa note (le titre)');
select is(tests.val('select count(*)::int from public.point_transactions where ref_id = ''' || tests.u(801) || ''''), '1', 'points : la ligne référence toujours la tentative disparue (sans clé étrangère)');
reset role;
select throws_ok($$delete from public.point_transactions where id = tests.u(901)$$, '42501', 'immutable_journal', 'points : le journal reste immuable');
select is(tests.val('select count(*)::int from public.activity_log'), '1', 'activité : la ligne existante est conservée et la purge n''en écrit aucune (aucune notification)');
-- l'historique de l'enfant se lit toujours (même vue que l'écran des points)
select tests.login(13);
select is((select count(*)::int from public.point_transactions where child_id = tests.u(201)), 2, 'enfant A : lit toujours ses 2 lignes de points');
select is((select note from public.point_transactions where id = tests.u(901)), 'Ngữ văn 7 · Ôn tập chung (bản thử)', '…avec leur libellé');
select is((select count(*)::int from public.child_catalog_quizzes() where quiz_id = tests.u(701)), 0, 'enfant A : le QCM purgé disparaît de ses révisions');
select is((select count(*)::int from public.child_catalog_quizzes() where quiz_id = tests.u(702)), 1, '…un autre QCM reste');
select tests.login(11);
select is((select count(*)::int from public.parent_catalog_overview(tests.u(201)) where quiz_id = tests.u(701)), 0, 'parent : le QCM purgé disparaît de la vue de son enfant');
select throws_ok($$select public.parent_quiz_detail(tests.u(201), tests.u(701))$$, '42501', 'forbidden', 'parent : le détail d''un QCM purgé est refusé proprement (forbidden)');

-- les autres QCM, même case de classe/semaine, ne sont pas touchés
select is(tests.val('select count(*)::int from public.catalog_quizzes where id in (''' || tests.u(702) || ''', ''' || tests.u(703) || ''', ''' || tests.u(704) || ''')'), '3', 'autres QCM : toujours là (702, 703, 704)');
select is(tests.val('select count(*)::int from public.catalog_questions where quiz_id in (''' || tests.u(702) || ''', ''' || tests.u(703) || ''')'), '2', '…leurs questions aussi');
select is(tests.val('select count(*)::int from public.quiz_attempts where id = ''' || tests.u(811) || ''''), '1', '…la tentative validée de 702 aussi');
select is(tests.val('select count(*)::int from public.quiz_answers where attempt_id = ''' || tests.u(811) || ''''), '1', '…sa réponse');
select is(tests.val('select count(*)::int from public.quiz_results where attempt_id = ''' || tests.u(811) || ''''), '1', '…son résultat');

-- ───────────── audit ─────────────
select is(tests.val('select count(*)::int from public.catalog_admin_log'), '1', 'audit : une ligne');
select is(tests.val('select admin_id::text from public.catalog_admin_log'), tests.u(11)::text, 'audit : qui');
select is(tests.val('select action from public.catalog_admin_log'), 'purge_quiz', 'audit : quelle action');
select is(tests.val('select quiz_id::text from public.catalog_admin_log'), tests.u(701)::text, 'audit : quel QCM');
select is(tests.val('select title from public.catalog_admin_log'), 'Ngữ văn 7 · Ôn tập chung (bản thử)', 'audit : son titre');
select is(tests.val('select slot->>''week_label'' || ''/'' || (slot->>''status'') from public.catalog_admin_log'), 'Tuần 7/published', 'audit : la case et le statut');
select is(tests.val('select counts->>''attempts'' || ''/'' || (counts->>''points'') || ''/'' || (counts->>''families'') from public.catalog_admin_log'), '3/8/2', 'audit : compteurs supprimés');
select isnt(tests.val('select created_at::text from public.catalog_admin_log'), null, 'audit : quand');
select is((select count(*)::int from public.catalog_admin_log), 1, 'audit : l''administrateur le lit');
select throws_ok($$insert into public.catalog_admin_log (admin_id, action, quiz_id, title) values (tests.u(11), 'purge_quiz', tests.u(1), 'x')$$, '42501', null, 'audit : même l''admin n''écrit pas directement');
select tests.login(21);
select is((select count(*)::int from public.catalog_admin_log), 0, 'audit : un parent ordinaire ne voit rien');
select tests.login(13);
select is((select count(*)::int from public.catalog_admin_log), 0, 'audit : un enfant ne voit rien');
select throws_ok($$insert into public.catalog_admin_log (admin_id, action, quiz_id, title) values (tests.u(13), 'purge_quiz', tests.u(1), 'x')$$, '42501', null, 'audit : un enfant n''écrit pas');
reset role;
select throws_ok($$update public.catalog_admin_log set title = 'x'$$, '42501', 'immutable_journal', 'audit : immuable (UPDATE)');
select throws_ok($$delete from public.catalog_admin_log$$, '42501', 'immutable_journal', 'audit : immuable (DELETE)');
select throws_ok($$truncate public.catalog_admin_log$$, '42501', 'immutable_journal', 'audit : immuable (TRUNCATE)');

-- ───────────── rejeu idempotent, case libérée ─────────────
select tests.login(11);
select is(public.catalog_purge_quiz(tests.u(701), 'Ngữ văn 7 · Ôn tập chung (bản thử)')->>'purged', 'false', 'rejeu : rien à supprimer, sans erreur');
select is(public.catalog_purge_quiz(tests.u(701), 'n''importe quoi')->>'purged', 'false', 'rejeu avec un autre texte : toujours sans effet (QCM absent)');
select is(tests.val('select count(*)::int from public.catalog_admin_log'), '1', 'rejeu : pas de seconde ligne d''audit');
select lives_ok($$select public.create_catalog_draft(tests.u(710), 'VN', '7', 'langue_nationale', 'Tuần 7', 'Le vrai fichier', '[{"prompt":"Q","choices":["a","b","c"],"correct":0}]'::jsonb)$$,
                'la case (VN, 7, langue_nationale, Tuần 7) est libre : nouvel import possible');
select is(tests.val('select title from public.catalog_quizzes where id = ''' || tests.u(710) || ''''), 'Le vrai fichier', '…le nouveau QCM occupe la case');

-- ───────────── brouillon sans tentative : la purge fonctionne aussi ─────────────
select is(public.catalog_purge_quiz(tests.u(704), 'English draft')->>'attempts', '0', 'brouillon : purge sans tentative');
select is(tests.val('select count(*)::int from public.catalog_quizzes where id = ''' || tests.u(704) || ''''), '0', '…supprimé');
select is(tests.val('select count(*)::int from public.catalog_admin_log'), '2', '…et journalisé');

select * from finish();
rollback;
