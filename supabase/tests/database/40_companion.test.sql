-- D-104 : compagnon panda (companions, companion_energy, companion_state / setup / set_stage_offset) et énergie ⚡ écrite par les RPC de tâches et de quiz.
-- Fixtures : famille 1 = parent 11, enfant A (user 13, profil 201, né 2013-05-01), enfant B (user 14, profil 202) ; famille 2 = parent 21, enfant C (user 23, profil 203).
-- Les cas de `companion_stage` / `companion_level` sont les MÊMES que dans apps/mobile/src/domain/panda.test.ts.
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
-- énergie totale vue par le propriétaire de la base (somme brute du journal)
create function tests.raw_energy(child int) returns int language sql security definer as
  $$ select coalesce(sum(amount), 0)::int from public.companion_energy where child_id = tests.u(child) $$;
create function tests.points_rows() returns int language sql security definer as $$ select count(*)::int from public.point_transactions $$;
create function tests.m() returns date language sql stable security definer as $$ select date_trunc('week', public.family_today(tests.u(1))::timestamp)::date $$;
-- tentative SOUMISE d'un enfant sur un quiz du catalogue, avec son résultat
create function tests.submitted(att int, fam int, child int, quiz int, sc int, tt int) returns void language plpgsql security definer as $$
begin
  insert into public.quiz_attempts (id, family_id, child_id, catalog_id, status, submitted_at) values (tests.u(att), tests.u(fam), tests.u(child), tests.u(quiz), 'submitted', now());
  insert into public.quiz_results (attempt_id, family_id, child_id, score, total) values (tests.u(att), tests.u(fam), tests.u(child), sc, tt);
end $$;
grant execute on all functions in schema tests to authenticated, anon, service_role;

insert into auth.users (id, email, is_anonymous) values (tests.u(11), 'p1@test', false), (tests.u(13), null, false), (tests.u(14), null, false), (tests.u(21), 'pb@test', false), (tests.u(23), null, false);
insert into public.families (id, name, timezone) values (tests.u(1), 'A', 'Asia/Ho_Chi_Minh'), (tests.u(2), 'B', 'Asia/Ho_Chi_Minh');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2013-05-01'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01'), (tests.u(203), tests.u(2), 'Lan', '2010-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'),
  (tests.u(114), tests.u(1), tests.u(14), 'child', tests.u(202), 'Khang'), (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'Cha B'),
  (tests.u(123), tests.u(2), tests.u(23), 'child', tests.u(203), 'Lan');
insert into public.tasks (id, family_id, child_id, title, date, created_by) values
  (tests.u(301), tests.u(1), tests.u(201), 'SECRET-A1', '2026-07-02', tests.u(111)),
  (tests.u(302), tests.u(1), tests.u(201), 'SECRET-A2', '2026-07-02', tests.u(111)),
  (tests.u(305), tests.u(1), tests.u(201), 'ZERO-A', '2026-07-02', tests.u(111)),
  (tests.u(306), tests.u(1), tests.u(201), 'LEGACY-A', '2026-07-02', tests.u(111)),
  (tests.u(303), tests.u(1), tests.u(202), 'SECRET-B1', '2026-07-02', tests.u(111)),
  (tests.u(304), tests.u(1), tests.u(202), 'SECRET-B2', '2026-07-02', tests.u(111));
update public.tasks set points = 7 where id = tests.u(302);
update public.tasks set points = 0 where id = tests.u(305);
insert into public.catalog_quizzes (id, country, grade, subject, week_label, title, status, release_on, due_on) values
  (tests.u(701), 'VN', '7', 'hist_geo', 'Tuần 1', 'Văn Lang', 'published', tests.m(), tests.m() + 6),
  (tests.u(702), 'VN', '7', 'hist_geo', 'Tuần 2', 'Âu Lạc', 'published', tests.m(), tests.m() + 6);
