-- D-099 : notifications planifiées (récap du soir, rappels des tâches). Aucune table nouvelle : on vérifie la fonction de sonnerie, ses droits (aucun
-- droit client), son innocuité sans secrets, et les tâches pg_cron quand l'extension existe.
begin;
create schema tests;
create function tests.u(n int) returns uuid language sql immutable
  as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
select * from no_plan();

select has_schema('private', 'schéma private présent');
select has_function('private', 'push_tick', array['text'], 'private.push_tick(text) existe');
select ok((select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'push_tick'), 'push_tick: security definer');

-- négatifs : aucun droit client, ni sur le schéma ni sur la fonction
select ok(not has_schema_privilege('anon', 'private', 'usage'), 'private: pas d''accès pour anon');
select ok(not has_schema_privilege('authenticated', 'private', 'usage'), 'private: pas d''accès pour les clients authentifiés');
select ok(not has_function_privilege('anon', 'private.push_tick(text)', 'execute'), 'push_tick: non exécutable par anon');
select ok(not has_function_privilege('authenticated', 'private.push_tick(text)', 'execute'), 'push_tick: non exécutable par les clients authentifiés');
set local role authenticated;
select throws_ok($$select private.push_tick('evening_recap')$$, '42501', null, 'push_tick: refusé à un client connecté');
reset role;
set local role anon;
select throws_ok($$select private.push_tick('task_reminders')$$, '42501', null, 'push_tick: refusé à anon');
reset role;

-- positif : sans secrets dans le coffre (ou sans coffre / pg_net), la sonnerie ne fait rien et ne lève pas d'erreur
select lives_ok($$select private.push_tick('evening_recap')$$, 'push_tick: inerte et sans erreur sans secrets');
select lives_ok($$select private.push_tick('task_reminders')$$, 'push_tick: idem pour les rappels');

-- rattrapage manuel : toujours refusé aux clients, structuré pour le propriétaire
select ok((select public.schedule_cron_jobs() ? 'ok'), 'schedule_cron_jobs: réponse structurée');

-- sur Supabase (pg_cron disponible), les quatre tâches existent ; ailleurs le test est vacuement vrai (`cron.job` n'existe pas : lecture dynamique)
create function tests.cron_value(q text) returns text language sql as
  $$ select (xpath('/row/v/text()', query_to_xml(q, true, true, '')))[1]::text $$;
select ok(
  not exists (select 1 from pg_available_extensions where name = 'pg_cron')
  or tests.cron_value($q$select count(*) as v from cron.job where jobname in ('expire-reward-requests', 'generate-recurrences', 'push-evening-recap', 'push-task-reminders')$q$) = '4',
  'pg_cron: tâches planifiées (expiration, récurrences, récap du soir, rappels) quand pg_cron existe');
select ok(
  not exists (select 1 from pg_available_extensions where name = 'pg_cron')
  or tests.cron_value($q$select schedule as v from cron.job where jobname = 'push-evening-recap'$q$) = '*/15 * * * *',
  'pg_cron: récap du soir toutes les 15 min');
select ok(
  not exists (select 1 from pg_available_extensions where name = 'pg_cron')
  or tests.cron_value($q$select schedule as v from cron.job where jobname = 'push-task-reminders'$q$) = '*/5 * * * *',
  'pg_cron: rappels toutes les 5 min');
select ok(
  not exists (select 1 from pg_available_extensions where name = 'pg_cron')
  or tests.cron_value($q$select command as v from cron.job where jobname = 'push-task-reminders'$q$) = 'select private.push_tick(''task_reminders'')',
  'pg_cron: les rappels appellent la sonnerie privée');

select * from finish();
rollback;
