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
  (tests.u(521), tests.u(2), tests.u(221), 50, 'manual_adjust', tests.u(121));
insert into public.reward_requests (id, family_id, child_id, reward_id, reward_title, cost, requested_by, expires_at)
  values (tests.u(701), tests.u(1), tests.u(201), tests.u(401), 'Game', 100, tests.u(113), now() + interval '7 days');
insert into public.devices (member_id, expo_push_token) values (tests.u(113), 'tok');
insert into public.notification_prefs (member_id, prefs) values (tests.u(111), '{}');
insert into public.goals (family_id, child_id, title, target, created_by) values (tests.u(1), tests.u(201), 'g', 3, tests.u(113));

select * from no_plan();

select tests.login(13);
select throws_ok($$select public.delete_family()$$, '42501', 'forbidden', 'delete_family: un enfant ne supprime pas la famille');
select tests.logout();
set local role anon;
select throws_ok($$select public.delete_family()$$, '42501', null, 'delete_family: refusé à anon');
select tests.logout();

-- le journal reste immuable pour tout le monde en temps normal
select throws_ok($$delete from public.point_transactions where id = tests.u(501)$$, '42501', 'immutable_journal', 'journal: DELETE direct toujours interdit');
select throws_ok($$update public.point_transactions set delta = 1 where id = tests.u(501)$$, '42501', 'immutable_journal', 'journal: UPDATE toujours interdit');
select tests.login(11);
select throws_ok($$set local app.deleting_family = 'on'; delete from public.point_transactions where id = tests.u(501)$$, '42501', null, 'journal: forcer le drapeau côté client ne permet pas de supprimer (pas de grant DELETE)');
select tests.logout();

-- suppression par un parent de la famille A
select tests.login(11);
select is(array_length(public.delete_family(), 1), 4, 'delete_family: renvoie les 4 comptes (2 parents + 2 enfants) à supprimer côté auth');
select tests.logout();
select is((select count(*)::int from public.families where id = tests.u(1)), 0, 'delete_family: famille supprimée');
select is((select count(*)::int from public.children where family_id = tests.u(1)), 0, 'delete_family: enfants supprimés');
select is((select count(*)::int from public.members where family_id = tests.u(1)), 0, 'delete_family: membres supprimés');
select is((select count(*)::int from public.tasks where family_id = tests.u(1)), 0, 'delete_family: tâches supprimées');
select is((select count(*)::int from public.point_transactions where family_id = tests.u(1)), 0, 'delete_family: journal des points purgé');
select is((select count(*)::int from public.reward_requests where family_id = tests.u(1)), 0, 'delete_family: demandes supprimées');
select is((select count(*)::int from public.goals where family_id = tests.u(1)), 0, 'delete_family: objectifs supprimés');
select is((select count(*)::int from public.rewards where family_id = tests.u(1)), 0, 'delete_family: récompenses supprimées');
select is((select count(*)::int from public.devices where member_id in (tests.u(113), tests.u(114))), 0, 'delete_family: appareils supprimés');
select is((select count(*)::int from public.notification_prefs), 0, 'delete_family: préférences supprimées');
-- l'autre famille est intacte
select is((select count(*)::int from public.families where id = tests.u(2)), 1, 'isolation: l''autre famille est intacte');
select is((select count(*)::int from public.point_transactions where family_id = tests.u(2)), 1, 'isolation: son journal aussi');
select is((select count(*)::int from public.tasks where family_id = tests.u(2)), 1, 'isolation: ses tâches aussi');
-- le drapeau est bien retombé
select throws_ok($$delete from public.point_transactions where id = tests.u(521)$$, '42501', 'immutable_journal', 'journal: protection rétablie après la suppression');

select * from finish();
rollback;