insert into public.catalog_questions (quiz_id, position, prompt, choices) values (tests.u(701), 0, 'Q1', array['a','b','c','d']);
insert into public.catalog_answer_keys (question_id, correct_index, confirmed) select id, 0, true from public.catalog_questions;
select * from no_plan();

-- ═══ structure et droits ═══
select has_table('public', 'companions', 'table companions');
select has_table('public', 'companion_energy', 'table companion_energy');
select ok((select relrowsecurity from pg_class where oid = 'public.companions'::regclass), 'companions: RLS activée');
select ok((select relrowsecurity from pg_class where oid = 'public.companion_energy'::regclass), 'companion_energy: RLS activée');
select ok(not has_table_privilege('anon', 'public.companions', 'select'), 'anon: aucune lecture de companions');
select ok(not has_table_privilege('anon', 'public.companion_energy', 'select'), 'anon: aucune lecture de companion_energy');
select ok(not has_table_privilege('authenticated', 'public.companions', 'insert'), 'companions: pas d''INSERT client');
select ok(not has_table_privilege('authenticated', 'public.companions', 'update'), 'companions: pas d''UPDATE client');
select ok(not has_table_privilege('authenticated', 'public.companions', 'delete'), 'companions: pas de DELETE client');
select ok(not has_table_privilege('authenticated', 'public.companion_energy', 'insert'), 'companion_energy: pas d''INSERT client');
select ok(not has_table_privilege('authenticated', 'public.companion_energy', 'update'), 'companion_energy: pas d''UPDATE client');
select ok(not has_table_privilege('authenticated', 'public.companion_energy', 'delete'), 'companion_energy: pas de DELETE client');
select ok(not has_function_privilege('anon', 'public.companion_state(uuid)', 'execute'), 'companion_state: non exécutable par anon');
select ok(not has_function_privilege('anon', 'public.companion_setup(uuid,text,public.companion_trait,text)', 'execute'), 'companion_setup: non exécutable par anon');
select ok(not has_function_privilege('anon', 'public.companion_set_stage_offset(uuid,int)', 'execute'), 'companion_set_stage_offset: non exécutable par anon');
select ok(not has_function_privilege('authenticated', 'public.companion_add_energy(uuid,uuid,int,public.companion_energy_reason,uuid,uuid)', 'execute'), 'companion_add_energy: interne, non exécutable par un client');
select ok(not has_function_privilege('authenticated', 'public.companion_task_energy(uuid,uuid)', 'execute'), 'companion_task_energy: interne');

-- ═══ stade : mêmes cas que panda.test.ts (année scolaire du 1er septembre, jour local) ═══
select is(public.companion_stage('2020-08-31', '2026-10-15'), 2, 'né le 31/08/2020, rentrée 2026 : 6 ans → nhí');
select is(public.companion_stage('2020-09-01', '2026-10-15'), 2, 'né le 01/09/2020 : 6 ans pile au 1er septembre → nhí');
select is(public.companion_stage('2020-09-02', '2026-10-15'), 1, 'né le 02/09/2020 : 5 ans → bé');
select is(public.companion_stage('2021-08-31', '2026-10-15'), 1, 'né le 31/08/2021 : 5 ans → bé');
select is(public.companion_stage('2015-09-01', '2026-10-15'), 3, 'né le 01/09/2015 : 11 ans → teen');
select is(public.companion_stage('2015-09-02', '2026-10-15'), 2, 'né le 02/09/2015 : 10 ans → nhí');
select is(public.companion_stage('2011-09-01', '2026-10-15'), 4, 'né le 01/09/2011 : 15 ans → đồng hành');
select is(public.companion_stage('2011-09-02', '2026-10-15'), 3, 'né le 02/09/2011 : 14 ans → teen');
select is(public.companion_stage('2019-09-01', '2026-08-31'), 2, '31 août 2026 = encore l''année 2025-2026 (rentrée du 01/09/2025) : né 01/09/2019 → 6 ans');
select is(public.companion_stage('2019-09-02', '2026-08-31'), 1, '31 août 2026 : né 02/09/2019 → 5 ans → bé (le stade ne change qu''à la rentrée)');
select is(public.companion_stage('2019-09-02', '2026-09-01'), 2, '1er septembre 2026 : la nouvelle année scolaire commence → 6 ans');
select is(public.companion_stage('2023-01-01', '2026-10-01', -1), 1, 'décalage −1 au plus bas : reste bé (borné)');
select is(public.companion_stage('2023-01-01', '2026-10-01', 1), 2, 'décalage +1 sur un bé → nhí');
select is(public.companion_stage('2018-01-01', '2026-10-01', -1), 1, '8 ans, −1 → bé');
select is(public.companion_stage('2018-01-01', '2026-10-01', 1), 3, '8 ans, +1 → teen');
select is(public.companion_stage('2009-01-01', '2026-10-01', 1), 4, '17 ans, +1 → reste đồng hành (borné)');
select is(public.companion_stage('2009-01-01', '2026-10-01', -1), 3, '17 ans, −1 → teen');
select is(public.companion_stage('2009-01-01', '2026-10-01', 5), 4, 'décalage hors bornes : ramené à +1 puis borné');

