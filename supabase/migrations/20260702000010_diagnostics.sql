-- Production Supabase cloud — outils d'exploitation (aucune nouvelle table, donc pas de nouvelle RLS à écrire).
--  1. `schedule_cron_jobs()` : (re)planifie les deux tâches pg_cron, idempotent ; à lancer depuis l'éditeur SQL si l'extension
--     a été activée après les migrations. Réservée aux rôles de la base (jamais aux clients).
--  2. `diagnostics()` : état du serveur pour l'écran Réglages → Diagnostic (parents uniquement). Ne renvoie que des NOMS
--     (tables, fonctions, extensions, tâches cron), jamais de données.

create function public.schedule_cron_jobs() returns jsonb
language plpgsql security definer set search_path = public as $$
declare scheduled text[] := '{}';
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    return jsonb_build_object('ok', false, 'reason', 'pg_cron_unavailable');
  end if;
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('expire-reward-requests', '0 * * * *', 'select public.expire_reward_requests()');
  perform cron.schedule('generate-recurrences', '5 * * * *', 'select public.generate_all_recurrences()');
  scheduled := array['expire-reward-requests', 'generate-recurrences'];
  return jsonb_build_object('ok', true, 'jobs', to_jsonb(scheduled));
end $$;
revoke all on function public.schedule_cron_jobs() from public, anon, authenticated;

create function public.diagnostics() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.members;
  v_tables text[];
  v_no_rls text[];
  v_functions text[];
  v_realtime text[];
  v_extensions text[];
  v_cron text[];
begin
  me := public.require_member();
  if me.role <> 'parent' then raise exception 'forbidden' using errcode = '42501'; end if;

  select coalesce(array_agg(c.relname order by c.relname), '{}') into v_tables
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p');

  select coalesce(array_agg(c.relname order by c.relname), '{}') into v_no_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;

  select coalesce(array_agg(distinct p.proname order by p.proname), '{}') into v_functions
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f';

  select coalesce(array_agg(tablename order by tablename), '{}') into v_realtime
  from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public';

  select coalesce(array_agg(extname order by extname), '{}') into v_extensions from pg_extension;

  -- pg_cron : absent, ou table des tâches illisible pour ce rôle → null (« inconnu »), jamais une erreur
  begin
    if to_regclass('cron.job') is not null then
      execute 'select coalesce(array_agg(jobname order by jobname), ''{}'') from cron.job' into v_cron;
    end if;
  exception when others then
    v_cron := null;
  end;

  return jsonb_build_object(
    'tables', to_jsonb(v_tables),
    'tables_without_rls', to_jsonb(v_no_rls),
    'functions', to_jsonb(v_functions),
    'realtime_tables', to_jsonb(v_realtime),
    'extensions', to_jsonb(v_extensions),
    'cron_jobs', case when v_cron is null then null else to_jsonb(v_cron) end
  );
end $$;
revoke all on function public.diagnostics() from public, anon;
grant execute on function public.diagnostics() to authenticated;
