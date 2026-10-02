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
-- Invite, appareil, solde, demande, activité pour les tests de lecture
insert into public.invite_codes (family_id, child_id, role, code, expires_at, created_by)
  values (tests.u(1), tests.u(201), 'child', 'ABCDEF', now() + interval '1 day', tests.u(111));
insert into public.devices (id, member_id, expo_push_token) values
  (tests.u(601), tests.u(113), 'tok-minh'), (tests.u(602), tests.u(114), 'tok-khang'), (tests.u(621), tests.u(121), 'tok-b');
insert into public.point_transactions (id, family_id, child_id, delta, reason, created_by) values
  (tests.u(501), tests.u(1), tests.u(201), 300, 'manual_adjust', tests.u(111)),
  (tests.u(502), tests.u(1), tests.u(202), 80, 'manual_adjust', tests.u(111));
insert into public.reward_requests (id, family_id, child_id, reward_id, reward_title, cost, requested_by, expires_at) values
  (tests.u(701), tests.u(1), tests.u(201), tests.u(401), 'Game', 100, tests.u(113), now() + interval '7 days'),
  (tests.u(702), tests.u(1), tests.u(202), tests.u(401), 'Game', 100, tests.u(114), now() + interval '7 days');
insert into public.activity_log (family_id, child_id, type) values (tests.u(1), tests.u(201), 'task_completed');

select * from no_plan();

-- ═══ families ═══
select tests.login(11);
select is(tests.n('select 1 from public.families'), 1::bigint, 'families: le parent voit sa famille uniquement');
select is(tests.n('update public.families set name = ''A2'' where id = tests.u(1)'), 1::bigint, 'families: le parent peut modifier sa famille');
select tests.login(13);
select is(tests.n('update public.families set name = ''X'' where id = tests.u(1)'), 0::bigint, 'families: un enfant ne peut pas modifier la famille');
select tests.login(21);
select is(tests.n('select 1 from public.families where id = tests.u(1)'), 0::bigint, 'families: une autre famille est invisible');
select is(tests.n('update public.families set name = ''X'' where id = tests.u(1)'), 0::bigint, 'families: pas de modification inter-familles');

-- ═══ children ═══
select tests.login(13);
select is(tests.n('select 1 from public.children'), 2::bigint, 'children: un enfant voit ses deux frères/soeurs (lecture)');
select throws_ok($$insert into public.children (family_id, name, birth_date) values (tests.u(1), 'Z', '2015-01-01')$$, '42501', null, 'children: un enfant ne peut pas créer d''enfant');
select is(tests.n('update public.children set name = ''Hack'' where id = tests.u(202)'), 0::bigint, 'children: un enfant ne peut pas modifier son frère');
select is(tests.n('update public.children set name = ''Hack'' where id = tests.u(201)'), 0::bigint, 'children: un enfant ne peut pas se modifier');
select tests.login(11);
select lives_ok($$insert into public.children (family_id, name, birth_date) values (tests.u(1), 'Nouveau', '2016-01-01')$$, 'children: le parent crée un enfant');
select is(tests.n('update public.children set name = ''Minh B'' where id = tests.u(201)'), 1::bigint, 'children: le parent modifie un enfant');
select tests.login(21);
select is(tests.n('select 1 from public.children where family_id = tests.u(1)'), 0::bigint, 'children: autre famille invisible');
select throws_ok($$insert into public.children (family_id, name, birth_date) values (tests.u(1), 'Z', '2015-01-01')$$, '42501', null, 'children: pas d''insertion dans une autre famille');
select is(tests.n('update public.children set name = ''Hack'' where id = tests.u(201)'), 0::bigint, 'children: pas de modification inter-familles');

-- ═══ members ═══
select tests.login(13);
select is(tests.n('select 1 from public.members'), 4::bigint, 'members: lecture limitée à la famille');
select throws_ok($$insert into public.members (family_id, user_id, role, display_name) values (tests.u(1), tests.u(21), 'parent', 'Pirate')$$, '42501', null, 'members: aucun insert direct (RPC uniquement)');
select throws_ok($$update public.members set role = 'parent' where id = tests.u(113)$$, '42501', null, 'members: aucun update direct (auto-promotion impossible)');
select tests.login(21);
select is(tests.n('select 1 from public.members'), 1::bigint, 'members: autre famille invisible');

