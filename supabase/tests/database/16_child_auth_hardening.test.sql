-- Durcissement des comptes enfants (D-051) : adresse GoTrue aléatoire, mot de passe GoTrue inconnu, mot de passe réel vérifié
-- contre un haché bcrypt illisible côté client ; migration des comptes existants sans rien casser.
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
grant execute on all functions in schema tests to authenticated, anon, service_role;

-- ═══ données « de production » AVANT la migration : adresse devinable, mot de passe d'enfant = mot de passe GoTrue (bcrypt) ═══
insert into auth.users (id, email, encrypted_password, is_anonymous) values
  (tests.u(11), 'parent@legacy.test', null, false),
  (tests.u(41), 'minh@child.taskmate.invalid', crypt('abc123', gen_salt('bf', 10)), false),
  (tests.u(42), 'khang@child.taskmate.invalid', crypt('secret9', gen_salt('bf', 10)), false),
  (tests.u(43), 'sansmdp@child.taskmate.invalid', null, false),
  (tests.u(51), 'deadbeef-0000-4000-8000-000000000051@child.taskmate.invalid', null, false);
insert into auth.identities (user_id, provider, provider_id, identity_data) values
  (tests.u(41), 'email', tests.u(41)::text, jsonb_build_object('sub', tests.u(41)::text, 'email', 'minh@child.taskmate.invalid')),
  (tests.u(42), 'email', tests.u(42)::text, jsonb_build_object('sub', tests.u(42)::text, 'email', 'khang@child.taskmate.invalid'));
insert into public.families (id, name) values (tests.u(1), 'A'), (tests.u(2), 'B');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2012-01-01'), (tests.u(202), tests.u(1), 'Khang', '2014-01-01'),
  (tests.u(203), tests.u(1), 'SansMdp', '2015-01-01'), (tests.u(221), tests.u(2), 'Autre', '2013-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'),
  (tests.u(113), tests.u(1), tests.u(41), 'child', tests.u(201), 'Minh'),
  (tests.u(114), tests.u(1), tests.u(42), 'child', tests.u(202), 'Khang'),
  (tests.u(115), tests.u(1), tests.u(43), 'child', tests.u(203), 'SansMdp');
insert into public.tasks (id, family_id, child_id, title, date, created_by) values (tests.u(301), tests.u(1), tests.u(201), 'Devoirs', '2026-07-02', tests.u(111));
insert into public.child_accounts (id, family_id, child_id, member_id, login_id, auth_email) values
  (tests.u(501), tests.u(1), tests.u(201), tests.u(113), 'minh', 'minh@child.taskmate.invalid'),
  (tests.u(502), tests.u(1), tests.u(202), tests.u(114), 'khang', 'khang@child.taskmate.invalid'),
  (tests.u(503), tests.u(1), tests.u(203), tests.u(115), 'sansmdp', 'sansmdp@child.taskmate.invalid');
select * from no_plan();

select is((select count(*)::int from public.child_accounts where password_hash is null), 3, 'avant: aucun haché, 3 comptes à migrer');

-- ═══ la migration : service_role uniquement ═══
select tests.login(11);
select throws_ok($$select public.migrate_legacy_child_accounts()$$, '42501', null, 'migrate: refusé à un parent');
select throws_ok($$select public.child_login_check_password('x', 'y')$$, '42501', null, 'check_password: refusé à un parent');
select throws_ok($$select public.set_child_password(tests.u(201), 'secret1')$$, '42501', null, 'set_child_password: refusé à un parent');
select tests.login(41);
select throws_ok($$select public.migrate_legacy_child_accounts()$$, '42501', null, 'migrate: refusé à un enfant');
select throws_ok($$select public.child_login_check_password('minh@child.taskmate.invalid', 'abc123')$$, '42501', null, 'check_password: un enfant ne peut pas tester un mot de passe');
select throws_ok($$select public.set_child_password(tests.u(201), 'secret1')$$, '42501', null, 'set_child_password: refusé à un enfant');
reset role;
set local role anon;
select throws_ok($$select public.migrate_legacy_child_accounts()$$, '42501', null, 'migrate: refusé à anon');
select throws_ok($$select public.child_login_check_password('x', 'y')$$, '42501', null, 'check_password: refusé à anon');
reset role;

