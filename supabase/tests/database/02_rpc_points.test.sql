-- Fixtures communes (ids lisibles : tests.u(n)).
--   familles : 1 = A (test), 2 = B (étrangère)
--   users    : 11 parent1, 12 parent2, 13 Minh, 14 Khang, 21 parent B
--   members  : 111, 112, 113 (Minh), 114 (Khang), 121 ; children : 201 Minh, 202 Khang, 221 (B)
--   rewards  : 401 Game(100), 402 Film(150), 421 (B) ; tasks : 301 (Minh, par parent), 302 (Khang, par Khang), 303 (Minh, par Minh), 321 (B)
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
create function tests.logout() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
-- exécute une requête (en tant que rôle courant) et renvoie le nombre de lignes touchées
create function tests.n(q text) returns bigint language plpgsql as $$
declare c bigint;
begin
  execute q;
  get diagnostics c = row_count;
  return c;
end $$;
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, email, is_anonymous) values
  (tests.u(11), 'p1@test', false), (tests.u(12), 'p2@test', false),
  (tests.u(13), null, true), (tests.u(14), null, true), (tests.u(21), 'pb@test', false);
insert into public.families (id, name) values (tests.u(1), 'A'), (tests.u(2), 'B');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2009-03-01'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01'),
  (tests.u(221), tests.u(2), 'Bé', '2012-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'),
  (tests.u(112), tests.u(1), tests.u(12), 'parent', null, 'Mẹ'),
  (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'),
  (tests.u(114), tests.u(1), tests.u(14), 'child', tests.u(202), 'Khang'),
  (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'PB');
insert into public.rewards (id, family_id, title, cost) values
  (tests.u(401), tests.u(1), 'Game', 100), (tests.u(402), tests.u(1), 'Film', 150),
  (tests.u(421), tests.u(2), 'Autre', 50);
insert into public.tasks (id, family_id, child_id, title, note, date, created_by) values
  (tests.u(301), tests.u(1), tests.u(201), 'Tâche Minh (parent)', 'note', '2026-07-02', tests.u(111)),
  (tests.u(302), tests.u(1), tests.u(202), 'Tâche Khang', 'secret?', '2026-07-02', tests.u(114)),
  (tests.u(303), tests.u(1), tests.u(201), 'Tâche Minh (perso)', null, '2026-07-02', tests.u(113)),
  (tests.u(321), tests.u(2), tests.u(221), 'Tâche B', null, '2026-07-02', tests.u(121));
insert into public.point_transactions (id, family_id, child_id, delta, reason, created_by) values
  (tests.u(501), tests.u(1), tests.u(201), 300, 'manual_adjust', tests.u(111)),
  (tests.u(502), tests.u(1), tests.u(202), 80, 'manual_adjust', tests.u(111));
insert into public.rewards (id, family_id, title, cost, child_id) values (tests.u(403), tests.u(1), 'Khang only', 90, tests.u(202));
create function tests.pend(c int) returns int language sql as $$ select pending_task_points from public.child_balances where child_id = tests.u(c) $$;
grant execute on all functions in schema tests to authenticated;

select * from no_plan();

-- ═══ complete_task — enfant : `pending`, AUCUN point ═══
select tests.login(13);
select lives_ok($$select public.complete_task(tests.u(301), tests.u(511))$$, 'child complete: Minh coche sa tâche');
select isnt((select completed_at from public.tasks where id = tests.u(301)), null, 'child complete: completed_at posé');
select is((select validated_at from public.tasks where id = tests.u(301)), null, 'child complete: pas validée (état pending)');
select is(public.child_balance(tests.u(201)), 300, 'child complete: solde INCHANGÉ (aucun crédit)');
select is((select count(*)::int from public.point_transactions where ref_id = tests.u(301)), 0, 'child complete: aucune transaction');
select is(tests.pend(201), 10, 'child complete: +10 en attente (informatif, hors solde)');
select is((select available from public.child_balances where child_id = tests.u(201)), 300, 'child complete: disponible inchangé');
select lives_ok($$select public.complete_task(tests.u(301), tests.u(512))$$, 'child complete: rejeu accepté (no-op)');
select is(tests.pend(201), 10, 'child complete: rejeu idempotent');
select throws_ok($$select public.complete_task(tests.u(302), tests.u(513))$$, '42501', 'forbidden', 'child complete: pas la tâche du frère');
select tests.login(21);
select throws_ok($$select public.complete_task(tests.u(301), tests.u(519))$$, 'P0002', 'task_not_found', 'complete: tâche d''une autre famille introuvable');
select tests.login(11);
select is((select count(*)::int from public.activity_log where type = 'task_completed'), 1, 'child complete: le parent est notifié (activity_log task_completed)');

-- ═══ décoche enfant ═══
select tests.login(13);
select lives_ok($$select public.uncomplete_task(tests.u(301), tests.u(514))$$, 'child uncomplete: décoche d''une tâche pending');
select is((select completed_at from public.tasks where id = tests.u(301)), null, 'child uncomplete: retour à todo');
select is(public.child_balance(tests.u(201)), 300, 'child uncomplete: aucun mouvement de points');
select is((select count(*)::int from public.point_transactions where ref_id = tests.u(301)), 0, 'child uncomplete: aucune transaction');
select lives_ok($$select public.uncomplete_task(tests.u(301), tests.u(514))$$, 'child uncomplete: rejeu accepté');

-- ═══ validate_task ═══
select public.complete_task(tests.u(301), tests.u(515));
select tests.login(13);
select throws_ok($$select public.validate_task(tests.u(301), tests.u(516))$$, '42501', 'forbidden', 'validate: un enfant ne valide pas (même sa tâche)');
select tests.login(14);
select throws_ok($$select public.validate_task(tests.u(301), tests.u(516))$$, '42501', 'forbidden', 'validate: son frère non plus');
select tests.login(21);
select throws_ok($$select public.validate_task(tests.u(301), tests.u(516))$$, 'P0002', 'task_not_found', 'validate: parent d''une autre famille → introuvable');
select tests.login(11);
select lives_ok($$select public.validate_task(tests.u(301), tests.u(516))$$, 'validate: le parent valide');
select is(public.child_balance(tests.u(201)), 310, 'validate: +10 points crédités');
select is(tests.pend(201), 0, 'validate: plus rien en attente');
select is((select validated_by from public.tasks where id = tests.u(301)), tests.u(111), 'validate: validated_by = parent');
select is((select count(*)::int from public.point_transactions where ref_id = tests.u(301) and reason = 'task_validated' and delta = 10), 1, 'validate: une transaction task_validated');
select lives_ok($$select public.validate_task(tests.u(301), tests.u(516))$$, 'validate: rejeu (même tx_id) accepté');
select is(public.child_balance(tests.u(201)), 310, 'validate: crédité UNE seule fois après rejeu');
select tests.login(12);
select throws_ok($$select public.validate_task(tests.u(301), tests.u(517))$$, 'P0001', 'not_pending', 'validate: le second parent (autre tx_id) ne crédite pas une 2e fois');
select is(public.child_balance(tests.u(201)), 310, 'validate: toujours 310');
select tests.login(11);
select is((select count(*)::int from public.activity_log where type = 'task_validated'), 1, 'validate: l''enfant est notifié (task_validated)');

-- ═══ l'enfant ne peut plus décocher une tâche validée ═══
select tests.login(13);
select throws_ok($$select public.uncomplete_task(tests.u(301), tests.u(518))$$, 'P0001', 'already_validated', 'child uncomplete: refus sur tâche validée');
select isnt((select completed_at from public.tasks where id = tests.u(301)), null, 'child uncomplete: tâche toujours cochée');
select is(public.child_balance(tests.u(201)), 310, 'child uncomplete: solde intact');

-- ═══ validation après décoche ⇒ not_pending ═══
select public.complete_task(tests.u(303), tests.u(520));
select public.uncomplete_task(tests.u(303), tests.u(521));
select tests.login(11);
select throws_ok($$select public.validate_task(tests.u(303), tests.u(522))$$, 'P0001', 'not_pending', 'validate: tâche décochée entre-temps → not_pending');
select throws_ok($$select public.validate_task(tests.u(302), tests.u(523))$$, 'P0001', 'not_pending', 'validate: tâche jamais cochée → not_pending');
select is(public.child_balance(tests.u(201)), 310, 'validate: aucun crédit sur échec');

-- ═══ reject_task ═══
select tests.login(13);
select public.complete_task(tests.u(303), tests.u(524));
select throws_ok($$select public.reject_task(tests.u(303), 'non')$$, '42501', 'forbidden', 'reject: un enfant ne refuse pas');
select tests.login(11);
select lives_ok($$select public.reject_task(tests.u(303), 'à refaire proprement')$$, 'reject: le parent refuse avec motif');
select is((select completed_at from public.tasks where id = tests.u(303)), null, 'reject: retour à todo');
select is((select rejection_note from public.tasks where id = tests.u(303)), 'à refaire proprement', 'reject: motif enregistré');
select isnt((select rejected_at from public.tasks where id = tests.u(303)), null, 'reject: rejected_at posé');
select is(public.child_balance(tests.u(201)), 310, 'reject: aucun point');
select is(tests.pend(201), 0, 'reject: plus rien en attente');
select lives_ok($$select public.reject_task(tests.u(303), 'à refaire proprement')$$, 'reject: rejeu accepté');
select throws_ok($$select public.reject_task(tests.u(301), null)$$, 'P0001', 'not_pending', 'reject: tâche déjà validée → not_pending');
select throws_ok($$select public.reject_task(tests.u(302), null)$$, 'P0001', 'not_pending', 'reject: tâche à faire → not_pending');
select is((select count(*)::int from public.activity_log where type = 'task_rejected'), 1, 'reject: l''enfant est notifié (task_rejected)');
-- le motif est effacé à la coche suivante
select tests.login(13);
select public.complete_task(tests.u(303), tests.u(525));
select is((select rejection_note from public.tasks where id = tests.u(303)), null, 'reject: motif effacé à la coche suivante');
select is((select rejected_at from public.tasks where id = tests.u(303)), null, 'reject: rejected_at effacé aussi');

-- ═══ coche parent : validée d'office et créditée ═══
select tests.login(11);
select lives_ok($$select public.complete_task(tests.u(302), tests.u(526))$$, 'parent complete: coche la tâche de Khang');
select isnt((select validated_at from public.tasks where id = tests.u(302)), null, 'parent complete: validée d''office');
select is(public.child_balance(tests.u(202)), 90, 'parent complete: Khang crédité (80 + 10)');
select lives_ok($$select public.complete_task(tests.u(302), tests.u(526))$$, 'parent complete: rejeu accepté');
select is(public.child_balance(tests.u(202)), 90, 'parent complete: crédité une seule fois');

-- ═══ décoche parent d'une tâche validée : débit exact ═══
-- les points de la tâche changent après coup ; le débit reprend ce qui a été crédité (10)
update public.tasks set points = 30 where id = tests.u(302);
select lives_ok($$select public.uncomplete_task(tests.u(302), tests.u(527))$$, 'parent uncomplete: décoche une tâche validée');
select is(public.child_balance(tests.u(202)), 80, 'parent uncomplete: débit exact des points crédités (10, pas 30)');
select is((select validated_at from public.tasks where id = tests.u(302)), null, 'parent uncomplete: validation retirée');
select is((select count(*)::int from public.point_transactions where ref_id = tests.u(302) and reason = 'task_unvalidated' and delta = -10), 1, 'parent uncomplete: transaction task_unvalidated');
select lives_ok($$select public.uncomplete_task(tests.u(302), tests.u(527))$$, 'parent uncomplete: rejeu accepté');
select is(public.child_balance(tests.u(202)), 80, 'parent uncomplete: idempotent');

-- refus si le disponible deviendrait négatif (points réservés protégés)
select public.complete_task(tests.u(302), tests.u(528));   -- Khang : 80 + 30 = 110
select tests.login(14);
select public.request_reward(tests.u(403), tests.u(721));  -- réserve 90 → disponible 20
select tests.login(11);
select throws_ok($$select public.uncomplete_task(tests.u(302), tests.u(529))$$, 'P0001', 'insufficient_balance', 'parent uncomplete: refus si disponible < 0');
select isnt((select validated_at from public.tasks where id = tests.u(302)), null, 'parent uncomplete: tâche toujours validée après refus');

-- ═══ cas limites ═══
select tests.logout();
update public.tasks set deleted_at = now() where id = tests.u(303);
select tests.login(11);
select throws_ok($$select public.validate_task(tests.u(303), tests.u(530))$$, 'P0002', 'task_not_found', 'validate: tâche supprimée → échec propre');
select tests.login(13);
select throws_ok($$select public.complete_task(tests.u(303), tests.u(531))$$, 'P0002', 'task_not_found', 'complete: tâche supprimée pendant la coche hors ligne → échec propre');
select tests.login(11);
insert into public.tasks (id, family_id, child_id, title, date, points, created_by) values (tests.u(340), tests.u(1), tests.u(201), 'Zéro', '2026-07-03', 0, tests.u(111));
select tests.login(13);
select public.complete_task(tests.u(340), tests.u(532));
select tests.login(11);
select public.validate_task(tests.u(340), tests.u(533));
select is(public.child_balance(tests.u(201)), 310, 'validate: tâche à 0 point sans transaction');
-- suppression d'une tâche pending : retirée de la file sans points
select tests.login(13);
select public.complete_task(tests.u(340), tests.u(534));
select tests.logout();
select tests.login(11);
insert into public.tasks (id, family_id, child_id, title, date, points, created_by) values (tests.u(341), tests.u(1), tests.u(201), 'À supprimer', '2026-07-03', 20, tests.u(111));
select tests.login(13);
select public.complete_task(tests.u(341), tests.u(535));
select is(tests.pend(201), 20, 'pending: 20 points en attente');
select tests.login(11);
update public.tasks set deleted_at = now() where id = tests.u(341);
select tests.login(13);
select is(tests.pend(201), 0, 'pending: supprimer la tâche la retire de l''attente, sans points');
select is(public.child_balance(tests.u(201)), 310, 'pending: aucun point');

-- ═══ adjust_points (inchangé) ═══
select tests.login(13);
select throws_ok($$select public.adjust_points(tests.u(201), 1000, 'triche', tests.u(540))$$, '42501', 'forbidden', 'adjust_points: un enfant ne s''ajuste pas ses points');
select tests.login(11);
select lives_ok($$select public.adjust_points(tests.u(201), 50, 'bonus', tests.u(541))$$, 'adjust_points: le parent ajuste (+50)');
select is(public.child_balance(tests.u(201)), 360, 'adjust_points: solde 360');
select lives_ok($$select public.adjust_points(tests.u(201), 50, 'bonus', tests.u(541))$$, 'adjust_points: rejeu accepté');
select is(public.child_balance(tests.u(201)), 360, 'adjust_points: idempotent');
select throws_ok($$select public.adjust_points(tests.u(201), 0, 'rien', tests.u(542))$$, '22023', 'invalid_adjustment', 'adjust_points: delta nul refusé');
select throws_ok($$select public.adjust_points(tests.u(201), 5, '  ', tests.u(543))$$, '22023', 'invalid_adjustment', 'adjust_points: motif obligatoire');
select throws_ok($$select public.adjust_points(tests.u(201), -1000, 'pénalité', tests.u(544))$$, 'P0001', 'insufficient_balance', 'adjust_points: pas de solde négatif');
select tests.login(21);
select throws_ok($$select public.adjust_points(tests.u(201), 5, 'x', tests.u(545))$$, 'P0002', 'child_not_found', 'adjust_points: enfant d''une autre famille introuvable');

-- ═══ accès ═══
select tests.logout();
set local role anon;
select throws_ok($$select public.validate_task(tests.u(301), tests.u(550))$$, '42501', null, 'validate: refusé à anon');
select throws_ok($$select public.complete_task(tests.u(301), tests.u(551))$$, '42501', null, 'complete: refusé à anon');
select tests.logout();
update public.members set revoked_at = now() where id = tests.u(113);
select tests.login(13);
select is(tests.n('select 1 from public.tasks'), 0::bigint, 'appareil révoqué: ne lit plus rien dès la requête suivante');
select throws_ok($$select public.complete_task(tests.u(301), tests.u(552))$$, '28000', 'not_authenticated', 'appareil révoqué: RPC refusée');

select * from finish();
rollback;
