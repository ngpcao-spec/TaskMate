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
create table tests.v (k text primary key, v int);
grant all on tests.v to authenticated;
create function tests.bal(c int, col text) returns int language plpgsql as $$
declare r int;
begin
  execute format('select %I from public.child_balances where child_id = tests.u(%s)', col, c) into r;
  return r;
end $$;
grant execute on all functions in schema tests to authenticated;

select * from no_plan();

-- ═══ request_reward : réserve sans débiter ═══
select tests.login(13);
insert into tests.v values ('avail0', tests.bal(201, 'available'));
select lives_ok($$select public.request_reward(tests.u(401), tests.u(711))$$, 'request_reward: Minh demande « Game » (100)');
select is(tests.bal(201, 'balance'), 300, 'request_reward: aucun débit (balance inchangée)');
select is(tests.bal(201, 'reserved'), 100, 'request_reward: 100 points réservés');
select is(tests.bal(201, 'available'), 200, 'request_reward: disponible = 200');
select is((select count(*)::int from public.point_transactions where reason = 'reward_redeemed'), 0, 'request_reward: aucune transaction reward_redeemed avant approbation');
select is((select status::text from public.reward_requests where id = tests.u(711)), 'pending', 'request_reward: statut pending');
select is((select expires_at > now() + interval '6 days 23 hours' from public.reward_requests where id = tests.u(711)), true, 'request_reward: expire dans 7 jours');
select lives_ok($$select public.request_reward(tests.u(401), tests.u(711))$$, 'request_reward: rejeu accepté');
select is(tests.bal(201, 'reserved'), 100, 'request_reward: rejeu idempotent (une seule réservation)');
select lives_ok($$select public.request_reward(tests.u(402), tests.u(712))$$, 'request_reward: seconde demande « Film » (150) acceptée');
select is(tests.bal(201, 'available'), 50, 'request_reward: disponible = 50');
select throws_ok($$select public.request_reward(tests.u(402), tests.u(713))$$, 'P0001', 'insufficient_balance', 'request_reward: la demande qui dépasse le disponible est refusée côté serveur');
select is((select count(*)::int from public.reward_requests where child_id = tests.u(201)), 2, 'request_reward: demande refusée non créée');
select throws_ok($$select public.request_reward(tests.u(403), tests.u(714))$$, 'P0002', 'reward_not_found', 'request_reward: récompense réservée à son frère introuvable');
select throws_ok($$select public.request_reward(tests.u(421), tests.u(714))$$, 'P0002', 'reward_not_found', 'request_reward: récompense d''une autre famille introuvable');
select tests.login(11);
select throws_ok($$select public.request_reward(tests.u(401), tests.u(715))$$, '42501', 'forbidden', 'request_reward: un parent ne demande pas pour un enfant');

-- Aucun plafond : plusieurs demandes identiques tant que le disponible le permet
select public.adjust_points(tests.u(201), 500, 'bonus', tests.u(522));
select tests.login(13);
select lives_ok($$select public.request_reward(tests.u(401), tests.u(714))$$, 'aucun plafond: 2e demande de « Game »');
select lives_ok($$select public.request_reward(tests.u(401), tests.u(715))$$, 'aucun plafond: 3e demande de « Game »');
select is(tests.bal(201, 'reserved'), 450, 'aucun plafond: 100+150+100+100 réservés');

-- ═══ annulation / refus : le disponible revient ═══
select tests.login(14);
select throws_ok($$select public.cancel_reward_request(tests.u(714))$$, '42501', 'forbidden', 'cancel: Khang ne peut pas annuler la demande de son frère');
select tests.login(13);
select lives_ok($$select public.cancel_reward_request(tests.u(714))$$, 'cancel: Minh annule sa demande');
select is((select status::text from public.reward_requests where id = tests.u(714)), 'cancelled', 'cancel: statut cancelled');
select lives_ok($$select public.cancel_reward_request(tests.u(714))$$, 'cancel: rejeu accepté');
select is(tests.bal(201, 'reserved'), 350, 'cancel: réservation libérée');
select tests.login(11);
select lives_ok($$select public.reject_reward_request(tests.u(715), 'pas ce soir')$$, 'reject: le parent refuse avec motif');
select is((select decision_note from public.reward_requests where id = tests.u(715)), 'pas ce soir', 'reject: motif enregistré');
select is(tests.bal(201, 'reserved'), 250, 'reject: réservation libérée');
select is(tests.bal(201, 'balance'), 800, 'reject: aucun débit');
select lives_ok($$select public.reject_reward_request(tests.u(715))$$, 'reject: rejeu accepté');
select is(tests.bal(201, 'available'), 550, 'reject/cancel: disponible = solde − demandes encore en attente');
select tests.login(13);
select throws_ok($$select public.reject_reward_request(tests.u(711))$$, '42501', 'forbidden', 'reject: un enfant ne refuse pas');

