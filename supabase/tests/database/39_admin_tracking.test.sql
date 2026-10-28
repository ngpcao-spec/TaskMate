-- D-102 : suivi des utilisateurs (administrateur de la plateforme, lecture seule).
-- Fixtures : famille 1 « Gia đình A » = parent 11 (ADMIN, créateur), parent 12, enfants 13 (VN 7) et 14 (FR CM1) ; famille 2 « Famille B » = parent 21, enfant 23 (VN 5) ;
-- famille 3 « Dormante » = parent 31 sans enfant, jamais active.
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
create function tests.val(q text) returns text language plpgsql security definer as $$
declare r text;
begin execute q into r; return r; end $$;
grant execute on all functions in schema tests to authenticated, anon, service_role;

insert into auth.users (id, email, is_anonymous) values
  (tests.u(11), 'admin@test', false), (tests.u(12), 'parent2@test', false), (tests.u(13), null, false), (tests.u(14), null, false),
  (tests.u(21), 'pb@test', false), (tests.u(23), null, false), (tests.u(31), 'dormant@test', false);
insert into public.families (id, name, timezone, created_at) values
  (tests.u(1), 'Gia đình A', 'Asia/Ho_Chi_Minh', now() - interval '2 days'),
  (tests.u(2), 'Famille B', 'Europe/Paris', now() - interval '20 days'),
  (tests.u(3), 'Dormante', 'Asia/Ho_Chi_Minh', now() - interval '100 days');