-- ═══ niveau d'amitié (D-106 : paliers doublés) : mêmes cas que panda.test.ts ═══
select is(public.companion_level(0), 1, 'niveau 1 à 0');
select is(public.companion_level(99), 1, 'niveau 1 à 99');
select is(public.companion_level(100), 2, 'niveau 2 à 100');
select is(public.companion_level(299), 2, 'niveau 2 à 299');
select is(public.companion_level(300), 3, 'niveau 3 à 300');
select is(public.companion_level(599), 3, 'niveau 3 à 599');
select is(public.companion_level(600), 4, 'niveau 4 à 600');
select is(public.companion_level(999), 4, 'niveau 4 à 999');
select is(public.companion_level(1000), 5, 'niveau 5 à 1000');
select is(public.companion_level(1599), 5, 'niveau 5 à 1599');
select is(public.companion_level(1600), 6, 'niveau 6 à 1600 (un niveau de plus tous les 600)');
select is(public.companion_level(2200), 7, 'niveau 7 à 2200');
select is(public.companion_level(-12), 1, 'total négatif : niveau 1');
select is(public.companion_next_level_at(0), 100, 'prochain palier depuis 0 : 100');
select is(public.companion_next_level_at(299), 300, 'prochain palier depuis 299 : 300');
select is(public.companion_next_level_at(300), 600, 'prochain palier depuis 300 : 600');
select is(public.companion_next_level_at(600), 1000, 'prochain palier depuis 600 : 1000');
select is(public.companion_next_level_at(1000), 1600, 'prochain palier depuis 1000 : 1600');
select is(public.companion_next_level_at(1600), 2200, 'prochain palier depuis 1600 : 2200');

