-- « Quiz de la semaine » (D-079) : l'enfant a toute la semaine pour finir un quiz publié par le parent (30 questions au plus).
--  * `quiz_sets.due_on` : date limite, en JOUR LOCAL de la famille (type `date`, jamais dérivée d'un timestamp UTC ; la validation de la borne
--    passe par `family_today`). Fixée par le parent (proposée par défaut au dimanche suivant par l'écran), modifiable ensuite, JAMAIS bloquante :
--    ni `start_quiz_evaluation`, ni `save_quiz_progress`, ni `submit_quiz_evaluation` ne regardent la date. Seule la RPC `set_quiz_due_on` l'écrit.
--  * `quiz_attempt_progress` : réponses enregistrées au fil de l'eau pendant que la tentative est « en cours » (une ligne par question, positions
--    AFFICHÉES : celles du mélange de CETTE tentative (D-059) ou de la feuille papier (D-062)). Choix de conception : une TABLE (et non une colonne
--    de la tentative) car chaque réponse est une écriture indépendante et idempotente (upsert), sans verrou sur toute la tentative, donc sûre pour
--    la file hors ligne et pour deux appareils ; et surtout parce qu'elle peut rester TOTALEMENT illisible en direct : RLS activée, aucune
--    politique, aucun droit pour `authenticated` / `anon`. L'enfant et le parent passent par des RPC `security definer` (l'enfant relit SES réponses,
--    le parent ne lit qu'un NOMBRE de réponses). La progression ne contient aucune information de correction (jamais la clé, ni juste/faux).
--  * `submit_quiz_evaluation` reste la seule source du résultat : le score est calculé sur les réponses ENVOYÉES (une réponse absente de l'envoi est
--    complétée par la progression enregistrée, jamais l'inverse) ; la progression est effacée à l'envoi.
--  * `delete_family` purge la progression par la cascade de la tentative (testé) ; `copy_quiz_set` repart sans date limite (colonne nulle par défaut).

alter table public.quiz_sets add column due_on date;

create table public.quiz_attempt_progress (
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  family_id uuid not null references public.families (id),
  child_id uuid not null,
  -- position AFFICHÉE à l'enfant (0 = première réponse affichée) ; convertie en indice d'origine seulement à l'envoi
  choice smallint not null check (choice between 0 and 3),
  saved_at timestamptz not null default now(),
  primary key (attempt_id, question_id),
  foreign key (child_id, family_id) references public.children (id, family_id)
);
create index quiz_attempt_progress_family on public.quiz_attempt_progress (family_id);

alter table public.quiz_attempt_progress enable row level security;
revoke all on public.quiz_attempt_progress from anon, authenticated;
-- volontairement AUCUNE politique ni aucun droit : lecture et écriture uniquement par les RPC ci-dessous

-- ───────────────────────── RPC parent ─────────────────────────
-- Date limite : brouillon ou publié (modifiable après la publication) ; `null` = sans date limite. Bornes de bon sens, en jour local de la famille.
create function public.set_quiz_due_on(p_set uuid, p_due date) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; s public.quiz_sets; today date;
begin
  me := public.quiz_require_parent();
  select * into s from public.quiz_sets where id = p_set and family_id = me.family_id and deleted_at is null for update;
  if not found then raise exception 'set_not_found' using errcode = 'P0002'; end if;
  if p_due is not null then
    today := public.family_today(s.family_id);
    if p_due < today - 7 or p_due > today + 400 then raise exception 'invalid_due_date' using errcode = 'P0001'; end if;
  end if;
  update public.quiz_sets set due_on = p_due where id = s.id;
end $$;

-- Nombre de réponses déjà données, par tentative EN COURS de la famille (le parent ne lit jamais le détail des réponses avant l'envoi).
create function public.quiz_progress_counts() returns table (attempt_id uuid, answered int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members;
begin
  me := public.quiz_require_parent();
  return query
  select a.id, count(p.question_id)::int
  from public.quiz_attempts a left join public.quiz_attempt_progress p on p.attempt_id = a.id
  where a.family_id = me.family_id and a.status = 'in_progress'
  group by a.id;
end $$;

-- ───────────────────────── RPC enfant ─────────────────────────
-- Enregistre (ou efface, avec p_choice null) UNE réponse, en position affichée. Idempotent (upsert). Réservé à l'enfant propriétaire de la tentative,
-- tant qu'elle est « en cours » ; refusée si elle est envoyée, validée, d'un autre enfant ou d'une autre famille. La date limite n'intervient JAMAIS.
create function public.save_quiz_progress(p_attempt uuid, p_question uuid, p_choice int) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; a public.quiz_attempts; q public.quiz_questions;
begin
  me := public.quiz_require_child();
  -- `for share` : sérialisé avec l'envoi (`for update`) ; une sauvegarde qui arrive après l'envoi voit « envoyée » et est refusée
  select * into a from public.quiz_attempts where id = p_attempt and child_id = me.child_id and family_id = me.family_id for share;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  if a.status <> 'in_progress' then raise exception 'attempt_closed' using errcode = 'P0001'; end if;
  select * into q from public.quiz_questions where id = p_question and set_id = a.set_id;
  if not found then raise exception 'invalid_answers' using errcode = 'P0001'; end if;
  if p_choice is null then
    delete from public.quiz_attempt_progress where attempt_id = a.id and question_id = q.id;
    return;
  end if;
  if p_choice < 0 or p_choice >= cardinality(q.choices) then raise exception 'invalid_answers' using errcode = 'P0001'; end if;
  insert into public.quiz_attempt_progress (attempt_id, question_id, family_id, child_id, choice)
  values (a.id, q.id, a.family_id, a.child_id, p_choice)
  on conflict (attempt_id, question_id) do update set choice = excluded.choice, saved_at = now();
end $$;

-- Réponses déjà données de SA tentative en cours (positions affichées) : reprise sur le même appareil ou un autre. Jamais de correction.
create function public.child_quiz_progress(p_attempt uuid) returns table (question_id uuid, choice int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members; a public.quiz_attempts;
begin
  me := public.quiz_require_child();
  select * into a from public.quiz_attempts where id = p_attempt and child_id = me.child_id and family_id = me.family_id;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status <> 'in_progress' then raise exception 'attempt_closed' using errcode = 'P0001'; end if;
  return query select p.question_id, p.choice::int from public.quiz_attempt_progress p where p.attempt_id = a.id order by p.saved_at, p.question_id;
end $$;

-- Liste de SES jeux publiés : + date limite et nombre de réponses déjà enregistrées (tentative en cours). Jamais de score ni de drapeau de clé.
drop function public.child_quiz_sets();
create function public.child_quiz_sets()
returns table (set_id uuid, title text, subject text, question_count int, evaluation_attempt_id uuid, evaluation_status public.quiz_attempt_status, can_start_evaluation boolean,
               paper_support boolean, answer_sheet_only boolean, due_on date, answered_count int)
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
         s.paper_support, s.answer_sheet_only, s.due_on,
         case when ev.status = 'in_progress' then (select count(*)::int from public.quiz_attempt_progress p where p.attempt_id = ev.id) else 0 end
  from public.quiz_sets s
  left join lateral (select a.id, a.status from public.quiz_attempts a
                     where a.set_id = s.id and a.child_id = me.child_id order by a.started_at desc, a.id limit 1) ev on true
  where s.child_id = me.child_id and s.family_id = me.family_id and s.status = 'published' and s.deleted_at is null
    and exists (select 1 from public.quiz_questions q where q.set_id = s.id)
  order by s.created_at desc, s.id;
end $$;

-- Envoi : inchangé (D-059), sauf (1) une réponse absente de l'envoi (question non mentionnée, ou réponse nulle) est complétée par la progression enregistrée (jamais l'inverse : l'envoi prime),
-- (2) la progression est effacée une fois la tentative envoyée. Le score est calculé ICI, rien n'est renvoyé. Un second envoi est ignoré.
create or replace function public.submit_quiz_evaluation(p_attempt uuid, p_answers jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; a public.quiz_attempts; lay jsonb; eff jsonb; e jsonb; qid uuid; ch int; orig int; q public.quiz_questions; k public.quiz_answer_keys; sc int := 0; tt int; ok boolean;
begin
  me := public.quiz_require_child();
  select * into a from public.quiz_attempts where id = p_attempt and child_id = me.child_id and family_id = me.family_id for update;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  if a.status <> 'in_progress' then return; end if;  -- double envoi : ignoré
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then raise exception 'invalid_answers' using errcode = 'P0001'; end if;
  select l.layout into lay from public.quiz_attempt_layouts l where l.attempt_id = a.id;
  -- réponses effectives : l'envoi, plus les réponses enregistrées pour les questions qu'il ne mentionne pas
  eff := p_answers || coalesce((select jsonb_agg(jsonb_build_object('question_id', p.question_id, 'choice', p.choice))
                                from public.quiz_attempt_progress p
                                where p.attempt_id = a.id and not exists (select 1 from jsonb_array_elements(p_answers) x where x->>'question_id' = p.question_id::text)), '[]'::jsonb);
  for e in select * from jsonb_array_elements(eff) loop
    begin
      qid := (e->>'question_id')::uuid;
      ch := case when jsonb_typeof(e->'choice') = 'number' then (e->>'choice')::int end;
    exception when others then
      raise exception 'invalid_answers' using errcode = 'P0001';
    end;
    select * into q from public.quiz_questions where id = qid and set_id = a.set_id;
    if not found then raise exception 'invalid_answers' using errcode = 'P0001'; end if;
    if ch is null then
      select p.choice::int into ch from public.quiz_attempt_progress p where p.attempt_id = a.id and p.question_id = q.id;
    end if;
    orig := null;
    if ch is not null then
      if ch < 0 or ch >= cardinality(q.choices) then raise exception 'invalid_answers' using errcode = 'P0001'; end if;
      orig := (lay->'choices'->(qid::text)->>ch)::int;  -- position affichée → indice d'origine
    end if;
    select * into k from public.quiz_answer_keys where question_id = q.id;
    ok := orig is not null and k.correct_index = orig;
    begin
      insert into public.quiz_answers (attempt_id, question_id, family_id, child_id, choice_index, is_correct) values (a.id, q.id, a.family_id, a.child_id, orig, ok);
    exception when unique_violation then
      raise exception 'invalid_answers' using errcode = 'P0001';
    end;
    if ok then sc := sc + 1; end if;
  end loop;
  select count(*)::int into tt from public.quiz_questions where set_id = a.set_id;
  insert into public.quiz_results (attempt_id, family_id, child_id, score, total) values (a.id, a.family_id, a.child_id, sc, tt);
  update public.quiz_attempts set status = 'submitted', submitted_at = now() where id = a.id;
  delete from public.quiz_attempt_progress where attempt_id = a.id;
end $$;

do $$
declare f text;
begin
  foreach f in array array['set_quiz_due_on(uuid, date)', 'quiz_progress_counts()', 'save_quiz_progress(uuid, uuid, int)', 'child_quiz_progress(uuid)', 'child_quiz_sets()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