-- ═══ approbation ═══
select throws_ok($$select public.approve_reward_request(tests.u(711), tests.u(523))$$, '42501', 'forbidden', 'approve: un enfant ne s''auto-approuve pas');
select tests.login(14);
select throws_ok($$select public.approve_reward_request(tests.u(711), tests.u(523))$$, '42501', 'forbidden', 'approve: son frère non plus');
select tests.login(21);
select throws_ok($$select public.approve_reward_request(tests.u(711), tests.u(523))$$, 'P0002', 'request_not_found', 'approve: parent d''une autre famille → introuvable');
select tests.login(11);
select lives_ok($$select public.approve_reward_request(tests.u(711), tests.u(523))$$, 'approve: le parent approuve');
select is(tests.bal(201, 'balance'), 700, 'approve: débit définitif de 100');
select is(tests.bal(201, 'reserved'), 150, 'approve: la réservation de 711 disparaît');
select is((select count(*)::int from public.point_transactions where reason = 'reward_redeemed' and ref_id = tests.u(711) and delta = -100), 1, 'approve: exactement une transaction reward_redeemed');
select lives_ok($$select public.approve_reward_request(tests.u(711), tests.u(523))$$, 'approve: rejeu (même tx_id) accepté');
select tests.login(12);
select throws_ok($$select public.approve_reward_request(tests.u(711), tests.u(524))$$, 'P0001', 'not_pending', 'approve: le second parent ne débite pas une 2e fois');
select is(tests.bal(201, 'balance'), 700, 'approve: un seul débit');
select throws_ok($$select public.approve_reward_request(tests.u(714), tests.u(525))$$, 'P0001', 'not_pending', 'approve: demande annulée → échec propre');
select throws_ok($$select public.approve_reward_request(tests.u(715), tests.u(526))$$, 'P0001', 'not_pending', 'approve: demande refusée → échec propre');
select is((select decided_by from public.reward_requests where id = tests.u(711)), tests.u(111), 'approve: decided_by = premier parent');
select tests.login(13);
select throws_ok($$select public.cancel_reward_request(tests.u(711))$$, 'P0001', 'not_pending', 'cancel: impossible après approbation');

-- ═══ expiration (7 jours) ═══
select tests.logout();
update public.reward_requests set expires_at = now() - interval '1 hour' where id = tests.u(712);
select tests.login(13);
select is(tests.bal(201, 'reserved'), 0, 'expiration: une demande échue ne réserve plus rien');
select is(tests.bal(201, 'available'), 700, 'expiration: disponible revenu à la valeur sans demande');
select tests.login(11);
select throws_ok($$select public.approve_reward_request(tests.u(712), tests.u(527))$$, 'P0001', 'not_pending', 'expiration: approuver une demande échue échoue');
select tests.logout();
select is(public.expire_reward_requests(), 1, 'expiration: le job passe la demande en expired');
select is((select status::text from public.reward_requests where id = tests.u(712)), 'expired', 'expiration: statut expired');
select is(public.expire_reward_requests(), 0, 'expiration: job idempotent');
select is((select count(*)::int from public.activity_log where type = 'reward_expired'), 1, 'expiration: notification (activity_log) pour l''enfant');
select tests.login(13);
select throws_ok($$select public.expire_reward_requests()$$, '42501', null, 'expiration: non appelable par un client');
select is(tests.bal(201, 'available'), 700, 'expiration: disponible stable');

select * from finish();
rollback;
