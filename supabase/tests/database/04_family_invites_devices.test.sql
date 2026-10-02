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
  (tests.u(31), 'pc@test', false), (tests.u(32), null, true), (tests.u(33), null, true), (tests.u(34), 'p2c@test', false);

select * from no_plan();

-- ═══ create_family ═══
select tests.login(31);
select lives_ok($$select public.create_family('Famille C', 'Ba C')$$, 'create_family: un parent crée sa famille');
select is((select role::text from public.members where user_id = tests.u(31)), 'parent', 'create_family: le créateur est parent');
select is((select count(*)::int from public.rewards), 4, 'create_family: 4 récompenses par défaut');
select is((select array_agg(cost order by sort_order) from public.rewards), array[100, 150, 200, 100], 'create_family: coûts par défaut (§3.7)');
select is((select timezone from public.families), 'Asia/Ho_Chi_Minh', 'create_family: fuseau par défaut');
select throws_ok($$select public.create_family('Autre', 'Ba')$$, 'P0001', 'already_member', 'create_family: une seule famille par compte');
select tests.login(32);
select tests.logout();
set local role anon;
select throws_ok($$select public.create_family('X', 'Y')$$, '42501', null, 'create_family: refusé à anon');

-- ═══ create_invite ═══
select tests.login(31);
insert into public.children (id, family_id, name, birth_date)
  select tests.u(231), family_id, 'Enfant C', '2012-02-02' from public.members where user_id = tests.u(31);
select matches(public.create_invite(tests.u(231), 'child'), '^[A-HJ-NP-Z2-9]{6}$', 'create_invite: 6 caractères sans 0/O/1/I');
select is((select count(*)::int from public.invite_codes where child_id = tests.u(231) and used_at is null and revoked_at is null), 1, 'create_invite: un code actif');
select is((select expires_at between now() + interval '23 hours' and now() + interval '25 hours' from public.invite_codes limit 1), true, 'create_invite: valide 24 h');
select public.create_invite(tests.u(231), 'child');
select is((select count(*)::int from public.invite_codes where child_id = tests.u(231) and used_at is null and revoked_at is null), 1, 'create_invite: régénérer révoque l''ancien code');
select throws_ok($$select public.create_invite(null, 'child')$$, '22023', 'invalid_invite', 'create_invite: enfant sans child_id refusé');
select throws_ok($$select public.create_invite(tests.u(231), 'parent')$$, '22023', 'invalid_invite', 'create_invite: parent avec child_id refusé');
select throws_ok($$select public.create_invite(tests.u(201), 'child')$$, 'P0002', 'child_not_found', 'create_invite: enfant d''une autre famille introuvable');
select tests.login(13);
select throws_ok($$select public.create_invite(tests.u(201), 'child')$$, '42501', 'forbidden', 'create_invite: un enfant ne génère pas de code');

-- ═══ redeem_invite ═══
select tests.login(31);
create temp table codes (k text primary key, c text);
grant all on codes to authenticated;
insert into codes values ('child', public.create_invite(tests.u(231), 'child')), ('parent', public.create_invite(null, 'parent'));
select tests.login(32);
select lives_ok($$select public.redeem_invite((select c from codes where k = 'child'), 'Bé C')$$, 'redeem_invite: l''enfant rejoint son profil');
select is((select child_id from public.members where user_id = tests.u(32)), tests.u(231), 'redeem_invite: lié au bon profil');
select is((select role::text from public.members where user_id = tests.u(32)), 'child', 'redeem_invite: rôle child');
select tests.logout();
select isnt((select used_at from public.invite_codes where code = (select c from codes where k = 'child')), null, 'redeem_invite: code consommé');
select tests.login(33);
select throws_ok($$select public.redeem_invite((select c from codes where k = 'child'), 'Pirate')$$, 'P0001', 'invalid_code', 'redeem_invite: usage unique');
select throws_ok($$select public.redeem_invite('ZZZZZZ', 'Pirate')$$, 'P0001', 'invalid_code', 'redeem_invite: code inconnu');
select tests.login(32);
select throws_ok($$select public.redeem_invite((select c from codes where k = 'parent'), 'Bé')$$, 'P0001', 'already_member', 'redeem_invite: déjà membre');
select tests.login(34);
select lives_ok($$select public.redeem_invite(lower((select c from codes where k = 'parent')) || ' ', 'Mẹ C')$$, 'redeem_invite: code insensible à la casse/espaces → co-parent');
select is((select role::text from public.members where user_id = tests.u(34)), 'parent', 'redeem_invite: co-parent');
select is((select child_id from public.members where user_id = tests.u(34)), null, 'redeem_invite: co-parent sans child_id');
-- expiré / révoqué
select tests.login(31);
insert into codes values ('old', public.create_invite(tests.u(231), 'child'));
select tests.logout();
update public.invite_codes set expires_at = now() - interval '1 minute' where code = (select c from codes where k = 'old');
select tests.login(33);
select throws_ok($$select public.redeem_invite((select c from codes where k = 'old'), 'Bé')$$, 'P0001', 'invalid_code', 'redeem_invite: code expiré refusé');
select tests.login(31);
insert into codes values ('rev', public.create_invite(tests.u(231), 'child'));
select public.create_invite(tests.u(231), 'child');
select tests.login(33);
select throws_ok($$select public.redeem_invite((select c from codes where k = 'rev'), 'Bé')$$, 'P0001', 'invalid_code', 'redeem_invite: code révoqué refusé');
select tests.logout();
set local role anon;
select throws_ok($$select public.redeem_invite('ABCDEF', 'X')$$, '42501', null, 'redeem_invite: refusé à anon');

-- ═══ appareils ═══
select tests.login(32);
select lives_ok($$select public.register_device('tok-1', 'ios')$$, 'register_device: l''enfant enregistre son appareil');
select lives_ok($$select public.register_device('tok-1', 'ios')$$, 'register_device: idempotent');
select is((select count(*)::int from public.devices), 1, 'register_device: une seule ligne par token');
select tests.login(31);
select is((select count(*)::int from public.devices), 1, 'devices: le parent voit l''appareil de l''enfant');
select tests.login(32);
select throws_ok($$select public.revoke_device((select id from public.devices limit 1))$$, '42501', 'forbidden', 'revoke_device: un enfant ne révoque pas');
select tests.login(21);
select throws_ok($$select public.revoke_device(tests.u(601))$$, 'P0002', 'device_not_found', 'revoke_device: appareil d''une autre famille introuvable');
select tests.login(31);
select lives_ok($$select public.revoke_device((select id from public.devices limit 1))$$, 'revoke_device: le parent révoque');
select tests.login(32);
select is(tests.n('select 1 from public.children'), 0::bigint, 'revoke_device: l''appareil perd l''accès dès la requête suivante');
select throws_ok($$select public.register_device('tok-2', 'ios')$$, '28000', 'not_authenticated', 'revoke_device: RPC refusée après révocation');
select tests.login(31);
insert into codes values ('again', public.create_invite(tests.u(231), 'child'));
select tests.login(32);
select lives_ok($$select public.redeem_invite((select c from codes where k = 'again'), 'Bé C')$$, 'revoke_device: re-scanner un nouveau code rétablit l''accès');
select is(tests.n('select 1 from public.children'), 1::bigint, 'revoke_device: accès rétabli');
select tests.login(31);

select * from finish();
rollback;
