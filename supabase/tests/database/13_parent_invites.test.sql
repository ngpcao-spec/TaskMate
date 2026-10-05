-- Invitations de parent (D-050) : code à usage unique 24 h, haché, régénérable/annulable, limite d'essais, jointure Google.
-- Fixtures : famille 1 (parents 11 « Ba » et 12 « Mẹ » déjà membres, enfants 13/14), famille 2 (parent 21), nouveaux parents
-- Google 51, 52, 53 (sans famille), compte e-mail historique 54 (sans famille), compte enfant 55 (app_metadata child).
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
-- fournisseur du compte courant : 'google' | 'email' | 'child'
create function tests.provider(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case p
    when 'google' then '{"app_metadata":{"provider":"google","providers":["google"]}}'
    when 'child' then '{"app_metadata":{"provider":"email","account_type":"child"}}'
    else '{"app_metadata":{"provider":"email","providers":["email"]}}' end, true);
end $$;
create function tests.n(q text) returns bigint language plpgsql as $$
declare c bigint;
begin
  execute q;
  get diagnostics c = row_count;
  return c;
end $$;
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, email, is_anonymous) values
  (tests.u(11), 'p1@test', false), (tests.u(12), 'p2@test', false), (tests.u(13), null, false), (tests.u(14), null, false),
  (tests.u(21), 'pb@test', false), (tests.u(51), 'g1@gmail.test', false), (tests.u(52), 'g2@gmail.test', false),
  (tests.u(53), 'g3@gmail.test', false), (tests.u(54), 'old@test', false), (tests.u(55), null, false);
