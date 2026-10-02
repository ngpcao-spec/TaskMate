-- M9 — préférences de notification (SPEC §3.9) + journal « tâche assignée » (push parent → enfant, §5.6).

create table public.notification_prefs (
  member_id uuid primary key references public.members (id),
  prefs jsonb not null default '{}'::jsonb check (jsonb_typeof(prefs) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
revoke all on public.notification_prefs from anon, authenticated;
grant select on public.notification_prefs to authenticated;
grant insert (member_id, prefs) on public.notification_prefs to authenticated;
grant update (prefs) on public.notification_prefs to authenticated;

-- chacun ne lit / n'écrit que SES préférences (le parent ne règle pas celles de l'enfant, et inversement)
create policy notification_prefs_select on public.notification_prefs for select to authenticated
  using (member_id = public.my_member_id());
create policy notification_prefs_insert on public.notification_prefs for insert to authenticated
  with check (member_id = public.my_member_id());
create policy notification_prefs_update on public.notification_prefs for update to authenticated
  using (member_id = public.my_member_id()) with check (member_id = public.my_member_id());

create trigger notification_prefs_updated_at before update on public.notification_prefs
  for each row execute function public.set_updated_at();

-- Une tâche créée par un PARENT pour un enfant est journalisée : l'Edge Function `send-push` notifie l'enfant
-- (et son téléphone replanifie ses rappels locaux à la prochaine synchro).
create function public.log_task_assigned() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.members where id = new.created_by and role = 'parent') then
    perform public.log_activity(new.family_id, new.child_id, new.created_by, 'task_assigned',
      jsonb_build_object('task_id', new.id, 'title', new.title, 'date', new.date));
  end if;
  return new;
end $$;
create trigger tasks_log_assigned after insert on public.tasks
  for each row execute function public.log_task_assigned();