-- ═══ invite_codes ═══
select tests.login(11);
select is(tests.n('select 1 from public.invite_codes'), 1::bigint, 'invite_codes: le parent voit les codes de sa famille');
select tests.login(13);
select is(tests.n('select 1 from public.invite_codes'), 0::bigint, 'invite_codes: invisibles pour un enfant');
select tests.login(21);
select is(tests.n('select 1 from public.invite_codes'), 0::bigint, 'invite_codes: invisibles pour une autre famille');
select throws_ok($$insert into public.invite_codes (family_id, role, code, expires_at, created_by) values (tests.u(2), 'parent', 'ZZZZZZ', now(), tests.u(121))$$, '42501', null, 'invite_codes: aucun insert direct');

-- ═══ devices ═══
select tests.login(13);
select is(tests.n('select 1 from public.devices'), 1::bigint, 'devices: un enfant ne voit que le sien');
select throws_ok($$insert into public.devices (member_id) values (tests.u(113))$$, '42501', null, 'devices: aucun insert direct');
select tests.login(11);
select is(tests.n('select 1 from public.devices'), 2::bigint, 'devices: le parent voit ceux de sa famille (pas ceux de B)');
select tests.login(21);
select is(tests.n('select 1 from public.devices'), 1::bigint, 'devices: B ne voit que ses appareils');

-- ═══ tasks ═══
select tests.login(13);
select is(tests.n('select 1 from public.tasks'), 3::bigint, 'tasks: Minh lit les tâches de la famille (frère inclus)');
select is(tests.n('select 1 from public.tasks where id = tests.u(302) and note = ''secret?'''), 1::bigint, 'tasks: Minh lit les notes de son frère');
select is(tests.n('select 1 from public.tasks where id = tests.u(321)'), 0::bigint, 'tasks: autre famille invisible');
select lives_ok($$insert into public.tasks (id, family_id, child_id, title, date, created_by) values (tests.u(331), tests.u(1), tests.u(201), 'Nouvelle', '2026-07-03', tests.u(113))$$, 'tasks: Minh crée une tâche pour lui (points = 10)');
select throws_ok($$insert into public.tasks (family_id, child_id, title, date, created_by) values (tests.u(1), tests.u(202), 'Pour Khang', '2026-07-03', tests.u(113))$$, '42501', null, 'tasks: Minh ne peut pas créer pour son frère');
select throws_ok($$insert into public.tasks (family_id, child_id, title, date, points, created_by) values (tests.u(1), tests.u(201), 'Riche', '2026-07-03', 50, tests.u(113))$$, '42501', null, 'tasks: Minh ne peut pas fixer points ≠ 10');
select throws_ok($$insert into public.tasks (family_id, child_id, title, date, created_by) values (tests.u(1), tests.u(201), 'Usurpe', '2026-07-03', tests.u(111))$$, '42501', null, 'tasks: created_by doit être soi-même');
select throws_ok($$insert into public.tasks (family_id, child_id, title, date, created_by, completed_at) values (tests.u(1), tests.u(201), 'Déjà faite', '2026-07-03', tests.u(113), now())$$, '42501', null, 'tasks: completed_at non insérable directement');
select throws_ok($$update public.tasks set points = 99 where id = tests.u(303)$$, '42501', null, 'tasks: Minh ne peut pas modifier points de sa tâche');
select throws_ok($$update public.tasks set completed_at = now() where id = tests.u(303)$$, '42501', null, 'tasks: completed_at non modifiable directement (RPC)');
select is(tests.n('update public.tasks set title = ''Renommée'' where id = tests.u(303)'), 1::bigint, 'tasks: Minh modifie une tâche qu''il a créée');
select is(tests.n('update public.tasks set title = ''Hack'' where id = tests.u(301)'), 0::bigint, 'tasks: Minh ne modifie pas une tâche créée par le parent');
select is(tests.n('update public.tasks set title = ''Hack'' where id = tests.u(302)'), 0::bigint, 'tasks: Minh ne modifie pas la tâche de son frère');
select is(tests.n('update public.tasks set deleted_at = now() where id = tests.u(302)'), 0::bigint, 'tasks: Minh ne supprime pas la tâche de son frère');
select throws_ok($$update public.tasks set child_id = tests.u(202) where id = tests.u(303)$$, '42501', null, 'tasks: Minh ne peut pas réassigner à son frère');
select is(tests.n('update public.tasks set deleted_at = now() where id = tests.u(303)'), 1::bigint, 'tasks: Minh supprime (soft) sa propre tâche');
select throws_ok($$delete from public.tasks where id = tests.u(303)$$, '42501', null, 'tasks: aucun DELETE physique');
select tests.login(11);
select lives_ok($$insert into public.tasks (family_id, child_id, title, date, points, created_by) values (tests.u(1), tests.u(202), 'Parent->Khang', '2026-07-03', 25, tests.u(111))$$, 'tasks: le parent crée pour n''importe quel enfant, points libres');
select is(tests.n('update public.tasks set points = 30 where id = tests.u(301)'), 1::bigint, 'tasks: le parent modifie points');
select is(tests.n('update public.tasks set title = ''P'' where id = tests.u(302)'), 1::bigint, 'tasks: le parent modifie toute tâche');
select throws_ok($$update public.tasks set completed_by = tests.u(111) where id = tests.u(301)$$, '42501', null, 'tasks: même le parent ne touche pas completed_by directement');
select tests.login(21);
select throws_ok($$insert into public.tasks (family_id, child_id, title, date, created_by) values (tests.u(1), tests.u(201), 'Inter-familles', '2026-07-03', tests.u(121))$$, '42501', null, 'tasks: pas d''insertion dans une autre famille');
select is(tests.n('update public.tasks set title = ''Hack'' where id = tests.u(301)'), 0::bigint, 'tasks: pas de modification inter-familles');

