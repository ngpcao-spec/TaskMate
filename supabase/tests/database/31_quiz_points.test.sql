-- D-083 : points crédités à la VALIDATION d'un quiz du catalogue (barème 50 % → 5 points, 80 % → 8 points, jamais depuis un client), une seule fois, journal immuable.
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

-- ───────────── barème : UNE fonction, seuils exacts ─────────────
select is(public.quiz_points_for(s, t), e, format('%s/%s → %s point(s)', s, t, e))
from (values
  (49, 100, 0), (50, 100, 5), (79, 100, 5), (80, 100, 8), (100, 100, 8), (0, 100, 0),
  (7, 16, 0), (8, 16, 5), (12, 16, 5), (13, 16, 8), (16, 16, 8),
  (1, 2, 5), (2, 3, 5), (4, 5, 8), (3, 5, 5), (0, 0, 0), (0, 16, 0)
) as v(s, t, e);
select is(public.quiz_points_for(null, 10), 0, 'score absent : 0');
select is(public.quiz_points_for(5, null), 0, 'total absent : 0');
select is(public.quiz_points_for(5, 0), 0, 'total nul : 0');
select is(public.quiz_points_for(-1, 10), 0, 'score négatif : 0');

-- structure : le barème n'est pas appelable par un client ; le journal reste fermé
select tests.login(11);
select throws_ok($$select public.quiz_points_for(10, 10)$$, '42501', null, 'client : quiz_points_for interne');
select throws_ok($$insert into public.point_transactions (id, family_id, child_id, delta, reason, created_by) values (tests.u(900), tests.u(1), tests.u(201), 50, 'quiz_validated', tests.u(111))$$, '42501', null, 'parent : aucune écriture directe de points');
select throws_ok($$update public.quiz_attempts set points_awarded = 8 where id = tests.u(800)$$, '42501', null, 'parent : aucune écriture directe de points_awarded');
select tests.login(13);
select throws_ok($$insert into public.point_transactions (id, family_id, child_id, delta, reason, created_by) values (tests.u(901), tests.u(1), tests.u(201), 50, 'quiz_validated', tests.u(113))$$, '42501', null, 'enfant : aucune écriture directe de points');

