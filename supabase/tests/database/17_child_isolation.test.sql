-- D-052 : un enfant ne voit QUE ses propres données (RLS + RPC), les parents voient toujours tous les enfants de leur famille.
-- Fixtures : famille 1 = parents 11 et 12, enfant A = Minh (user 13, profil 201, membre 113), enfant B = Khang (user 14, profil 202,
-- membre 114) ; famille 2 = parent 21, enfant C (profil 221). Récompenses : 401 catalogue famille, 402 dédiée à A, 403 dédiée à B.
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
create function tests.n(q text) returns bigint language plpgsql as $$
declare c bigint;
begin
  execute q;
  get diagnostics c = row_count;
  return c;
end $$;
-- lignes de l'enfant `child` lisibles par le rôle courant dans la table publiée `t` (celle que Realtime évalue pour l'abonné)
create function tests.visible_rows_of(t text, child uuid) returns bigint language plpgsql as $$
declare c bigint; col text := case when t = 'children' then 'id' else 'child_id' end;
begin
  execute format('select count(*) from public.%I where %I = %L', t, col, child) into c;
  return c;
end $$;
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, email, is_anonymous) values
  (tests.u(11), 'p1@test', false), (tests.u(12), 'p2@test', false), (tests.u(13), null, false), (tests.u(14), null, false),
  (tests.u(21), 'pb@test', false), (tests.u(24), null, false);