insert into public.families (id, name) values (tests.u(1), 'A'), (tests.u(2), 'B');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2009-03-01'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01'), (tests.u(221), tests.u(2), 'Bé', '2012-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'),
  (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'),
  (tests.u(114), tests.u(1), tests.u(14), 'child', tests.u(202), 'Khang'),
  (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'PB');
insert into public.tasks (id, family_id, child_id, title, date, created_by) values
  (tests.u(301), tests.u(1), tests.u(201), 'Tâche Minh', '2026-07-02', tests.u(111));
insert into public.rewards (id, family_id, title, cost) values (tests.u(401), tests.u(1), 'Game', 100);
select * from no_plan();

-- ═══ création : parent uniquement, code clair renvoyé UNE fois, haché en base ═══
select tests.login(13);
select tests.provider('child');
select throws_ok($$select public.create_parent_invite()$$, '42501', 'forbidden', 'create: un enfant ne peut pas inviter');
select throws_ok($$select public.revoke_parent_invite()$$, '42501', 'forbidden', 'revoke: un enfant ne peut pas annuler');
select tests.login(21);
select tests.provider('google');
select lives_ok($$select public.create_parent_invite()$$, 'create: le parent d''une AUTRE famille a sa propre invitation (isolation)');
select tests.login(11);
select tests.provider('email');
create temp table codes (label text, code text);
grant all on codes to authenticated;
insert into codes select 'a', public.create_parent_invite();
select matches((select code from codes where label = 'a'), '^[A-HJ-NP-Z2-9]{8}$', 'create: code de 8 caractères sans ambiguïté');
select is((select count(*)::int from public.parent_invites where family_id = tests.u(1)), 1, 'create: une ligne pour la famille');
select is((select expires_at - created_at from public.parent_invites where family_id = tests.u(1)), interval '24 hours', 'create: valable 24 h');
reset role; -- (vérifications en tant que propriétaire : la colonne code_hash n'est lisible par aucun rôle applicatif)
select is((select count(*)::int from public.parent_invites where code_hash = (select code from codes where label = 'a')), 0, 'create: le code en clair n''est PAS stocké');
select is((select code_hash from public.parent_invites where family_id = tests.u(1)), encode(sha256(convert_to((select code from codes where label = 'a'), 'utf8')), 'hex'), 'create: seul le sha256 du code est stocké');
select tests.login(11);
select throws_ok($$select code_hash from public.parent_invites$$, '42501', null, 'RLS: la colonne code_hash n''est lisible par personne (même le parent)');
select is(tests.n('select id, expires_at, used_at from public.parent_invites'), 1::bigint, 'RLS: le parent voit l''état de l''invitation de SA famille uniquement');

-- régénérer annule la précédente ; une seule invitation active
insert into codes select 'b', public.create_parent_invite();
select isnt((select code from codes where label = 'a'), (select code from codes where label = 'b'), 'regénérer: nouveau code');
select is((select count(*)::int from public.parent_invites where family_id = tests.u(1) and revoked_at is null and used_at is null), 1, 'regénérer: une seule invitation active');
select is((select count(*)::int from public.parent_invites where family_id = tests.u(1) and revoked_at is not null), 1, 'regénérer: l''ancienne est annulée');

-- ═══ RLS : lecture réservée aux parents de la famille, aucune écriture directe ═══
select tests.login(13);
select tests.provider('child');
select is(tests.n('select 1 from public.parent_invites'), 0::bigint, 'RLS: un enfant ne voit aucune invitation');
select throws_ok($$update public.parent_invites set expires_at = now() + interval '10 years'$$, '42501', null, 'RLS: un enfant ne modifie pas une invitation');
select throws_ok($$delete from public.parent_invites$$, '42501', null, 'RLS: un enfant ne supprime pas une invitation');
select throws_ok($$insert into public.parent_invites (family_id, created_by, code_hash, expires_at) values (tests.u(1), tests.u(111), 'x', now())$$, '42501', null, 'RLS: un enfant ne crée pas d''invitation');
select tests.login(11);
select throws_ok($$update public.parent_invites set expires_at = now() + interval '10 years'$$, '42501', null, 'RLS: pas d''update direct, même parent (RPC uniquement)');
select throws_ok($$insert into public.parent_invites (family_id, created_by, code_hash, expires_at) values (tests.u(1), tests.u(111), 'y', now())$$, '42501', null, 'RLS: pas d''insert direct, même parent');
select throws_ok($$delete from public.parent_invites$$, '42501', null, 'RLS: pas de delete direct, même parent');
select tests.login(21);
select is(tests.n('select 1 from public.parent_invites where family_id = tests.u(1)'), 0::bigint, 'RLS: un parent d''une autre famille ne voit pas nos invitations');
reset role;
set local role anon;
select throws_ok($$select 1 from public.parent_invites$$, '42501', null, 'RLS: anon n''a aucun accès');
select throws_ok($$select public.join_family_with_code('ABCDEFGH', 'X')$$, '42501', null, 'join: anon refusé');
select throws_ok($$select public.create_parent_invite()$$, '42501', null, 'create: anon refusé');
reset role;
set local role authenticated;
select throws_ok($$select 1 from public.auth_attempts$$, '42501', null, 'auth_attempts: illisible pour authenticated');
select throws_ok($$insert into public.auth_attempts (key) values ('j:x')$$, '42501', null, 'auth_attempts: non inscriptible directement');

-- ═══ jointure : refus (aucune création de membre) ═══
select tests.login(51);
select tests.provider('google');
select is(public.join_family_with_code('ZZZZZZZZ', 'Cô'), null, 'join: mauvais code → null (échec journalisé)');
select is(public.join_family_with_code('', 'Cô'), null, 'join: code vide → null');
select is(public.join_family_with_code(null, 'Cô'), null, 'join: code NULL → null');
select throws_ok(format($$select public.join_family_with_code(%L, '')$$, (select code from codes where label = 'b')), '22023', 'invalid_name', 'join: prénom obligatoire');
select throws_ok(format($$select public.join_family_with_code(%L, %L)$$, (select code from codes where label = 'b'), repeat('x', 41)), '22023', 'invalid_name', 'join: prénom ≤ 40 caractères');
select is((select count(*)::int from public.members where user_id = tests.u(51)), 0, 'join: aucun membre créé par les refus');
-- code annulé (l'ancien « a »)
select is(public.join_family_with_code((select code from codes where label = 'a'), 'Cô'), null, 'join: code annulé (régénéré) → null');
-- compte e-mail historique, compte enfant : refusés
select tests.login(54);
select tests.provider('email');
select throws_ok(format($$select public.join_family_with_code(%L, 'Vieux')$$, (select code from codes where label = 'b')), '42501', 'google_required', 'join: un compte non-Google ne peut pas rejoindre');
select tests.login(55);
select tests.provider('child');
select throws_ok(format($$select public.join_family_with_code(%L, 'Bé')$$, (select code from codes where label = 'b')), '42501', 'forbidden', 'join: un compte enfant est refusé');
select tests.login(13);
select tests.provider('child');
select throws_ok(format($$select public.join_family_with_code(%L, 'Minh')$$, (select code from codes where label = 'b')), '42501', 'forbidden', 'join: un enfant membre est refusé');
select tests.login(21);
select tests.provider('google');
select throws_ok(format($$select public.join_family_with_code(%L, 'Dup')$$, (select code from codes where label = 'b')), 'P0001', 'already_member', 'join: un parent déjà dans une famille ne peut pas en rejoindre une autre');
select tests.login(51);
select tests.provider('google');
select is((select count(*)::int from public.members where family_id = tests.u(1) and role = 'parent'), 0, 'join: le non-membre ne voit rien de la famille avant de la rejoindre');

-- ═══ jointure : succès, usage unique ═══
select is((select public.join_family_with_code(lower((select code from codes where label = 'b')), '  Cô  ') is not null), true, 'join: code valide (insensible à la casse, prénom rogné) → membre créé');
select is((select display_name from public.members where user_id = tests.u(51)), 'Cô', 'join: prénom enregistré');
select is((select role::text from public.members where user_id = tests.u(51)), 'parent', 'join: rôle parent');
select is((select family_id from public.members where user_id = tests.u(51)), tests.u(1), 'join: dans la bonne famille');
select isnt((select used_at from public.parent_invites where family_id = tests.u(1) and revoked_at is null), null, 'join: invitation marquée utilisée');
-- même enfants, tâches, récompenses ; tous peuvent valider
select is(tests.n('select 1 from public.children'), 2::bigint, 'parents: le nouveau parent voit les mêmes enfants');
select is(tests.n('select 1 from public.tasks'), 1::bigint, 'parents: …les mêmes tâches');
select is(tests.n('select 1 from public.rewards'), 1::bigint, 'parents: …les mêmes récompenses');
select lives_ok($$update public.tasks set title = 'Modifiée par le 2e parent' where id = tests.u(301)$$, 'parents: le 2e parent modifie une tâche');
select throws_ok(format($$select public.join_family_with_code(%L, 'Cô2')$$, (select code from codes where label = 'b')), 'P0001', 'already_member', 'join: déjà membre');
-- réutilisation du code par un autre compte
select tests.login(52);
select is(public.join_family_with_code((select code from codes where label = 'b'), 'Autre'), null, 'join: code déjà utilisé → null');
select is((select count(*)::int from public.members where user_id = tests.u(52)), 0, 'join: aucun membre créé avec un code déjà utilisé');

-- ═══ code expiré ═══
select tests.login(11);
select tests.provider('email');
insert into codes select 'c', public.create_parent_invite();
reset role;
update public.parent_invites set expires_at = now() - interval '1 second' where family_id = tests.u(1) and used_at is null and revoked_at is null;
select tests.login(53);
select tests.provider('google');
select is(public.join_family_with_code((select code from codes where label = 'c'), 'Trop tard'), null, 'join: code expiré → null');
select is((select count(*)::int from public.members where user_id = tests.u(53)), 0, 'join: aucun membre avec un code expiré');

-- ═══ annulation par le parent ═══
select tests.login(11);
select tests.provider('email');
insert into codes select 'd', public.create_parent_invite();
select lives_ok($$select public.revoke_parent_invite()$$, 'revoke: le parent annule l''invitation');
select is((select count(*)::int from public.parent_invites where family_id = tests.u(1) and used_at is null and revoked_at is null), 0, 'revoke: plus d''invitation active');
select tests.login(53);
select tests.provider('google');
select is(public.join_family_with_code((select code from codes where label = 'd'), 'Trop tard'), null, 'join: code annulé → null');

-- ═══ limite d'essais par compte : 5 échecs puis verrouillage (même avec le BON code) ═══
reset role;
delete from public.auth_attempts;
select tests.login(11);
select tests.provider('email');
insert into codes select 'e', public.create_parent_invite();
select tests.login(52);
select tests.provider('google');
select is(public.join_family_with_code('AAAAAAA' || '1', 'X'), null, 'essais: échec 1');
select is(public.join_family_with_code('AAAAAAA' || '2', 'X'), null, 'essais: échec 2');
select is(public.join_family_with_code('AAAAAAA' || '3', 'X'), null, 'essais: échec 3');
select is(public.join_family_with_code('AAAAAAA' || '4', 'X'), null, 'essais: échec 4');
select is(public.join_family_with_code('AAAAAAA' || '5', 'X'), null, 'essais: échec 5');
select throws_ok(format($$select public.join_family_with_code(%L, 'X')$$, (select code from codes where label = 'e')), 'P0001', 'too_many_attempts', 'essais: 6e tentative refusée, même avec le bon code');
select is((select count(*)::int from public.members where user_id = tests.u(52)), 0, 'essais: aucun membre créé pendant le verrouillage');
-- le verrouillage est par compte : un autre compte n'est pas touché
select tests.login(53);
select is((select public.join_family_with_code((select code from codes where label = 'e'), 'Troisième') is not null), true, 'essais: un autre compte peut rejoindre (limite par compte)');
-- le verrou expire
reset role;
update public.auth_attempts set created_at = now() - interval '16 minutes';
select tests.login(52);
select tests.provider('google');
select is(public.join_family_with_code('AAAAAAA' || '6', 'X'), null, 'essais: après 15 minutes, on peut réessayer');

-- ═══ quitter la famille ═══
select tests.login(51);
select tests.provider('google');
select lives_ok($$select public.leave_family()$$, 'leave: un parent quitte la famille (il en reste d''autres)');
select is(tests.n('select 1 from public.children'), 0::bigint, 'leave: plus aucun accès aux données de la famille');
reset role;
select isnt((select revoked_at from public.members where user_id = tests.u(51)), null, 'leave: membre révoqué');
select tests.login(13);
select tests.provider('child');
select throws_ok($$select public.leave_family()$$, '42501', 'forbidden', 'leave: un enfant ne « quitte » pas (réservé au parent)');
select tests.login(21);
select tests.provider('google');
select throws_ok($$select public.leave_family()$$, 'P0001', 'last_parent', 'leave: le dernier parent ne peut pas partir (il doit supprimer la famille)');
-- le dernier parent d'un groupe (11 + 53 restent) : 53 part, 11 est alors le dernier
select tests.login(53);
select lives_ok($$select public.leave_family()$$, 'leave: le troisième parent part');
select tests.login(11);
select tests.provider('email');
select throws_ok($$select public.leave_family()$$, 'P0001', 'last_parent', 'leave: le dernier parent restant ne peut partir qu''en supprimant la famille');
select lives_ok($$select public.delete_family()$$, 'leave: …la suppression de la famille reste possible');
reset role;
select is((select count(*)::int from public.parent_invites where family_id = tests.u(1)), 0, 'delete_family: invitations purgées');
-- un ancien parent peut ensuite créer ou rejoindre une famille
select tests.login(51);
select tests.provider('google');
select lives_ok($$select public.create_family('Nouvelle', 'Cô')$$, 'après avoir quitté : peut créer une nouvelle famille');

select * from finish();
rollback;