set local role service_role;
select is(public.migrate_legacy_child_accounts(), 2, 'migrate: 2 comptes migrés (le compte sans mot de passe GoTrue est laissé tel quel)');
reset role;

-- ═══ après : adresses aléatoires, identifiant et données intacts ═══
select matches((select auth_email from public.child_accounts where login_id = 'minh'), '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@child\.taskmate\.invalid$', 'après: adresse = UUID aléatoire');
select isnt((select auth_email from public.child_accounts where login_id = 'minh'), 'minh@child.taskmate.invalid', 'après: l''adresse devinable a disparu');
select isnt((select auth_email from public.child_accounts where login_id = 'minh'), (select auth_email from public.child_accounts where login_id = 'khang'), 'après: deux comptes, deux UUID distincts');
select is((select email::text from auth.users where id = tests.u(41)), (select auth_email from public.child_accounts where login_id = 'minh'), 'après: auth.users porte la nouvelle adresse');
select is((select identity_data ->> 'email' from auth.identities where user_id = tests.u(41)), (select auth_email from public.child_accounts where login_id = 'minh'), 'après: l''identité e-mail est alignée');
select is((select provider_id from auth.identities where user_id = tests.u(41)), tests.u(41)::text, 'après: provider_id (id utilisateur) inchangé');
select is((select count(*)::int from auth.users where email in ('minh@child.taskmate.invalid', 'khang@child.taskmate.invalid')), 0, 'après: plus aucun compte joignable par l''ancienne adresse');
select is((select login_id from public.child_accounts where id = tests.u(501)), 'minh', 'après: identifiant visible conservé');
select is((select member_id from public.child_accounts where id = tests.u(501)), tests.u(113), 'après: même membre');
select is((select count(*)::int from public.tasks where child_id = tests.u(201)), 1, 'après: données de l''enfant intactes');
select is((select auth_email from public.child_accounts where id = tests.u(503)), 'sansmdp@child.taskmate.invalid', 'après: compte sans mot de passe GoTrue non touché');
-- le mot de passe GoTrue est devenu inconnu : l'ancien mot de passe ne l'ouvre plus (connexion directe impossible)
select ok((select crypt('abc123', encrypted_password) <> encrypted_password from auth.users where id = tests.u(41)), 'après: le mot de passe de l''enfant n''ouvre PLUS le compte GoTrue (connexion directe impossible)');
select ok((select crypt('secret9', encrypted_password) <> encrypted_password from auth.users where id = tests.u(42)), 'après: idem pour le second compte');
select isnt((select encrypted_password from auth.users where id = tests.u(41)), (select password_hash from public.child_accounts where id = tests.u(501)), 'après: le haché GoTrue n''est pas celui de l''enfant');

-- ═══ child-login : le MÊME mot de passe fonctionne, via le haché ═══
set local role service_role;
select is(public.child_login_check_password((select auth_email from public.child_accounts where login_id = 'minh'), 'abc123'), true, 'check: même mot de passe qu''avant → accepté');
select is(public.child_login_check_password((select auth_email from public.child_accounts where login_id = 'khang'), 'secret9'), true, 'check: second compte, même mot de passe qu''avant');
select is(public.child_login_check_password((select auth_email from public.child_accounts where login_id = 'minh'), 'secret9'), false, 'check: le mot de passe d''un autre enfant est refusé');
select is(public.child_login_check_password((select auth_email from public.child_accounts where login_id = 'minh'), 'ABC123'), false, 'check: casse respectée');
select is(public.child_login_check_password((select auth_email from public.child_accounts where login_id = 'minh'), ''), false, 'check: mot de passe vide refusé');
select is(public.child_login_check_password((select auth_email from public.child_accounts where login_id = 'minh'), null), false, 'check: NULL refusé');
select is(public.child_login_check_password('minh@child.taskmate.invalid', 'abc123'), false, 'check: l''ancienne adresse devinable ne désigne plus aucun compte');
select is(public.child_login_check_password('sansmdp@child.taskmate.invalid', 'x'), false, 'check: compte sans haché → refusé');
select is(public.child_login_check_password('inconnu@child.taskmate.invalid', 'abc123'), false, 'check: adresse inconnue → refusé');
-- le flux child-login résout toujours (e-mail parent + identifiant) vers la NOUVELLE adresse
select is((select public.child_login_prepare('1.1.1.1', 'parent@legacy.test', 'minh')->>'auth_email'), (select auth_email from public.child_accounts where login_id = 'minh'), 'prepare: e-mail du parent + identifiant → nouvelle adresse');
-- idempotence
select is(public.migrate_legacy_child_accounts(), 0, 'migrate: rejouable, plus rien à migrer');
reset role;
select is((select count(*)::int from public.child_accounts where password_hash is not null), 2, 'migrate: 2 hachés, rien d''écrasé');

