-- D-086 : consulter les semaines FUTURES dans l'écran « Ôn tập ». `catalog_for_child` ne renvoie que ce qui est déjà ouvert ; ce qui ne l'est pas
-- encore doit pouvoir s'afficher en carte grisée (« Sắp mở »), mais SANS jamais rien révéler du contenu.
--
-- `catalog_upcoming_for_child(p_child)` : MÉTADONNÉES SEULES des quiz publiés qui correspondent à la classe et aux matières activées de l'enfant
-- (même règle que `catalog_for_child`, moins le filtre « déjà ouvert »). Colonnes : quiz, matière, semaine, titre, ouverture et échéance EFFECTIVES
-- (décalage de l'enfant 7 × week_offset appliqué, jours locaux de la famille), maximum du barème. Jamais de question, de choix, de réponse, de
-- corrigé, de signalement ni de nombre de questions. Les tables du catalogue restent fermées (aucun droit client) : tout passe par cette fonction.
--   * famille et enfant viennent de l'identité de l'appelant (`require_member`) ;
--   * enfant : SES quiz seulement (un autre identifiant = `child_not_found`), et au plus jusqu'à la semaine SUIVANTE (échéance au plus tard le
--     dimanche de la semaine prochaine, jour local de la famille) ;
--   * parent : un enfant de SA famille obligatoire (`child_not_found` sinon), jusqu'à la dernière semaine publiée.
create function public.catalog_upcoming_for_child(p_child uuid default null)
returns table (quiz_id uuid, subject text, week_label text, title text, release_on date, due_on date, max_points int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members; target uuid; today date; cap date;
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
  -- dernier jour visible par un enfant : le dimanche de la semaine suivante (semaines lundi → dimanche, comme l'écran)
  cap := (date_trunc('week', today::timestamp)::date) + 13;
  return query
  select f.quiz_id, f.subject, f.week_label, f.title, f.release_on, f.due_on, public.quiz_points_for(1, 1)
  from public.catalog_for_child(target) f
  where not f.available
    and (me.role = 'parent' or f.due_on <= cap)
  order by f.release_on, f.subject, f.week_label;
end $$;
revoke all on function public.catalog_upcoming_for_child(uuid) from public, anon;
grant execute on function public.catalog_upcoming_for_child(uuid) to authenticated;