insert into public.children (id, family_id, name, birth_date, country, grade) values
  (tests.u(201), tests.u(1), 'Minh', '2013-03-01', 'VN', '7'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01', 'FR', 'CM1'), (tests.u(203), tests.u(2), 'Lan', '2013-01-01', 'VN', '5');
insert into public.members (id, family_id, user_id, role, child_id, display_name, created_at) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba', now() - interval '2 days'),
  (tests.u(112), tests.u(1), tests.u(12), 'parent', null, 'Mẹ', now() - interval '1 day'),
  (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh', now() - interval '2 days'),
  (tests.u(114), tests.u(1), tests.u(14), 'child', tests.u(202), 'Khang', now() - interval '2 days'),
  (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'Cha B', now() - interval '20 days'),
  (tests.u(123), tests.u(2), tests.u(23), 'child', tests.u(203), 'Lan', now() - interval '20 days'),
  (tests.u(131), tests.u(3), tests.u(31), 'parent', null, 'Ông', now() - interval '100 days');
insert into public.platform_admins (user_id) values (tests.u(11));

-- activité : A active aujourd'hui (parent et enfant), B il y a 10 jours, Dormante jamais
update public.members set last_active_at = now() where id in (tests.u(111), tests.u(113));
update public.members set last_active_at = now() - interval '10 days' where id in (tests.u(121));
insert into public.member_activity_days (member_id, day) values
  (tests.u(111), (now() at time zone 'Asia/Ho_Chi_Minh')::date), (tests.u(113), (now() at time zone 'Asia/Ho_Chi_Minh')::date),
  (tests.u(111), (now() at time zone 'Asia/Ho_Chi_Minh')::date - 1), (tests.u(121), (now() at time zone 'Asia/Ho_Chi_Minh')::date - 10);
-- appareils : A a un navigateur abonné (notifications), B un appareil sans jeton, Dormante aucun
insert into public.devices (member_id, platform, web_push_subscription) values (tests.u(111), 'web', '{"endpoint":"https://push.example/a","keys":{"p256dh":"k","auth":"a"}}'::jsonb);
insert into public.devices (member_id, platform) values (tests.u(121), 'ios');
-- usage : contenus sensibles qui ne doivent JAMAIS ressortir
insert into public.tasks (id, family_id, child_id, title, date, created_by, created_at, completed_at, completed_by, validated_at, validated_by) values
  (tests.u(301), tests.u(1), tests.u(201), 'SECRET-TACHE-ALPHA', current_date, tests.u(111), now() - interval '1 day', now() - interval '1 day', tests.u(113), now() - interval '1 day', tests.u(111)),
  (tests.u(302), tests.u(1), tests.u(201), 'SECRET-TACHE-BETA', current_date, tests.u(111), now() - interval '20 days', null, null, null, null),
  (tests.u(303), tests.u(2), tests.u(203), 'SECRET-TACHE-GAMMA', current_date, tests.u(121), now() - interval '40 days', null, null, null, null);
insert into public.rewards (id, family_id, title, cost) values (tests.u(401), tests.u(1), 'SECRET-RECOMPENSE', 10);
insert into public.reward_requests (id, family_id, child_id, reward_id, reward_title, cost, status, requested_by, expires_at) values
  (tests.u(411), tests.u(1), tests.u(201), tests.u(401), 'SECRET-RECOMPENSE', 10, 'pending', tests.u(113), now() + interval '7 days');
insert into public.ai_usage (family_id, member_id, day, status, model, input_tokens, output_tokens, created_at) values
  (tests.u(1), tests.u(111), current_date, 'success', 'gpt-test', 100, 50, now() - interval '1 day'),
  (tests.u(1), tests.u(111), current_date, 'failed', 'gpt-test', null, null, now() - interval '9 days');
insert into public.avatar_usage (family_id, child_id, member_id, day, status, model, created_at) values (tests.u(1), tests.u(201), tests.u(111), current_date, 'success', 'gpt-image-2', now() - interval '2 days');
insert into public.catalog_quizzes (id, country, grade, subject, week_label, title, status) values (tests.u(701), 'VN', '7', 'maths', 'Tuần 1', 'SECRET-QUIZ', 'published');
insert into public.quiz_attempts (id, family_id, child_id, catalog_id, status, submitted_at, validated_at, validated_by) values
  (tests.u(801), tests.u(1), tests.u(201), tests.u(701), 'validated', now() - interval '1 day', now() - interval '1 day', tests.u(111));

select * from no_plan();

-- ── structure ──
select has_function('public', f, 'RPC ' || f || ' existe') from unnest(array['touch_activity', 'admin_stats_overview', 'admin_stats_series', 'admin_stats_usage', 'admin_families', 'admin_family_detail', 'admin_health']) as f;
select has_column('public', 'members', 'last_active_at', 'members.last_active_at existe');
select ok((select relrowsecurity from pg_class where oid = 'public.member_activity_days'::regclass), 'member_activity_days : RLS activée');
select is((select count(*)::int from pg_policy where polrelid = 'public.member_activity_days'::regclass), 0, 'member_activity_days : aucune politique');
select ok(not has_table_privilege('authenticated', 'public.member_activity_days', 'select'), 'member_activity_days : aucun select client');
select ok(not has_table_privilege('authenticated', 'public.member_activity_days', 'insert'), 'member_activity_days : aucune écriture client');
select ok(not has_table_privilege('anon', 'public.member_activity_days', 'select'), 'member_activity_days : aucun select anon');
select ok(not has_schema_privilege('authenticated', 'private', 'usage'), 'schéma private : fermé aux clients');

-- ── NÉGATIFS : parent, enfant, anon refusés sur CHAQUE RPC d'administration ──
create temp table rpc_calls (n int, q text);
insert into rpc_calls values
  (1, 'select public.admin_stats_overview()'), (2, 'select public.admin_stats_series()'), (3, 'select public.admin_stats_usage()'),
  (4, $$select public.admin_families('', 'name', 'asc', 1)$$), (5, 'select public.admin_family_detail(tests.u(1))'), (6, 'select public.admin_health()');
grant select on rpc_calls to authenticated, anon;
select tests.login(21);
select throws_ok(q, '42501', null, 'parent ordinaire refusé : ' || q) from rpc_calls order by n;
select tests.login(13);
select throws_ok(q, '42501', null, 'enfant refusé : ' || q) from rpc_calls order by n;
select tests.login(12);
select throws_ok(q, '42501', null, 'second parent de la famille de l''admin refusé : ' || q) from rpc_calls order by n;
reset role;
set local role anon;
select throws_ok(q, '42501', null, 'anon refusé : ' || q) from rpc_calls order by n;
reset role;
select ok(not has_function_privilege('anon', 'public.admin_families(text,text,text,int)', 'execute'), 'admin_families : non exécutable par anon');
select ok(not has_function_privilege('anon', 'public.admin_stats_overview()', 'execute'), 'admin_stats_overview : non exécutable par anon');
select ok(not has_function_privilege('anon', 'public.touch_activity()', 'execute'), 'touch_activity : non exécutable par anon');

-- ── POSITIFS (administrateur) ──
select tests.login(11);
-- la base de test peut contenir des données de départ (seed) : les totaux sont comparés à un comptage DIRECT, jamais à un nombre figé
select is((public.admin_stats_overview()->>'families')::int, tests.val('select count(*) from public.families where deleted_at is null')::int, 'overview : toutes les familles sont comptées (aucun compte exclu)');
select is((public.admin_stats_overview()->>'parents')::int, tests.val($$select count(*) from public.members m join public.families f on f.id = m.family_id and f.deleted_at is null where m.role = 'parent' and m.revoked_at is null and m.deleted_at is null$$)::int, 'overview : parents');
select is((public.admin_stats_overview()->>'children')::int, tests.val($$select count(*) from public.children c join public.families f on f.id = c.family_id and f.deleted_at is null where c.deleted_at is null$$)::int, 'overview : enfants');
select is((public.admin_stats_overview()->>'new_families_7d')::int, tests.val($$select count(*) from public.families where deleted_at is null and created_at >= now() - interval '7 days'$$)::int, 'overview : nouvelles familles sur 7 j');
select is((public.admin_stats_overview()->>'new_families_30d')::int, tests.val($$select count(*) from public.families where deleted_at is null and created_at >= now() - interval '30 days'$$)::int, 'overview : nouvelles familles sur 30 j');
select ok((public.admin_stats_overview()->>'new_families_30d')::int >= 2 and (public.admin_stats_overview()->>'families')::int >= 3, 'overview : les 3 familles de test sont comptées');
select is((public.admin_stats_overview()->'active'->'today'->>'parents')::int, 1, 'overview : 1 parent actif aujourd''hui');
select is((public.admin_stats_overview()->'active'->'today'->>'children')::int, 1, 'overview : 1 enfant actif aujourd''hui');
select is((public.admin_stats_overview()->'active'->'d7'->>'parents')::int, 1, 'overview : 1 parent actif sur 7 j (celui d''il y a 10 jours n''y est pas)');
select is((public.admin_stats_overview()->'active'->'d30'->>'parents')::int, 2, 'overview : 2 parents actifs sur 30 j');
select is((public.admin_stats_overview()->>'families_with_notifications')::int, 1, 'overview : 1 famille avec notifications (jeton web seulement)');

select is(jsonb_array_length(public.admin_stats_series()->'weeks'), 12, 'séries : 12 semaines');
select is(jsonb_array_length(public.admin_stats_series()->'days'), 30, 'séries : 30 jours');
select is((select sum((w->>'families')::int)::int from jsonb_array_elements(public.admin_stats_series()->'weeks') w), tests.val($$select count(*) from public.families where deleted_at is null and created_at >= (date_trunc('week', (now() at time zone 'Asia/Ho_Chi_Minh')::date::timestamp)::date - 77)::timestamp at time zone 'Asia/Ho_Chi_Minh'$$)::int, 'séries : familles créées dans les 12 semaines (la 3e a 100 jours : exclue)');
select is((public.admin_stats_series()->'days'->29->>'parents')::int, 1, 'séries : aujourd''hui, 1 parent actif');
select is((public.admin_stats_series()->'days'->29->>'children')::int, 1, 'séries : aujourd''hui, 1 enfant actif');
select is((public.admin_stats_series()->'days'->19->>'parents')::int, 1, 'séries : il y a 10 jours, 1 parent actif');

select is((public.admin_stats_usage()->'d7'->>'tasks_created')::int, tests.val($$select count(*) from public.tasks where created_at >= now() - interval '7 days' and recurrence_id is null$$)::int, 'usage 7 j : tâches créées');
select is((public.admin_stats_usage()->'d30'->>'tasks_created')::int, tests.val($$select count(*) from public.tasks where created_at >= now() - interval '30 days' and recurrence_id is null$$)::int, 'usage 30 j : tâches créées');
select is((public.admin_stats_usage()->'d7'->>'tasks_completed')::int, 1, 'usage 7 j : 1 tâche cochée');
select is((public.admin_stats_usage()->'d7'->>'tasks_validated')::int, 1, 'usage 7 j : 1 tâche validée');
select is((public.admin_stats_usage()->'d7'->>'quizzes_submitted')::int, 1, 'usage 7 j : 1 quiz soumis');
select is((public.admin_stats_usage()->'d7'->>'quizzes_validated')::int, 1, 'usage 7 j : 1 quiz validé');
select is((public.admin_stats_usage()->'d7'->>'reward_requests')::int, 1, 'usage 7 j : 1 demande de récompense');
select is((public.admin_stats_usage()->'d7'->>'ai_calls')::int, 1, 'usage 7 j : 1 appel IA');
select is((public.admin_stats_usage()->'d30'->>'ai_calls')::int, 2, 'usage 30 j : 2 appels IA');
select is((public.admin_stats_usage()->'d30'->>'ai_failed')::int, 1, 'usage 30 j : 1 appel IA en échec');
select is((public.admin_stats_usage()->'d7'->>'avatar_calls')::int, 1, 'usage 7 j : 1 avatar');
select is(public.admin_stats_usage()->'quiz_by_class'->0->>'subject', 'maths', 'répartition des quiz : matière');
select is(public.admin_stats_usage()->'quiz_by_class'->0->>'grade', '7', 'répartition des quiz : classe');
select is((public.admin_stats_usage()->'ai_by_model'->0->>'input_tokens_30d')::int, 100, 'usage IA : jetons d''entrée');

select is((public.admin_families('', 'name', 'asc', 1)->>'total')::int, tests.val('select count(*) from public.families where deleted_at is null')::int, 'liste : toutes les familles');
select is(public.admin_families('', 'name', 'asc', 1)->'rows'->0->>'name', 'Dormante', 'liste triée par nom croissant');
select ok((select coalesce(bool_and(c >= nxt), true) from (select (r->>'created_at')::timestamptz as c, lead((r->>'created_at')::timestamptz) over (order by ord) as nxt from jsonb_array_elements(public.admin_families('', 'created_at', 'desc', 1)->'rows') with ordinality as t (r, ord)) z), 'liste triée par création décroissante');
select ok((select coalesce(bool_and(c <= nxt), true) from (select (r->>'created_at')::timestamptz as c, lead((r->>'created_at')::timestamptz) over (order by ord) as nxt from jsonb_array_elements(public.admin_families('', 'created_at', 'asc', 1)->'rows') with ordinality as t (r, ord)) z), 'liste triée par création croissante');
select is(public.admin_families('', 'last_active_at', 'desc', 1)->'rows'->0->>'name', 'Gia đình A', 'liste triée par dernière activité (récente d''abord)');
select is(public.admin_families('', 'last_active_at', 'desc', 1)->'rows'->1->>'name', 'Famille B', 'puis la famille active il y a 10 jours');
select ok((public.admin_families('', 'last_active_at', 'desc', 1)->'rows'->2->>'last_active_at') is null, 'les familles jamais actives sont en dernier');
select is((public.admin_families('PB@test', 'name', 'asc', 1)->>'total')::int, 1, 'recherche par e-mail du parent créateur (insensible à la casse)');
select is(public.admin_families('famille', 'name', 'asc', 1)->'rows'->0->>'creator_email', 'pb@test', 'recherche par nom : e-mail du créateur');
select is((public.admin_families('%', 'name', 'asc', 1)->>'total')::int, 0, 'recherche : « % » est littéral (jamais un joker)');
select is((public.admin_families('_', 'name', 'asc', 1)->>'total')::int, 0, 'recherche : « _ » est littéral');
select is((public.admin_families('', 'name; drop table public.families', 'asc; --', 1)->>'total')::int, tests.val('select count(*) from public.families where deleted_at is null')::int, 'tri hors liste : valeur par défaut, aucune injection');
select ok(to_regclass('public.families') is not null, 'la table families existe toujours');
select is(jsonb_array_length(public.admin_families('', 'name', 'asc', 2)->'rows'), 0, 'page 2 vide (moins de 50 familles)');
select is((public.admin_families('', 'name', 'asc', 0)->>'page')::int, 1, 'page < 1 ramenée à 1');
select is(public.admin_families('Gia đình A', 'name', 'asc', 1)->'rows'->0->>'creator_email', 'admin@test', 'créateur = premier parent de la famille');
select is((public.admin_families('Gia', 'name', 'asc', 1)->'rows'->0->>'parents')::int, 2, 'liste : 2 parents');
select is((public.admin_families('Gia', 'name', 'asc', 1)->'rows'->0->>'children')::int, 2, 'liste : 2 enfants');
select is(public.admin_families('Gia', 'name', 'asc', 1)->'rows'->0->>'status', 'active', 'statut Actif (< 7 j)');
select is(public.admin_families('Famille', 'name', 'asc', 1)->'rows'->0->>'status', 'inactive', 'statut Inactif (7–30 j)');
select is(public.admin_families('Dormante', 'name', 'asc', 1)->'rows'->0->>'status', 'dormant', 'statut Dormant (jamais active)');
select is((public.admin_families('Gia', 'name', 'asc', 1)->'rows'->0->>'notifications')::boolean, true, 'notifications : oui');
select is((public.admin_families('Famille', 'name', 'asc', 1)->'rows'->0->>'notifications')::boolean, false, 'notifications : non (appareil sans jeton)');
select is(public.admin_families('Gia', 'name', 'asc', 1)->'rows'->0->'classes', '[{"country":"VN","grade":"7"},{"country":"FR","grade":"CM1"}]'::jsonb, 'classes : pays et classe seulement');

select is(public.admin_family_detail(tests.u(1))->>'name', 'Gia đình A', 'fiche : nom');
select is((public.admin_family_detail(tests.u(1))->'usage_30d'->>'tasks_created')::int, 2, 'fiche : usage 30 j (tâches créées)');
select is((public.admin_family_detail(tests.u(2))->'usage_30d'->>'tasks_created')::int, 0, 'fiche : une autre famille ne voit pas les compteurs de A');
select is((public.admin_family_detail(tests.u(1))->>'active_devices')::int, 1, 'fiche : appareils actifs');
select throws_ok($$select public.admin_family_detail(tests.u(999))$$, 'P0002', 'family_not_found', 'fiche : famille inconnue');

select ok((public.admin_health()->>'db_size_bytes')::bigint > 0, 'santé : taille de la base');
select is((public.admin_health()->>'active_devices')::int, 1, 'santé : appareils actifs');
select ok(jsonb_typeof(public.admin_health()->'cron') in ('array', 'null'), 'santé : tâches planifiées = tableau ou null (inconnu), jamais une erreur');

-- ── VIE PRIVÉE : aucun contenu ni prénom d'enfant dans AUCUNE réponse ──
select ok(position('SECRET' in (public.admin_stats_overview()::text || public.admin_stats_series()::text || public.admin_stats_usage()::text || public.admin_families('', 'name', 'asc', 1)::text
  || public.admin_family_detail(tests.u(1))::text || public.admin_health()::text)) = 0, 'aucune réponse ne contient de titre de tâche, de récompense ni de quiz');
select ok(position('Minh' in (public.admin_families('', 'name', 'asc', 1)::text || public.admin_family_detail(tests.u(1))::text)) = 0
  and position('Khang' in (public.admin_families('', 'name', 'asc', 1)::text || public.admin_family_detail(tests.u(1))::text)) = 0, 'aucun prénom d''enfant dans la liste ni la fiche');

-- ── touch_activity ──
reset role;
select tests.login(14);
select lives_ok($$select public.touch_activity()$$, 'touch_activity : un enfant connecté peut l''appeler');
reset role;
select ok((select last_active_at from public.members where id = tests.u(114)) is not null, 'touch_activity : last_active_at renseignée');
select is((select count(*)::int from public.member_activity_days where member_id = tests.u(114)), 1, 'touch_activity : le jour est compté');
create temp table t0 as select last_active_at from public.members where id = tests.u(114);
select tests.login(14);
select public.touch_activity();
reset role;
select is((select last_active_at from public.members where id = tests.u(114)), (select last_active_at from t0), 'touch_activity : aucune écriture si moins d''une heure');
update public.members set last_active_at = now() - interval '2 hours' where id = tests.u(114);
select tests.login(14);
select public.touch_activity();
reset role;
select ok((select last_active_at from public.members where id = tests.u(114)) > now() - interval '1 minute', 'touch_activity : réécrite après plus d''une heure');
select is((select count(*)::int from public.member_activity_days where member_id = tests.u(114)), 1, 'touch_activity : un seul jour compté pour le même jour');
set local role anon;
select throws_ok($$select public.touch_activity()$$, '42501', null, 'touch_activity : refusé à anon');
reset role;
-- rien n'est lisible ni écrivable par un client sur la nouvelle table
select tests.login(21);
select throws_ok($$select * from public.member_activity_days$$, '42501', null, 'parent : member_activity_days illisible');
select throws_ok($$insert into public.member_activity_days (member_id, day) values (tests.u(121), current_date)$$, '42501', null, 'parent : member_activity_days non inscriptible');
select tests.login(13);
select throws_ok($$select * from public.member_activity_days$$, '42501', null, 'enfant : member_activity_days illisible');
reset role;

select * from finish();
rollback;
