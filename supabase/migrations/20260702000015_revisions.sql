-- « Révisions » (D-055, modifiée par D-059) : le parent compose (ou fait générer, PR B) des questions à choix multiple, les relit et les publie
-- pour UN enfant ; l'enfant répond à TOUTES les questions, envoie ses réponses, puis attend ; le parent valide avant que l'enfant voie son score.
-- Il n'y a PLUS de mode « entraînement » : aucun retour juste/faux n'est jamais donné pendant les questions (D-059). Points non reliés ; aucun fichier conservé.
--
-- Confidentialité (D-052 : un enfant ne voit QUE ses propres données, imposé ici par la RLS) :
--  * la clé des bonnes réponses et les explications vivent dans une table réservée au parent (`quiz_answer_keys`) ;
--  * un enfant n'a AUCUN accès direct aux questions, réponses, résultats, ordres : il passe par des RPC `security definer` qui ne rendent jamais
--    la bonne réponse, l'explication ni un « juste/faux » par question avant la validation du parent ; APRÈS validation, la correction n'est
--    visible que si le parent l'a activée au moment de valider (réglage stocké côté serveur, appliqué par le RPC de résultat) ;
--  * à chaque tentative, l'ordre des questions et des choix est mélangé CÔTÉ SERVEUR (table `quiz_attempt_layouts`, parent seulement) ;
--  * tout brouillon est invisible pour l'enfant ; aucune écriture directe pour l'enfant (RPC uniquement).

create type public.quiz_status as enum ('draft', 'published');
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
  status public.quiz_attempt_status not null default 'in_progress',
  started_at timestamptz not null default clock_timestamp(),
  submitted_at timestamptz,
  validated_at timestamptz,
  validated_by uuid references public.members (id),
  relaunched_by uuid references public.members (id),
  -- réglage posé par le parent AU MOMENT de valider : l'enfant voit-il la bonne réponse et l'explication ? (désactivé par défaut)
  show_correction boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (set_id, child_id) references public.quiz_sets (id, child_id),
  foreign key (child_id, family_id) references public.children (id, family_id),
  unique (id, family_id)
);
create index quiz_attempts_child on public.quiz_attempts (child_id, started_at desc);
-- une seule tentative ouverte par jeu et enfant (reprise, pas de doublon)
create unique index quiz_attempts_one_open on public.quiz_attempts (set_id, child_id) where status = 'in_progress';

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