-- ═══ état sans compagnon : l'enfant le lit, le stade vient de l'âge ═══
select tests.login(13);
select is((public.companion_state(tests.u(201)) ->> 'has_companion'), 'false', 'A: pas encore de compagnon');
select is((public.companion_state(tests.u(201)) ->> 'name'), null, '…nom nul');
select is((public.companion_state(tests.u(201)) ->> 'energy_total'), '0', '…énergie 0');
select is((public.companion_state(tests.u(201)) ->> 'level'), '1', '…niveau 1');
select is((public.companion_state(tests.u(201)) ->> 'next_level_at'), '100', '…prochain palier 100');
select is((public.companion_state(tests.u(201)) ->> 'stage')::int,
          public.companion_stage('2013-05-01', tests.val('select public.family_today(''' || tests.u(1) || ''')')::date, 0), 'le stade suit companion_stage au JOUR LOCAL de la famille');

-- ═══ énergie sans compagnon : enregistrée quand même ═══
select lives_ok($$select public.complete_task(tests.u(301), tests.u(901))$$, 'A coche la tâche 301');
select is(tests.raw_energy(201), 10, 'cocher : + les points de la tâche (10) même sans compagnon');
select is((public.companion_state(tests.u(201)) ->> 'energy_total'), '10', '…visible dans l''état');
select lives_ok($$select public.complete_task(tests.u(301), tests.u(901))$$, 'rejeu de la coche (même tx) : sans erreur');
select is(tests.raw_energy(201), 10, '…toujours +10 (aucun doublon)');
select is(tests.points_rows(), 0, 'cocher ne crée AUCUN point');

-- ═══ configuration par l'enfant ═══
select lives_ok($$select public.companion_setup(tests.u(201), '  Bambou  ', 'kind')$$, 'A nomme son panda (espaces retirés)');
select is((public.companion_state(tests.u(201)) ->> 'name'), 'Bambou', 'nom enregistré');
select is((public.companion_state(tests.u(201)) ->> 'trait'), 'kind', 'trait enregistré');
select is((public.companion_state(tests.u(201)) ->> 'has_companion'), 'true', 'compagnon présent');
select throws_ok($$select public.companion_setup(tests.u(201), '', 'kind')$$, 'P0001', 'invalid_input', 'nom vide refusé');
select throws_ok($$select public.companion_setup(tests.u(201), '   ', 'kind')$$, 'P0001', 'invalid_input', 'nom d''espaces refusé');
select throws_ok($$select public.companion_setup(tests.u(201), repeat('x', 21), 'kind')$$, 'P0001', 'invalid_input', 'nom de 21 caractères refusé');
select lives_ok($$select public.companion_setup(tests.u(201), repeat('x', 20), 'brave')$$, 'nom de 20 caractères accepté');
select throws_ok($$select public.companion_setup(tests.u(201), 'Bambou', 'grumpy')$$, '22P02', null, 'trait inconnu refusé');
select throws_ok($$select public.companion_setup(tests.u(202), 'Voleur', 'kind')$$, '42501', 'forbidden', 'A ne configure pas le panda de B');
select lives_ok($$select public.companion_setup(tests.u(201), 'Bambou', 'kind')$$, 'A remet Bambou / kind');

-- ═══ décalage de stade : l'enfant seulement ═══
select lives_ok($$select public.companion_set_stage_offset(tests.u(201), 1)$$, 'A choisit +1');
select is((public.companion_state(tests.u(201)) ->> 'stage_offset'), '1', 'décalage enregistré');
select is((public.companion_state(tests.u(201)) ->> 'stage')::int,
          public.companion_stage('2013-05-01', tests.val('select public.family_today(''' || tests.u(1) || ''')')::date, 1), 'le stade tient compte du décalage');
select throws_ok($$select public.companion_set_stage_offset(tests.u(201), 2)$$, 'P0001', 'invalid_input', 'décalage +2 refusé');
select throws_ok($$select public.companion_set_stage_offset(tests.u(201), -2)$$, 'P0001', 'invalid_input', 'décalage −2 refusé');
select throws_ok($$select public.companion_set_stage_offset(tests.u(202), 1)$$, '42501', 'forbidden', 'A ne change pas le décalage de B');
select lives_ok($$select public.companion_set_stage_offset(tests.u(201), 0)$$, 'A revient à 0');

-- ═══ décocher / refuser : − ce qui a été crédité, jamais sous 0 ═══
select lives_ok($$select public.uncomplete_task(tests.u(301), tests.u(902))$$, 'A décoche 301');
select is(tests.raw_energy(201), 0, 'décocher : −10 (total 0)');
select lives_ok($$select public.uncomplete_task(tests.u(301), tests.u(903))$$, 'décocher une tâche déjà décochée : sans effet');
select is(tests.raw_energy(201), 0, '…le total ne descend pas sous 0');
select lives_ok($$select public.complete_task(tests.u(302), tests.u(904))$$, 'A coche 302');
select is(tests.raw_energy(201), 7, 'coche d''une tâche à 7 points : +7');
select tests.login(11);
select lives_ok($$select public.reject_task(tests.u(302), 'à refaire')$$, 'le parent refuse 302');
select is(tests.raw_energy(201), 0, 'refus : −7');
select lives_ok($$select public.reject_task(tests.u(302), 'à refaire')$$, 'rejeu du refus : sans effet');
select is(tests.raw_energy(201), 0, '…aucun second retrait');
select is((select (public.companion_state(tests.u(201)) ->> 'energy_total')), '0', 'le parent lit un total de 0');
select tests.login(13);
select lives_ok($$select public.complete_task(tests.u(302), tests.u(905))$$, 'A recoche 302 (nouvelle tx)');
select is(tests.raw_energy(201), 7, 'recoche après refus : +7');

-- ═══ tâche à 0 point : aucune énergie (le journal refuse les montants nuls) ═══
select lives_ok($$select public.complete_task(tests.u(305), tests.u(910))$$, 'A coche une tâche à 0 point');
select is(tests.raw_energy(201), 7, '…aucune énergie');
select lives_ok($$select public.uncomplete_task(tests.u(305), tests.u(911))$$, 'A la décoche');
select is(tests.raw_energy(201), 7, '…rien n''est retiré');

-- ═══ historique existant non recalculé : un ancien +5 (règle D-104) est retiré tel quel ═══
reset role;
update public.tasks set completed_at = now(), completed_by = tests.u(113) where id = tests.u(306);
select public.companion_add_energy(tests.u(1), tests.u(201), 5, 'task_checked', tests.u(306), tests.u(912));
select tests.login(13);
select is(tests.raw_energy(201), 12, 'ancien crédit de +5 conservé (pas de recalcul)');
select lives_ok($$select public.uncomplete_task(tests.u(306), tests.u(913))$$, 'A décoche la tâche créditée par l''ancienne règle');
select is(tests.raw_energy(201), 7, '…seuls les 5 crédités sont retirés (pas les 10 points de la tâche)');

-- ═══ une tâche cochée par le PARENT ne donne rien, et la retirer ne retire rien ═══
select tests.login(11);
select lives_ok($$select public.complete_task(tests.u(303), tests.u(906))$$, 'le parent coche et valide 303 pour B');
select is(tests.raw_energy(202), 0, 'coche parent : aucune énergie');
select lives_ok($$select public.uncomplete_task(tests.u(303), tests.u(907))$$, 'le parent décoche 303');
select is(tests.raw_energy(202), 0, '…aucune énergie négative (jamais sous 0)');
select is((select (public.companion_state(tests.u(202)) ->> 'energy_total')), '0', '…total de B à 0');

-- ═══ quiz : + les points attribués par quiz_points_for, une seule fois par tentative ═══
select tests.submitted(801, 1, 201, 701, 1, 1);
select tests.login(11);
select lives_ok($$select public.validate_quiz_attempt(tests.u(801), false)$$, 'le parent valide le quiz de A');
select is(tests.raw_energy(201), 15, 'validation du quiz (100 %) : +8 = quiz_points_for');
select lives_ok($$select public.validate_quiz_attempt(tests.u(801), true)$$, 'revalidation : sans erreur');
select is(tests.raw_energy(201), 15, '…un seul crédit par tentative');
select is(tests.val('select count(*) from public.companion_energy where source_id = ''' || tests.u(801) || ''' and reason = ''quiz_validated'''), '1', '…une seule ligne quiz_validated');
select is((select (public.companion_state(tests.u(201)) ->> 'energy_total')), '15', 'état : 15 ⚡');
select is((public.companion_state(tests.u(201)) ->> 'level'), '1', '…niveau 1 (palier suivant à 100)');
select tests.submitted(802, 1, 201, 702, 0, 1);
select tests.login(11);
select lives_ok($$select public.validate_quiz_attempt(tests.u(802), false)$$, 'le parent valide un quiz à 0 %');
select is(tests.raw_energy(201), 15, '…0 point attribué : 0 énergie');
select is(tests.val('select count(*) from public.companion_energy where source_id = ''' || tests.u(802) || ''''), '0', '…aucune ligne d''énergie');

-- ═══ le parent configure nom et trait, jamais le décalage ═══
select lives_ok($$select public.companion_setup(tests.u(201), 'Bao Bao', 'funny')$$, 'le parent renomme le panda de A');
select is((public.companion_state(tests.u(201)) ->> 'name'), 'Bao Bao', '…nom changé');
select is((public.companion_state(tests.u(201)) ->> 'stage_offset'), '0', '…décalage inchangé');
select throws_ok($$select public.companion_set_stage_offset(tests.u(201), 1)$$, '42501', 'forbidden', 'le parent ne change PAS le décalage de stade');
select is((public.companion_state(tests.u(201)) ->> 'stage_offset'), '0', '…toujours 0');
select lives_ok($$select public.companion_setup(tests.u(202), 'Mochi', 'calm')$$, 'le parent crée le panda de B');

-- ═══ variante (D-106) : 'boy' par défaut, réglée par companion_setup, inchangée si absente ═══
select is((public.companion_state(tests.u(202)) ->> 'variant'), 'boy', 'variante par défaut : boy');
select lives_ok($$select public.companion_setup(tests.u(202), 'Mochi', 'calm', 'girl')$$, 'variante girl');
select is((public.companion_state(tests.u(202)) ->> 'variant'), 'girl', '…enregistrée');
select lives_ok($$select public.companion_setup(tests.u(202), 'Mochi 2', 'calm')$$, 'mise à jour sans variante');
select is((public.companion_state(tests.u(202)) ->> 'variant'), 'girl', '…variante inchangée');
select throws_ok($$select public.companion_setup(tests.u(202), 'Mochi', 'calm', 'robot')$$, 'P0001', 'invalid_input', 'variante inconnue refusée');
select throws_ok($$update public.companions set variant = 'boy'$$, '42501', null, 'UPDATE direct de la variante refusé');

-- ═══ lecture : isolation (D-052) ═══
select is(tests.n('select 1 from public.companions'), 2::bigint, 'parent 1: voit les deux compagnons de SA famille');
select is(tests.n('select 1 from public.companion_energy'), 8::bigint, 'parent 1: voit l''énergie de SA famille (coche, décoche, coche, refus, recoche, ancien +5, son retrait, quiz)');
select tests.login(13);
select is(tests.n('select 1 from public.companions'), 1::bigint, 'A: ne voit que SON compagnon');
select is(tests.n('select 1 from public.companions where child_id = tests.u(202)'), 0::bigint, 'A: pas celui de B, même par id');
select is(tests.n('select 1 from public.companion_energy where child_id = tests.u(202)'), 0::bigint, 'A: pas l''énergie de B');
select ok(tests.n('select 1 from public.companion_energy') > 0, 'A: lit sa propre énergie');
select throws_ok($$select public.companion_state(tests.u(202))$$, '42501', 'forbidden', 'A: companion_state de B refusé');
select throws_ok($$select public.companion_state(tests.u(203))$$, '42501', 'forbidden', 'A: companion_state d''un enfant d''une autre famille refusé');
select tests.login(14);
select is(tests.n('select 1 from public.companions'), 1::bigint, 'B: ne voit que SON compagnon');
select is(tests.n('select 1 from public.companions where child_id = tests.u(201)'), 0::bigint, 'B: pas celui de A');
select is(tests.n('select 1 from public.companion_energy where child_id = tests.u(201)'), 0::bigint, 'B: pas l''énergie de A');
select throws_ok($$select public.companion_state(tests.u(201))$$, '42501', 'forbidden', 'B: companion_state de A refusé');
select tests.login(21);
select is(tests.n('select 1 from public.companions'), 0::bigint, 'parent d''une autre famille: ne voit aucun compagnon');
select is(tests.n('select 1 from public.companion_energy'), 0::bigint, '…aucune énergie');
select throws_ok($$select public.companion_state(tests.u(201))$$, '42501', 'forbidden', '…companion_state refusé');
select throws_ok($$select public.companion_setup(tests.u(201), 'Intrus', 'kind')$$, '42501', 'forbidden', '…companion_setup refusé');
select tests.login(23);
select throws_ok($$select public.companion_state(tests.u(201))$$, '42501', 'forbidden', 'enfant d''une autre famille: companion_state refusé');
reset role;
set local role anon;
select throws_ok($$select public.companion_state(tests.u(201))$$, '42501', null, 'anon: companion_state refusé');
select throws_ok($$select * from public.companions$$, '42501', null, 'anon: pas de lecture');
reset role;

-- ═══ aucune écriture client directe ═══
select tests.login(11);
select throws_ok($$insert into public.companions (child_id, family_id, name, trait) values (tests.u(203), tests.u(2), 'X', 'kind')$$, '42501', null, 'parent: INSERT direct dans companions refusé');
select throws_ok($$update public.companions set name = 'Hack'$$, '42501', null, 'parent: UPDATE direct refusé');
select throws_ok($$delete from public.companions$$, '42501', null, 'parent: DELETE direct refusé');
select throws_ok($$insert into public.companion_energy (id, child_id, family_id, amount, reason, source_id) values (gen_random_uuid(), tests.u(201), tests.u(1), 999, 'task_checked', gen_random_uuid())$$, '42501', null, 'parent: INSERT direct d''énergie refusé');
select throws_ok($$update public.companion_energy set amount = 999$$, '42501', null, 'parent: UPDATE direct d''énergie refusé');
select throws_ok($$delete from public.companion_energy$$, '42501', null, 'parent: DELETE direct d''énergie refusé');
select tests.login(13);
select throws_ok($$insert into public.companion_energy (id, child_id, family_id, amount, reason, source_id) values (gen_random_uuid(), tests.u(201), tests.u(1), 999, 'task_checked', gen_random_uuid())$$, '42501', null, 'enfant: INSERT direct d''énergie refusé');
select throws_ok($$update public.companions set stage_offset = 1$$, '42501', null, 'enfant: UPDATE direct de companions refusé (RPC seulement)');
select throws_ok($$delete from public.companion_energy$$, '42501', null, 'enfant: DELETE direct d''énergie refusé');
reset role;

-- ═══ journal immuable, même pour le propriétaire de la base ═══
select throws_ok($$update public.companion_energy set amount = amount + 1$$, '42501', 'immutable_journal', 'journal: UPDATE interdit');
select throws_ok($$delete from public.companion_energy$$, '42501', 'immutable_journal', 'journal: DELETE interdit');
select throws_ok($$truncate public.companion_energy$$, '42501', 'immutable_journal', 'journal: TRUNCATE interdit');

-- ═══ suppression de la famille : les deux tables partent en cascade (delete_family() n'a pas été modifiée) ═══
select tests.login(11);
select lives_ok($$select public.delete_family()$$, 'le parent supprime sa famille (compagnons et énergie compris)');
reset role;
select is(tests.val('select count(*) from public.companions where family_id = ''' || tests.u(1) || ''''), '0', '…plus de compagnon');
select is(tests.val('select count(*) from public.companion_energy where family_id = ''' || tests.u(1) || ''''), '0', '…plus d''énergie');

select * from finish();
rollback;
