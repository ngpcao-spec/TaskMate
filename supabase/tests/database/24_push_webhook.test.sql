-- D-065 : le déclencheur push sur `activity_log` ne doit JAMAIS empêcher l'enregistrement d'une activité (secret absent, coffre ou pg_net
-- indisponibles) et n'est exécutable par aucun client. Fixtures : famille 1 = parent 11 ; famille 2 = parent 21.
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

insert into auth.users (id, email, is_anonymous) values (tests.u(11), 'p1@test', false), (tests.u(21), 'pb@test', false);
insert into public.families (id, name) values (tests.u(1), 'A'), (tests.u(2), 'B');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'PB');
select * from no_plan();

select has_function('public', 'push_on_activity', 'la fonction du déclencheur existe');
select is((select prosecdef from pg_proc where oid = 'public.push_on_activity()'::regprocedure), true, 'security definer (lit le coffre)');
select is((select count(*)::int from pg_trigger where tgname = 'activity_log_push' and tgrelid = 'public.activity_log'::regclass and not tgisinternal), 1, 'un seul déclencheur sur activity_log');
select is((select tgtype & 1 from pg_trigger where tgname = 'activity_log_push'), 1, 'déclencheur par ligne');
select is((select tgtype & 4 from pg_trigger where tgname = 'activity_log_push'), 4, 'sur INSERT');
select ok(not has_function_privilege('anon', 'public.push_on_activity()', 'execute'), 'anon : aucun droit d''exécution');
select ok(not has_function_privilege('authenticated', 'public.push_on_activity()', 'execute'), 'authenticated : aucun droit d''exécution');

-- sans secret dans le coffre (ou sans coffre / pg_net) : l'activité s'enregistre quand même
select lives_ok($$insert into public.activity_log (family_id, type, payload) values (tests.u(1), 'task_assigned', '{"title":"x"}'::jsonb)$$, 'insertion d''activité sans secret push : OK');
select is((select count(*)::int from public.activity_log where family_id = tests.u(1)), 1, '…et la ligne existe');
select lives_ok($$insert into public.activity_log (family_id, type, payload) values (tests.u(2), 'goal_achieved', '{}'::jsonb)$$, 'autre famille : OK aussi');

-- aucun client ne peut appeler la fonction directement
select tests.login(11);
select throws_ok($$select public.push_on_activity()$$, '42501', null, 'parent : appel direct refusé');
reset role;
set local role anon;
select throws_ok($$select public.push_on_activity()$$, '42501', null, 'anon : appel direct refusé');

select * from finish();
rollback;
