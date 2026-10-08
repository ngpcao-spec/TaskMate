-- D-063 : langue des notifications push. Colonne `devices.locale` (vi/fr/en), écrite UNIQUEMENT par la RPC `set_push_locale`
-- (aucune écriture directe), appliquée aux appareils actifs du membre appelant et à personne d'autre.
-- Fixtures : famille 1 = parent 11, enfant (user 13, profil 201), enfant (user 14, profil 202) ; famille 2 = parent 21.
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
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, email, is_anonymous) values (tests.u(11), 'p1@test', false), (tests.u(13), null, false), (tests.u(14), null, false), (tests.u(21), 'pb@test', false);
insert into public.families (id, name) values (tests.u(1), 'A'), (tests.u(2), 'B');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2009-03-01'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'),
  (tests.u(114), tests.u(1), tests.u(14), 'child', tests.u(202), 'Khang'), (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'Cha B');
select * from no_plan();

-- ───────────── structure ─────────────
select col_not_null('public', 'devices', 'locale', 'devices.locale : obligatoire');
select col_default_is('public', 'devices', 'locale', 'vi', 'devices.locale : vietnamien par défaut (langue par défaut de l''app)');

-- ───────────── parent : appareils mobile + web ─────────────
select tests.login(11);
select lives_ok($$select public.register_device('tok-p1', 'ios')$$, 'fixture: appareil mobile du parent');
select lives_ok($$select public.register_web_push('{"endpoint":"https://push.example/p1","keys":{"p256dh":"k","auth":"a"}}'::jsonb)$$, 'fixture: navigateur du parent');
select is((select count(*)::int from public.devices where member_id = tests.u(111) and locale = 'vi'), 2, 'un nouvel appareil est en vietnamien');
select lives_ok($$select public.set_push_locale('fr')$$, 'parent: set_push_locale(fr)');
select is((select count(*)::int from public.devices where member_id = tests.u(111) and locale = 'fr'), 2, 'parent: tous ses appareils actifs passent en français');
select lives_ok($$select public.set_push_locale('fr')$$, 'parent: idempotent');
select lives_ok($$select public.set_push_locale('en')$$, 'parent: set_push_locale(en)');
select is((select count(*)::int from public.devices where member_id = tests.u(111) and locale = 'en'), 2, 'parent: …puis en anglais');
select throws_ok($$select public.set_push_locale('de')$$, 'P0001', 'invalid_locale', 'langue inconnue refusée');
select throws_ok($$select public.set_push_locale('')$$, 'P0001', 'invalid_locale', 'langue vide refusée');
select throws_ok($$select public.set_push_locale(null)$$, 'P0001', 'invalid_locale', 'langue nulle refusée');
select is((select count(*)::int from public.devices where member_id = tests.u(111) and locale = 'en'), 2, '…et rien n''a changé après les refus');
-- aucune écriture directe sur la table (pas de droit UPDATE pour les clients)
select throws_ok($$update public.devices set locale = 'vi' where member_id = tests.u(111)$$, '42501', null, 'parent: pas d''UPDATE direct de devices.locale');
select throws_ok($$insert into public.devices (member_id, platform, locale) values (tests.u(111), 'ios', 'fr')$$, '42501', null, 'parent: pas d''INSERT direct dans devices');

-- ───────────── enfant : n'atteint que ses propres appareils ─────────────
select tests.login(13);
select lives_ok($$select public.register_device('tok-minh', 'android')$$, 'fixture: appareil de l''enfant 13');
select tests.login(14);
select lives_ok($$select public.register_device('tok-khang', 'android')$$, 'fixture: appareil de l''enfant 14');
select lives_ok($$select public.set_push_locale('fr')$$, 'enfant 14: set_push_locale(fr)');
select is((select locale from public.devices where member_id = tests.u(114)), 'fr', 'enfant 14: son appareil est en français');
reset role;
select is((select locale from public.devices where member_id = tests.u(113)), 'vi', 'l''appareil du frère/sœur ne change pas');
select is((select count(*)::int from public.devices where member_id = tests.u(111) and locale = 'en'), 2, 'les appareils du parent ne changent pas');

-- ───────────── autre famille, appareils révoqués, anonyme ─────────────
select tests.login(21);
select lives_ok($$select public.register_device('tok-b', 'ios')$$, 'fixture: appareil de la famille B');
select lives_ok($$select public.set_push_locale('fr')$$, 'famille B: set_push_locale(fr)');
reset role;
select is((select count(*)::int from public.devices where member_id in (tests.u(111), tests.u(113), tests.u(114)) and locale = 'fr'), 1, 'la famille B ne change aucun appareil de la famille A (seul l''enfant 14 est en français)');
update public.devices set revoked_at = now() where member_id = tests.u(111) and platform = 'web';
select tests.login(11);
select lives_ok($$select public.set_push_locale('vi')$$, 'parent: set_push_locale(vi) avec un appareil révoqué');
select is((select locale from public.devices where member_id = tests.u(111) and platform = 'web'), 'en', 'un appareil révoqué n''est pas touché');
select is((select locale from public.devices where member_id = tests.u(111) and platform = 'ios'), 'vi', 'l''appareil actif passe en vietnamien');
reset role;
set local role anon;
select throws_ok($$select public.set_push_locale('fr')$$, '42501', null, 'anon: set_push_locale refusé');

select * from finish();
rollback;
