-- D-084 : écran « Ôn tập » (enfant et parent). Il faut deux informations que l'écran ne doit PAS recoder :
--   * max_points      = le maximum du barème (quiz_points_for(total, total)), lu de la MÊME fonction que le crédit (D-083) ;
--   * points_awarded  = ce que CE quiz a déjà rapporté à l'enfant (somme des crédits de ses tentatives, 0 si rien).
-- Aucune table, aucun droit nouveau : deux RPC existantes reçoivent deux colonnes de plus (mêmes règles d'accès qu'avant :
-- l'enfant ne lit que SES données, le parent seulement celles de SES enfants).

-- ───────────── enfant ─────────────
drop function public.child_catalog_quizzes();
create function public.child_catalog_quizzes()
returns table (quiz_id uuid, subject text, week_label text, title text, question_count int, evaluation_attempt_id uuid, evaluation_status public.quiz_attempt_status,
               can_start_evaluation boolean, paper_support boolean, answer_sheet_only boolean, due_on date, answered_count int, release_on date, score int, total int,
               max_points int, points_awarded int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members;
begin
  me := public.quiz_require_child();
  return query
  select f.quiz_id, f.subject, f.week_label, f.title, f.question_count, ev.id, ev.status,
         not exists (select 1 from public.quiz_attempts a where a.catalog_id = f.quiz_id and a.child_id = me.child_id),
         f.paper_support, f.answer_sheet_only, f.due_on,
         case when ev.status = 'in_progress' then (select count(*)::int from public.quiz_attempt_progress p where p.attempt_id = ev.id) else 0 end,
         f.release_on,
         case when ev.status = 'validated' then r.score end,
         case when ev.status = 'validated' then r.total end,
         public.quiz_points_for(1, 1),
         (select coalesce(sum(a.points_awarded), 0)::int from public.quiz_attempts a where a.catalog_id = f.quiz_id and a.child_id = me.child_id)
  from public.catalog_for_child(me.child_id) f
  left join lateral (select a.id, a.status from public.quiz_attempts a where a.catalog_id = f.quiz_id and a.child_id = me.child_id
                     order by a.started_at desc, a.id limit 1) ev on true
  left join public.quiz_results r on r.attempt_id = ev.id
  where f.available
  order by f.release_on desc, f.subject, f.week_label;
end $$;
revoke all on function public.child_catalog_quizzes() from public, anon;
grant execute on function public.child_catalog_quizzes() to authenticated;

-- ───────────── parent (SES enfants) ─────────────
drop function public.parent_catalog_overview(uuid);
create function public.parent_catalog_overview(p_child uuid)
returns table (quiz_id uuid, subject text, week_label text, title text, question_count int, release_on date, due_on date, available boolean,
               attempt_id uuid, attempt_status public.quiz_attempt_status, answered_count int, score int, total int, max_points int, points_awarded int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members;
begin
  me := public.quiz_require_parent();
  if not exists (select 1 from public.children where id = p_child and family_id = me.family_id and deleted_at is null) then
    raise exception 'child_not_found' using errcode = 'P0002';
  end if;
  return query
  select f.quiz_id, f.subject, f.week_label, f.title, f.question_count, f.release_on, f.due_on, f.available,
         ev.id, ev.status,
         case when ev.status = 'in_progress' then (select count(*)::int from public.quiz_attempt_progress p where p.attempt_id = ev.id) else 0 end,
         r.score, r.total,
         public.quiz_points_for(1, 1),
         (select coalesce(sum(a.points_awarded), 0)::int from public.quiz_attempts a where a.catalog_id = f.quiz_id and a.child_id = p_child and a.family_id = me.family_id)
  from public.catalog_for_child(p_child) f
  left join lateral (select a.id, a.status from public.quiz_attempts a where a.catalog_id = f.quiz_id and a.child_id = p_child and a.family_id = me.family_id
                     order by a.started_at desc, a.id limit 1) ev on true
  left join public.quiz_results r on r.attempt_id = ev.id
  order by f.release_on, f.subject, f.week_label;
end $$;
revoke all on function public.parent_catalog_overview(uuid) from public, anon;
grant execute on function public.parent_catalog_overview(uuid) to authenticated;
