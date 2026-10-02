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
select * from no_plan();

select tests.login(13);
insert into public.goals (id, family_id, child_id, title, target, progress, created_by)
  values (tests.u(901), tests.u(1), tests.u(201), 'Lire 5 livres', 5, 3, tests.u(113));
select is((select achieved_at from public.goals where id = tests.u(901)), null, 'goals: 3/5 → pas atteint');
update public.goals set progress = 4 where id = tests.u(901);
select is((select achieved_at from public.goals where id = tests.u(901)), null, 'goals: 4/5 → pas atteint');
update public.goals set progress = 5 where id = tests.u(901);
select isnt((select achieved_at from public.goals where id = tests.u(901)), null, 'goals: 5/5 → achieved_at posé par le serveur');
select tests.login(11);
select is((select count(*)::int from public.activity_log where type = 'goal_achieved'), 1, 'goals: le parent est notifié (activity_log) une seule fois');
select tests.login(13);
update public.goals set progress = 6 where id = tests.u(901);
select tests.login(11);
select is((select count(*)::int from public.activity_log where type = 'goal_achieved'), 1, 'goals: dépasser la cible ne notifie pas à nouveau');
select tests.login(13);
update public.goals set progress = 2 where id = tests.u(901);
select is((select achieved_at from public.goals where id = tests.u(901)), null, 'goals: décrémenter sous la cible retire le badge');
update public.goals set progress = 5 where id = tests.u(901);
select tests.login(11);
select is((select count(*)::int from public.activity_log where type = 'goal_achieved'), 2, 'goals: ré-atteindre la cible notifie à nouveau');
select tests.login(13);
select throws_ok($$update public.goals set progress = -1 where id = tests.u(901)$$, '23514', null, 'goals: progression négative refusée (CHECK)');
select throws_ok($$insert into public.goals (family_id, child_id, title, target, created_by) values (tests.u(1), tests.u(201), 'Zéro', 0, tests.u(113))$$, '23514', null, 'goals: cible ≥ 1 (CHECK)');
select tests.login(14);
select is(tests.n('update public.goals set progress = 0 where id = tests.u(901)'), 0::bigint, 'goals: le frère ne modifie pas la progression');
select tests.login(13);
select is(tests.n('update public.goals set deleted_at = now() where id = tests.u(901)'), 1::bigint, 'goals: suppression logique par son propriétaire');

select * from finish();
rollback;