-- ═══ recurrences ═══
select tests.login(13);
select throws_ok($$insert into public.recurrences (family_id, child_id, title, time_kind, rule, starts_on, created_by) values (tests.u(1), tests.u(201), 'R', 'anytime', 'daily', '2026-07-02', tests.u(113))$$, '42501', null, 'recurrences: un enfant ne crée pas de récurrence');
select tests.login(11);
select lives_ok($$insert into public.recurrences (id, family_id, child_id, title, time_kind, rule, starts_on, created_by) values (tests.u(801), tests.u(1), tests.u(201), 'R', 'anytime', 'daily', '2026-07-02', tests.u(111))$$, 'recurrences: le parent crée une récurrence');
select tests.login(13);
select is(tests.n('select 1 from public.recurrences'), 1::bigint, 'recurrences: lecture par l''enfant');
select is(tests.n('update public.recurrences set title = ''X'' where id = tests.u(801)'), 0::bigint, 'recurrences: un enfant ne modifie pas');
select tests.login(21);
select is(tests.n('select 1 from public.recurrences'), 0::bigint, 'recurrences: autre famille invisible');

-- ═══ goals ═══
select tests.login(13);
select lives_ok($$insert into public.goals (id, family_id, child_id, title, target, created_by) values (tests.u(901), tests.u(1), tests.u(201), 'Lire', 5, tests.u(113))$$, 'goals: Minh crée un objectif pour lui');
select throws_ok($$insert into public.goals (family_id, child_id, title, target, created_by) values (tests.u(1), tests.u(202), 'Pour Khang', 5, tests.u(113))$$, '42501', null, 'goals: Minh ne crée pas pour son frère');
select throws_ok($$update public.goals set achieved_at = now() where id = tests.u(901)$$, '42501', null, 'goals: achieved_at posé par le serveur uniquement');
select is(tests.n('update public.goals set progress = 5 where id = tests.u(901)'), 1::bigint, 'goals: Minh met à jour sa progression');
select isnt((select achieved_at from public.goals where id = tests.u(901)), null, 'goals: objectif atteint → achieved_at posé par trigger');
select tests.login(14);
select is(tests.n('select 1 from public.goals'), 1::bigint, 'goals: Khang lit les objectifs de son frère');
select is(tests.n('update public.goals set progress = 0 where id = tests.u(901)'), 0::bigint, 'goals: Khang ne modifie pas ceux de son frère');
select tests.login(11);
select lives_ok($$insert into public.goals (family_id, child_id, title, target, created_by) values (tests.u(1), tests.u(202), 'Parent', 3, tests.u(111))$$, 'goals: le parent crée pour tout enfant');
select tests.login(21);
select is(tests.n('select 1 from public.goals'), 0::bigint, 'goals: autre famille invisible');