insert into public.families (id, name) values (tests.u(1), 'Famille A'), (tests.u(2), 'Famille B');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2009-03-01'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01'), (tests.u(221), tests.u(2), 'Cam', '2012-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(112), tests.u(1), tests.u(12), 'parent', null, 'Mẹ'),
  (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'), (tests.u(114), tests.u(1), tests.u(14), 'child', tests.u(202), 'Khang'),
  (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'PB'), (tests.u(124), tests.u(2), tests.u(24), 'child', tests.u(221), 'Cam');
insert into public.rewards (id, family_id, title, cost, child_id) values
  (tests.u(401), tests.u(1), 'Catalogue famille', 100, null), (tests.u(402), tests.u(1), 'Pour Minh', 20, tests.u(201)),
  (tests.u(403), tests.u(1), 'Pour Khang', 20, tests.u(202)), (tests.u(421), tests.u(2), 'Autre famille', 10, null);
insert into public.tasks (id, family_id, child_id, title, note, date, created_by) values
  (tests.u(301), tests.u(1), tests.u(201), 'Tâche de Minh', 'note A', '2026-07-02', tests.u(111)),
  (tests.u(302), tests.u(1), tests.u(202), 'Tâche de Khang', 'note B', '2026-07-02', tests.u(111)),
  (tests.u(321), tests.u(2), tests.u(221), 'Tâche de Cam', null, '2026-07-02', tests.u(121));
insert into public.tasks (id, family_id, child_id, title, date, created_by, completed_at, completed_by) values
  (tests.u(304), tests.u(1), tests.u(202), 'Cochée par Khang', '2026-07-02', tests.u(111), now(), tests.u(114));
insert into public.recurrences (id, family_id, child_id, title, time_kind, rule, starts_on, ends_on, created_by) values
  (tests.u(801), tests.u(1), tests.u(201), 'Série Minh', 'anytime', 'daily', '2026-07-01', '2026-07-03', tests.u(111)),
  (tests.u(802), tests.u(1), tests.u(202), 'Série Khang', 'anytime', 'daily', '2026-07-01', '2026-07-03', tests.u(111));
insert into public.goals (id, family_id, child_id, title, target, created_by) values
  (tests.u(901), tests.u(1), tests.u(201), 'Objectif Minh', 5, tests.u(111)), (tests.u(902), tests.u(1), tests.u(202), 'Objectif Khang', 5, tests.u(111));
insert into public.point_transactions (id, family_id, child_id, delta, reason, created_by) values
  (tests.u(501), tests.u(1), tests.u(201), 100, 'manual_adjust', tests.u(111)), (tests.u(502), tests.u(1), tests.u(202), 50, 'manual_adjust', tests.u(111));
insert into public.reward_requests (id, family_id, child_id, reward_id, reward_title, cost, requested_by, expires_at) values
  (tests.u(701), tests.u(1), tests.u(201), tests.u(402), 'Pour Minh', 20, tests.u(113), now() + interval '7 days'),
  (tests.u(702), tests.u(1), tests.u(202), tests.u(403), 'Pour Khang', 20, tests.u(114), now() + interval '7 days');
insert into public.activity_log (family_id, child_id, type) values (tests.u(1), tests.u(202), 'x');
insert into public.devices (id, member_id, expo_push_token) values (tests.u(601), tests.u(113), 'tok-a'), (tests.u(602), tests.u(114), 'tok-b');
insert into public.notification_prefs (member_id, prefs) values (tests.u(113), '{}'), (tests.u(114), '{}');
select * from no_plan();

-- ═══ l'enfant A voit ses données et pas celles de B ═══
select tests.login(13);
select is(tests.n('select 1 from public.children'), 1::bigint, 'A: ne voit que SA fiche enfant');
select is((select name from public.children), 'Minh', 'A: …et c''est la sienne');
select is(tests.n('select 1 from public.children where id = tests.u(202)'), 0::bigint, 'A: la fiche de B (prénom, âge, couleur) est invisible, même par id');
select is(tests.n('select 1 from public.tasks where child_id = tests.u(201)'), 1::bigint, 'A: voit sa tâche');
select is(tests.n('select 1 from public.tasks'), 1::bigint, 'A: ne voit QUE sa tâche');
select is(tests.n('select 1 from public.tasks where id = tests.u(302)'), 0::bigint, 'A: la tâche de B est invisible par id');
select is(tests.n('select 1 from public.tasks where id = tests.u(304)'), 0::bigint, 'A: ni la tâche cochée de B');
select is(tests.n('select 1 from public.recurrences'), 1::bigint, 'A: ne voit que sa série');
select is(tests.n('select 1 from public.recurrences where child_id = tests.u(202)'), 0::bigint, 'A: la série de B est invisible');
select is(tests.n('select 1 from public.goals'), 1::bigint, 'A: ne voit que son objectif');
select is(tests.n('select 1 from public.goals where id = tests.u(902)'), 0::bigint, 'A: l''objectif de B est invisible');
select is(tests.n('select 1 from public.point_transactions'), 1::bigint, 'A: ne voit que ses mouvements de points');
select is(tests.n('select 1 from public.point_transactions where child_id = tests.u(202)'), 0::bigint, 'A: les points de B sont invisibles');
select is(tests.n('select 1 from public.reward_requests'), 1::bigint, 'A: ne voit que sa demande de récompense');
select is(tests.n('select 1 from public.reward_requests where id = tests.u(702)'), 0::bigint, 'A: la demande de B est invisible');
select is(tests.n('select 1 from public.activity_log'), 0::bigint, 'A: aucun journal d''activité');
select is(tests.n('select 1 from public.devices'), 1::bigint, 'A: ne voit que son appareil');
select is(tests.n('select 1 from public.notification_prefs'), 1::bigint, 'A: ne voit que ses préférences');
-- catalogue de la famille : lisible ; récompense dédiée à A : lisible ; dédiée à B : invisible
select is((select array_agg(title order by title collate "C") from public.rewards), array['Catalogue famille', 'Pour Minh'], 'A: voit le catalogue de la famille et SA récompense, pas celle de B');
select is(tests.n('select 1 from public.rewards where id = tests.u(403)'), 0::bigint, 'A: la récompense réservée à B est invisible');
select is((select name from public.families), 'Famille A', 'A: le nom de la famille reste lisible');
-- members : sa ligne + celles des parents ; jamais celle de B
select is((select array_agg(display_name order by display_name collate "C") from public.members), array['Ba', 'Minh', 'Mẹ'], 'A: members = sa ligne + les parents');
select is(tests.n('select 1 from public.members where id = tests.u(114)'), 0::bigint, 'A: la ligne members de B (nom, enfant lié) est invisible');
select is(tests.n('select 1 from public.members where child_id = tests.u(202)'), 0::bigint, 'A: aucun membre lié au profil de B');
-- soldes : vue et fonctions bornées
select is(tests.n('select 1 from public.child_balances'), 1::bigint, 'A: child_balances = une seule ligne');
select is((select balance from public.child_balances where child_id = tests.u(201)), 100, 'A: son solde est visible');
select is(tests.n('select 1 from public.child_balances where child_id = tests.u(202)'), 0::bigint, 'A: le solde de B est absent de la vue');
select is(public.child_balance(tests.u(201)), 100, 'A: child_balance(A) = son solde');
select is(public.child_balance(tests.u(202)), 0, 'A: child_balance(B) = 0, jamais le vrai solde de B (50)');
select is(public.child_reserved(tests.u(202)), 0, 'A: child_reserved(B) = 0');
select is(public.child_pending_task_points(tests.u(202)), 0, 'A: points en attente de B = 0 (la vraie valeur est 10)');
select is(public.child_reserved(tests.u(201)), 20, 'A: ses propres réservations restent visibles');

-- ═══ l'enfant A ne peut ni modifier, ni cocher, ni agir au nom de B ═══
select is(tests.n('update public.tasks set title = ''Hack'' where id = tests.u(302)'), 0::bigint, 'A: ne modifie pas la tâche de B');
select is(tests.n('update public.tasks set deleted_at = now() where id = tests.u(302)'), 0::bigint, 'A: ne supprime pas la tâche de B');
select is(tests.n('update public.tasks set title = ''Hack'' where id = tests.u(301)'), 0::bigint, 'A: ne modifie même pas la sienne (spec v4 : l''enfant ne modifie rien)');
select throws_ok($$select public.complete_task(tests.u(302), tests.u(591))$$, '42501', 'forbidden', 'A: ne coche pas la tâche de B, même en connaissant son id');
select throws_ok($$select public.uncomplete_task(tests.u(304), tests.u(592))$$, '42501', 'forbidden', 'A: ne décoche pas la tâche de B');
select throws_ok($$select public.validate_task(tests.u(304), tests.u(593))$$, '42501', 'forbidden', 'A: ne valide rien (parent seulement)');
select throws_ok($$select public.request_reward(tests.u(403), tests.u(594))$$, 'P0002', 'reward_not_found', 'A: ne demande pas la récompense réservée à B');
select throws_ok($$select public.cancel_reward_request(tests.u(702))$$, '42501', 'forbidden', 'A: n''annule pas la demande de B');
select throws_ok($$select public.approve_reward_request(tests.u(702), tests.u(595))$$, '42501', 'forbidden', 'A: n''approuve rien');
select throws_ok($$select public.adjust_points(tests.u(202), 1000, 'x', tests.u(596))$$, '42501', 'forbidden', 'A: n''ajuste pas les points de B');
select throws_ok($$insert into public.tasks (family_id, child_id, title, date, created_by) values (tests.u(1), tests.u(202), 'Pour B', '2026-07-03', tests.u(113))$$, '42501', null, 'A: ne crée pas de tâche pour B');
select throws_ok($$insert into public.goals (family_id, child_id, title, target, created_by) values (tests.u(1), tests.u(202), 'Pour B', 5, tests.u(113))$$, '42501', null, 'A: ne crée pas d''objectif pour B');
select is(tests.n('update public.goals set progress = 3 where id = tests.u(902)'), 0::bigint, 'A: ne modifie pas l''objectif de B');
select is(tests.n('update public.children set name = ''Hack'' where id = tests.u(202)'), 0::bigint, 'A: ne modifie pas la fiche de B');
select throws_ok($$insert into public.point_transactions (id, family_id, child_id, delta, reason, created_by) values (gen_random_uuid(), tests.u(1), tests.u(202), -50, 'manual_adjust', tests.u(113))$$, '42501', null, 'A: n''écrit aucun point');
-- une demande de récompense est toujours faite POUR l'appelant (aucun paramètre d'enfant)
select lives_ok($$select public.request_reward(tests.u(402), tests.u(597))$$, 'A: demande SA récompense (20 points ≤ solde disponible)');
select is((select child_id from public.reward_requests where id = tests.u(597)), tests.u(201), 'A: …la demande est enregistrée pour A, jamais pour B');
-- A coche SA tâche (écriture inchangée)
select lives_ok($$select public.complete_task(tests.u(301), tests.u(598))$$, 'A: coche sa propre tâche → pending');
reset role;
select is((select title from public.tasks where id = tests.u(302)), 'Tâche de Khang', 'état serveur: la tâche de B est intacte');
select is((select completed_at is null from public.tasks where id = tests.u(302)), true, 'état serveur: la tâche de B n''est pas cochée');
select is((select name from public.children where id = tests.u(202)), 'Khang', 'état serveur: la fiche de B est intacte');
select is((select progress from public.goals where id = tests.u(902)), 0, 'état serveur: l''objectif de B est intact');

-- ═══ symétrie : B ne voit pas A ═══
select tests.login(14);
select is(tests.n('select 1 from public.tasks'), 2::bigint, 'B: voit ses 2 tâches (dont la cochée)');
select is(tests.n('select 1 from public.tasks where child_id = tests.u(201)'), 0::bigint, 'B: ne voit pas les tâches de A');
select is(tests.n('select 1 from public.children where id = tests.u(201)'), 0::bigint, 'B: ne voit pas la fiche de A');
select is(tests.n('select 1 from public.members where id = tests.u(113)'), 0::bigint, 'B: ne voit pas la ligne members de A');
select is(tests.n('select 1 from public.point_transactions where child_id = tests.u(201)'), 0::bigint, 'B: ne voit pas les points de A');
select is(public.child_balance(tests.u(201)), 0, 'B: child_balance(A) = 0');
select throws_ok($$select public.complete_task(tests.u(301), tests.u(599))$$, '42501', 'forbidden', 'B: ne coche pas la tâche de A');

-- ═══ Realtime : les tables publiées sont diffusées sous la RLS de l'abonné → aucune ligne d'un autre enfant ═══
-- (Realtime évalue la policy SELECT du rôle `authenticated` de l'abonné ; ce qu'un SELECT direct ne renvoie pas n'est pas diffusé)
reset role;
select ok((select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public') >= 5, 'realtime: les tables métier sont publiées');
select is((select count(*)::int from pg_publication_tables p join pg_class c on c.relname = p.tablename and c.relnamespace = 'public'::regnamespace
           where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and not c.relrowsecurity), 0, 'realtime: toute table publiée a la RLS activée');
select tests.login(13);
select is((select coalesce(sum(tests.visible_rows_of(tablename, tests.u(202))), 0)::int from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'), 0, 'realtime: A ne reçoit AUCUNE ligne de B (toutes les tables publiées)');
select cmp_ok((select coalesce(sum(tests.visible_rows_of(tablename, tests.u(201))), 0)::int from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'), '>', 0, 'realtime: A reçoit bien SES lignes');
select tests.login(14);
select is((select coalesce(sum(tests.visible_rows_of(tablename, tests.u(201))), 0)::int from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'), 0, 'realtime: B ne reçoit AUCUNE ligne de A');
select tests.login(11);
select cmp_ok((select coalesce(sum(tests.visible_rows_of(tablename, tests.u(202))), 0)::int from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'), '>', 0, 'realtime: le parent reçoit les lignes de B');

-- ═══ le parent voit toujours TOUS les enfants de sa famille (aucun changement) ═══
select tests.login(11);
select is(tests.n('select 1 from public.children'), 2::bigint, 'parent: voit les deux enfants');
select is(tests.n('select 1 from public.tasks'), 3::bigint, 'parent: voit toutes les tâches (A + B)');
select is(tests.n('select 1 from public.recurrences'), 2::bigint, 'parent: voit les deux séries');
select is(tests.n('select 1 from public.goals'), 2::bigint, 'parent: voit les deux objectifs');
select is(tests.n('select 1 from public.point_transactions'), 2::bigint, 'parent: voit tous les mouvements de points');
select is(tests.n('select 1 from public.reward_requests'), 3::bigint, 'parent: voit toutes les demandes (A, B et la nouvelle de A)');
select is(tests.n('select 1 from public.rewards'), 3::bigint, 'parent: voit tout le catalogue, dont les récompenses dédiées');
select is(tests.n('select 1 from public.members'), 4::bigint, 'parent: voit tous les membres de la famille');
select is(tests.n('select 1 from public.child_balances'), 2::bigint, 'parent: child_balances pour les deux enfants');
select is((select balance from public.child_balances where child_id = tests.u(202)), 50, 'parent: solde de B visible');
select is(public.child_balance(tests.u(201)), 100, 'parent: child_balance(A)');
select is(public.child_balance(tests.u(202)), 50, 'parent: child_balance(B)');
select is(public.child_pending_task_points(tests.u(202)), 10, 'parent: points en attente de B');
select cmp_ok(tests.n('select 1 from public.activity_log where child_id = tests.u(202)'), '>=', 1::bigint, 'parent: voit le journal d''activité, y compris celui de B');
select tests.login(12);
select is(tests.n('select 1 from public.tasks'), 3::bigint, 'second parent: voit aussi tout');

-- ═══ autre famille : aucune fuite, dans aucun sens ═══
select tests.login(21);
select is(tests.n('select 1 from public.tasks where family_id = tests.u(1)'), 0::bigint, 'autre famille (parent): ne voit pas nos tâches');
select is(tests.n('select 1 from public.children where family_id = tests.u(1)'), 0::bigint, 'autre famille (parent): ne voit pas nos enfants');
select tests.login(24);
select is(tests.n('select 1 from public.tasks'), 1::bigint, 'autre famille (enfant): voit seulement sa tâche');
select is(tests.n('select 1 from public.children'), 1::bigint, 'autre famille (enfant): voit seulement sa fiche');
select is(public.child_balance(tests.u(201)), 0, 'autre famille: child_balance(A) = 0');
reset role;
set local role anon;
select throws_ok($$select 1 from public.tasks$$, '42501', null, 'anon: aucun accès aux tâches');
select throws_ok($$select 1 from public.child_balances$$, '42501', null, 'anon: aucun accès aux soldes');

select * from finish();
rollback;