-- ═══ le haché n'est lisible par personne côté application ═══
select tests.login(11);
select throws_ok($$select password_hash from public.child_accounts$$, '42501', null, 'RLS: un parent ne lit pas le haché');
select throws_ok($$select auth_email from public.child_accounts$$, '42501', null, 'RLS: un parent ne lit pas l''adresse interne');
select throws_ok($$update public.child_accounts set password_hash = 'x'$$, '42501', null, 'RLS: un parent ne modifie pas le haché');
select is((select count(*)::int from public.child_accounts), 3, 'RLS: le parent lit toujours les identifiants (colonnes autorisées)');
select tests.login(41);
select throws_ok($$select password_hash from public.child_accounts$$, '42501', null, 'RLS: un enfant ne lit pas le haché');
select throws_ok($$update public.child_accounts set password_hash = 'x'$$, '42501', null, 'RLS: un enfant ne modifie pas le haché');
reset role;

-- ═══ nouveaux comptes et changement de mot de passe (service_role) ═══
set local role service_role;
select lives_ok($$select public.register_child_account(tests.u(221), tests.u(51), 'neuf', 'deadbeef-0000-4000-8000-000000000051@child.taskmate.invalid', 'motdepasse1')$$, 'register: nouveau compte avec mot de passe');
select is(public.child_login_check_password('deadbeef-0000-4000-8000-000000000051@child.taskmate.invalid', 'motdepasse1'), true, 'register: le mot de passe est vérifiable');
select is(public.child_login_check_password('deadbeef-0000-4000-8000-000000000051@child.taskmate.invalid', 'autre'), false, 'register: un autre mot de passe est refusé');
reset role;
select ok((select password_hash <> 'motdepasse1' and password_hash like '$2%' from public.child_accounts where login_id = 'neuf'), 'register: seul un haché bcrypt est stocké (jamais le clair)');
set local role service_role;
select throws_ok($$select public.register_child_account(tests.u(221), tests.u(51), 'faible', 'faible@child.taskmate.invalid', '12345')$$, '22023', 'weak_password', 'register: mot de passe < 6 refusé');
select lives_ok($$select public.set_child_password(tests.u(221), 'nouveau1')$$, 'set_child_password: le parent change le mot de passe');
select is(public.child_login_check_password('deadbeef-0000-4000-8000-000000000051@child.taskmate.invalid', 'motdepasse1'), false, 'set_child_password: l''ancien mot de passe ne marche plus');
select is(public.child_login_check_password('deadbeef-0000-4000-8000-000000000051@child.taskmate.invalid', 'nouveau1'), true, 'set_child_password: le nouveau marche');
select throws_ok($$select public.set_child_password(tests.u(221), '123')$$, '22023', 'weak_password', 'set_child_password: ≥ 6 caractères');
select throws_ok($$select public.set_child_password(tests.u(999), 'nouveau1')$$, 'P0002', 'no_account', 'set_child_password: enfant sans compte');

select * from finish();
rollback;
