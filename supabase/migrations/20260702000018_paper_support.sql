-- « Révisions : supports multiples », PR 2/2 — côté enfant (D-062). L'enfant lit souvent le support sur PAPIER et répond sur son téléphone.
--
--  * `quiz_sets.paper_support` : jeu « support papier » (types examen par défaut, corrigeable par le parent) ;
--    `quiz_sets.answer_sheet_only` : « feuille de réponses seule » (numéros et lettres uniquement, jamais d'énoncé ni de texte de choix).
--  * Un jeu papier n'est JAMAIS mélangé : les lettres doivent rester celles de la feuille imprimée et les questions suivent les numéros d'origine
--    (le mélange de D-059 reste en vigueur pour les autres jeux). Décidé par le serveur au démarrage de la tentative (`quiz_make_layout`).
--  * RPC enfant : numéro d'origine et « dépend d'une figure » deviennent visibles (jamais « à vérifier » ni « confirmée », qui restent dans la table
--    de la clé, illisible par l'enfant). En mode « feuille seule », le SERVEUR n'envoie que des lettres (énoncé vide, choix = A, B, C…), y compris
--    dans le résultat : aucun texte du support ne transite, même si l'application était modifiée.
--  * Aucune table nouvelle : RLS inchangée (l'enfant ne lit que SES jeux publiés ; questions et clés restent réservées au parent).

alter table public.quiz_sets
  add column paper_support boolean not null default false,
  add column answer_sheet_only boolean not null default false,
  add constraint quiz_sets_sheet_needs_paper check (not answer_sheet_only or paper_support);

-- Valeur par défaut portée par le type : un type examen est un support papier ; on la rejoue quand le TYPE change (création, correction du type).
create function public.quiz_sets_paper_default() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.material_kind is distinct from old.material_kind then
    new.paper_support := new.material_kind in ('exam', 'exam_key');
    new.answer_sheet_only := false;
  end if;
  return new;
end $$;
create trigger quiz_sets_paper_default before insert or update of material_kind on public.quiz_sets
  for each row execute function public.quiz_sets_paper_default();

-- brouillons existants de type examen : même valeur par défaut (les jeux publiés ne changent pas)
update public.quiz_sets set paper_support = true where status = 'draft' and material_kind in ('exam', 'exam_key');

-- ───────────────────────── RPC parent ─────────────────────────
-- Réglage « support papier » / « feuille seule » (brouillon sans tentative, comme le type).
create function public.set_quiz_paper_support(p_set uuid, p_paper boolean, p_sheet_only boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; s public.quiz_sets;
begin
  me := public.quiz_require_parent();
  s := public.quiz_editable_set(p_set, me.family_id);
  if p_paper is null or p_sheet_only is null or (p_sheet_only and not p_paper) then
    raise exception 'invalid_paper' using errcode = 'P0001';
  end if;
  update public.quiz_sets set paper_support = p_paper, answer_sheet_only = p_sheet_only where id = s.id;
end $$;

-- Copie : reprend aussi le réglage papier (le trigger de type l'a remis à sa valeur par défaut à l'insertion).
create or replace function public.copy_quiz_set(p_source uuid, p_new_set uuid, p_child uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; s public.quiz_sets; qid uuid; q record;
begin
  me := public.quiz_require_parent();
  if exists (select 1 from public.quiz_sets where id = p_new_set) then
    if exists (select 1 from public.quiz_sets where id = p_new_set and family_id = me.family_id) then return; end if;
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into s from public.quiz_sets where id = p_source and family_id = me.family_id and deleted_at is null;
  if not found then raise exception 'set_not_found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.children where id = p_child and family_id = me.family_id and deleted_at is null) then
    raise exception 'child_not_found' using errcode = 'P0002';
  end if;
  insert into public.quiz_sets (id, family_id, child_id, title, subject, status, created_by, material_kind)
  values (p_new_set, me.family_id, p_child, s.title, s.subject, 'draft', me.id, s.material_kind);
  update public.quiz_sets set paper_support = s.paper_support, answer_sheet_only = s.answer_sheet_only where id = p_new_set;
  for q in select qq.*, k.correct_index, k.explanation, k.to_verify, k.confirmed
           from public.quiz_questions qq join public.quiz_answer_keys k on k.question_id = qq.id
           where qq.set_id = s.id order by qq.position, qq.id loop
    qid := gen_random_uuid();
    insert into public.quiz_questions (id, set_id, family_id, position, prompt, choices, origin_number, needs_figure)
    values (qid, p_new_set, me.family_id, q.position, q.prompt, q.choices, q.origin_number, q.needs_figure);
    insert into public.quiz_answer_keys (question_id, family_id, correct_index, explanation, to_verify, confirmed)
    values (qid, me.family_id, q.correct_index, q.explanation, q.to_verify, q.confirmed);
  end loop;
end $$;

-- ───────────────────────── mélange ─────────────────────────
-- Jeu papier : questions par numéro d'origine (sans numéro : à la suite, dans l'ordre de saisie), choix dans l'ORDRE d'origine (lettres de la feuille).
-- Autres jeux : mélange complet (D-059), inchangé.
create or replace function public.quiz_make_layout(p_set uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare paper boolean;
begin
  select s.paper_support into paper from public.quiz_sets s where s.id = p_set;
  if coalesce(paper, false) then
    return jsonb_build_object(
      'order', coalesce((select jsonb_agg(q.id order by q.origin_number nulls last, q.position, q.id) from public.quiz_questions q where q.set_id = p_set), '[]'::jsonb),
      'choices', coalesce((select jsonb_object_agg(q.id::text, (select jsonb_agg(i - 1 order by i) from generate_series(1, cardinality(q.choices)) i))
                           from public.quiz_questions q where q.set_id = p_set), '{}'::jsonb));
  end if;
  return (select jsonb_build_object(
    'order', coalesce(jsonb_agg(q.id order by random()), '[]'::jsonb),
    'choices', coalesce(jsonb_object_agg(q.id::text, (select jsonb_agg(i - 1 order by random()) from generate_series(1, cardinality(q.choices)) i)), '{}'::jsonb))
  from public.quiz_questions q where q.set_id = p_set);
end $$;
revoke all on function public.quiz_make_layout(uuid) from public, anon, authenticated;

-- ───────────────────────── RPC enfant ─────────────────────────
-- Liste de SES jeux publiés : + indication « support papier » / « feuille seule » (pour choisir l'écran), jamais de score.
drop function public.child_quiz_sets();
create function public.child_quiz_sets()
returns table (set_id uuid, title text, subject text, question_count int, evaluation_attempt_id uuid, evaluation_status public.quiz_attempt_status, can_start_evaluation boolean,
               paper_support boolean, answer_sheet_only boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members;
begin
  me := public.quiz_require_child();
  return query
  select s.id, s.title, s.subject,
         (select count(*)::int from public.quiz_questions q where q.set_id = s.id),
         ev.id, ev.status,
         not exists (select 1 from public.quiz_attempts a where a.set_id = s.id and a.child_id = me.child_id),
         s.paper_support, s.answer_sheet_only
  from public.quiz_sets s
  left join lateral (select a.id, a.status from public.quiz_attempts a
                     where a.set_id = s.id and a.child_id = me.child_id order by a.started_at desc, a.id limit 1) ev on true
  where s.child_id = me.child_id and s.family_id = me.family_id and s.status = 'published' and s.deleted_at is null
    and exists (select 1 from public.quiz_questions q where q.set_id = s.id)
  order by s.created_at desc, s.id;
end $$;

-- Questions d'UNE tentative en cours : + numéro d'origine et « dépend d'une figure ». Jamais de clé, d'explication, de « à vérifier » ni de « confirmée ».
-- « Feuille seule » : énoncé vide et choix = lettres (le texte du support ne quitte pas le serveur).
drop function public.child_quiz_questions(uuid);
create function public.child_quiz_questions(p_attempt uuid)
returns table (question_id uuid, "position" int, prompt text, choices text[], origin_number int, needs_figure boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members; a public.quiz_attempts; s public.quiz_sets; lay jsonb; qid text; pos int := 0; q public.quiz_questions;
begin
  me := public.quiz_require_child();
  select * into a from public.quiz_attempts where id = p_attempt and child_id = me.child_id and family_id = me.family_id;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status <> 'in_progress' then raise exception 'attempt_closed' using errcode = 'P0001'; end if;
  select * into s from public.quiz_sets where id = a.set_id;
  select l.layout into lay from public.quiz_attempt_layouts l where l.attempt_id = a.id;
  for qid in select jsonb_array_elements_text(lay->'order') loop
    select * into q from public.quiz_questions x where x.id = qid::uuid;
    question_id := q.id;
    "position" := pos;
    if s.paper_support and s.answer_sheet_only then
      prompt := '';
      choices := array(select chr(64 + e.ord::int) from jsonb_array_elements_text(lay->'choices'->qid) with ordinality e(value, ord) order by e.ord);
    else
      prompt := q.prompt;
      choices := array(select q.choices[(e.value)::int + 1] from jsonb_array_elements_text(lay->'choices'->qid) with ordinality e(value, ord) order by e.ord);
    end if;
    origin_number := q.origin_number;
    needs_figure := q.needs_figure;
    pos := pos + 1;
    return next;
  end loop;
end $$;

-- Résultat : comme avant (D-059) + numéro d'origine ; « feuille seule » : lettres à la place des textes, énoncé vide.
create or replace function public.child_quiz_result(p_attempt uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.members; a public.quiz_attempts; s public.quiz_sets; r public.quiz_results; lay jsonb; qid text; q public.quiz_questions; k public.quiz_answer_keys; ans public.quiz_answers;
        perm jsonb; shown text[]; given int; right_pos int; items jsonb := '[]'::jsonb; pos int := 0; sheet boolean; shown_prompt text;
begin
  me := public.quiz_require_child();
  select * into a from public.quiz_attempts where id = p_attempt and child_id = me.child_id and family_id = me.family_id;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status <> 'validated' then
    return jsonb_build_object('status', a.status, 'set_id', a.set_id);
  end if;
  select * into s from public.quiz_sets where id = a.set_id;
  sheet := s.paper_support and s.answer_sheet_only;
  select * into r from public.quiz_results where attempt_id = a.id;
  select l.layout into lay from public.quiz_attempt_layouts l where l.attempt_id = a.id;
  for qid in select jsonb_array_elements_text(lay->'order') loop
    select * into q from public.quiz_questions x where x.id = qid::uuid;
    select * into ans from public.quiz_answers x where x.attempt_id = a.id and x.question_id = q.id;
    perm := lay->'choices'->qid;
    if sheet then
      shown := array(select chr(64 + e.ord::int) from jsonb_array_elements_text(perm) with ordinality e(value, ord) order by e.ord);
      shown_prompt := '';
    else
      shown := array(select q.choices[(e.value)::int + 1] from jsonb_array_elements_text(perm) with ordinality e(value, ord) order by e.ord);
      shown_prompt := q.prompt;
    end if;
    given := null;
    if ans.choice_index is not null then
      select (e.ord - 1)::int into given from jsonb_array_elements_text(perm) with ordinality e(value, ord) where (e.value)::int = ans.choice_index;
    end if;
    if a.show_correction then
      select * into k from public.quiz_answer_keys x where x.question_id = q.id;
      select (e.ord - 1)::int into right_pos from jsonb_array_elements_text(perm) with ordinality e(value, ord) where (e.value)::int = k.correct_index;
      items := items || jsonb_build_object('question_id', q.id, 'position', pos, 'number', q.origin_number, 'prompt', shown_prompt, 'choices', to_jsonb(shown), 'choice_index', given,
                                          'correct_index', right_pos, 'explanation', case when sheet then null else k.explanation end, 'is_correct', coalesce(ans.is_correct, false));
    elsif not coalesce(ans.is_correct, false) then
      items := items || jsonb_build_object('question_id', q.id, 'position', pos, 'number', q.origin_number, 'prompt', shown_prompt, 'chosen_text', case when given is null then null else shown[given + 1] end);
    end if;
    pos := pos + 1;
  end loop;
  return jsonb_build_object('status', a.status, 'set_id', a.set_id, 'score', r.score, 'total', r.total, 'validated_at', a.validated_at,
                            'show_correction', a.show_correction, 'paper_support', s.paper_support, 'answer_sheet_only', s.answer_sheet_only,
                            case when a.show_correction then 'questions' else 'missed' end, items);
end $$;

do $$
declare f text;
begin
  foreach f in array array['set_quiz_paper_support(uuid, boolean, boolean)', 'child_quiz_sets()', 'child_quiz_questions(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
