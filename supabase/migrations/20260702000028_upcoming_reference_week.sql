-- D-087 : correctif de `catalog_upcoming_for_child` (D-086). Le plafond de l'enfant (« une semaine d'avance ») était compté depuis la semaine CALENDAIRE
-- du jour. Or un quiz ouvert le week-end pour l'échéance de la semaine d'après fait déjà de cette semaine-là la semaine EN COURS pour l'enfant
-- (« Tuần 7 », 19–25/10, vue le dimanche 18/10) : la semaine suivante pour lui (26/10 – 01/11) restait hors d'atteinte.
-- Référence = la plus tardive des deux : semaine du jour local, semaine de l'échéance du dernier quiz DÉJÀ OUVERT de l'enfant. Plafond = le dimanche
-- de la semaine qui suit cette référence. Toujours métadonnées seules ; parent : toujours jusqu'à la dernière semaine publiée.
create or replace function public.catalog_upcoming_for_child(p_child uuid default null)
returns table (quiz_id uuid, subject text, week_label text, title text, release_on date, due_on date, max_points int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members; target uuid; today date; ref date; cap date;
begin
  me := public.require_member();
  if me.role = 'child' then
    if me.child_id is null or (p_child is not null and p_child <> me.child_id) then
      raise exception 'child_not_found' using errcode = 'P0002';
    end if;
    target := me.child_id;
  else
    if p_child is null or not exists (select 1 from public.children where id = p_child and family_id = me.family_id and deleted_at is null) then
      raise exception 'child_not_found' using errcode = 'P0002';
    end if;
    target := p_child;
  end if;
  today := public.family_today(me.family_id);
  select greatest(today, coalesce(max(f.due_on), today)) into ref from public.catalog_for_child(target) f where f.available;
  -- dernier jour visible par un enfant : le dimanche de la semaine qui suit la semaine de référence (semaines lundi → dimanche, comme l'écran)
  cap := (date_trunc('week', ref::timestamp)::date) + 13;
  return query
  select f.quiz_id, f.subject, f.week_label, f.title, f.release_on, f.due_on, public.quiz_points_for(1, 1)
  from public.catalog_for_child(target) f
  where not f.available
    and (me.role = 'parent' or f.due_on <= cap)
  order by f.release_on, f.subject, f.week_label;
end $$;
revoke all on function public.catalog_upcoming_for_child(uuid) from public, anon;
grant execute on function public.catalog_upcoming_for_child(uuid) to authenticated;