-- ═══ rewards ═══
select tests.login(13);
select is(tests.n('select 1 from public.rewards'), 2::bigint, 'rewards: lecture par l''enfant');
select throws_ok($$insert into public.rewards (family_id, title, cost) values (tests.u(1), 'Gratuit', 1)$$, '42501', null, 'rewards: un enfant ne crée pas de récompense');
select is(tests.n('update public.rewards set cost = 1 where id = tests.u(401)'), 0::bigint, 'rewards: un enfant ne modifie pas le coût');
select tests.login(11);
select lives_ok($$insert into public.rewards (family_id, title, cost) values (tests.u(1), 'Sortie', 300)$$, 'rewards: le parent crée');
select is(tests.n('update public.rewards set cost = 120 where id = tests.u(401)'), 1::bigint, 'rewards: le parent modifie');
select tests.login(21);
select is(tests.n('select 1 from public.rewards where family_id = tests.u(1)'), 0::bigint, 'rewards: autre famille invisible');
select is(tests.n('update public.rewards set cost = 1 where id = tests.u(401)'), 0::bigint, 'rewards: pas de modification inter-familles');

-- ═══ point_transactions ═══
select tests.login(13);
select is(tests.n('select 1 from public.point_transactions'), 2::bigint, 'point_transactions: le solde du frère est lisible');
select throws_ok($$insert into public.point_transactions (id, family_id, child_id, delta, reason, created_by) values (gen_random_uuid(), tests.u(1), tests.u(201), 1000, 'manual_adjust', tests.u(113))$$, '42501', null, 'point_transactions: un enfant ne s''attribue pas de points');
select tests.login(11);
select throws_ok($$insert into public.point_transactions (id, family_id, child_id, delta, reason, created_by) values (gen_random_uuid(), tests.u(1), tests.u(201), 1, 'manual_adjust', tests.u(111))$$, '42501', null, 'point_transactions: même le parent passe par adjust_points');
select throws_ok($$update public.point_transactions set delta = 1 where id = tests.u(501)$$, '42501', null, 'point_transactions: pas d''UPDATE');
select tests.login(21);
select is(tests.n('select 1 from public.point_transactions'), 0::bigint, 'point_transactions: autre famille invisible');
select tests.logout();
select throws_ok($$update public.point_transactions set delta = 1 where id = tests.u(501)$$, '42501', 'immutable_journal', 'point_transactions: journal immuable même pour le propriétaire (UPDATE)');
select throws_ok($$delete from public.point_transactions where id = tests.u(501)$$, '42501', 'immutable_journal', 'point_transactions: journal immuable (DELETE)');
select throws_ok($$truncate public.point_transactions$$, '42501', 'immutable_journal', 'point_transactions: journal immuable (TRUNCATE)');

-- ═══ reward_requests ═══
select tests.login(13);
select is(tests.n('select 1 from public.reward_requests'), 1::bigint, 'reward_requests: un enfant ne voit que les siennes');
select throws_ok($$insert into public.reward_requests (id, family_id, child_id, reward_id, reward_title, cost, requested_by, expires_at) values (gen_random_uuid(), tests.u(1), tests.u(201), tests.u(401), 'Game', 1, tests.u(113), now())$$, '42501', null, 'reward_requests: aucun insert direct');
select throws_ok($$update public.reward_requests set status = 'approved' where id = tests.u(701)$$, '42501', null, 'reward_requests: un enfant ne s''auto-approuve pas');
select tests.login(11);
select is(tests.n('select 1 from public.reward_requests'), 2::bigint, 'reward_requests: le parent voit toutes les demandes');
select tests.login(21);
select is(tests.n('select 1 from public.reward_requests'), 0::bigint, 'reward_requests: autre famille invisible');

-- ═══ activity_log ═══
select tests.login(11);
select is(tests.n('select 1 from public.activity_log'), 2::bigint, 'activity_log: le parent lit (dont goal_achieved posé par trigger)');
select tests.login(13);
select is(tests.n('select 1 from public.activity_log'), 0::bigint, 'activity_log: invisible pour un enfant');
select throws_ok($$insert into public.activity_log (family_id, type) values (tests.u(1), 'x')$$, '42501', null, 'activity_log: aucun insert direct');

-- ═══ child_balances (vue) ═══
select tests.login(13);
select is((select balance from public.child_balances where child_id = tests.u(202)), 80, 'child_balances: solde du frère visible');
select is((select available from public.child_balances where child_id = tests.u(201)), 200, 'child_balances: disponible = solde − réservé');
select tests.login(21);
select is(tests.n('select 1 from public.child_balances where family_id = tests.u(1)'), 0::bigint, 'child_balances: autre famille invisible');
select is(public.child_balance(tests.u(201)), 0, 'child_balance: pas de fuite inter-familles');
select tests.logout();
set local role anon;
select throws_ok($$select 1 from public.tasks$$, '42501', null, 'anon: aucun accès aux tables');

select * from finish();
rollback;
