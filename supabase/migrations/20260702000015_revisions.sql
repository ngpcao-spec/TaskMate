-- « Révisions » (D-055) : le parent compose (ou fait générer, PR B) des questions à choix multiple, les relit et les publie pour UN enfant ;
-- l'enfant s'entraîne (retour immédiat) puis passe une évaluation ; le résultat va d'abord au parent, qui le valide avant que l'enfant le voie.
-- Les points de l'app ne sont PAS reliés. Les fichiers originaux ne sont jamais conservés.
--
-- Confidentialité (D-052 : un enfant ne voit QUE ses propres données, imposé ici par la RLS) :
--  * la clé des bonnes réponses et les explications vivent dans une table réservée au parent (`quiz_answer_keys`) ;
--  * un enfant n'a AUCUN accès direct aux questions, réponses, résultats : il passe par des RPC `security definer` qui ne rendent jamais
--    la bonne réponse avant la correction (entraînement : une réponse à la fois ; évaluation : après validation parentale) ;
--  * tout brouillon est invisible pour l'enfant ; aucune écriture directe pour l'enfant (RPC uniquement).

create type public.quiz_status as enum ('draft', 'published');
create type public.quiz_attempt_kind as enum ('practice', 'evaluation');
create type public.quiz_attempt_status as enum ('in_progress', 'submitted', 'validated');

create function public.quiz_choices_valid(c text[]) returns boolean
language sql immutable as $$
  select c is not null and cardinality(c) between 3 and 4
     and not exists (select 1 from unnest(c) x where x is null or char_length(btrim(x)) not between 1 and 200)
$$;

-- ───────────────────────── Tables ─────────────────────────
create table public.quiz_sets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  child_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  subject text check (subject is null or char_length(subject) <= 40),
  status public.quiz_status not null default 'draft',
  created_by uuid not null references public.members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (child_id, family_id) references public.children (id, family_id),
  unique (id, family_id),
  unique (id, child_id)
);
create index quiz_sets_child on public.quiz_sets (child_id) where deleted_at is null;

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null,
  family_id uuid not null,
  position int not null check (position >= 0),
  prompt text not null check (char_length(btrim(prompt)) between 1 and 500),
  choices text[] not null check (public.quiz_choices_valid(choices)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (set_id, family_id) references public.quiz_sets (id, family_id) on delete cascade
);
create index quiz_questions_set on public.quiz_questions (set_id, position);

-- La clé : jamais lisible par l'enfant.
create table public.quiz_answer_keys (
  question_id uuid primary key references public.quiz_questions (id) on delete cascade,
  family_id uuid not null references public.families (id),
  correct_index smallint not null check (correct_index between 0 and 3),
  explanation text check (explanation is null or char_length(explanation) <= 500)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  child_id uuid not null,
  set_id uuid not null,
  kind public.quiz_attempt_kind not null,
  status public.quiz_attempt_status not null default 'in_progress',
  started_at timestamptz not null default clock_timestamp(),
  submitted_at timestamptz,
  validated_at timestamptz,
  validated_by uuid references public.members (id),
  relaunched_by uuid references public.members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (set_id, child_id) references public.quiz_sets (id, child_id),
  foreign key (child_id, family_id) references public.children (id, family_id),
  unique (id, family_id)
);
create index quiz_attempts_child on public.quiz_attempts (child_id, started_at desc);
-- une seule tentative ouverte par jeu, enfant et type (reprise, pas de doublon)
create unique index quiz_attempts_one_open on public.quiz_attempts (set_id, child_id, kind) where status = 'in_progress';

