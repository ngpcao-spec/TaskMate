-- D-099 — Notifications planifiées : récap du soir des parents et rappels « avant le début / l'échéance » des tâches de l'enfant.
--   * Deux tâches `pg_cron` appellent l'Edge Function `send-push` (même adresse et même secret partagé que le déclencheur d'activité, D-065, lus dans le
--     coffre Vault) : `evening_recap` toutes les 15 min, `task_reminders` toutes les 5 min. Tout le calcul (jour et heure LOCAUX de la famille, préférences,
--     destinataires) est dans la fonction ; la base ne fait que « sonner ».
--   * Tant que les secrets du coffre sont absents (CI, base locale) ou que `pg_net` / `pg_cron` manquent, RIEN ne se passe, et aucune erreur n'est remontée.
--   * Aucune table nouvelle : RLS inchangée. Aucun secret ici. La fonction vit dans le schéma `private` (non exposé par l'API : pas de droit client).
--   * `schedule_cron_jobs()` (rattrapage manuel, migration 10) planifie maintenant les quatre tâches.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.push_tick(p_type text) returns void
language plpgsql security definer set search_path = public, extensions, vault as $$
declare
  fn_url text;
  fn_secret text;
begin
  -- Une sonnerie ratée ne doit jamais faire échouer la tâche cron : toute erreur est avalée.
  begin
    select decrypted_secret into fn_url from vault.decrypted_secrets where name = 'push_webhook_url';
    select decrypted_secret into fn_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
    if fn_url is not null and fn_secret is not null then
      perform net.http_post(
        url := fn_url,
        body := jsonb_build_object('type', p_type),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', fn_secret),
        timeout_milliseconds := 30000
      );
    end if;
  exception when others then
    null;
  end;
end $$;
revoke all on function private.push_tick(text) from public, anon, authenticated;

-- Rattrapage manuel : les quatre tâches planifiées, idempotent.
create or replace function public.schedule_cron_jobs() returns jsonb
language plpgsql security definer set search_path = public as $$
declare scheduled text[] := '{}';
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    return jsonb_build_object('ok', false, 'reason', 'pg_cron_unavailable');
  end if;
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('expire-reward-requests', '0 * * * *', 'select public.expire_reward_requests()');
  perform cron.schedule('generate-recurrences', '5 * * * *', 'select public.generate_all_recurrences()');
  perform cron.schedule('push-evening-recap', '*/15 * * * *', $cmd$select private.push_tick('evening_recap')$cmd$);
  perform cron.schedule('push-task-reminders', '*/5 * * * *', $cmd$select private.push_tick('task_reminders')$cmd$);
  scheduled := array['expire-reward-requests', 'generate-recurrences', 'push-evening-recap', 'push-task-reminders'];
  return jsonb_build_object('ok', true, 'jobs', to_jsonb(scheduled));
end $$;
revoke all on function public.schedule_cron_jobs() from public, anon, authenticated;

-- Planification à l'application de la migration (non bloquant, comme les migrations 2 et 10).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('push-evening-recap', '*/15 * * * *', $cmd$select private.push_tick('evening_recap')$cmd$);
    perform cron.schedule('push-task-reminders', '*/5 * * * *', $cmd$select private.push_tick('task_reminders')$cmd$);
  end if;
exception when others then
  raise warning 'pg_cron : planification des notifications ignorée (%)', sqlerrm;
end $$;
