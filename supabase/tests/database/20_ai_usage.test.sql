-- D-057 : quota et journal d'usage de l'IA (aucun contenu), autorisation de l'appelant, brouillon généré enregistré d'un bloc.
-- Fixtures : famille 1 = parent 11, enfant A (user 13, profil 201), enfant B (user 14, profil 202) ; famille 2 = parent 21, enfant C (221).
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
create function tests.n(q text) returns bigint language plpgsql as $$
declare c bigint;
begin
  execute q;
  get diagnostics c = row_count;
  return c;
end $$;
grant execute on all functions in schema tests to authenticated, anon, service_role;

insert into auth.users (id, email, is_anonymous) values (tests.u(11), 'p1@test', false), (tests.u(13), null, false), (tests.u(14), null, false), (tests.u(21), 'pb@test', false);
insert into public.families (id, name, timezone) values (tests.u(1), 'A', 'Asia/Ho_Chi_Minh'), (tests.u(2), 'B', 'Asia/Ho_Chi_Minh');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2009-03-01'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01'), (tests.u(221), tests.u(2), 'Cam', '2012-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'),
  (tests.u(114), tests.u(1), tests.u(14), 'child', tests.u(202), 'Khang'), (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'Cha B');
select * from no_plan();

select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'ai_usage' and c.relrowsecurity), 1, 'ai_usage a la RLS');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'ai_usage' and column_name ~ '(content|text|document|prompt|file|body)'), 0, 'ai_usage ne contient AUCUNE colonne de contenu');

-- ───────────── ai_target : autorisation de l'appelant ─────────────
select tests.login(11);
select is(((public.ai_target())->>'timezone'), 'Asia/Ho_Chi_Minh', 'parent: ai_target sans enfant → famille et fuseau');
select is(((public.ai_target(tests.u(201)))->>'child_name'), 'Minh', 'parent: ai_target pour son enfant');
select throws_ok($$select public.ai_target(tests.u(221))$$, 'P0002', 'child_not_found', 'parent: pas l''enfant d''une autre famille');
select tests.login(13);
select throws_ok($$select public.ai_target()$$, '42501', 'forbidden', 'enfant: refusé');
select tests.login(21);
select throws_ok($$select public.ai_target(tests.u(201))$$, 'P0002', 'child_not_found', 'autre famille: refusé');

-- ───────────── les RPC de quota ne sont pas appelables par un client ─────────────
select tests.login(11);
select throws_ok($$select * from public.ai_reserve(tests.u(1), tests.u(111), 20)$$, '42501', null, 'client: ai_reserve interdit');
select throws_ok($$select public.ai_finish(tests.u(900), 'success', null, 'm', 1, 1)$$, '42501', null, 'client: ai_finish interdit');
select throws_ok($$select public.ai_usage_today(tests.u(1))$$, '42501', null, 'client: ai_usage_today interdit');
select throws_ok($$insert into public.ai_usage (family_id, member_id, day) values (tests.u(1), tests.u(111), current_date)$$, '42501', null, 'client: aucune écriture directe dans ai_usage');