-- Mélange de CHAQUE tentative, décidé par le serveur : { "order": [question_id…], "choices": { question_id: [indice d'origine du choix affiché en position 0, 1, …] } }.
-- Illisible pour l'enfant (il ne connaît donc jamais l'ordre d'origine) ; les réponses sont envoyées en positions AFFICHÉES et converties ici.
create table public.quiz_attempt_layouts (
  attempt_id uuid primary key references public.quiz_attempts (id) on delete cascade,
  family_id uuid not null references public.families (id),
  layout jsonb not null
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
  foreach t in array array['quiz_sets', 'quiz_questions', 'quiz_answer_keys', 'quiz_attempts', 'quiz_results', 'quiz_answers', 'quiz_attempt_layouts'] loop
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
create policy quiz_attempt_layouts_select on public.quiz_attempt_layouts for select to authenticated
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

-- Mélange d'une nouvelle tentative (ordre des questions ET des choix de chacune).
create function public.quiz_make_layout(p_set uuid) returns jsonb
language sql volatile security definer set search_path = public as $$
  select jsonb_build_object(
    'order', coalesce(jsonb_agg(q.id order by random()), '[]'::jsonb),
    'choices', coalesce(jsonb_object_agg(q.id::text, (select jsonb_agg(i - 1 order by random()) from generate_series(1, cardinality(q.choices)) i)), '{}'::jsonb))
  from public.quiz_questions q where q.set_id = p_set
$$;
revoke all on function public.quiz_make_layout(uuid) from public, anon, authenticated;

-- Crée une tentative et son mélange (partagé par le démarrage de l'enfant et la relance du parent).
create function public.quiz_new_attempt(p_attempt uuid, p_set public.quiz_sets, p_relaunched_by uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.quiz_attempts (id, family_id, child_id, set_id, relaunched_by) values (p_attempt, p_set.family_id, p_set.child_id, p_set.id, p_relaunched_by);
  insert into public.quiz_attempt_layouts (attempt_id, family_id, layout) values (p_attempt, p_set.family_id, public.quiz_make_layout(p_set.id));
end $$;
revoke all on function public.quiz_new_attempt(uuid, public.quiz_sets, uuid) from public, anon, authenticated;

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

-- Le parent valide une évaluation soumise ET choisit s'il montre la correction à l'enfant (réglage posé ICI, désactivé par défaut) :
-- désactivé → l'enfant voit son score et la liste des questions ratées (énoncé + sa réponse), SANS bonne réponse ni explication ;
-- activé → il voit en plus la bonne réponse et l'explication. Un second appel (déjà validée) ne change rien.
create function public.validate_quiz_attempt(p_attempt uuid, p_show_correction boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; a public.quiz_attempts;
begin
  me := public.quiz_require_parent();
  select * into a from public.quiz_attempts where id = p_attempt and family_id = me.family_id for update;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status = 'validated' then return; end if;
  if a.status <> 'submitted' then raise exception 'not_submitted' using errcode = 'P0001'; end if;
  update public.quiz_attempts set status = 'validated', validated_at = now(), validated_by = me.id, show_correction = coalesce(p_show_correction, false) where id = a.id;
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
  if exists (select 1 from public.quiz_attempts where set_id = s.id and status = 'in_progress') then
    raise exception 'attempt_in_progress' using errcode = 'P0001';
  end if;
  perform public.quiz_new_attempt(p_attempt, s, me.id);
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
         not exists (select 1 from public.quiz_attempts a where a.set_id = s.id and a.child_id = me.child_id)
  from public.quiz_sets s
  left join lateral (select a.id, a.status from public.quiz_attempts a
                     where a.set_id = s.id and a.child_id = me.child_id order by a.started_at desc, a.id limit 1) ev on true
  where s.child_id = me.child_id and s.family_id = me.family_id and s.status = 'published' and s.deleted_at is null
    and exists (select 1 from public.quiz_questions q where q.set_id = s.id)
  order by s.created_at desc, s.id;
end $$;

-- Première évaluation : l'enfant la démarre ; ensuite seul le parent peut en relancer une (relaunch_quiz_evaluation). Le mélange est tiré ICI.
create function public.start_quiz_evaluation(p_set uuid, p_attempt uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; s public.quiz_sets; a public.quiz_attempts;
begin
  me := public.quiz_require_child();
  select * into a from public.quiz_attempts where id = p_attempt;
  if found then
    if a.child_id = me.child_id and a.set_id = p_set then return; end if;
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into s from public.quiz_sets where id = p_set and child_id = me.child_id and family_id = me.family_id and status = 'published' and deleted_at is null for update;
  if not found then raise exception 'set_not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.quiz_attempts where set_id = s.id and child_id = me.child_id) then
    raise exception 'evaluation_already_taken' using errcode = 'P0001';
  end if;
  perform public.quiz_new_attempt(p_attempt, s, null);
end $$;

-- Questions d'UNE tentative en cours, dans l'ordre et avec les choix mélangés par le serveur : SANS clé ni explication.
-- Impossible une fois la tentative envoyée (aucune relecture des questions pour tâtonner).
create function public.child_quiz_questions(p_attempt uuid)
returns table (question_id uuid, "position" int, prompt text, choices text[])
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members; a public.quiz_attempts; lay jsonb; qid text; pos int := 0; q public.quiz_questions;
begin
  me := public.quiz_require_child();
  select * into a from public.quiz_attempts where id = p_attempt and child_id = me.child_id and family_id = me.family_id;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status <> 'in_progress' then raise exception 'attempt_closed' using errcode = 'P0001'; end if;
  select l.layout into lay from public.quiz_attempt_layouts l where l.attempt_id = a.id;
  for qid in select jsonb_array_elements_text(lay->'order') loop
    select * into q from public.quiz_questions x where x.id = qid::uuid;
    question_id := q.id;
    "position" := pos;
    prompt := q.prompt;
    choices := array(select q.choices[(e.value)::int + 1] from jsonb_array_elements_text(lay->'choices'->qid) with ordinality e(value, ord) order by e.ord);
    pos := pos + 1;
    return next;
  end loop;
end $$;

-- Évaluation : toutes les réponses d'un coup (positions AFFICHÉES, converties ici), score calculé ICI, rien n'est renvoyé.
-- Un second envoi est ignoré (idempotent).
create function public.submit_quiz_evaluation(p_attempt uuid, p_answers jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; a public.quiz_attempts; lay jsonb; e jsonb; qid uuid; ch int; orig int; q public.quiz_questions; k public.quiz_answer_keys; sc int := 0; tt int; ok boolean;
begin
  me := public.quiz_require_child();
  select * into a from public.quiz_attempts where id = p_attempt and child_id = me.child_id and family_id = me.family_id for update;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  if a.status <> 'in_progress' then return; end if;  -- double envoi : ignoré
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then raise exception 'invalid_answers' using errcode = 'P0001'; end if;
  select l.layout into lay from public.quiz_attempt_layouts l where l.attempt_id = a.id;
  for e in select * from jsonb_array_elements(p_answers) loop
    begin
      qid := (e->>'question_id')::uuid;
      ch := case when jsonb_typeof(e->'choice') = 'number' then (e->>'choice')::int end;
    exception when others then
      raise exception 'invalid_answers' using errcode = 'P0001';
    end;
    select * into q from public.quiz_questions where id = qid and set_id = a.set_id;
    if not found then raise exception 'invalid_answers' using errcode = 'P0001'; end if;
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
end $$;

-- Résultat d'UNE tentative de l'enfant. Avant validation : l'état seulement. Après : score + (selon le réglage posé par le parent à la validation)
--  * correction désactivée : liste des questions RATÉES (énoncé + sa réponse), sans bonne réponse, sans explication, sans « juste/faux » par question ;
--  * correction activée : toutes les questions avec bonne réponse, explication et juste/faux.
-- Ordre et choix : ceux que l'enfant a vus (mélange de CETTE tentative).
create function public.child_quiz_result(p_attempt uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.members; a public.quiz_attempts; r public.quiz_results; lay jsonb; qid text; q public.quiz_questions; k public.quiz_answer_keys; ans public.quiz_answers;
        perm jsonb; shown text[]; given int; right_pos int; items jsonb := '[]'::jsonb; pos int := 0;
begin
  me := public.quiz_require_child();
  select * into a from public.quiz_attempts where id = p_attempt and child_id = me.child_id and family_id = me.family_id;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status <> 'validated' then
    return jsonb_build_object('status', a.status, 'set_id', a.set_id);
  end if;
  select * into r from public.quiz_results where attempt_id = a.id;
  select l.layout into lay from public.quiz_attempt_layouts l where l.attempt_id = a.id;
  for qid in select jsonb_array_elements_text(lay->'order') loop
    select * into q from public.quiz_questions x where x.id = qid::uuid;
    select * into ans from public.quiz_answers x where x.attempt_id = a.id and x.question_id = q.id;
    perm := lay->'choices'->qid;
    shown := array(select q.choices[(e.value)::int + 1] from jsonb_array_elements_text(perm) with ordinality e(value, ord) order by e.ord);
    given := null;
    if ans.choice_index is not null then
      select (e.ord - 1)::int into given from jsonb_array_elements_text(perm) with ordinality e(value, ord) where (e.value)::int = ans.choice_index;
    end if;
    if a.show_correction then
      select * into k from public.quiz_answer_keys x where x.question_id = q.id;
      select (e.ord - 1)::int into right_pos from jsonb_array_elements_text(perm) with ordinality e(value, ord) where (e.value)::int = k.correct_index;
      items := items || jsonb_build_object('question_id', q.id, 'position', pos, 'prompt', q.prompt, 'choices', to_jsonb(shown), 'choice_index', given,
                                          'correct_index', right_pos, 'explanation', k.explanation, 'is_correct', coalesce(ans.is_correct, false));
    elsif not coalesce(ans.is_correct, false) then
      items := items || jsonb_build_object('question_id', q.id, 'position', pos, 'prompt', q.prompt, 'chosen_text', case when given is null then null else shown[given + 1] end);
    end if;
    pos := pos + 1;
  end loop;
  return jsonb_build_object('status', a.status, 'set_id', a.set_id, 'score', r.score, 'total', r.total, 'validated_at', a.validated_at,
                            'show_correction', a.show_correction, case when a.show_correction then 'questions' else 'missed' end, items);
end $$;

-- Progression de L'enfant sur un jeu : ses tentatives VALIDÉES (jamais un score en attente).
create function public.child_quiz_history(p_set uuid)
returns table (attempt_id uuid, validated_at timestamptz, score int, total int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members;
begin
  me := public.quiz_require_child();
  return query
  select a.id, a.validated_at, r.score, r.total
  from public.quiz_attempts a join public.quiz_results r on r.attempt_id = a.id
  where a.set_id = p_set and a.child_id = me.child_id and a.family_id = me.family_id and a.status = 'validated'
  order by a.validated_at, a.id;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'upsert_quiz_question(uuid, uuid, int, text, text[], int, text)', 'delete_quiz_question(uuid)', 'reorder_quiz_questions(uuid, uuid[])',
    'set_quiz_status(uuid, public.quiz_status)', 'copy_quiz_set(uuid, uuid, uuid)', 'validate_quiz_attempt(uuid, boolean)', 'relaunch_quiz_evaluation(uuid, uuid)',
    'child_quiz_sets()', 'child_quiz_questions(uuid)', 'start_quiz_evaluation(uuid, uuid)', 'submit_quiz_evaluation(uuid, jsonb)', 'child_quiz_result(uuid)', 'child_quiz_history(uuid)'] loop
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
  delete from public.quiz_attempt_layouts where family_id = fid;
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