-- Score : réservé au parent (l'enfant ne le reçoit que par RPC, une fois validé).
create table public.quiz_results (
  attempt_id uuid primary key references public.quiz_attempts (id) on delete cascade,
  family_id uuid not null references public.families (id),
  child_id uuid not null,
  score int not null check (score >= 0),
  total int not null check (total >= 0),
  check (score <= total)
);

create table public.quiz_answers (
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  family_id uuid not null references public.families (id),
  child_id uuid not null,
  choice_index smallint check (choice_index is null or choice_index between 0 and 3),
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

do $$
declare t text;
begin
  foreach t in array array['quiz_sets', 'quiz_questions', 'quiz_attempts'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- ───────────────────────── RLS ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array['quiz_sets', 'quiz_questions', 'quiz_answer_keys', 'quiz_attempts', 'quiz_results', 'quiz_answers'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- jeux : le parent voit toute la famille ; l'enfant, SES jeux publiés et non supprimés (jamais un brouillon, jamais ceux de l'autre enfant)
create policy quiz_sets_select on public.quiz_sets for select to authenticated
  using (family_id = public.my_family_id()
         and (public.is_parent() or (child_id = public.my_child_id() and status = 'published' and deleted_at is null)));
create policy quiz_sets_insert on public.quiz_sets for insert to authenticated
  with check (family_id = public.my_family_id() and public.is_parent() and created_by = public.my_member_id() and status = 'draft');
create policy quiz_sets_update on public.quiz_sets for update to authenticated
  using (family_id = public.my_family_id() and public.is_parent())
  with check (family_id = public.my_family_id() and public.is_parent());
grant insert (id, family_id, child_id, title, subject, created_by) on public.quiz_sets to authenticated;
-- le statut ne se change que par RPC (publication contrôlée)
grant update (title, subject, deleted_at) on public.quiz_sets to authenticated;

-- questions, clés, réponses données, scores : parent uniquement (l'enfant passe par les RPC ci-dessous)
create policy quiz_questions_select on public.quiz_questions for select to authenticated
  using (family_id = public.my_family_id() and public.is_parent());
create policy quiz_answer_keys_select on public.quiz_answer_keys for select to authenticated
  using (family_id = public.my_family_id() and public.is_parent());
create policy quiz_results_select on public.quiz_results for select to authenticated
  using (family_id = public.my_family_id() and public.is_parent());
create policy quiz_answers_select on public.quiz_answers for select to authenticated
  using (family_id = public.my_family_id() and public.is_parent());
-- tentatives : état seulement (aucun score) ; le parent voit tout, l'enfant les siennes
create policy quiz_attempts_select on public.quiz_attempts for select to authenticated
  using (family_id = public.my_family_id() and (public.is_parent() or child_id = public.my_child_id()));

-- ───────────────────────── Aides internes ─────────────────────────
create function public.quiz_require_parent() returns public.members
language plpgsql stable security definer set search_path = public as $$
declare me public.members;
begin
  me := public.require_member();
  if me.role <> 'parent' then raise exception 'forbidden' using errcode = '42501'; end if;
  return me;
end $$;
revoke all on function public.quiz_require_parent() from public, anon, authenticated;

create function public.quiz_require_child() returns public.members
language plpgsql stable security definer set search_path = public as $$
declare me public.members;
begin
  me := public.require_member();
  if me.role <> 'child' or me.child_id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  return me;
end $$;
revoke all on function public.quiz_require_child() from public, anon, authenticated;

-- Jeu de la famille, modifiable : brouillon, non supprimé, sans tentative (l'historique reste cohérent : pour changer un jeu publié, le copier).
create function public.quiz_editable_set(p_set uuid, p_family uuid) returns public.quiz_sets
language plpgsql security definer set search_path = public as $$
declare s public.quiz_sets;
begin
  select * into s from public.quiz_sets where id = p_set and family_id = p_family and deleted_at is null for update;
  if not found then raise exception 'set_not_found' using errcode = 'P0002'; end if;
  if s.status <> 'draft' then raise exception 'set_published' using errcode = 'P0001'; end if;
  if exists (select 1 from public.quiz_attempts where set_id = s.id) then raise exception 'set_has_attempts' using errcode = 'P0001'; end if;
  return s;
end $$;
revoke all on function public.quiz_editable_set(uuid, uuid) from public, anon, authenticated;

-- ───────────────────────── RPC parent ─────────────────────────
create function public.upsert_quiz_question(p_id uuid, p_set uuid, p_position int, p_prompt text, p_choices text[], p_correct int, p_explanation text)
returns void language plpgsql security definer set search_path = public as $$
declare me public.members; s public.quiz_sets; existing public.quiz_questions; n int; expl text;
begin
  me := public.quiz_require_parent();
  s := public.quiz_editable_set(p_set, me.family_id);
  p_prompt := btrim(coalesce(p_prompt, ''));
  if char_length(p_prompt) not between 1 and 500 then raise exception 'invalid_question' using errcode = 'P0001'; end if;
  if not public.quiz_choices_valid(p_choices) then raise exception 'invalid_choices' using errcode = 'P0001'; end if;
  n := cardinality(p_choices);
  if (select count(distinct lower(btrim(x))) from unnest(p_choices) x) <> n then raise exception 'duplicate_choices' using errcode = 'P0001'; end if;
  if p_correct is null or p_correct < 0 or p_correct >= n then raise exception 'invalid_correct' using errcode = 'P0001'; end if;
  expl := nullif(btrim(coalesce(p_explanation, '')), '');
  if expl is not null and char_length(expl) > 500 then raise exception 'invalid_question' using errcode = 'P0001'; end if;
  if p_position is null or p_position < 0 then raise exception 'invalid_question' using errcode = 'P0001'; end if;

  select * into existing from public.quiz_questions where id = p_id;
  if found then
    if existing.set_id <> s.id then raise exception 'forbidden' using errcode = '42501'; end if;
    update public.quiz_questions set position = p_position, prompt = p_prompt, choices = p_choices where id = p_id;
    update public.quiz_answer_keys set correct_index = p_correct, explanation = expl where question_id = p_id;
  else
    insert into public.quiz_questions (id, set_id, family_id, position, prompt, choices) values (p_id, s.id, s.family_id, p_position, p_prompt, p_choices);
    insert into public.quiz_answer_keys (question_id, family_id, correct_index, explanation) values (p_id, s.family_id, p_correct, expl);
  end if;
end $$;

create function public.delete_quiz_question(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; q public.quiz_questions;
begin
  me := public.quiz_require_parent();
  select * into q from public.quiz_questions where id = p_id and family_id = me.family_id;
  if not found then return; end if;  -- déjà supprimée : rejeu idempotent
  perform public.quiz_editable_set(q.set_id, me.family_id);
  delete from public.quiz_questions where id = p_id;
end $$;

create function public.reorder_quiz_questions(p_set uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; s public.quiz_sets;
begin
  me := public.quiz_require_parent();
  s := public.quiz_editable_set(p_set, me.family_id);
  if exists (select 1 from unnest(p_ids) i where not exists (select 1 from public.quiz_questions q where q.id = i and q.set_id = s.id)) then
    raise exception 'invalid_question' using errcode = 'P0001';
  end if;
  update public.quiz_questions q set position = o.pos - 1 from unnest(p_ids) with ordinality as o(id, pos) where q.id = o.id and q.set_id = s.id;
end $$;

create function public.set_quiz_status(p_set uuid, p_status public.quiz_status) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; s public.quiz_sets;
begin
  me := public.quiz_require_parent();
  select * into s from public.quiz_sets where id = p_set and family_id = me.family_id and deleted_at is null for update;
  if not found then raise exception 'set_not_found' using errcode = 'P0002'; end if;
  if s.status = p_status then return; end if;
  if p_status = 'published' and not exists (select 1 from public.quiz_questions where set_id = s.id) then
    raise exception 'no_questions' using errcode = 'P0001';
  end if;
  update public.quiz_sets set status = p_status where id = s.id;
end $$;

-- Copie d'un jeu (vers un autre enfant ou le même) : TOUJOURS en brouillon, questions et clés recopiées ; rejeu idempotent sur p_new_set.
create function public.copy_quiz_set(p_source uuid, p_new_set uuid, p_child uuid) returns void
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
  insert into public.quiz_sets (id, family_id, child_id, title, subject, status, created_by)
  values (p_new_set, me.family_id, p_child, s.title, s.subject, 'draft', me.id);
  for q in select qq.*, k.correct_index, k.explanation from public.quiz_questions qq join public.quiz_answer_keys k on k.question_id = qq.id
           where qq.set_id = s.id order by qq.position, qq.id loop
    qid := gen_random_uuid();
    insert into public.quiz_questions (id, set_id, family_id, position, prompt, choices) values (qid, p_new_set, me.family_id, q.position, q.prompt, q.choices);
    insert into public.quiz_answer_keys (question_id, family_id, correct_index, explanation) values (qid, me.family_id, q.correct_index, q.explanation);
  end loop;
end $$;

-- Le parent valide une évaluation soumise : seulement ensuite l'enfant voit score et correction.
create function public.validate_quiz_attempt(p_attempt uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; a public.quiz_attempts;
begin
  me := public.quiz_require_parent();
  select * into a from public.quiz_attempts where id = p_attempt and family_id = me.family_id for update;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status = 'validated' then return; end if;
  if a.status <> 'submitted' then raise exception 'not_submitted' using errcode = 'P0001'; end if;
  update public.quiz_attempts set status = 'validated', validated_at = now(), validated_by = me.id where id = a.id;
end $$;

-- Nouvelle tentative d'évaluation, décidée par le parent (l'historique est conservé). Impossible tant qu'une tentative est en cours.
create function public.relaunch_quiz_evaluation(p_set uuid, p_attempt uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; s public.quiz_sets;
begin
  me := public.quiz_require_parent();
  if exists (select 1 from public.quiz_attempts where id = p_attempt) then
    if exists (select 1 from public.quiz_attempts where id = p_attempt and family_id = me.family_id and set_id = p_set) then return; end if;
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into s from public.quiz_sets where id = p_set and family_id = me.family_id and deleted_at is null and status = 'published';
  if not found then raise exception 'set_not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.quiz_attempts where set_id = s.id and kind = 'evaluation' and status = 'in_progress') then
    raise exception 'attempt_in_progress' using errcode = 'P0001';
  end if;
  insert into public.quiz_attempts (id, family_id, child_id, set_id, kind, relaunched_by) values (p_attempt, s.family_id, s.child_id, s.id, 'evaluation', me.id);
end $$;

-- ───────────────────────── RPC enfant ─────────────────────────
-- Liste de SES jeux publiés, avec l'état de l'évaluation (jamais de score).
create function public.child_quiz_sets()
returns table (set_id uuid, title text, subject text, question_count int, evaluation_attempt_id uuid, evaluation_status public.quiz_attempt_status, can_start_evaluation boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members;
begin
  me := public.quiz_require_child();
  return query
  select s.id, s.title, s.subject,
         (select count(*)::int from public.quiz_questions q where q.set_id = s.id),
         ev.id, ev.status,
         not exists (select 1 from public.quiz_attempts a where a.set_id = s.id and a.child_id = me.child_id and a.kind = 'evaluation')
  from public.quiz_sets s
  left join lateral (select a.id, a.status from public.quiz_attempts a
                     where a.set_id = s.id and a.child_id = me.child_id and a.kind = 'evaluation' order by a.started_at desc, a.id limit 1) ev on true
  where s.child_id = me.child_id and s.family_id = me.family_id and s.status = 'published' and s.deleted_at is null
    and exists (select 1 from public.quiz_questions q where q.set_id = s.id)
  order by s.created_at desc, s.id;
end $$;

-- Questions d'un jeu publié, SANS la clé ni l'explication.
create function public.child_quiz_questions(p_set uuid)
returns table (question_id uuid, "position" int, prompt text, choices text[])
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members;
begin
  me := public.quiz_require_child();
  if not exists (select 1 from public.quiz_sets s where s.id = p_set and s.child_id = me.child_id and s.family_id = me.family_id and s.status = 'published' and s.deleted_at is null) then
    raise exception 'set_not_found' using errcode = 'P0002';
  end if;
  return query select q.id, q.position, q.prompt, q.choices from public.quiz_questions q where q.set_id = p_set order by q.position, q.id;
end $$;

create function public.start_quiz_practice(p_set uuid, p_attempt uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; s public.quiz_sets; a public.quiz_attempts;
begin
  me := public.quiz_require_child();
  select * into a from public.quiz_attempts where id = p_attempt;
  if found then
    if a.child_id = me.child_id and a.set_id = p_set and a.kind = 'practice' then return; end if;
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into s from public.quiz_sets where id = p_set and child_id = me.child_id and family_id = me.family_id and status = 'published' and deleted_at is null;
  if not found then raise exception 'set_not_found' using errcode = 'P0002'; end if;
  -- une seule séance d'entraînement ouverte par jeu : on abandonne l'ancienne (aucun score, rien à garder)
  delete from public.quiz_attempts where set_id = s.id and child_id = me.child_id and kind = 'practice' and status = 'in_progress';
  insert into public.quiz_attempts (id, family_id, child_id, set_id, kind) values (p_attempt, s.family_id, s.child_id, s.id, 'practice');
end $$;

-- Entraînement : vérifie UNE réponse, retour immédiat (juste/faux + bonne réponse + explication).
create function public.check_quiz_answer(p_attempt uuid, p_question uuid, p_choice int)
returns table (correct boolean, correct_index int, explanation text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members; a public.quiz_attempts; q public.quiz_questions; k public.quiz_answer_keys; ok boolean;
begin
  me := public.quiz_require_child();
  select * into a from public.quiz_attempts where id = p_attempt and child_id = me.child_id and family_id = me.family_id for update;
  if not found or a.kind <> 'practice' then raise exception 'forbidden' using errcode = '42501'; end if;
  if a.status <> 'in_progress' then raise exception 'attempt_closed' using errcode = 'P0001'; end if;
  select * into q from public.quiz_questions where id = p_question and set_id = a.set_id;
  if not found then raise exception 'question_not_found' using errcode = 'P0002'; end if;
  if p_choice is null or p_choice < 0 or p_choice >= cardinality(q.choices) then raise exception 'invalid_answers' using errcode = 'P0001'; end if;
  select * into k from public.quiz_answer_keys where question_id = q.id;
  ok := (k.correct_index = p_choice);
  insert into public.quiz_answers (attempt_id, question_id, family_id, child_id, choice_index, is_correct)
  values (a.id, q.id, a.family_id, a.child_id, p_choice, ok)
  on conflict (attempt_id, question_id) do update set choice_index = excluded.choice_index, is_correct = excluded.is_correct, answered_at = now();
  return query select ok, k.correct_index::int, k.explanation;
end $$;

-- Fin d'un entraînement : pas de validation parentale (retour immédiat déjà donné) ; score calculé par le serveur.
create function public.finish_quiz_practice(p_attempt uuid)
returns table (score int, total int)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members; a public.quiz_attempts; sc int; tt int;
begin
  me := public.quiz_require_child();
  select * into a from public.quiz_attempts where id = p_attempt and child_id = me.child_id and family_id = me.family_id for update;
  if not found or a.kind <> 'practice' then raise exception 'forbidden' using errcode = '42501'; end if;
  if a.status = 'in_progress' then
    select count(*)::int into tt from public.quiz_questions where set_id = a.set_id;
    select count(*)::int into sc from public.quiz_answers where attempt_id = a.id and is_correct;
    insert into public.quiz_results (attempt_id, family_id, child_id, score, total) values (a.id, a.family_id, a.child_id, sc, tt);
    update public.quiz_attempts set status = 'validated', submitted_at = now(), validated_at = now() where id = a.id;
  end if;
  return query select r.score, r.total from public.quiz_results r where r.attempt_id = a.id;
end $$;

-- Première évaluation : l'enfant la démarre ; ensuite seul le parent peut en relancer une (relaunch_quiz_evaluation).
create function public.start_quiz_evaluation(p_set uuid, p_attempt uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; s public.quiz_sets; a public.quiz_attempts;
begin
  me := public.quiz_require_child();
  select * into a from public.quiz_attempts where id = p_attempt;
  if found then
    if a.child_id = me.child_id and a.set_id = p_set and a.kind = 'evaluation' then return; end if;
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into s from public.quiz_sets where id = p_set and child_id = me.child_id and family_id = me.family_id and status = 'published' and deleted_at is null for update;
  if not found then raise exception 'set_not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.quiz_attempts where set_id = s.id and child_id = me.child_id and kind = 'evaluation') then
    raise exception 'evaluation_already_taken' using errcode = 'P0001';
  end if;
  insert into public.quiz_attempts (id, family_id, child_id, set_id, kind) values (p_attempt, s.family_id, s.child_id, s.id, 'evaluation');
end $$;

-- Évaluation : toutes les réponses d'un coup, score calculé ICI, rien n'est renvoyé. Un second envoi est ignoré (idempotent).
create function public.submit_quiz_evaluation(p_attempt uuid, p_answers jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; a public.quiz_attempts; e jsonb; qid uuid; ch int; q public.quiz_questions; k public.quiz_answer_keys; sc int := 0; tt int; ok boolean;
begin
  me := public.quiz_require_child();
  select * into a from public.quiz_attempts where id = p_attempt and child_id = me.child_id and family_id = me.family_id for update;
  if not found or a.kind <> 'evaluation' then raise exception 'forbidden' using errcode = '42501'; end if;
  if a.status <> 'in_progress' then return; end if;  -- double envoi : ignoré
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then raise exception 'invalid_answers' using errcode = 'P0001'; end if;
  for e in select * from jsonb_array_elements(p_answers) loop
    begin
      qid := (e->>'question_id')::uuid;
      ch := case when jsonb_typeof(e->'choice') = 'number' then (e->>'choice')::int end;
    exception when others then
      raise exception 'invalid_answers' using errcode = 'P0001';
    end;
    select * into q from public.quiz_questions where id = qid and set_id = a.set_id;
    if not found then raise exception 'invalid_answers' using errcode = 'P0001'; end if;
    if ch is not null and (ch < 0 or ch >= cardinality(q.choices)) then raise exception 'invalid_answers' using errcode = 'P0001'; end if;
    select * into k from public.quiz_answer_keys where question_id = q.id;
    ok := ch is not null and k.correct_index = ch;
    begin
      insert into public.quiz_answers (attempt_id, question_id, family_id, child_id, choice_index, is_correct) values (a.id, q.id, a.family_id, a.child_id, ch, ok);
    exception when unique_violation then
      raise exception 'invalid_answers' using errcode = 'P0001';
    end;
    if ok then sc := sc + 1; end if;
  end loop;
  select count(*)::int into tt from public.quiz_questions where set_id = a.set_id;
  insert into public.quiz_results (attempt_id, family_id, child_id, score, total) values (a.id, a.family_id, a.child_id, sc, tt);
  update public.quiz_attempts set status = 'submitted', submitted_at = now() where id = a.id;
end $$;

-- Résultat d'UNE tentative de l'enfant : score et correction SEULEMENT une fois validé ; avant, juste l'état.
create function public.child_quiz_result(p_attempt uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.members; a public.quiz_attempts; r public.quiz_results;
begin
  me := public.quiz_require_child();
  select * into a from public.quiz_attempts where id = p_attempt and child_id = me.child_id and family_id = me.family_id;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status <> 'validated' then
    return jsonb_build_object('status', a.status, 'kind', a.kind, 'set_id', a.set_id);
  end if;
  select * into r from public.quiz_results where attempt_id = a.id;
  return jsonb_build_object(
    'status', a.status, 'kind', a.kind, 'set_id', a.set_id, 'score', r.score, 'total', r.total, 'validated_at', a.validated_at,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'question_id', q.id, 'position', q.position, 'prompt', q.prompt, 'choices', to_jsonb(q.choices),
        'choice_index', ans.choice_index, 'correct_index', k.correct_index, 'explanation', k.explanation, 'is_correct', coalesce(ans.is_correct, false)
      ) order by q.position, q.id)
      from public.quiz_questions q
      join public.quiz_answer_keys k on k.question_id = q.id
      left join public.quiz_answers ans on ans.attempt_id = a.id and ans.question_id = q.id
      where q.set_id = a.set_id), '[]'::jsonb));
end $$;

-- Progression de L'enfant sur un jeu : ses tentatives VALIDÉES (jamais un score en attente).
create function public.child_quiz_history(p_set uuid)
returns table (attempt_id uuid, kind public.quiz_attempt_kind, validated_at timestamptz, score int, total int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members;
begin
  me := public.quiz_require_child();
  return query
  select a.id, a.kind, a.validated_at, r.score, r.total
  from public.quiz_attempts a join public.quiz_results r on r.attempt_id = a.id
  where a.set_id = p_set and a.child_id = me.child_id and a.family_id = me.family_id and a.status = 'validated'
  order by a.validated_at, a.id;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'upsert_quiz_question(uuid, uuid, int, text, text[], int, text)', 'delete_quiz_question(uuid)', 'reorder_quiz_questions(uuid, uuid[])',
    'set_quiz_status(uuid, public.quiz_status)', 'copy_quiz_set(uuid, uuid, uuid)', 'validate_quiz_attempt(uuid)', 'relaunch_quiz_evaluation(uuid, uuid)',
    'child_quiz_sets()', 'child_quiz_questions(uuid)', 'start_quiz_practice(uuid, uuid)', 'check_quiz_answer(uuid, uuid, int)', 'finish_quiz_practice(uuid)',
    'start_quiz_evaluation(uuid, uuid)', 'submit_quiz_evaluation(uuid, jsonb)', 'child_quiz_result(uuid)', 'child_quiz_history(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Realtime : le parent voit arriver une évaluation soumise, l'enfant voit un jeu publié ou une validation (RLS appliquée à chaque abonné).
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['quiz_sets', 'quiz_attempts'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- Suppression de la famille : purge aussi les révisions.
create or replace function public.delete_family() returns uuid[]
language plpgsql security definer set search_path = public as $$
declare me public.members; fid uuid; users uuid[];
begin
  me := public.require_member();
  if me.role <> 'parent' then raise exception 'forbidden' using errcode = '42501'; end if;
  fid := me.family_id;
  select coalesce(array_agg(user_id), '{}') into users from public.members where family_id = fid;

  perform set_config('app.deleting_family', 'on', true);
  delete from public.quiz_answers where family_id = fid;
  delete from public.quiz_results where family_id = fid;
  delete from public.quiz_attempts where family_id = fid;
  delete from public.quiz_answer_keys where family_id = fid;
  delete from public.quiz_questions where family_id = fid;
  delete from public.quiz_sets where family_id = fid;
  delete from public.activity_log where family_id = fid;
  delete from public.reward_requests where family_id = fid;
  delete from public.point_transactions where family_id = fid;
  delete from public.notification_prefs where member_id in (select id from public.members where family_id = fid);
  delete from public.devices where member_id in (select id from public.members where family_id = fid);
  delete from public.child_accounts where family_id = fid;
  delete from public.parent_invites where family_id = fid;
  delete from public.tasks where family_id = fid;
  delete from public.recurrences where family_id = fid;
  delete from public.goals where family_id = fid;
  delete from public.rewards where family_id = fid;
  delete from public.members where family_id = fid;
  delete from public.children where family_id = fid;
  delete from public.families where id = fid;
  perform set_config('app.deleting_family', 'off', true);
  return users;
end $$;
