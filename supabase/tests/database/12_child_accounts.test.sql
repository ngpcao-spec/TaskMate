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
insert into auth.users (id, email, is_anonymous) values
  (tests.u(41), 'lan@child.test', false), (tests.u(42), 'bao@child.test', false), (tests.u(43), 'an@child.test', false);
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(203), tests.u(1), 'Lan', '2014-01-01'), (tests.u(204), tests.u(1), 'Bảo', '2015-01-01');
grant usage on schema tests to service_role;
grant execute on all functions in schema tests to service_role;

select * from no_plan();

-- ═══ child_account_target : autorisation (appelée avec le JWT de l'appelant) ═══
select tests.login(11);
select is((select public.child_account_target(tests.u(203))->>'child_name'), 'Lan', 'target: le parent obtient son enfant');
select ok((select public.child_account_target(tests.u(203))->>'login_id') is null, 'target: pas encore de compte');
select tests.login(13);
select throws_ok($$select public.child_account_target(tests.u(203))$$, '42501', 'forbidden', 'target: un enfant est refusé');
select tests.login(21);
select throws_ok($$select public.child_account_target(tests.u(203))$$, '42501', 'forbidden', 'target: le parent d''une autre famille est refusé');
select tests.login(11);
select throws_ok($$select public.child_account_target(tests.u(221))$$, '42501', 'forbidden', 'target: enfant d''une autre famille = même refus (aucune fuite)');
select throws_ok($$select public.child_account_target(tests.u(999))$$, '42501', 'forbidden', 'target: enfant inexistant = même refus');
reset role;
set local role anon;
select throws_ok($$select public.child_account_target(tests.u(203))$$, '42501', null, 'target: anon refusé');

-- ═══ register_child_account : service_role uniquement ═══
select tests.login(11);
select throws_ok($$select public.register_child_account(tests.u(203), tests.u(41), 'lan.nguyen', 'lan.nguyen@child.taskmate.invalid')$$, '42501', null, 'register: un parent ne l''appelle pas directement');
select tests.login(13);
select throws_ok($$select public.register_child_account(tests.u(203), tests.u(41), 'lan.nguyen', 'lan.nguyen@child.taskmate.invalid')$$, '42501', null, 'register: un enfant ne crée aucun compte');
select throws_ok($$select public.remove_child_account(tests.u(201))$$, '42501', null, 'remove: un enfant ne supprime aucun compte');
reset role;
set local role anon;
select throws_ok($$select public.register_child_account(tests.u(203), tests.u(41), 'lan.nguyen', 'lan.nguyen@child.taskmate.invalid')$$, '42501', null, 'register: anon refusé');

reset role;
set local role service_role;
select lives_ok($$select public.register_child_account(tests.u(203), tests.u(41), 'lan.nguyen', 'lan.nguyen@child.taskmate.invalid')$$, 'register: le service crée le compte de Lan');
select is((select role::text from public.members where user_id = tests.u(41)), 'child', 'register: membre de rôle child');
select is((select child_id from public.members where user_id = tests.u(41)), tests.u(203), 'register: lié au bon profil');
select is((select display_name from public.members where user_id = tests.u(41)), 'Lan', 'register: prénom du profil');
select is((select login_id from public.child_accounts where child_id = tests.u(203)), 'lan.nguyen', 'register: identifiant enregistré');
select throws_ok($$select public.register_child_account(tests.u(203), tests.u(42), 'lan.autre', 'lan.autre@child.taskmate.invalid')$$, 'P0001', 'account_exists', 'register: un seul compte par enfant');
select throws_ok($$select public.register_child_account(tests.u(204), tests.u(42), 'lan.nguyen', 'lan.nguyen@child.taskmate.invalid')$$, 'P0001', 'identifier_taken', 'register: identifiant déjà pris');
select throws_ok($$select public.register_child_account(tests.u(204), tests.u(41), 'bao.nguyen', 'bao.nguyen@child.taskmate.invalid')$$, 'P0001', 'already_member', 'register: un utilisateur déjà membre est refusé');
select throws_ok($$select public.register_child_account(tests.u(999), tests.u(42), 'bao.nguyen', 'bao.nguyen@child.taskmate.invalid')$$, 'P0002', 'child_not_found', 'register: profil inconnu');
select throws_ok($$select public.register_child_account(tests.u(204), tests.u(42), 'Bao Nguyen', 'Bao Nguyen@child.taskmate.invalid')$$, '23514', null, 'register: format d''identifiant invalide (majuscule, espace)');
select throws_ok($$select public.register_child_account(tests.u(204), tests.u(42), 'ab', 'ab@child.taskmate.invalid')$$, '23514', null, 'register: identifiant trop court');
select lives_ok($$select public.register_child_account(tests.u(204), tests.u(42), 'bao.nguyen', 'bao.nguyen@child.taskmate.invalid')$$, 'register: second enfant, autre identifiant');

-- l'enfant connecté voit son profil et rien de plus qu'avant (droits spec v4 inchangés)
select tests.login(41);
select is(tests.n('select 1 from public.children'), 4::bigint, 'compte enfant: voit les profils de la famille (lecture)');
select is(tests.n('select 1 from public.child_accounts'), 0::bigint, 'compte enfant: ne voit aucun identifiant');
select throws_ok($$insert into public.tasks (family_id, child_id, title, date, created_by) values (tests.u(1), tests.u(203), 'Tâche bidon', '2026-07-02', (select id from public.members where user_id = tests.u(41)))$$, '42501', null, 'compte enfant: ne crée toujours aucune tâche (spec v4)');

-- ═══ child_account_target après création ═══
select tests.login(11);
select is((select public.child_account_target(tests.u(203))->>'login_id'), 'lan.nguyen', 'target: le parent voit l''identifiant');
select is((select public.child_account_target(tests.u(203))->>'user_id'), tests.u(41)::text, 'target: renvoie le compte auth à gérer');
select is(tests.n('select 1 from public.child_accounts'), 2::bigint, 'child_accounts: le parent lit les deux comptes');

-- ═══ remove_child_account ═══
select tests.login(41);
select lives_ok($$select public.register_device('tok-lan', 'web')$$, 'fixture: l''enfant a un appareil');
reset role;
set local role service_role;
select is((select public.remove_child_account(tests.u(203))), tests.u(41), 'remove: renvoie le user_id à verrouiller');
select isnt((select revoked_at from public.members where user_id = tests.u(41)), null, 'remove: membre révoqué');
select is((select count(*)::int from public.devices where member_id = (select id from public.members where user_id = tests.u(41)) and revoked_at is null), 0, 'remove: appareils révoqués');
select is((select count(*)::int from public.child_accounts where child_id = tests.u(203)), 0, 'remove: compte supprimé');
select is((select public.remove_child_account(tests.u(203))), null, 'remove: idempotent (aucun compte → null)');
select lives_ok($$select public.register_child_account(tests.u(203), tests.u(43), 'lan.nguyen', 'lan.nguyen@child.taskmate.invalid')$$, 'remove: l''identifiant est libéré et réutilisable');
select tests.login(41);
select is(tests.n('select 1 from public.children'), 0::bigint, 'remove: l''ancien compte perd tout accès');
select tests.login(11);
select is((select count(*)::int from public.tasks where child_id = tests.u(203)), 0, 'remove: (historique conservé côté profil, ici aucune tâche)');
select is((select count(*)::int from public.children where id = tests.u(203) and deleted_at is null), 1, 'remove: le profil de l''enfant est conservé');

-- ═══ un compte enfant ne crée jamais de famille ═══
reset role;
update public.members set revoked_at = now() where user_id = tests.u(42); -- compte enfant dont le profil a été retiré
select tests.login(42);
select set_config('request.jwt.claims', '{"app_metadata":{"account_type":"child"}}', true);
select throws_ok($$select public.create_family('Famille pirate', 'Bảo')$$, '42501', 'forbidden', 'create_family: refusé à un compte marqué « child »');
select set_config('request.jwt.claims', '{"app_metadata":{"provider":"email"}}', true);
select throws_ok($$select public.create_family('Famille e-mail', 'Ba')$$, '42501', 'google_required', 'create_family: un NOUVEAU parent doit se connecter avec Google (D-050)');
select set_config('request.jwt.claims', '{"app_metadata":{"provider":"google","providers":["google"]}}', true);
select lives_ok($$select public.create_family('Famille légitime', 'Ba')$$, 'create_family: un parent connecté avec Google peut créer sa famille');

-- ═══ delete_family purge aussi les comptes enfants ═══
select tests.login(11);
select set_config('request.jwt.claims', '', true);
select lives_ok($$select public.delete_family()$$, 'delete_family: le parent supprime sa famille');
reset role;
select is((select count(*)::int from public.child_accounts where family_id = tests.u(1)), 0, 'delete_family: comptes enfants purgés');

select * from finish();
rollback;
