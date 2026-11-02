-- D-106 : interface V2 — interrupteur `families.ui_version` (admin seulement), icônes d'objectifs (tâches, récurrences), coût d'aventure 60.
-- (Les nouvelles règles d'énergie et d'amitié sont testées dans 40_companion.test.sql, la jauge de 60 dans 41_adventures.test.sql.)
-- Fixtures : famille 1 = parent 11 (ADMIN de la plateforme), parent 12, enfant A (user 13, profil 201) ; famille 2 = parent 21, enfant C (user 23, profil 203).
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
create function tests.n(q text) returns bigint language plpgsql as $$
declare c bigint;
begin
  execute q;
  get diagnostics c = row_count;
  return c;
end $$;
grant execute on all functions in schema tests to authenticated, anon, service_role;

insert into auth.users (id, email, is_anonymous) values
  (tests.u(11), 'admin@test', false), (tests.u(12), 'p2@test', false), (tests.u(13), null, false), (tests.u(21), 'pb@test', false), (tests.u(23), null, false);
insert into public.families (id, name, timezone) values (tests.u(1), 'A', 'Asia/Ho_Chi_Minh'), (tests.u(2), 'B', 'Asia/Ho_Chi_Minh');
insert into public.children (id, family_id, name, birth_date) values (tests.u(201), tests.u(1), 'Minh', '2015-01-01'), (tests.u(203), tests.u(2), 'Lan', '2014-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(112), tests.u(1), tests.u(12), 'parent', null, 'Mẹ'),
  (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'),
  (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'Cha B'), (tests.u(123), tests.u(2), tests.u(23), 'child', tests.u(203), 'Lan');
insert into public.platform_admins (user_id) values (tests.u(11));
select * from no_plan();

-- ═══ structure et droits ═══
select has_column('public', 'families', 'ui_version', 'families.ui_version existe');
select is(tests.val('select ui_version from public.families where id = tests.u(1)'), 'v1', 'défaut : v1');
select throws_ok($$insert into public.families (name, ui_version) values ('X', 'v3')$$, '23514', null, 'valeur hors liste refusée (check)');
select ok(not has_column_privilege('authenticated', 'public.families', 'ui_version', 'update'), 'authenticated : aucun droit UPDATE sur ui_version');
select ok(not has_column_privilege('authenticated', 'public.families', 'ui_version', 'insert'), 'authenticated : aucun droit INSERT sur ui_version');
select ok(not has_function_privilege('anon', 'public.admin_set_ui_version(uuid,text)', 'execute'), 'admin_set_ui_version : non exécutable par anon');

-- ═══ lecture : chacun lit la version de SA famille seulement ═══
reset role;
update public.families set ui_version = 'v2' where id = tests.u(2);
select tests.login(13);
select is(tests.val('select ui_version from public.families where id = tests.u(1)'), 'v1', 'enfant : lit la version de sa famille');
select is(tests.n('select 1 from public.families where id = tests.u(2)'), 0::bigint, 'enfant : ne lit pas la version d''une autre famille');
select tests.login(12);
select is(tests.n('select ui_version from public.families where id = tests.u(2)'), 0::bigint, 'parent : ne lit pas la version d''une autre famille');
select tests.login(21);
select is(tests.val('select ui_version from public.families where id = tests.u(2)'), 'v2', 'parent B : lit la sienne (v2)');
select is(tests.n('select 1 from public.families where id = tests.u(1)'), 0::bigint, 'parent B : pas celle de A');
reset role;
update public.families set ui_version = 'v1' where id = tests.u(2);

-- ═══ un parent ne change pas sa propre version ═══
select tests.login(12);
select throws_ok($$update public.families set ui_version = 'v2' where id = tests.u(1)$$, '42501', null, 'parent : UPDATE direct de ui_version refusé');
select throws_ok($$select public.admin_set_ui_version(tests.u(1), 'v2')$$, '42501', 'forbidden', 'parent non admin : admin_set_ui_version refusé');
select tests.login(13);
select throws_ok($$select public.admin_set_ui_version(tests.u(1), 'v2')$$, '42501', 'forbidden', 'enfant : refusé');
select tests.login(21);
select throws_ok($$select public.admin_set_ui_version(tests.u(2), 'v2')$$, '42501', 'forbidden', 'parent B pour SA famille : refusé (admin seulement)');
reset role;
set local role anon;
select throws_ok($$select public.admin_set_ui_version(tests.u(1), 'v2')$$, '42501', null, 'anon : refusé');
reset role;
select is(tests.val('select ui_version from public.families where id = tests.u(1)'), 'v1', '…la version de A est toujours v1');
select is(tests.val('select count(*) from public.catalog_admin_log'), '0', '…aucune trace');

-- ═══ l'administrateur change la version, tracée ═══
select tests.login(11);
select throws_ok($$select public.admin_set_ui_version(tests.u(2), 'v9')$$, 'P0001', 'invalid_input', 'version inconnue refusée');
select throws_ok($$select public.admin_set_ui_version(tests.u(999), 'v2')$$, 'P0002', 'family_not_found', 'famille inconnue refusée');
select is(public.admin_set_ui_version(tests.u(2), 'v2') ->> 'ui_version', 'v2', 'admin : famille B passe en v2');
select is(tests.val('select ui_version from public.families where id = tests.u(2)'), 'v2', '…enregistré');
select is(tests.val('select count(*) from public.catalog_admin_log where action = ''set_ui_version'' and family_id = tests.u(2)'), '1', '…tracé dans catalog_admin_log');
select is(tests.val('select slot::text from public.catalog_admin_log where family_id = tests.u(2)'), '{"to": "v2", "from": "v1"}', '…de v1 vers v2');
select lives_ok($$select public.admin_set_ui_version(tests.u(2), 'v2')$$, 'rejeu (même valeur) : sans erreur');
select is(tests.val('select count(*) from public.catalog_admin_log where family_id = tests.u(2)'), '1', '…aucune trace de plus');
select is(public.admin_family_detail(tests.u(2)) ->> 'ui_version', 'v2', 'fiche famille : version affichée');
select is(public.admin_stats_overview() -> 'ui_versions',
          jsonb_build_object('v1', tests.val('select count(*) from public.families where deleted_at is null and ui_version = ''v1''')::int,
                             'v2', tests.val('select count(*) from public.families where deleted_at is null and ui_version = ''v2''')::int),
          'indicateurs : familles par version (nombres seulement)');
select ok((public.admin_stats_overview() -> 'ui_versions' ->> 'v2')::int >= 1, '…la famille B est comptée en v2');
select lives_ok($$select public.admin_set_ui_version(tests.u(2), 'v1')$$, 'retour en v1');
select is(tests.val('select count(*) from public.catalog_admin_log where family_id = tests.u(2)'), '2', '…tracé aussi');
reset role;
select throws_ok($$update public.catalog_admin_log set title = 'x'$$, '42501', 'immutable_journal', 'journal : toujours immuable');
select throws_ok($$insert into public.catalog_admin_log (admin_id, action, title) values (tests.u(11), 'set_ui_version', 'v2')$$, '23514', null, 'journal : set_ui_version exige une famille');

-- ═══ icônes d'objectifs ═══
select is(array_length(public.goal_icon_slugs(), 1), 36, '36 icônes');
select has_column('public', 'tasks', 'icon', 'tasks.icon');
select has_column('public', 'recurrences', 'icon', 'recurrences.icon');
select tests.login(11);
select lives_ok($$insert into public.tasks (id, family_id, child_id, title, date, created_by, icon) values (tests.u(301), tests.u(1), tests.u(201), 'Đánh răng', '2026-07-02', tests.u(111), 'brosse-a-dents')$$, 'parent : crée une tâche avec icône');
select lives_ok($$insert into public.tasks (id, family_id, child_id, title, date, created_by) values (tests.u(302), tests.u(1), tests.u(201), 'Sans icône', '2026-07-02', tests.u(111))$$, 'parent : icône facultative');
select is(tests.val('select coalesce(icon, ''∅'') from public.tasks where id = tests.u(302)'), '∅', '…nulle (icône de la catégorie côté client)');
select throws_ok($$insert into public.tasks (id, family_id, child_id, title, date, created_by, icon) values (tests.u(303), tests.u(1), tests.u(201), 'X', '2026-07-02', tests.u(111), 'licorne')$$, '23514', null, 'icône hors liste refusée');
select lives_ok($$update public.tasks set icon = 'lecture' where id = tests.u(302)$$, 'parent : modifie l''icône');
select is(tests.val('select icon from public.tasks where id = tests.u(302)'), 'lecture', '…enregistrée');
select tests.login(13);
select is(tests.n($$update public.tasks set icon = 'velo' where id = tests.u(301)$$), 0::bigint, 'enfant : ne modifie aucune icône (RLS)');
select throws_ok($$insert into public.tasks (family_id, child_id, title, date, created_by, icon) values (tests.u(1), tests.u(201), 'X', '2026-07-02', tests.u(113), 'velo')$$, '42501', null, 'enfant : ne crée pas de tâche');
select is(tests.val('select icon from public.tasks where id = tests.u(301)'), 'brosse-a-dents', '…icône inchangée');

-- récurrence : ses occurrences héritent de l'icône, et la suivent quand elle change
select tests.login(11);
select lives_ok($$insert into public.recurrences (id, family_id, child_id, title, time_kind, rule, starts_on, created_by, icon) values (tests.u(801), tests.u(1), tests.u(201), 'Tưới cây', 'anytime', 'daily', tests.val('select public.family_today(tests.u(1))')::date, tests.u(111), 'arroser')$$, 'parent : récurrence avec icône');
reset role;
select is(tests.val('select count(*) from public.tasks where recurrence_id = tests.u(801) and icon = ''arroser'''), '14', 'les 14 occurrences héritent de l''icône');
select tests.login(11);
select lives_ok($$update public.recurrences set icon = 'animal' where id = tests.u(801)$$, 'parent : change l''icône de la récurrence');
reset role;
select is(tests.val('select count(*) from public.tasks where recurrence_id = tests.u(801) and icon = ''animal'' and deleted_at is null'), '14', '…les occurrences futures non faites suivent');
select throws_ok($$update public.recurrences set icon = 'dragon' where id = tests.u(801)$$, '23514', null, 'récurrence : icône hors liste refusée');
select tests.login(13);
select is(tests.n($$update public.recurrences set icon = 'velo' where id = tests.u(801)$$), 0::bigint, 'enfant : ne modifie pas une récurrence');
select tests.login(21);
select is(tests.n($$update public.tasks set icon = 'velo' where id = tests.u(301)$$), 0::bigint, 'parent d''une autre famille : aucune modification');

-- ═══ aventure : coût 60, heure de départ exposée ═══
reset role;
select is(public.adventure_cost(), 60, 'coût d''une aventure : 60');
insert into public.companion_energy (id, child_id, family_id, amount, reason, source_id) values (gen_random_uuid(), tests.u(201), tests.u(1), 60, 'task_checked', gen_random_uuid());
select tests.login(13);
select lives_ok($$select public.adventure_start(tests.u(201), tests.u(950), 'ha-long')$$, 'A part (jauge de 60 pleine)');
select ok((public.adventure_state(tests.u(201)) -> 'active' ->> 'departed_at') is not null, 'adventure_state : heure de départ de l''aventure en cours');

select * from finish();
rollback;
