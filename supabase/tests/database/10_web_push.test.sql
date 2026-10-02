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

-- ═══ register_web_push ═══
select tests.login(11);
select lives_ok($$select public.register_web_push('{"endpoint":"https://push.example/abc","keys":{"p256dh":"k1","auth":"a1"}}'::jsonb)$$, 'web push: le parent enregistre son navigateur');
select is((select count(*)::int from public.devices where platform = 'web' and member_id = tests.u(111)), 1, 'web push: une ligne appareil web');
select lives_ok($$select public.register_web_push('{"endpoint":"https://push.example/abc","keys":{"p256dh":"k2","auth":"a2"}}'::jsonb)$$, 'web push: idempotent (même endpoint)');
select is((select count(*)::int from public.devices where platform = 'web' and member_id = tests.u(111) and revoked_at is null), 1, 'web push: toujours une seule ligne active');
select is((select web_push_subscription->'keys'->>'p256dh' from public.devices where member_id = tests.u(111) and platform = 'web'), 'k2', 'web push: clés mises à jour');

-- négatifs : abonnement invalide
select throws_ok($$select public.register_web_push('{"endpoint":"http://insecure/x","keys":{"p256dh":"k","auth":"a"}}'::jsonb)$$, 'P0001', 'invalid_subscription', 'web push: endpoint non HTTPS refusé');
select throws_ok($$select public.register_web_push('{"keys":{"p256dh":"k","auth":"a"}}'::jsonb)$$, 'P0001', 'invalid_subscription', 'web push: endpoint absent refusé');
select throws_ok($$select public.register_web_push('{"endpoint":"https://push.example/nokeys"}'::jsonb)$$, '23514', null, 'web push: clés absentes refusées (contrainte)');

-- l'enfant enregistre son propre navigateur ; il ne voit pas l'appareil du parent
select tests.login(13);
select lives_ok($$select public.register_web_push('{"endpoint":"https://push.example/minh","keys":{"p256dh":"k","auth":"a"}}'::jsonb)$$, 'web push: l''enfant enregistre son navigateur');
select is((select count(*)::int from public.devices), 1, 'web push: l''enfant ne voit que son appareil (RLS)');
select throws_ok($$insert into public.devices (member_id, platform) values (tests.u(113), 'web')$$, '42501', null, 'web push: pas d''écriture directe sur devices');

-- même navigateur, autre compte : l'ancien abonnement est révoqué
select tests.login(12);
select lives_ok($$select public.register_web_push('{"endpoint":"https://push.example/abc","keys":{"p256dh":"k3","auth":"a3"}}'::jsonb)$$, 'web push: le navigateur passe au second parent');
select tests.login(11);
select is((select count(*)::int from public.devices where member_id = tests.u(111) and revoked_at is null and web_push_subscription is not null), 0, 'web push: l''abonnement du premier parent est révoqué');

-- famille étrangère : aucune visibilité sur les appareils web
select tests.login(21);
select is((select count(*)::int from public.devices where platform = 'web'), 0, 'web push: la famille B ne voit aucun appareil web de A');

-- non authentifié (rôle anon)
reset role;
set local role anon;
select throws_ok($$select public.register_web_push('{"endpoint":"https://push.example/z","keys":{"p256dh":"k","auth":"a"}}'::jsonb)$$, '42501', null, 'web push: anon sans droit d''exécution');

-- désinscription
select tests.login(12);
select lives_ok($$select public.unregister_web_push('https://push.example/abc')$$, 'web push: désinscription');
select is((select count(*)::int from public.devices where member_id = tests.u(112) and revoked_at is null and web_push_subscription is not null), 0, 'web push: abonnement retiré');
select lives_ok($$select public.unregister_web_push('https://push.example/abc')$$, 'web push: désinscription idempotente');
select tests.login(11);
select is((select count(*)::int from public.devices where member_id = tests.u(111) and platform = 'web'), 1, 'web push: la désinscription n''affecte pas les autres membres');

select * from finish();
rollback;