-- ───────────── quota (clé service) : atomique, par famille, jour LOCAL ─────────────
reset role;
set local role service_role;
-- 02:00 le 2 juillet à Hô Chi Minh (= 1er juillet 19:00 UTC)
select is((select allowed from public.ai_reserve(tests.u(1), tests.u(111), 2, timestamptz '2026-07-01 19:00:00+00')), true, 'quota: 1re réservation autorisée');
select is((select used from public.ai_reserve(tests.u(1), tests.u(111), 2, timestamptz '2026-07-01 19:30:00+00')), 2, 'quota: 2e autorisée (2 utilisées)');
select is((select allowed from public.ai_reserve(tests.u(1), tests.u(111), 2, timestamptz '2026-07-01 20:00:00+00')), false, 'quota: 3e REFUSÉE (limite 2)');
select is((select used from public.ai_reserve(tests.u(1), tests.u(111), 2, timestamptz '2026-07-01 20:00:00+00')), 2, 'quota: …sans rien consommer de plus');
select is((select count(*)::int from public.ai_usage where family_id = tests.u(1)), 2, 'le refus n''écrit aucune ligne');
select is((select allowed from public.ai_reserve(tests.u(2), tests.u(121), 2, timestamptz '2026-07-01 20:00:00+00')), true, 'quota: indépendant par famille');
-- 16:59 UTC le 2 juillet = 23:59 le jeudi à Hô Chi Minh : même jour local, toujours refusé ; 17:00 UTC = minuit local → nouveau jour
select is((select allowed from public.ai_reserve(tests.u(1), tests.u(111), 2, timestamptz '2026-07-02 16:59:00+00')), false, 'quota: 23:59 locale = même jour local, toujours refusé');
select is((select allowed from public.ai_reserve(tests.u(1), tests.u(111), 2, timestamptz '2026-07-02 17:00:00+00')), true, 'quota: minuit LOCAL → nouveau jour, autorisé (pas minuit UTC)');
select is(public.ai_usage_today(tests.u(1), timestamptz '2026-07-02 17:30:00+00'), 1, 'ai_usage_today: 1 le nouveau jour');
select is(public.ai_usage_today(tests.u(1), timestamptz '2026-07-01 19:00:00+00'), 2, 'ai_usage_today: 2 le jour précédent');
select is((select min(day) from public.ai_usage where family_id = tests.u(1)), date '2026-07-02', 'le jour enregistré est le jour LOCAL (2 juillet, pas le 1er UTC)');

-- finish : statut, jetons, aucun contenu
select lives_ok($$select public.ai_finish((select id from public.ai_usage where family_id = tests.u(1) order by created_at, id limit 1), 'success', null, 'claude-sonnet-5-5', 1200, 800)$$, 'ai_finish: succès');
select is((select input_tokens from public.ai_usage where family_id = tests.u(1) and status = 'success'), 1200, 'jetons d''entrée enregistrés');
select lives_ok($$select public.ai_finish((select id from public.ai_usage where family_id = tests.u(1) and status = 'started' order by created_at, id limit 1), 'failed', 'invalid_output', 'claude-sonnet-5-5', 900, 50)$$, 'ai_finish: échec');
select is((select failure from public.ai_usage where status = 'failed' and family_id = tests.u(1)), 'invalid_output', 'code d''échec enregistré');
select throws_ok($$select public.ai_finish(tests.u(900), 'started', null, 'm', 1, 1)$$, 'P0001', 'invalid_status', 'statut invalide refusé');

-- ───────────── lecture : parents de la famille seulement ─────────────
select tests.login(11);
select is(tests.n('select 1 from public.ai_usage'), 3::bigint, 'parent: voit l''usage de SA famille (3 lignes)');
select tests.login(13);
select is(tests.n('select 1 from public.ai_usage'), 0::bigint, 'enfant: ne voit aucun usage');
select tests.login(21);
select is(tests.n('select 1 from public.ai_usage'), 1::bigint, 'autre famille: voit seulement le sien');
reset role;
set local role anon;
select throws_ok($$select 1 from public.ai_usage$$, '42501', null, 'anon: aucun accès');

