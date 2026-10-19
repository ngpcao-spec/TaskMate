-- D-089 : le PARENT consulte un quiz du catalogue de SON enfant depuis « Ôn tập · {enfant} » (questions, bonnes réponses, explications, réponses de l'enfant).
--   * Une seule RPC de lecture, `parent_quiz_detail(p_child, p_catalog)`, `security definer`, parent de la famille de l'enfant SEULEMENT. Le quiz doit être réellement
--     attribuable à CET enfant (publié, pays + classe, matière activée, mise à disposition décalée <= jour LOCAL de la famille : `catalog_for_child` … `available`) ;
--     tout autre cas lève `forbidden` (42501), sans dire si le quiz existe. Aucun droit direct sur les tables de clés : le client ne lit que ce que renvoie la RPC.
--   * Choix dans l'ORDRE D'ORIGINE du catalogue. La réponse de l'enfant est rendue en indice d'ORIGINE :
--       - tentative envoyée / validée : `quiz_answers.choice_index` est déjà l'indice d'origine (converti à l'envoi par `submit_quiz_evaluation`) ;
--       - tentative EN COURS : `quiz_attempt_progress.choice` est la position AFFICHÉE à l'enfant ; on la convertit ici avec la disposition mélangée de la tentative
--         (`quiz_attempt_layouts`), exactement comme l'envoi, pour ne jamais présenter une mauvaise réponse.
--   * Lecture seule : aucune écriture, aucune modification des RPC enfant ; l'enfant n'a aucun accès à cette fonction (D-052, clé réservée au parent).
create function public.parent_quiz_detail(p_child uuid, p_catalog uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me public.members; f record; z public.catalog_quizzes; a public.quiz_attempts; r public.quiz_results; lay jsonb; items jsonb; answered int := 0; att jsonb := null;
begin
  me := public.quiz_require_parent();
  if not exists (select 1 from public.children c where c.id = p_child and c.family_id = me.family_id and c.deleted_at is null) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into f from public.catalog_for_child(p_child) x where x.quiz_id = p_catalog and x.available;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into z from public.catalog_quizzes where id = p_catalog;

  select * into a from public.quiz_attempts
   where catalog_id = p_catalog and child_id = p_child and family_id = me.family_id
   order by started_at desc, id limit 1;
  if found then
    select * into r from public.quiz_results where attempt_id = a.id;
    select l.layout into lay from public.quiz_attempt_layouts l where l.attempt_id = a.id;
    answered := case when a.status = 'in_progress'
                     then (select count(*)::int from public.quiz_attempt_progress p where p.attempt_id = a.id)
                     else (select count(*)::int from public.quiz_answers x where x.attempt_id = a.id and x.choice_index is not null) end;
    att := jsonb_build_object('id', a.id, 'status', a.status, 'answered', answered, 'started_at', a.started_at, 'submitted_at', a.submitted_at, 'validated_at', a.validated_at,
                              'show_correction', a.show_correction, 'score', r.score, 'total', r.total, 'points_awarded', a.points_awarded);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'question_id', q.id, 'position', q.position, 'number', q.origin_number, 'needs_figure', q.needs_figure, 'prompt', q.prompt, 'choices', to_jsonb(q.choices),
           'correct_index', k.correct_index, 'explanation', k.explanation, 'to_verify', k.to_verify, 'confirmed', k.confirmed,
           'choice_index', case when a.status in ('submitted', 'validated') then ans.choice_index
                                when a.status = 'in_progress' and pr.choice is not null then (lay->'choices'->(q.id::text)->>(pr.choice::int))::int end,
           'is_correct', case when a.status in ('submitted', 'validated') then coalesce(ans.is_correct, false) end)
         order by q.position, q.id), '[]'::jsonb)
    into items
  from public.catalog_questions q
  join public.catalog_answer_keys k on k.question_id = q.id
  left join public.quiz_answers ans on ans.attempt_id = a.id and ans.question_id = q.id
  left join public.quiz_attempt_progress pr on pr.attempt_id = a.id and pr.question_id = q.id
  where q.quiz_id = p_catalog;

  return jsonb_build_object(
    'quiz', jsonb_build_object('id', z.id, 'subject', z.subject, 'week_label', z.week_label, 'title', z.title, 'release_on', f.release_on, 'due_on', f.due_on,
                               'material_kind', z.material_kind, 'paper_support', z.paper_support, 'answer_sheet_only', z.answer_sheet_only,
                               'question_count', f.question_count, 'max_points', public.quiz_points_for(1, 1)),
    'attempt', att,
    'questions', items);
end $$;
revoke all on function public.parent_quiz_detail(uuid, uuid) from public, anon;
grant execute on function public.parent_quiz_detail(uuid, uuid) to authenticated;