-- ───────────── seuils à la validation : 49 / 50 / 79 / 80 % ─────────────
reset role;
select tests.submitted(801, 1, 201, 701, 49, 100);
select tests.submitted(802, 1, 201, 702, 50, 100);
select tests.submitted(803, 1, 202, 701, 79, 100);
select tests.submitted(804, 1, 202, 702, 80, 100);
-- l'enfant ne voit AUCUN score tant que le parent n'a pas validé
select tests.login(13);
select is((select count(*)::int from public.child_catalog_quizzes() where quiz_id = tests.u(702)), 1, 'enfant : le quiz soumis est bien listé');
select is((select score from public.child_catalog_quizzes() where quiz_id = tests.u(702)), null, 'enfant : score invisible tant que la tentative est soumise');
select is((select total from public.child_catalog_quizzes() where quiz_id = tests.u(702)), null, '…total aussi');
select is((select evaluation_status::text from public.child_catalog_quizzes() where quiz_id = tests.u(702)), 'submitted', '…état « en attente de validation »');
select tests.login(11);
select lives_ok($$select public.validate_quiz_attempt(tests.u(801), false)$$, 'parent : valide 49 %');
select is(tests.val('select coalesce(sum(delta), 0)::int from public.point_transactions where child_id = ''' || tests.u(201) || ''''), '0', '49 % : 0 point, aucune ligne');
select is(tests.val('select count(*)::int from public.point_transactions where ref_id = ''' || tests.u(801) || ''''), '0', '…aucune écriture dans le journal');
select is(tests.val('select status::text from public.quiz_attempts where id = ''' || tests.u(801) || ''''), 'validated', '…mais bien validée');
select lives_ok($$select public.validate_quiz_attempt(tests.u(802), false)$$, 'parent : valide 50 %');
select is(tests.val('select points_awarded::text from public.quiz_attempts where id = ''' || tests.u(802) || ''''), '5', '50 % : 5 points');
select tests.login(13);
select is((select score::text || '/' || total::text from public.child_catalog_quizzes() where quiz_id = tests.u(702)), '50/100', 'enfant : score visible APRÈS validation');
select tests.login(11);
select lives_ok($$select public.validate_quiz_attempt(tests.u(803), true)$$, 'parent : valide 79 %');
select is(tests.val('select points_awarded::text from public.quiz_attempts where id = ''' || tests.u(803) || ''''), '5', '79 % : 5 points');
select lives_ok($$select public.validate_quiz_attempt(tests.u(804), false)$$, 'parent : valide 80 %');
select is(tests.val('select points_awarded::text from public.quiz_attempts where id = ''' || tests.u(804) || ''''), '8', '80 % : 8 points');
select is(tests.val('select public.child_balance(''' || tests.u(201) || ''')::text'), '5', 'solde de A : 5 points');
select is(tests.val('select public.child_balance(''' || tests.u(202) || ''')::text'), '13', 'solde de B : 5 + 8 points');

-- la ligne du journal : motif, montant, référence, titre, auteur
select is(tests.val('select reason::text || ''/'' || delta::text || ''/'' || note || ''/'' || created_by::text from public.point_transactions where ref_id = ''' || tests.u(804) || ''''),
          'quiz_validated/8/Phân số/' || tests.u(111), 'journal : motif quiz_validated, +8, titre du quiz, validé par le parent');
select is(tests.val('select (a.points_tx_id = p.id)::text from public.quiz_attempts a join public.point_transactions p on p.ref_id = a.id where a.id = ''' || tests.u(804) || ''''), 'true', 'la tentative référence son écriture');

-- ───────────── idempotence stricte ─────────────
select lives_ok($$select public.validate_quiz_attempt(tests.u(804), true)$$, 'double validation : sans erreur');
select lives_ok($$select public.validate_quiz_attempt(tests.u(804), false)$$, '…et encore');
select is(tests.val('select count(*)::int from public.point_transactions where ref_id = ''' || tests.u(804) || ''''), '1', 'une seule écriture malgré la re-validation');
select is(tests.val('select public.child_balance(''' || tests.u(202) || ''')::text'), '13', 'solde inchangé');
select is(tests.val('select show_correction::text from public.quiz_attempts where id = ''' || tests.u(804) || ''''), 'false', 'la re-validation ne change rien d''autre (réglage conservé)');
reset role;
select throws_ok($$insert into public.quiz_attempts (id, family_id, child_id, catalog_id, status, points_tx_id) values (tests.u(890), tests.u(1), tests.u(202), tests.u(703), 'submitted', (select points_tx_id from public.quiz_attempts where id = tests.u(804)))$$, '23505', null, 'garde d''unicité : une écriture du journal ne peut servir qu''à UNE tentative');
select throws_ok($$update public.point_transactions set delta = 100 where ref_id = tests.u(804)$$, '42501', 'immutable_journal', 'le journal reste immuable');

-- ───────────── pas de points à répéter un quiz ─────────────
-- A a eu 49 % (0 point) puis une relance à 90 % : elle rapporte 8 ; une 3e tentative à 100 % ne rapporte plus rien.
select tests.submitted(805, 1, 201, 701, 90, 100);
select tests.submitted(806, 1, 201, 701, 100, 100);
select tests.login(11);
select lives_ok($$select public.validate_quiz_attempt(tests.u(805), false)$$, 'relance validée (90 %)');
select is(tests.val('select points_awarded::text from public.quiz_attempts where id = ''' || tests.u(805) || ''''), '8', '…rapporte 8 (la 1re tentative à 49 % n''avait rien rapporté)');
select lives_ok($$select public.validate_quiz_attempt(tests.u(806), false)$$, '3e tentative validée (100 %)');
select is(tests.val('select coalesce(points_awarded::text, ''-'') from public.quiz_attempts where id = ''' || tests.u(806) || ''''), '-', '…ne rapporte plus rien (déjà récompensé sur ce quiz)');
select is(tests.val('select public.child_balance(''' || tests.u(201) || ''')::text'), '13', 'solde de A : 5 + 8, sans doublon');
-- un AUTRE quiz du même enfant rapporte de nouveau
reset role;
select tests.submitted(807, 1, 201, 703, 16, 16);
select tests.login(11);
select lives_ok($$select public.validate_quiz_attempt(tests.u(807), false)$$, 'autre quiz validé (16/16)');
select is(tests.val('select public.child_balance(''' || tests.u(201) || ''')::text'), '21', '…+8 : chaque quiz récompense une fois');

-- ───────────── refus ─────────────
reset role;
select tests.submitted(808, 1, 201, 702, 16, 16);
insert into public.quiz_attempts (id, family_id, child_id, catalog_id, status) values (tests.u(809), tests.u(1), tests.u(202), tests.u(703), 'in_progress');
select tests.login(21);
select throws_ok($$select public.validate_quiz_attempt(tests.u(808), false)$$, 'P0002', 'attempt_not_found', 'autre famille : refusé (tentative introuvable)');
select tests.login(13);
select throws_ok($$select public.validate_quiz_attempt(tests.u(808), false)$$, '42501', 'forbidden', 'enfant : refusé');
select tests.login(11);
select throws_ok($$select public.validate_quiz_attempt(tests.u(809), false)$$, 'P0001', 'not_submitted', 'tentative non envoyée : refusée');
select throws_ok($$select public.validate_quiz_attempt(tests.u(899), false)$$, 'P0002', 'attempt_not_found', 'tentative inconnue : refusée');
select is(tests.val('select count(*)::int from public.point_transactions where ref_id in (''' || tests.u(808) || ''', ''' || tests.u(809) || ''')'), '0', 'aucun point crédité par un refus');
select is(tests.val('select public.child_balance(''' || tests.u(201) || ''')::text'), '21', 'solde de A inchangé par les refus');

-- ───────────── jeux importés par une famille : pas de points ─────────────
reset role;
insert into public.quiz_sets (id, family_id, child_id, title, created_by, status) values (tests.u(751), tests.u(1), tests.u(201), 'Jeu de famille', tests.u(111), 'published');
insert into public.quiz_attempts (id, family_id, child_id, set_id, status, submitted_at) values (tests.u(810), tests.u(1), tests.u(201), tests.u(751), 'submitted', now());
insert into public.quiz_results (attempt_id, family_id, child_id, score, total) values (tests.u(810), tests.u(1), tests.u(201), 10, 10);
select tests.login(11);
select lives_ok($$select public.validate_quiz_attempt(tests.u(810), false)$$, 'jeu de famille validé');
select is(tests.val('select count(*)::int from public.point_transactions where ref_id = ''' || tests.u(810) || ''''), '0', '…sans points (D-055 : points non reliés aux jeux de famille)');

-- ───────────── données d'affichage de l'enfant ─────────────
select tests.login(13);
select is((select count(*)::int from public.point_transactions where child_id = tests.u(201)), 3, 'A lit SES 3 lignes de points');
select is((select count(*)::int from public.point_transactions where child_id = tests.u(202)), 0, 'A ne lit AUCUNE ligne de son frère (D-052)');
select is((select count(*)::int from public.point_transactions where reason = 'quiz_validated'), 3, 'seulement les siennes, motif quiz_validated');

-- ───────────── suppression de la famille : le journal et les tentatives partent ensemble ─────────────
select tests.login(21);
select lives_ok($$select public.delete_family()$$, 'autre famille : supprime la SIENNE (ne touche pas la famille 1)');
select is(tests.val('select count(*)::int from public.point_transactions where family_id = ''' || tests.u(1) || ''''), '5', 'la famille 1 garde son journal');
select tests.login(11);
select lives_ok($$select public.delete_family()$$, 'la famille 1 se supprime avec ses tentatives créditées (clé étrangère points_tx_id)');
select is(tests.val('select count(*)::int from public.point_transactions where family_id = ''' || tests.u(1) || ''''), '0', '…journal purgé');

select * from finish();
rollback;