-- ───────────── create_quiz_draft ─────────────
select tests.login(11);
select lives_ok($$select public.create_quiz_draft(tests.u(701), tests.u(201), 'Fractions (IA)', 'Toán', '[
  {"prompt":"1/2 + 1/4 ?","choices":["1/6","3/4","2/6"],"correct":1,"explanation":"Même dénominateur"},
  {"prompt":"0,5 = ?","choices":["1/2","1/3","1/4","2/3"],"correct":0,"explanation":null}]'::jsonb)$$, 'parent: enregistre un jeu généré');
select is((select status::text from public.quiz_sets where id = tests.u(701)), 'draft', 'le jeu généré est un BROUILLON');
select is((select count(*)::int from public.quiz_questions where set_id = tests.u(701)), 2, '2 questions');
select is((select count(*)::int from public.quiz_answer_keys k join public.quiz_questions q on q.id = k.question_id where q.set_id = tests.u(701)), 2, '2 clés');
select is((select array_agg(position order by position) from public.quiz_questions where set_id = tests.u(701)), array[0, 1], 'positions dans l''ordre');
select lives_ok($$select public.create_quiz_draft(tests.u(701), tests.u(201), 'Autre titre', null, '[{"prompt":"x","choices":["a","b","c"],"correct":0}]'::jsonb)$$, 'rejeu : idempotent');
select is((select count(*)::int from public.quiz_questions where set_id = tests.u(701)), 2, '…sans doublon');
select throws_ok($$select public.create_quiz_draft(tests.u(702), tests.u(201), 't', null, '[{"prompt":"x","choices":["a","b"],"correct":0}]'::jsonb)$$, 'P0001', 'invalid_choices', '2 choix refusés');
select throws_ok($$select public.create_quiz_draft(tests.u(702), tests.u(201), 't', null, '[{"prompt":"x","choices":["a","b","c"],"correct":3}]'::jsonb)$$, 'P0001', 'invalid_correct', 'bonne réponse hors plage refusée');
select throws_ok($$select public.create_quiz_draft(tests.u(702), tests.u(201), 't', null, '[{"prompt":"x","choices":["a","A","c"],"correct":0}]'::jsonb)$$, 'P0001', 'duplicate_choices', 'choix en double refusés');
select throws_ok($$select public.create_quiz_draft(tests.u(702), tests.u(201), 't', null, '[]'::jsonb)$$, 'P0001', 'invalid_question', 'aucune question refusé');
select throws_ok($$select public.create_quiz_draft(tests.u(702), tests.u(201), '  ', null, '[{"prompt":"x","choices":["a","b","c"],"correct":0}]'::jsonb)$$, 'P0001', 'invalid_title', 'titre vide refusé');
select throws_ok($$select public.create_quiz_draft(tests.u(702), tests.u(201), 't', null, '[{"prompt":"x","choices":["a","b","c"],"correct":"0"}]'::jsonb)$$, 'P0001', 'invalid_question', 'type invalide refusé');
select is((select count(*)::int from public.quiz_sets where id = tests.u(702)), 0, 'un rejet n''enregistre rien (aucun jeu à moitié créé)');
select throws_ok($$select public.create_quiz_draft(tests.u(703), tests.u(221), 't', null, '[{"prompt":"x","choices":["a","b","c"],"correct":0}]'::jsonb)$$, 'P0002', 'child_not_found', 'pas pour l''enfant d''une autre famille');
select tests.login(13);
select throws_ok($$select public.create_quiz_draft(tests.u(704), tests.u(201), 't', null, '[{"prompt":"x","choices":["a","b","c"],"correct":0}]'::jsonb)$$, '42501', 'forbidden', 'enfant: ne crée pas de jeu');
select is(tests.n('select 1 from public.quiz_sets'), 0::bigint, 'enfant A: ne voit pas le brouillon généré');
select tests.login(14);
select is(tests.n('select 1 from public.quiz_sets'), 0::bigint, 'enfant B: non plus');
select tests.login(21);
select throws_ok($$select public.create_quiz_draft(tests.u(701), tests.u(221), 't', null, '[{"prompt":"x","choices":["a","b","c"],"correct":0}]'::jsonb)$$, '42501', 'forbidden', 'autre famille: ne réutilise pas l''id d''un jeu');

-- ───────────── suppression de la famille ─────────────
select lives_ok($$select public.delete_family()$$, 'autre famille: supprime sa famille');
reset role;
select is((select count(*)::int from public.ai_usage where family_id = tests.u(2)), 0, 'delete_family: journal d''usage purgé');
select is((select count(*)::int from public.ai_usage where family_id = tests.u(1)), 3, 'delete_family: la famille A est intacte');

select * from finish();
rollback;
