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
-- récompense réservée à Khang, coût 90
insert into public.rewards (id, family_id, title, cost, child_id) values (tests.u(403), tests.u(1), 'Khang only', 90, tests.u(202));

select * from no_plan();

-- ═══ complete_task ═══
select tests.login(13);
select lives_ok($$select public.complete_task(tests.u(301), tests.u(511))$$, 'complete_task: Minh coche sa tâche');
select is(public.child_balance(tests.u(201)), 310, 'complete_task: +10 points crédités');
select isnt((select completed_at from public.tasks where id = tests.u(301)), null, 'complete_task: completed_at posé');
select is((select count(*)::int from public.point_transactions where ref_id = tests.u(301)), 1, 'complete_task: une transaction');
select lives_ok($$select public.complete_task(tests.u(301), tests.u(511))$$, 'complete_task: rejeu (même tx_id) accepté');
select lives_ok($$select public.complete_task(tests.u(301), tests.u(512))$$, 'complete_task: rejeu (autre tx_id) accepté');
select is(public.child_balance(tests.u(201)), 310, 'complete_task: idempotent — crédité une seule fois, même après retries');
select throws_ok($$select public.complete_task(tests.u(302), tests.u(513))$$, '42501', 'forbidden', 'complete_task: Minh ne coche pas la tâche de son frère');
select is((select completed_at from public.tasks where id = tests.u(302)), null, 'complete_task: tâche du frère inchangée');
select tests.login(11);
select lives_ok($$select public.complete_task(tests.u(302), tests.u(513))$$, 'complete_task: le parent coche la tâche d''un enfant');
select is((select completed_by from public.tasks where id = tests.u(302)), tests.u(111), 'complete_task: completed_by = parent');
select is(public.child_balance(tests.u(202)), 90, 'complete_task: Khang crédité par le parent');
select tests.login(21);
select throws_ok($$select public.complete_task(tests.u(301), tests.u(519))$$, 'P0002', 'task_not_found', 'complete_task: tâche d''une autre famille introuvable');

-- ═══ uncomplete_task ═══
select tests.login(13);
select lives_ok($$select public.uncomplete_task(tests.u(301), tests.u(514))$$, 'uncomplete_task: Minh décoche');
select is(public.child_balance(tests.u(201)), 300, 'uncomplete_task: points annulés');
select is((select completed_at from public.tasks where id = tests.u(301)), null, 'uncomplete_task: completed_at remis à null');
select lives_ok($$select public.uncomplete_task(tests.u(301), tests.u(514))$$, 'uncomplete_task: rejeu accepté');
select is(public.child_balance(tests.u(201)), 300, 'uncomplete_task: idempotent');
select throws_ok($$select public.uncomplete_task(tests.u(302), tests.u(520))$$, '42501', 'forbidden', 'uncomplete_task: pas sur la tâche du frère');
-- les points débités sont ceux effectivement crédités, même si la tâche a changé depuis
select public.complete_task(tests.u(301), tests.u(515));
select tests.login(11);
update public.tasks set points = 30 where id = tests.u(301);
select tests.login(13);
select public.uncomplete_task(tests.u(301), tests.u(516));
select is(public.child_balance(tests.u(201)), 300, 'uncomplete_task: reprend les points réellement crédités (10, pas 30)');

-- refus si le solde disponible deviendrait négatif (points réservés protégés)
select tests.login(14);
select public.request_reward(tests.u(403), tests.u(721));  -- Khang : solde 90, réserve 90
select is((select available from public.child_balances where child_id = tests.u(202)), 0, 'réservation: disponible = 0');
select throws_ok($$select public.uncomplete_task(tests.u(302), tests.u(517))$$, 'P0001', 'insufficient_balance', 'uncomplete_task: refusé si le disponible deviendrait négatif');
select isnt((select completed_at from public.tasks where id = tests.u(302)), null, 'uncomplete_task: tâche toujours cochée après refus');

-- ═══ adjust_points ═══
select tests.login(13);
select throws_ok($$select public.adjust_points(tests.u(201), 1000, 'triche', tests.u(530))$$, '42501', 'forbidden', 'adjust_points: un enfant ne s''ajuste pas ses points');
select tests.login(14);
select throws_ok($$select public.adjust_points(tests.u(201), 5, 'frère', tests.u(531))$$, '42501', 'forbidden', 'adjust_points: ni ceux de son frère');
select tests.login(11);
select lives_ok($$select public.adjust_points(tests.u(201), 50, 'bonus', tests.u(518))$$, 'adjust_points: le parent ajuste (+50)');
select is(public.child_balance(tests.u(201)), 350, 'adjust_points: solde 350');
select lives_ok($$select public.adjust_points(tests.u(201), 50, 'bonus', tests.u(518))$$, 'adjust_points: rejeu accepté');
select is(public.child_balance(tests.u(201)), 350, 'adjust_points: idempotent');
select throws_ok($$select public.adjust_points(tests.u(201), 0, 'rien', tests.u(532))$$, '22023', 'invalid_adjustment', 'adjust_points: delta nul refusé');
select throws_ok($$select public.adjust_points(tests.u(201), 5, '  ', tests.u(533))$$, '22023', 'invalid_adjustment', 'adjust_points: motif obligatoire');
select throws_ok($$select public.adjust_points(tests.u(201), -1000, 'pénalité', tests.u(534))$$, 'P0001', 'insufficient_balance', 'adjust_points: pas de solde négatif');
select tests.login(21);
select throws_ok($$select public.adjust_points(tests.u(201), 5, 'x', tests.u(535))$$, 'P0002', 'child_not_found', 'adjust_points: enfant d''une autre famille introuvable');

-- ═══ tâches supprimées / points nuls ═══
select tests.logout();
update public.tasks set deleted_at = now() where id = tests.u(303);
select tests.login(13);
select throws_ok($$select public.complete_task(tests.u(303), tests.u(540))$$, 'P0002', 'task_not_found', 'complete_task: tâche supprimée pendant que l''enfant la coche → échec propre');
select tests.login(11);
insert into public.tasks (id, family_id, child_id, title, date, points, created_by)
  values (tests.u(340), tests.u(1), tests.u(201), 'Zéro', '2026-07-03', 0, tests.u(111));
select tests.login(13);
select public.complete_task(tests.u(340), tests.u(541));
select is(public.child_balance(tests.u(201)), 350, 'complete_task: tâche à 0 point sans transaction');
select isnt((select completed_at from public.tasks where id = tests.u(340)), null, 'complete_task: tâche à 0 point cochée');

-- ═══ accès ═══
select tests.logout();
set local role anon;
select throws_ok($$select public.complete_task(tests.u(301), tests.u(550))$$, '42501', null, 'complete_task: refusé à anon');
select tests.logout();
update public.members set revoked_at = now() where id = tests.u(113);
select tests.login(13);
select is(tests.n('select 1 from public.tasks'), 0::bigint, 'appareil révoqué: ne lit plus rien dès la requête suivante');
select throws_ok($$select public.complete_task(tests.u(301), tests.u(551))$$, '28000', 'not_authenticated', 'appareil révoqué: RPC refusée');

select * from finish();
rollback;
