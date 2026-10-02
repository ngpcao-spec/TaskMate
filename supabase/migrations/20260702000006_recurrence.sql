-- M10 — Récurrence côté serveur (SPEC §5.3) : occurrences matérialisées sur 14 jours glissants.
-- Générées par pg_cron (idempotent) et à chaque création/modification d'une récurrence ; l'unicité
-- (recurrence_id, date) empêche tout doublon, y compris si deux exécutions se chevauchent.

alter table public.recurrences
  add constraint recurrences_weekdays_required
  check (rule <> 'weekdays' or (weekdays is not null and cardinality(weekdays) > 0));

-- Les occurrences générées par le système ne déclenchent PAS de push « tâche assignée » (une par jour = spam).
create or replace function public.log_task_assigned() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.recurrence_id is null
     and exists (select 1 from public.members where id = new.created_by and role = 'parent') then
    perform public.log_activity(new.family_id, new.child_id, new.created_by, 'task_assigned',
      jsonb_build_object('task_id', new.id, 'title', new.title, 'date', new.date));
  end if;
  return new;
end $$;

-- Jour local de la famille (jamais dérivé de l'UTC, §6.1).
create function public.family_today(p_family uuid, p_now timestamptz default now()) returns date
language sql stable security definer set search_path = public as $$
  select (p_now at time zone f.timezone)::date from public.families f where f.id = p_family
$$;
revoke all on function public.family_today(uuid, timestamptz) from public, anon, authenticated;

create function public.recurrence_matches(r public.recurrences, p_day date) returns boolean
language sql immutable as $$
  select p_day >= r.starts_on
     and (r.ends_on is null or p_day <= r.ends_on)
     and (r.rule = 'daily' or extract(isodow from p_day)::int = any (r.weekdays))
$$;
revoke all on function public.recurrence_matches(public.recurrences, date) from public, anon, authenticated;

-- Matérialise les occurrences manquantes d'UNE récurrence sur les 14 prochains jours (aujourd'hui inclus).
create function public.generate_recurrence(p_recurrence uuid, p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare r public.recurrences; d date; today date; n int := 0; inserted int;
begin
  select * into r from public.recurrences where id = p_recurrence and deleted_at is null;
  if not found then return 0; end if;
  today := public.family_today(r.family_id, p_now);
  for d in select g::date from generate_series(today, today + 13, interval '1 day') g loop
    if public.recurrence_matches(r, d) then
      insert into public.tasks (family_id, child_id, title, category, note, date, time_kind, start_time, end_time,
                                points, recurrence_id, created_by)
      values (r.family_id, r.child_id, r.title, r.category, r.note, d, r.time_kind, r.start_time, r.end_time,
              r.points, r.id, r.created_by)
      on conflict (recurrence_id, date) do nothing;
      get diagnostics inserted = row_count;
      n := n + inserted;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.generate_recurrence(uuid, timestamptz) from public, anon, authenticated;

create function public.generate_all_recurrences(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare rid uuid; total int := 0;
begin
  for rid in select id from public.recurrences where deleted_at is null loop
    total := total + public.generate_recurrence(rid, p_now);
  end loop;
  return total;
end $$;
revoke all on function public.generate_all_recurrences(timestamptz) from public, anon, authenticated;

-- Modifier / supprimer une récurrence met à jour les occurrences FUTURES NON FAITES ; le passé et le fait sont intacts.
create function public.sync_recurrence(p_recurrence uuid, p_now timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
declare r public.recurrences; today date;
begin
  select * into r from public.recurrences where id = p_recurrence;
  if not found then return; end if;
  today := public.family_today(r.family_id, p_now);

  -- 1) retire les occurrences futures non faites qui ne correspondent plus (jour retiré, fin atteinte, série supprimée)
  update public.tasks t set deleted_at = now()
  where t.recurrence_id = r.id and t.deleted_at is null and t.completed_at is null and t.date >= today
    and (r.deleted_at is not null or not public.recurrence_matches(r, t.date));

  if r.deleted_at is null then
    -- 2) aligne les occurrences futures non faites restantes
    update public.tasks t
    set title = r.title, category = r.category, note = r.note, time_kind = r.time_kind,
        start_time = r.start_time, end_time = r.end_time, points = r.points
    where t.recurrence_id = r.id and t.deleted_at is null and t.completed_at is null and t.date >= today;
    -- 3) crée celles qui manquent (jour ajouté, début reculé…)
    perform public.generate_recurrence(r.id, p_now);
  end if;
end $$;
revoke all on function public.sync_recurrence(uuid, timestamptz) from public, anon, authenticated;

create function public.recurrences_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_recurrence(new.id);
  return null;
end $$;
create trigger recurrences_sync after insert or update on public.recurrences
  for each row execute function public.recurrences_after_write();

-- pg_cron : exécution horaire (idempotente → couvre tous les fuseaux ; équivalent « minuit local » du §5.3).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('generate-recurrences', '5 * * * *', 'select public.generate_all_recurrences()');
  end if;
end $$;
