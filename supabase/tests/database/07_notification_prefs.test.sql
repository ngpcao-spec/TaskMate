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

-- ═══ notification_prefs ═══
select tests.login(11);
select lives_ok($$insert into public.notification_prefs (member_id, prefs) values (tests.u(111), '{"activity":{"taskDone":false}}')$$, 'prefs: le parent crée ses préférences');
select is((select prefs->'activity'->>'taskDone' from public.notification_prefs), 'false', 'prefs: relecture');
select is(tests.n($$update public.notification_prefs set prefs = '{"reminderBeforeStartMin":5}' where member_id = tests.u(111)$$), 1::bigint, 'prefs: le parent modifie les siennes');
select throws_ok($$insert into public.notification_prefs (member_id, prefs) values (tests.u(113), '{}')$$, '42501', null, 'prefs: un parent ne crée pas celles de l''enfant');
select throws_ok($$insert into public.notification_prefs (member_id, prefs) values (tests.u(111), '{}')$$, '23505', null, 'prefs: une seule ligne par membre (clé primaire)');
select tests.login(13);
select is(tests.n('select 1 from public.notification_prefs'), 0::bigint, 'prefs: l''enfant ne voit pas celles du parent');
select lives_ok($$insert into public.notification_prefs (member_id, prefs) values (tests.u(113), '{"reminderBeforeStartMin":15}')$$, 'prefs: l''enfant crée les siennes');
select is(tests.n($$update public.notification_prefs set prefs = '{}' where member_id = tests.u(111)$$), 0::bigint, 'prefs: l''enfant ne modifie pas celles du parent');
select tests.login(14);
select is(tests.n('select 1 from public.notification_prefs'), 0::bigint, 'prefs: son frère ne voit pas les siennes');
select throws_ok($$delete from public.notification_prefs$$, '42501', null, 'prefs: pas de DELETE');
select tests.login(21);
select is(tests.n('select 1 from public.notification_prefs'), 0::bigint, 'prefs: autre famille invisible');
select throws_ok($$insert into public.notification_prefs (member_id, prefs) values (tests.u(111), '{}')$$, '42501', null, 'prefs: pas d''écriture inter-familles');
select tests.logout();
select throws_ok($$insert into public.notification_prefs (member_id, prefs) values (tests.u(114), '"x"')$$, '23514', null, 'prefs: prefs doit être un objet JSON (CHECK)');

-- ═══ tâche assignée (journal) ═══
select tests.login(11);
select lives_ok($$insert into public.tasks (id, family_id, child_id, title, date, created_by) values (tests.u(350), tests.u(1), tests.u(201), 'À 20h', '2026-07-02', tests.u(111))$$, 'assigned: le parent crée une tâche pour Minh');
select is((select count(*)::int from public.activity_log where type = 'task_assigned' and child_id = tests.u(201) and payload->>'task_id' = tests.u(350)::text), 1, 'assigned: journalisé pour l''enfant concerné');
select tests.login(13);
select throws_ok($$insert into public.tasks (id, family_id, child_id, title, date, created_by) values (tests.u(351), tests.u(1), tests.u(201), 'Perso', '2026-07-02', tests.u(113))$$, '42501', null, 'assigned: l''enfant ne peut plus créer de tâche (SPEC v4)');
select tests.login(11);
select is((select count(*)::int from public.activity_log where type = 'task_assigned' and payload->>'task_id' = tests.u(351)::text), 0, 'assigned: aucune tâche ni journal côté enfant');

select * from finish();
rollback;
