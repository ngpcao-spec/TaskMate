-- D-065 — Notifications push : chaque ligne de `activity_log` déclenche la fonction `send-push` (SPEC §5.6).
-- Équivalent d'un « Database Webhook » du tableau de bord, mais versionné. AUCUN secret ici : l'adresse de la fonction et le secret
-- partagé sont lus dans le coffre (Vault) sous `push_webhook_url` et `push_webhook_secret`. Tant qu'ils sont absents (CI, base locale),
-- le déclencheur ne fait RIEN. Aucune table nouvelle : RLS inchangée. Idempotent (rejouable).

-- `pg_net` existe sur Supabase ; une base PostgreSQL nue (tests locaux sans Docker, D-002) ne l'a pas : le déclencheur reste alors inerte.
do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net indisponible : le déclencheur push restera inerte (%)', sqlerrm;
end $$;

create or replace function public.push_on_activity() returns trigger
language plpgsql security definer set search_path = public, extensions, vault as $$
declare
  fn_url text;
  fn_secret text;
begin
  -- Une notification ne doit JAMAIS empêcher l'enregistrement de l'activité (ni la tâche, ni la validation) : toute erreur est avalée.
  begin
    select decrypted_secret into fn_url from vault.decrypted_secrets where name = 'push_webhook_url';
    select decrypted_secret into fn_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
    if fn_url is not null and fn_secret is not null then
      perform net.http_post(
        url := fn_url,
        body := jsonb_build_object('type', 'INSERT', 'table', 'activity_log', 'schema', 'public', 'record', to_jsonb(new)),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', fn_secret),
        timeout_milliseconds := 5000
      );
    end if;
  exception when others then
    null;
  end;
  return new;
end $$;

revoke all on function public.push_on_activity() from public, anon, authenticated;

drop trigger if exists activity_log_push on public.activity_log;
create trigger activity_log_push after insert on public.activity_log
  for each row execute function public.push_on_activity();
