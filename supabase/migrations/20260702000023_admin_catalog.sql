-- Espace ADMINISTRATEUR + catalogue de QCM par pays / classe / matière, distribué aux enfants (D-080).
--
-- Vue d'ensemble
--  * `platform_admins` : l'administrateur de la plateforme (Teo). La migration ne crée AUCUNE ligne (aucun e-mail ni identifiant en dur) : la première
--    ligne est insérée une fois par l'humain dans l'éditeur SQL (voir HUMAN_TODO). Toute vérification admin est faite ICI, dans les RPC `security definer`
--    (`catalog_require_admin`), jamais seulement dans l'interface.
--  * Catalogue : `catalog_quizzes` (une case = pays + classe + matière + semaine, avec dates de mise à disposition et d'échéance), `catalog_questions`,
--    `catalog_answer_keys` (clés, « à vérifier », « confirmée » : MÊME séparation que les jeux de famille, D-059/D-061). RLS activée sur toutes les tables
--    nouvelles, AUCUNE politique, AUCUN droit client : tout passe par des RPC. Les clés ne sont lisibles que par l'admin ; le parent ne reçoit les réponses
--    d'un QCM du catalogue que par `parent_attempt_review`, pour une tentative SOUMISE de SON enfant.
--  * Famille : `children.country` / `children.grade` (écrits par le PARENT seulement, RPC `set_child_class`) et `child_subjects` (matières activées par
--    le parent pour chaque enfant, avec un décalage en semaines −4..+4). L'enfant reçoit un QCM du catalogue par RPC (`child_catalog_quizzes`) : publié,
--    pays + classe de CET enfant, matière activée, mise à disposition (décalée) <= jour LOCAL de la famille. Rien n'est copié dans les familles.
--  * Tentatives : `quiz_attempts.catalog_id` (au lieu de `set_id`) ; progression, mélange (D-059), feuille papier (D-062), envoi, validation parent et
--    `show_correction` restent ceux d'aujourd'hui : les RPC d'évaluation lisent les questions par `quiz_attempt_items` (jeu de famille OU catalogue).
--  * L'échéance n'empêche JAMAIS de répondre (D-079). Un QCM dépublié garde ses tentatives ; il n'est plus modifiable tant qu'il en a.

-- ───────────────────────── Identité admin ─────────────────────────
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;
-- aucune politique, aucun droit : on ne s'ajoute pas soi-même, on ne lit pas la liste

-- Ne renvoie que le statut de l'APPELANT.
create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create function public.catalog_require_admin() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.platform_admins where user_id = auth.uid()) then raise exception 'forbidden' using errcode = '42501'; end if;
  return auth.uid();
end $$;
revoke all on function public.catalog_require_admin() from public, anon, authenticated;

-- ───────────────────────── Catalogue ─────────────────────────
create table public.catalog_quizzes (
  id uuid primary key default gen_random_uuid(),
  country text not null check (country in ('VN', 'FR')),
  -- classe en texte (« 5 », « 6E »…), normalisée en majuscules sans espaces autour : même valeur côté admin et côté profil enfant
  grade text not null check (grade = upper(btrim(grade)) and char_length(grade) between 1 and 12),
  -- matière : clé technique (liste fixe côté application : hist_geo, maths, langue_nationale, anglais, sciences…)
  subject text not null check (subject ~ '^[a-z][a-z_]{1,29}$'),
  -- « Tuần N » : étiquette libre, jamais calculée
  week_label text not null check (char_length(btrim(week_label)) between 1 and 40),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  status public.quiz_status not null default 'draft',
  material_kind public.quiz_material_kind not null default 'course',
  kind_detected boolean not null default false,
  paper_support boolean not null default false,
  answer_sheet_only boolean not null default false,
  -- jours LOCAUX de la famille (type date, jamais un timestamp UTC) ; décalables par enfant (child_subjects.week_offset)
  release_on date,
  due_on date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_quizzes_sheet_needs_paper check (not answer_sheet_only or paper_support),
  constraint catalog_quizzes_dates check (release_on is null or due_on is null or due_on >= release_on),
  constraint catalog_quizzes_slot unique (country, grade, subject, week_label)
);
create index catalog_quizzes_class on public.catalog_quizzes (country, grade, subject) where status = 'published';

create table public.catalog_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.catalog_quizzes (id) on delete cascade,
  position int not null check (position >= 0),
  prompt text not null check (char_length(btrim(prompt)) between 1 and 500),
  choices text[] not null check (public.quiz_choices_valid(choices)),
  origin_number int check (origin_number is null or origin_number between 1 and 999),
  needs_figure boolean not null default false,
  -- « Nguồn: … » du fichier source (information pour l'admin ; jamais envoyée à l'enfant)
  source text check (source is null or char_length(source) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index catalog_questions_quiz on public.catalog_questions (quiz_id, position);

create table public.catalog_answer_keys (
  question_id uuid primary key references public.catalog_questions (id) on delete cascade,
  correct_index smallint not null check (correct_index between 0 and 3),
  explanation text check (explanation is null or char_length(explanation) <= 500),
  to_verify boolean not null default false,
  confirmed boolean not null default false
);

create function public.catalog_paper_default() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.material_kind is distinct from old.material_kind then
    new.paper_support := new.material_kind in ('exam', 'exam_key');
    new.answer_sheet_only := false;
  end if;
  return new;
end $$;
create trigger catalog_quizzes_paper_default before insert or update of material_kind on public.catalog_quizzes
  for each row execute function public.catalog_paper_default();
create trigger catalog_quizzes_updated_at before update on public.catalog_quizzes for each row execute function public.set_updated_at();
create trigger catalog_questions_updated_at before update on public.catalog_questions for each row execute function public.set_updated_at();

do $$
declare t text;
begin
  foreach t in array array['catalog_quizzes', 'catalog_questions', 'catalog_answer_keys'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
-- aucune politique, aucun droit : lecture et écriture uniquement par les RPC ci-dessous

-- ───────────────────────── Côté famille : classe de l'enfant, matières activées ─────────────────────────
-- Pays et classe de l'enfant : colonnes de `children` (lisibles par le parent et par l'enfant lui-même, comme le reste de son profil), écrites par RPC
-- seulement (les droits de colonnes de `children` ne changent pas : aucune écriture directe).
alter table public.children
  add column country text check (country is null or country in ('VN', 'FR')),
  add column grade text check (grade is null or (grade = upper(btrim(grade)) and char_length(grade) between 1 and 12)),
  add constraint children_class_both check ((country is null) = (grade is null));

create table public.child_subjects (
  child_id uuid not null,
  family_id uuid not null,
  subject text not null check (subject ~ '^[a-z][a-z_]{1,29}$'),
  -- décalage en semaines (−4..+4) : un enfant en retard ou en avance sur la classe ; appliqué aux deux dates du catalogue
  week_offset smallint not null default 0 check (week_offset between -4 and 4),
  created_at timestamptz not null default now(),
  primary key (child_id, subject),
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade
);
alter table public.child_subjects enable row level security;
revoke all on public.child_subjects from anon, authenticated;

-- ───────────────────────── Tentatives : jeu de famille OU quiz du catalogue ─────────────────────────
alter table public.quiz_attempts
  alter column set_id drop not null,
  add column catalog_id uuid references public.catalog_quizzes (id),
  add constraint quiz_attempts_one_source check ((set_id is null) <> (catalog_id is null));
create unique index quiz_attempts_one_open_catalog on public.quiz_attempts (catalog_id, child_id) where status = 'in_progress' and catalog_id is not null;
create index quiz_attempts_catalog on public.quiz_attempts (catalog_id, child_id) where catalog_id is not null;
-- les réponses et la progression pointent une question du jeu de famille OU du catalogue (UUID uniques) : plus de clé étrangère unique vers quiz_questions ;
-- elles partent avec leur tentative (cascade) et une question ne se supprime jamais tant qu'une tentative existe (jeux modifiables = sans tentative).
alter table public.quiz_answers drop constraint quiz_answers_question_id_fkey;
alter table public.quiz_attempt_progress drop constraint quiz_attempt_progress_question_id_fkey;

-- Questions d'une tentative, quelle qu'en soit la source (INTERNE : jamais appelée par un client).
create function public.quiz_attempt_items(p_attempt uuid)
returns table (question_id uuid, "position" int, prompt text, choices text[], origin_number int, needs_figure boolean, correct_index int, explanation text,
               paper boolean, sheet_only boolean, source_id uuid)
language sql stable security definer set search_path = public as $$
  select q.id, q.position, q.prompt, q.choices, q.origin_number, q.needs_figure, k.correct_index::int, k.explanation, s.paper_support, s.answer_sheet_only, s.id
  from public.quiz_attempts a
  join public.quiz_sets s on s.id = a.set_id
  join public.quiz_questions q on q.set_id = s.id
  join public.quiz_answer_keys k on k.question_id = q.id
  where a.id = p_attempt
  union all
  select c.id, c.position, c.prompt, c.choices, c.origin_number, c.needs_figure, k.correct_index::int, k.explanation, z.paper_support, z.answer_sheet_only, z.id
  from public.quiz_attempts a
  join public.catalog_quizzes z on z.id = a.catalog_id
  join public.catalog_questions c on c.quiz_id = z.id
  join public.catalog_answer_keys k on k.question_id = c.id
  where a.id = p_attempt
$$;
revoke all on function public.quiz_attempt_items(uuid) from public, anon, authenticated;

-- Mélange d'une tentative du catalogue : mêmes règles que `quiz_make_layout` (jeu papier : par numéro d'origine, choix dans l'ordre ; sinon mélange complet).
create function public.catalog_make_layout(p_quiz uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare paper boolean;
begin
  select z.paper_support into paper from public.catalog_quizzes z where z.id = p_quiz;
  if coalesce(paper, false) then
    return jsonb_build_object(
      'order', coalesce((select jsonb_agg(q.id order by q.origin_number nulls last, q.position, q.id) from public.catalog_questions q where q.quiz_id = p_quiz), '[]'::jsonb),
      'choices', coalesce((select jsonb_object_agg(q.id::text, (select jsonb_agg(i - 1 order by i) from generate_series(1, cardinality(q.choices)) i))
                           from public.catalog_questions q where q.quiz_id = p_quiz), '{}'::jsonb));
  end if;
  return (select jsonb_build_object(
    'order', coalesce(jsonb_agg(q.id order by random()), '[]'::jsonb),
    'choices', coalesce(jsonb_object_agg(q.id::text, (select jsonb_agg(i - 1 order by random()) from generate_series(1, cardinality(q.choices)) i)), '{}'::jsonb))
  from public.catalog_questions q where q.quiz_id = p_quiz);
end $$;
revoke all on function public.catalog_make_layout(uuid) from public, anon, authenticated;

create function public.catalog_new_attempt(p_attempt uuid, p_quiz uuid, p_child uuid, p_family uuid, p_relaunched_by uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.quiz_attempts (id, family_id, child_id, catalog_id, relaunched_by) values (p_attempt, p_family, p_child, p_quiz, p_relaunched_by);
  insert into public.quiz_attempt_layouts (attempt_id, family_id, layout) values (p_attempt, p_family, public.catalog_make_layout(p_quiz));
end $$;
revoke all on function public.catalog_new_attempt(uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;

-- ───────────────────────── Disponibilité d'un quiz du catalogue pour un enfant ─────────────────────────
-- INTERNE. Publié + pays/classe de l'enfant + matière ACTIVÉE pour lui ; dates décalées de 7 × décalage ; « disponible » = mise à disposition (décalée)
-- <= JOUR LOCAL de la famille (jamais l'UTC). L'échéance n'intervient pas dans la disponibilité.
create function public.catalog_for_child(p_child uuid)
returns table (quiz_id uuid, subject text, week_label text, title text, question_count int, release_on date, due_on date, available boolean,
               paper_support boolean, answer_sheet_only boolean)
language sql stable security definer set search_path = public as $$
  select z.id, z.subject, z.week_label, z.title,
         (select count(*)::int from public.catalog_questions q where q.quiz_id = z.id),
         z.release_on + 7 * s.week_offset, z.due_on + 7 * s.week_offset,
         (z.release_on + 7 * s.week_offset) <= public.family_today(c.family_id),
         z.paper_support, z.answer_sheet_only
  from public.children c
  join public.child_subjects s on s.child_id = c.id
  join public.catalog_quizzes z on z.country = c.country and z.grade = c.grade and z.subject = s.subject
  where c.id = p_child and c.deleted_at is null and z.status = 'published' and z.release_on is not null
    and exists (select 1 from public.catalog_questions q where q.quiz_id = z.id)
$$;
revoke all on function public.catalog_for_child(uuid) from public, anon, authenticated;

-- ───────────────────────── RPC parent : classe, matières, décalage ─────────────────────────
create function public.set_child_class(p_child uuid, p_country text, p_grade text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; g text;
begin
  me := public.quiz_require_parent();
  if not exists (select 1 from public.children where id = p_child and family_id = me.family_id and deleted_at is null) then
    raise exception 'child_not_found' using errcode = 'P0002';
  end if;
  g := nullif(upper(btrim(coalesce(p_grade, ''))), '');
  if p_country is null and g is null then
    update public.children set country = null, grade = null where id = p_child;
    return;
  end if;
  if p_country is null or p_country not in ('VN', 'FR') then raise exception 'invalid_country' using errcode = 'P0001'; end if;
  if g is null or char_length(g) > 12 then raise exception 'invalid_grade' using errcode = 'P0001'; end if;
  update public.children set country = p_country, grade = g where id = p_child;
end $$;

create function public.set_child_subject(p_child uuid, p_subject text, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public.quiz_require_parent();
  if not exists (select 1 from public.children where id = p_child and family_id = me.family_id and deleted_at is null) then
    raise exception 'child_not_found' using errcode = 'P0002';
  end if;
  if p_subject is null or p_subject !~ '^[a-z][a-z_]{1,29}$' or p_active is null then raise exception 'invalid_subject' using errcode = 'P0001'; end if;
  if p_active then
    insert into public.child_subjects (child_id, family_id, subject) values (p_child, me.family_id, p_subject) on conflict (child_id, subject) do nothing;
  else
    delete from public.child_subjects where child_id = p_child and subject = p_subject;
  end if;
end $$;

-- Décalage d'UNE semaine (p_delta = −1 ou +1), par enfant et par matière, borné à −4..+4. Un enfant en retard : −1 repousse la mise à disposition ET l'échéance.
create function public.shift_child_subject(p_child uuid, p_subject text, p_delta int) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; cur int;
begin
  me := public.quiz_require_parent();
  if not exists (select 1 from public.children where id = p_child and family_id = me.family_id and deleted_at is null) then
    raise exception 'child_not_found' using errcode = 'P0002';
  end if;
  if p_delta is null or p_delta not in (-1, 1) then raise exception 'invalid_shift' using errcode = 'P0001'; end if;
  select s.week_offset into cur from public.child_subjects s where s.child_id = p_child and s.subject = p_subject for update;
  if not found then raise exception 'subject_not_active' using errcode = 'P0001'; end if;
  if cur + p_delta not between -4 and 4 then raise exception 'invalid_shift' using errcode = 'P0001'; end if;
  update public.child_subjects set week_offset = cur + p_delta where child_id = p_child and subject = p_subject;
end $$;

create function public.parent_child_subjects(p_child uuid) returns table (subject text, week_offset int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members;
begin
  me := public.quiz_require_parent();
  if not exists (select 1 from public.children where id = p_child and family_id = me.family_id and deleted_at is null) then
    raise exception 'child_not_found' using errcode = 'P0002';
  end if;
  return query select s.subject, s.week_offset::int from public.child_subjects s where s.child_id = p_child and s.family_id = me.family_id order by s.subject;
end $$;

-- Vue du PARENT sur les quiz du catalogue de SON enfant (classe + matières activées) : dates décalées, disponibilité, dernière tentative, nombre de
-- réponses (tentative en cours) et score (jamais les réponses : voir `parent_attempt_review`).
create function public.parent_catalog_overview(p_child uuid)
returns table (quiz_id uuid, subject text, week_label text, title text, question_count int, release_on date, due_on date, available boolean,
               attempt_id uuid, attempt_status public.quiz_attempt_status, answered_count int, score int, total int)
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
         r.score, r.total
  from public.catalog_for_child(p_child) f
  left join lateral (select a.id, a.status from public.quiz_attempts a where a.catalog_id = f.quiz_id and a.child_id = p_child and a.family_id = me.family_id
                     order by a.started_at desc, a.id limit 1) ev on true
  left join public.quiz_results r on r.attempt_id = ev.id
  order by f.release_on, f.subject, f.week_label;
end $$;

-- Tentatives du catalogue d'UN enfant (parent) : à valider, historique.
create function public.parent_catalog_attempts(p_child uuid)
returns table (attempt_id uuid, quiz_id uuid, title text, subject text, week_label text, status public.quiz_attempt_status, started_at timestamptz,
               submitted_at timestamptz, validated_at timestamptz, score int, total int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members;
begin
  me := public.quiz_require_parent();
  if not exists (select 1 from public.children where id = p_child and family_id = me.family_id and deleted_at is null) then
    raise exception 'child_not_found' using errcode = 'P0002';
  end if;
  return query
  select a.id, z.id, z.title, z.subject, z.week_label, a.status, a.started_at, a.submitted_at, a.validated_at, r.score, r.total
  from public.quiz_attempts a
  join public.catalog_quizzes z on z.id = a.catalog_id
  left join public.quiz_results r on r.attempt_id = a.id
  where a.child_id = p_child and a.family_id = me.family_id
  order by a.started_at desc, a.id;
end $$;

-- Le parent voit les BONNES RÉPONSES d'une tentative SOUMISE (ou validée) de SON enfant, pour valider et expliquer : jamais avant l'envoi, jamais pour
-- l'enfant d'une autre famille. Marche pour un quiz du catalogue ET pour un jeu de famille. Les questions sont dans l'ordre de la source.
create function public.parent_attempt_review(p_attempt uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.members; a public.quiz_attempts; r public.quiz_results; title text; items jsonb;
begin
  me := public.quiz_require_parent();
  select * into a from public.quiz_attempts where id = p_attempt and family_id = me.family_id;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status not in ('submitted', 'validated') then raise exception 'not_submitted' using errcode = 'P0001'; end if;
  select * into r from public.quiz_results where attempt_id = a.id;
  title := coalesce((select z.title from public.catalog_quizzes z where z.id = a.catalog_id), (select s.title from public.quiz_sets s where s.id = a.set_id));
  select coalesce(jsonb_agg(jsonb_build_object(
           'question_id', i.question_id, 'position', i."position", 'number', i.origin_number, 'needs_figure', i.needs_figure, 'prompt', i.prompt, 'choices', to_jsonb(i.choices),
           'correct_index', i.correct_index, 'explanation', i.explanation, 'choice_index', ans.choice_index, 'is_correct', coalesce(ans.is_correct, false))
         order by i."position", i.question_id), '[]'::jsonb)
    into items
  from public.quiz_attempt_items(a.id) i
  left join public.quiz_answers ans on ans.attempt_id = a.id and ans.question_id = i.question_id;
  return jsonb_build_object('attempt_id', a.id, 'child_id', a.child_id, 'status', a.status, 'title', title, 'catalog_id', a.catalog_id, 'set_id', a.set_id,
                            'score', r.score, 'total', r.total, 'show_correction', a.show_correction, 'validated_at', a.validated_at, 'questions', items);
end $$;

-- Nouvelle tentative décidée par le parent pour un quiz du catalogue (historique conservé ; impossible tant qu'une tentative est en cours).
create function public.relaunch_catalog_evaluation(p_quiz uuid, p_child uuid, p_attempt uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public.quiz_require_parent();
  if exists (select 1 from public.quiz_attempts where id = p_attempt) then
    if exists (select 1 from public.quiz_attempts where id = p_attempt and family_id = me.family_id and catalog_id = p_quiz and child_id = p_child) then return; end if;
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.children where id = p_child and family_id = me.family_id and deleted_at is null) then
    raise exception 'child_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.catalog_for_child(p_child) f where f.quiz_id = p_quiz and f.available) then raise exception 'set_not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.quiz_attempts where catalog_id = p_quiz and child_id = p_child and status = 'in_progress') then
    raise exception 'attempt_in_progress' using errcode = 'P0001';
  end if;
  perform public.catalog_new_attempt(p_attempt, p_quiz, p_child, me.family_id, me.id);
end $$;

-- ───────────────────────── RPC enfant ─────────────────────────
-- Les quiz du catalogue AUXQUELS L'ENFANT A DROIT : disponibles seulement (jamais non publié, futur, d'une autre classe ou d'un autre pays, ni d'une matière
-- non activée). Dates décalées incluses. Jamais de clé, de score ni de drapeau « à vérifier ».
create function public.child_catalog_quizzes()
returns table (quiz_id uuid, subject text, week_label text, title text, question_count int, evaluation_attempt_id uuid, evaluation_status public.quiz_attempt_status,
               can_start_evaluation boolean, paper_support boolean, answer_sheet_only boolean, due_on date, answered_count int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members;
begin
  me := public.quiz_require_child();
  return query
  select f.quiz_id, f.subject, f.week_label, f.title, f.question_count, ev.id, ev.status,
         not exists (select 1 from public.quiz_attempts a where a.catalog_id = f.quiz_id and a.child_id = me.child_id),
         f.paper_support, f.answer_sheet_only, f.due_on,
         case when ev.status = 'in_progress' then (select count(*)::int from public.quiz_attempt_progress p where p.attempt_id = ev.id) else 0 end
  from public.catalog_for_child(me.child_id) f
  left join lateral (select a.id, a.status from public.quiz_attempts a where a.catalog_id = f.quiz_id and a.child_id = me.child_id
                     order by a.started_at desc, a.id limit 1) ev on true
  where f.available
  order by f.release_on desc, f.subject, f.week_label;
end $$;

-- Première évaluation d'un quiz du catalogue (ensuite seul le parent relance). Le mélange est tiré ICI. La date limite n'intervient jamais.
create function public.start_catalog_evaluation(p_quiz uuid, p_attempt uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public.quiz_require_child();
  if exists (select 1 from public.quiz_attempts where id = p_attempt) then
    if exists (select 1 from public.quiz_attempts where id = p_attempt and child_id = me.child_id and catalog_id = p_quiz) then return; end if;
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.catalog_for_child(me.child_id) f where f.quiz_id = p_quiz and f.available) then
    raise exception 'set_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.quiz_attempts where catalog_id = p_quiz and child_id = me.child_id) then
    raise exception 'evaluation_already_taken' using errcode = 'P0001';
  end if;
  perform public.catalog_new_attempt(p_attempt, p_quiz, me.child_id, me.family_id, null);
end $$;

-- ───────────────────────── Évaluation : jeux de famille ET catalogue ─────────────────────────
-- Mêmes règles que D-059 / D-062 / D-079 ; les questions se lisent par `quiz_attempt_items`.
create or replace function public.child_quiz_questions(p_attempt uuid)
returns table (question_id uuid, "position" int, prompt text, choices text[], origin_number int, needs_figure boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members; a public.quiz_attempts; lay jsonb; qid text; pos int := 0; q record; sheet boolean;
begin
  me := public.quiz_require_child();
  select * into a from public.quiz_attempts where id = p_attempt and child_id = me.child_id and family_id = me.family_id;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status <> 'in_progress' then raise exception 'attempt_closed' using errcode = 'P0001'; end if;
  select (i.paper and i.sheet_only) into sheet from public.quiz_attempt_items(a.id) i limit 1;
  select l.layout into lay from public.quiz_attempt_layouts l where l.attempt_id = a.id;
  for qid in select jsonb_array_elements_text(lay->'order') loop
    select * into q from public.quiz_attempt_items(a.id) i where i.question_id = qid::uuid;
    question_id := q.question_id;
    "position" := pos;
    if coalesce(sheet, false) then
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

create or replace function public.save_quiz_progress(p_attempt uuid, p_question uuid, p_choice int) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; a public.quiz_attempts; q record;
begin
  me := public.quiz_require_child();
  select * into a from public.quiz_attempts where id = p_attempt and child_id = me.child_id and family_id = me.family_id for share;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  if a.status <> 'in_progress' then raise exception 'attempt_closed' using errcode = 'P0001'; end if;
  select * into q from public.quiz_attempt_items(a.id) i where i.question_id = p_question;
  if not found then raise exception 'invalid_answers' using errcode = 'P0001'; end if;
  if p_choice is null then
    delete from public.quiz_attempt_progress where attempt_id = a.id and question_id = q.question_id;
    return;
  end if;
  if p_choice < 0 or p_choice >= cardinality(q.choices) then raise exception 'invalid_answers' using errcode = 'P0001'; end if;
  insert into public.quiz_attempt_progress (attempt_id, question_id, family_id, child_id, choice)
  values (a.id, q.question_id, a.family_id, a.child_id, p_choice)
  on conflict (attempt_id, question_id) do update set choice = excluded.choice, saved_at = now();
end $$;

create or replace function public.submit_quiz_evaluation(p_attempt uuid, p_answers jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; a public.quiz_attempts; lay jsonb; eff jsonb; e jsonb; qid uuid; ch int; orig int; q record; sc int := 0; tt int; ok boolean;
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
    select * into q from public.quiz_attempt_items(a.id) i where i.question_id = qid;
    if not found then raise exception 'invalid_answers' using errcode = 'P0001'; end if;
    if ch is null then
      select p.choice::int into ch from public.quiz_attempt_progress p where p.attempt_id = a.id and p.question_id = q.question_id;
    end if;
    orig := null;
    if ch is not null then
      if ch < 0 or ch >= cardinality(q.choices) then raise exception 'invalid_answers' using errcode = 'P0001'; end if;
      orig := (lay->'choices'->(qid::text)->>ch)::int;  -- position affichée → indice d'origine
    end if;
    ok := orig is not null and q.correct_index = orig;
    begin
      insert into public.quiz_answers (attempt_id, question_id, family_id, child_id, choice_index, is_correct) values (a.id, q.question_id, a.family_id, a.child_id, orig, ok);
    exception when unique_violation then
      raise exception 'invalid_answers' using errcode = 'P0001';
    end;
    if ok then sc := sc + 1; end if;
  end loop;
  select count(*)::int into tt from public.quiz_attempt_items(a.id);
  insert into public.quiz_results (attempt_id, family_id, child_id, score, total) values (a.id, a.family_id, a.child_id, sc, tt);
  update public.quiz_attempts set status = 'submitted', submitted_at = now() where id = a.id;
  delete from public.quiz_attempt_progress where attempt_id = a.id;
end $$;

create or replace function public.child_quiz_result(p_attempt uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.members; a public.quiz_attempts; r public.quiz_results; lay jsonb; qid text; q record; ans public.quiz_answers;
        perm jsonb; shown text[]; given int; right_pos int; items jsonb := '[]'::jsonb; pos int := 0; sheet boolean; paper boolean; shown_prompt text; src uuid;
begin
  me := public.quiz_require_child();
  select * into a from public.quiz_attempts where id = p_attempt and child_id = me.child_id and family_id = me.family_id;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  src := coalesce(a.set_id, a.catalog_id);
  if a.status <> 'validated' then
    return jsonb_build_object('status', a.status, 'set_id', src);
  end if;
  select i.paper, (i.paper and i.sheet_only) into paper, sheet from public.quiz_attempt_items(a.id) i limit 1;
  sheet := coalesce(sheet, false);
  select * into r from public.quiz_results where attempt_id = a.id;
  select l.layout into lay from public.quiz_attempt_layouts l where l.attempt_id = a.id;
  for qid in select jsonb_array_elements_text(lay->'order') loop
    select * into q from public.quiz_attempt_items(a.id) i where i.question_id = qid::uuid;
    select * into ans from public.quiz_answers x where x.attempt_id = a.id and x.question_id = q.question_id;
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
      select (e.ord - 1)::int into right_pos from jsonb_array_elements_text(perm) with ordinality e(value, ord) where (e.value)::int = q.correct_index;
      items := items || jsonb_build_object('question_id', q.question_id, 'position', pos, 'number', q.origin_number, 'prompt', shown_prompt, 'choices', to_jsonb(shown), 'choice_index', given,
                                          'correct_index', right_pos, 'explanation', case when sheet then null else q.explanation end, 'is_correct', coalesce(ans.is_correct, false));
    elsif not coalesce(ans.is_correct, false) then
      items := items || jsonb_build_object('question_id', q.question_id, 'position', pos, 'number', q.origin_number, 'prompt', shown_prompt, 'chosen_text', case when given is null then null else shown[given + 1] end);
    end if;
    pos := pos + 1;
  end loop;
  return jsonb_build_object('status', a.status, 'set_id', src, 'score', r.score, 'total', r.total, 'validated_at', a.validated_at,
                            'show_correction', a.show_correction, 'paper_support', coalesce(paper, false), 'answer_sheet_only', sheet,
                            case when a.show_correction then 'questions' else 'missed' end, items);
end $$;

-- Historique de l'enfant sur un quiz (jeu de famille OU catalogue) : tentatives VALIDÉES seulement.
create or replace function public.child_quiz_history(p_set uuid)
returns table (attempt_id uuid, validated_at timestamptz, score int, total int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members;
begin
  me := public.quiz_require_child();
  return query
  select a.id, a.validated_at, r.score, r.total
  from public.quiz_attempts a join public.quiz_results r on r.attempt_id = a.id
  where (a.set_id = p_set or a.catalog_id = p_set) and a.child_id = me.child_id and a.family_id = me.family_id and a.status = 'validated'
  order by a.validated_at, a.id;
end $$;

-- ───────────────────────── RPC admin : catalogue ─────────────────────────
-- Brouillon sans tentative (comme un jeu de famille : pour corriger un quiz déjà passé, en créer un autre).
create function public.catalog_editable(p_quiz uuid) returns public.catalog_quizzes
language plpgsql security definer set search_path = public as $$
declare z public.catalog_quizzes;
begin
  perform public.catalog_require_admin();
  select * into z from public.catalog_quizzes where id = p_quiz for update;
  if not found then raise exception 'set_not_found' using errcode = 'P0002'; end if;
  if z.status <> 'draft' then raise exception 'set_published' using errcode = 'P0001'; end if;
  if exists (select 1 from public.quiz_attempts where catalog_id = z.id) then raise exception 'set_has_attempts' using errcode = 'P0001'; end if;
  return z;
end $$;
revoke all on function public.catalog_editable(uuid) from public, anon, authenticated;

-- Normalisation et validation d'une case (INTERNE).
create function public.catalog_check_slot(p_country text, p_grade text, p_subject text, p_week text, p_title text)
returns table (grade text, week_label text, title text)
language plpgsql immutable as $$
begin
  if p_country is null or p_country not in ('VN', 'FR') then raise exception 'invalid_country' using errcode = 'P0001'; end if;
  grade := upper(btrim(coalesce(p_grade, '')));
  if char_length(grade) not between 1 and 12 then raise exception 'invalid_grade' using errcode = 'P0001'; end if;
  if p_subject is null or p_subject !~ '^[a-z][a-z_]{1,29}$' then raise exception 'invalid_subject' using errcode = 'P0001'; end if;
  week_label := btrim(coalesce(p_week, ''));
  if char_length(week_label) not between 1 and 40 then raise exception 'invalid_week' using errcode = 'P0001'; end if;
  title := btrim(coalesce(p_title, ''));
  if char_length(title) not between 1 and 80 then raise exception 'invalid_title' using errcode = 'P0001'; end if;
  return next;
end $$;
revoke all on function public.catalog_check_slot(text, text, text, text, text) from public, anon, authenticated;

create function public.catalog_list(p_country text default null, p_grade text default null, p_subject text default null)
returns table (id uuid, country text, grade text, subject text, week_label text, title text, status public.quiz_status, release_on date, due_on date,
               material_kind public.quiz_material_kind, question_count int, to_verify_count int, attempts_count int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.catalog_require_admin();
  return query
  select z.id, z.country, z.grade, z.subject, z.week_label, z.title, z.status, z.release_on, z.due_on, z.material_kind,
         (select count(*)::int from public.catalog_questions q where q.quiz_id = z.id),
         (select count(*)::int from public.catalog_questions q join public.catalog_answer_keys k on k.question_id = q.id where q.quiz_id = z.id and k.to_verify),
         (select count(*)::int from public.quiz_attempts a where a.catalog_id = z.id)
  from public.catalog_quizzes z
  where (p_country is null or z.country = p_country) and (p_grade is null or z.grade = upper(btrim(p_grade))) and (p_subject is null or z.subject = p_subject)
  order by z.country, z.grade, z.subject, z.release_on nulls last, z.week_label;
end $$;

create function public.catalog_get(p_quiz uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare z public.catalog_quizzes;
begin
  perform public.catalog_require_admin();
  select * into z from public.catalog_quizzes where id = p_quiz;
  if not found then raise exception 'set_not_found' using errcode = 'P0002'; end if;
  return to_jsonb(z) || jsonb_build_object('attempts_count', (select count(*)::int from public.quiz_attempts a where a.catalog_id = z.id));
end $$;

create function public.catalog_questions_admin(p_quiz uuid)
returns table (id uuid, "position" int, prompt text, choices text[], origin_number int, needs_figure boolean, source text, correct_index int, explanation text,
               to_verify boolean, confirmed boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.catalog_require_admin();
  return query
  select q.id, q.position, q.prompt, q.choices, q.origin_number, q.needs_figure, q.source, k.correct_index::int, k.explanation, k.to_verify, k.confirmed
  from public.catalog_questions q join public.catalog_answer_keys k on k.question_id = q.id
  where q.quiz_id = p_quiz order by q.position, q.id;
end $$;

-- Case vide (saisie manuelle) : brouillon sans question.
create function public.catalog_create_quiz(p_quiz uuid, p_country text, p_grade text, p_subject text, p_week text, p_title text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; c record;
begin
  uid := public.catalog_require_admin();
  if exists (select 1 from public.catalog_quizzes where id = p_quiz) then return; end if;  -- rejeu idempotent
  select * into c from public.catalog_check_slot(p_country, p_grade, p_subject, p_week, p_title);
  begin
    insert into public.catalog_quizzes (id, country, grade, subject, week_label, title, created_by) values (p_quiz, p_country, c.grade, p_subject, c.week_label, c.title, uid);
  exception when unique_violation then
    raise exception 'catalog_slot_taken' using errcode = 'P0001';
  end;
end $$;

-- Brouillon généré par l'IA (même séparation clé / question, mêmes invariants que `create_quiz_draft`) ; appelée avec le JWT de l'admin par l'Edge Function.
-- `p_replace` : relance sur le MÊME brouillon (jamais un quiz publié ou ayant des tentatives).
create function public.create_catalog_draft(
  p_quiz uuid, p_country text, p_grade text, p_subject text, p_week text, p_title text, p_questions jsonb,
  p_kind public.quiz_material_kind default 'course', p_kind_detected boolean default false, p_replace boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; z public.catalog_quizzes; c record; q jsonb; i int := 0; qid uuid; ch text[]; correct int; v_prompt text; expl text; num int; figure boolean; verify boolean; src text;
begin
  uid := public.catalog_require_admin();
  select * into z from public.catalog_quizzes where id = p_quiz;
  if found then
    if not coalesce(p_replace, false) then return; end if;  -- rejeu idempotent
    z := public.catalog_editable(p_quiz);                    -- brouillon sans tentative, sinon erreur
  elsif coalesce(p_replace, false) then
    raise exception 'set_not_found' using errcode = 'P0002';
  end if;
  select * into c from public.catalog_check_slot(p_country, p_grade, p_subject, p_week, p_title);
  if p_kind is null then raise exception 'invalid_kind' using errcode = 'P0001'; end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) not between 1 and 50 then
    raise exception 'invalid_question' using errcode = 'P0001';
  end if;
  begin
    if z.id is null then
      insert into public.catalog_quizzes (id, country, grade, subject, week_label, title, material_kind, kind_detected, created_by)
      values (p_quiz, p_country, c.grade, p_subject, c.week_label, c.title, p_kind, coalesce(p_kind_detected, false), uid);
    else
      delete from public.catalog_questions where quiz_id = z.id;  -- les clés partent avec (cascade)
      update public.catalog_quizzes set country = p_country, grade = c.grade, subject = p_subject, week_label = c.week_label, title = c.title,
             material_kind = p_kind, kind_detected = coalesce(p_kind_detected, false) where id = z.id;
    end if;
  exception when unique_violation then
    raise exception 'catalog_slot_taken' using errcode = 'P0001';
  end;
  for q in select * from jsonb_array_elements(p_questions) loop
    if jsonb_typeof(q) <> 'object' or jsonb_typeof(q->'choices') <> 'array' or jsonb_typeof(q->'prompt') <> 'string' or jsonb_typeof(q->'correct') <> 'number' then
      raise exception 'invalid_question' using errcode = 'P0001';
    end if;
    v_prompt := btrim(q->>'prompt');
    ch := array(select btrim(x) from jsonb_array_elements_text(q->'choices') x);
    correct := (q->>'correct')::int;
    expl := case when jsonb_typeof(q->'explanation') = 'string' then nullif(btrim(q->>'explanation'), '') end;
    src := case when jsonb_typeof(q->'source') = 'string' then nullif(btrim(q->>'source'), '') end;
    if char_length(v_prompt) not between 1 and 500 then raise exception 'invalid_question' using errcode = 'P0001'; end if;
    if not public.quiz_choices_valid(ch) then raise exception 'invalid_choices' using errcode = 'P0001'; end if;
    if (select count(distinct lower(x)) from unnest(ch) x) <> cardinality(ch) then raise exception 'duplicate_choices' using errcode = 'P0001'; end if;
    if correct < 0 or correct >= cardinality(ch) then raise exception 'invalid_correct' using errcode = 'P0001'; end if;
    if expl is not null and char_length(expl) > 500 then raise exception 'invalid_question' using errcode = 'P0001'; end if;
    if src is not null and char_length(src) > 200 then src := left(src, 200); end if;
    num := null;
    if q->'number' is not null and jsonb_typeof(q->'number') <> 'null' then
      if jsonb_typeof(q->'number') <> 'number' or (q->>'number') !~ '^[0-9]{1,3}$' or (q->>'number')::int not between 1 and 999 then
        raise exception 'invalid_number' using errcode = 'P0001';
      end if;
      num := (q->>'number')::int;
    end if;
    figure := coalesce(case when jsonb_typeof(q->'needs_figure') = 'boolean' then (q->>'needs_figure')::boolean end, false);
    verify := coalesce(case when jsonb_typeof(q->'to_verify') = 'boolean' then (q->>'to_verify')::boolean end, false) or figure;
    qid := gen_random_uuid();
    insert into public.catalog_questions (id, quiz_id, position, prompt, choices, origin_number, needs_figure, source) values (qid, p_quiz, i, v_prompt, ch, num, figure, src);
    insert into public.catalog_answer_keys (question_id, correct_index, explanation, to_verify, confirmed) values (qid, correct, expl, verify, false);
    i := i + 1;
  end loop;
end $$;

-- Saisie d'une question : réponse choisie à la main = confirmation ; modifier la bonne réponse d'une question existante la confirme aussi (et lève
-- « à vérifier ») ; modifier seulement l'énoncé ou les choix ne confirme rien (comme `upsert_quiz_question`).
create function public.catalog_upsert_question(p_id uuid, p_quiz uuid, p_position int, p_prompt text, p_choices text[], p_correct int, p_explanation text, p_source text default null)
returns void language plpgsql security definer set search_path = public as $$
declare z public.catalog_quizzes; existing public.catalog_questions; k public.catalog_answer_keys; n int; expl text; src text;
begin
  z := public.catalog_editable(p_quiz);
  p_prompt := btrim(coalesce(p_prompt, ''));
  if char_length(p_prompt) not between 1 and 500 then raise exception 'invalid_question' using errcode = 'P0001'; end if;
  if not public.quiz_choices_valid(p_choices) then raise exception 'invalid_choices' using errcode = 'P0001'; end if;
  n := cardinality(p_choices);
  if (select count(distinct lower(btrim(x))) from unnest(p_choices) x) <> n then raise exception 'duplicate_choices' using errcode = 'P0001'; end if;
  if p_correct is null or p_correct < 0 or p_correct >= n then raise exception 'invalid_correct' using errcode = 'P0001'; end if;
  expl := nullif(btrim(coalesce(p_explanation, '')), '');
  if expl is not null and char_length(expl) > 500 then raise exception 'invalid_question' using errcode = 'P0001'; end if;
  src := nullif(btrim(coalesce(p_source, '')), '');
  if src is not null and char_length(src) > 200 then raise exception 'invalid_question' using errcode = 'P0001'; end if;
  if p_position is null or p_position < 0 then raise exception 'invalid_question' using errcode = 'P0001'; end if;
  select * into existing from public.catalog_questions where id = p_id;
  if found then
    if existing.quiz_id <> z.id then raise exception 'forbidden' using errcode = '42501'; end if;
    update public.catalog_questions set position = p_position, prompt = p_prompt, choices = (select array_agg(btrim(x)) from unnest(p_choices) x), source = src where id = p_id;
    select * into k from public.catalog_answer_keys where question_id = p_id;
    update public.catalog_answer_keys
    set correct_index = p_correct, explanation = expl, confirmed = (k.confirmed or k.correct_index <> p_correct), to_verify = (k.to_verify and k.correct_index = p_correct)
    where question_id = p_id;
  else
    insert into public.catalog_questions (id, quiz_id, position, prompt, choices, source) values (p_id, z.id, p_position, p_prompt, (select array_agg(btrim(x)) from unnest(p_choices) x), src);
    insert into public.catalog_answer_keys (question_id, correct_index, explanation, confirmed) values (p_id, p_correct, expl, true);
  end if;
end $$;

create function public.catalog_delete_question(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare q public.catalog_questions;
begin
  perform public.catalog_require_admin();
  select * into q from public.catalog_questions where id = p_id;
  if not found then return; end if;  -- déjà supprimée : rejeu idempotent
  perform public.catalog_editable(q.quiz_id);
  delete from public.catalog_questions where id = p_id;
end $$;

create function public.catalog_reorder_questions(p_quiz uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare z public.catalog_quizzes;
begin
  z := public.catalog_editable(p_quiz);
  if exists (select 1 from unnest(p_ids) i where not exists (select 1 from public.catalog_questions q where q.id = i and q.quiz_id = z.id)) then
    raise exception 'invalid_question' using errcode = 'P0001';
  end if;
  update public.catalog_questions q set position = o.pos - 1 from unnest(p_ids) with ordinality as o(id, pos) where q.id = o.id and q.quiz_id = z.id;
end $$;

-- L'admin CONFIRME les réponses (grille « Đáp án », D-061) : [{ "question_id": uuid, "correct": int }, …], atomique.
create function public.catalog_confirm_answers(p_quiz uuid, p_answers jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare z public.catalog_quizzes; a jsonb; qid uuid; n int; c int;
begin
  z := public.catalog_editable(p_quiz);
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) not between 1 and 100 then
    raise exception 'invalid_question' using errcode = 'P0001';
  end if;
  for a in select * from jsonb_array_elements(p_answers) loop
    if jsonb_typeof(a) <> 'object' or jsonb_typeof(a->'correct') <> 'number' or jsonb_typeof(a->'question_id') <> 'string' then
      raise exception 'invalid_question' using errcode = 'P0001';
    end if;
    begin
      qid := (a->>'question_id')::uuid;
    exception when others then
      raise exception 'invalid_question' using errcode = 'P0001';
    end;
    c := (a->>'correct')::int;
    select cardinality(q.choices) into n from public.catalog_questions q where q.id = qid and q.quiz_id = z.id;
    if not found then raise exception 'invalid_question' using errcode = 'P0001'; end if;
    if c < 0 or c >= n then raise exception 'invalid_correct' using errcode = 'P0001'; end if;
    update public.catalog_answer_keys set correct_index = c, confirmed = true, to_verify = false where question_id = qid;
  end loop;
end $$;

create function public.catalog_update_info(p_quiz uuid, p_week text, p_title text) returns void
language plpgsql security definer set search_path = public as $$
declare z public.catalog_quizzes; c record;
begin
  z := public.catalog_editable(p_quiz);
  select * into c from public.catalog_check_slot(z.country, z.grade, z.subject, p_week, p_title);
  begin
    update public.catalog_quizzes set week_label = c.week_label, title = c.title where id = z.id;
  exception when unique_violation then
    raise exception 'catalog_slot_taken' using errcode = 'P0001';
  end;
end $$;

create function public.catalog_set_kind(p_quiz uuid, p_kind public.quiz_material_kind) returns void
language plpgsql security definer set search_path = public as $$
declare z public.catalog_quizzes;
begin
  z := public.catalog_editable(p_quiz);
  if p_kind is null then raise exception 'invalid_kind' using errcode = 'P0001'; end if;
  update public.catalog_quizzes set material_kind = p_kind, kind_detected = false where id = z.id;
end $$;

create function public.catalog_set_paper(p_quiz uuid, p_paper boolean, p_sheet_only boolean) returns void
language plpgsql security definer set search_path = public as $$
declare z public.catalog_quizzes;
begin
  z := public.catalog_editable(p_quiz);
  if p_paper is null or p_sheet_only is null or (p_sheet_only and not p_paper) then raise exception 'invalid_paper' using errcode = 'P0001'; end if;
  update public.catalog_quizzes set paper_support = p_paper, answer_sheet_only = p_sheet_only where id = z.id;
end $$;

-- Dates (jours locaux de la famille) : modifiables à tout moment, même publié ; un quiz publié ne peut pas perdre ses dates.
create function public.catalog_set_dates(p_quiz uuid, p_release date, p_due date) returns void
language plpgsql security definer set search_path = public as $$
declare z public.catalog_quizzes;
begin
  perform public.catalog_require_admin();
  select * into z from public.catalog_quizzes where id = p_quiz for update;
  if not found then raise exception 'set_not_found' using errcode = 'P0002'; end if;
  if p_release is not null and p_due is not null and p_due < p_release then raise exception 'invalid_dates' using errcode = 'P0001'; end if;
  if (p_release is not null and p_release not between date '2020-01-01' and date '2100-01-01') or (p_due is not null and p_due not between date '2020-01-01' and date '2100-01-01') then
    raise exception 'invalid_dates' using errcode = 'P0001';
  end if;
  if z.status = 'published' and (p_release is null or p_due is null) then raise exception 'dates_required' using errcode = 'P0001'; end if;
  update public.catalog_quizzes set release_on = p_release, due_on = p_due where id = z.id;
end $$;

-- Publication : mêmes règles que `set_quiz_status` (D-061) + dates obligatoires. Dépublier est libre et ne supprime AUCUNE tentative.
create function public.catalog_set_status(p_quiz uuid, p_status public.quiz_status) returns void
language plpgsql security definer set search_path = public as $$
declare z public.catalog_quizzes;
begin
  perform public.catalog_require_admin();
  select * into z from public.catalog_quizzes where id = p_quiz for update;
  if not found then raise exception 'set_not_found' using errcode = 'P0002'; end if;
  if z.status = p_status then return; end if;
  if p_status = 'published' then
    if not exists (select 1 from public.catalog_questions where quiz_id = z.id) then raise exception 'no_questions' using errcode = 'P0001'; end if;
    if exists (select 1 from public.catalog_questions q join public.catalog_answer_keys k on k.question_id = q.id where q.quiz_id = z.id and k.to_verify) then
      raise exception 'answers_to_verify' using errcode = 'P0001';
    end if;
    if z.material_kind in ('exam', 'exam_key')
       and exists (select 1 from public.catalog_questions q join public.catalog_answer_keys k on k.question_id = q.id where q.quiz_id = z.id and not k.confirmed) then
      raise exception 'answers_not_confirmed' using errcode = 'P0001';
    end if;
    if z.release_on is null or z.due_on is null then raise exception 'dates_required' using errcode = 'P0001'; end if;
  end if;
  update public.catalog_quizzes set status = p_status where id = z.id;
end $$;

create function public.catalog_delete_quiz(p_quiz uuid) returns void
language plpgsql security definer set search_path = public as $$
declare z public.catalog_quizzes;
begin
  perform public.catalog_require_admin();
  if not exists (select 1 from public.catalog_quizzes where id = p_quiz) then return; end if;  -- déjà supprimé : rejeu idempotent
  z := public.catalog_editable(p_quiz);
  delete from public.catalog_quizzes where id = z.id;
end $$;

-- ───────────────────────── IA : cible admin et quota ─────────────────────────
-- Autorisation de l'appelant (JWT de l'admin) pour la génération « catalogue » : DOIT être admin (vérifié ici, côté serveur) ; le quota `ai_usage` s'applique
-- à l'admin comme aux autres, sur la famille dont il est membre (parent).
create function public.ai_target_admin() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.members; tz text;
begin
  perform public.catalog_require_admin();
  me := public.quiz_require_parent();
  select timezone into tz from public.families where id = me.family_id;
  return jsonb_build_object('family_id', me.family_id, 'member_id', me.id, 'timezone', tz);
end $$;

-- La relance gratuite (même brouillon, après correction du type) vaut aussi pour un brouillon du catalogue sans tentative.
create or replace function public.ai_reserve(p_family uuid, p_member uuid, p_limit int, p_now timestamptz default now(), p_set uuid default null, p_retry boolean default false)
returns table (usage_id uuid, allowed boolean, used int, free boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare d date; n int; new_id uuid;
begin
  perform 1 from public.families f where f.id = p_family for update;
  if not found then raise exception 'family_not_found' using errcode = 'P0002'; end if;
  d := public.family_today(p_family, p_now);
  select count(*)::int into n from public.ai_usage u where u.family_id = p_family and u.day = d and u.counted;
  if coalesce(p_retry, false) and p_set is not null
     and exists (select 1 from public.ai_usage u where u.family_id = p_family and u.set_id = p_set and u.counted and u.status = 'success')
     and not exists (select 1 from public.ai_usage u where u.family_id = p_family and u.set_id = p_set and not u.counted and u.status in ('started', 'success'))
     and (exists (select 1 from public.quiz_sets s where s.id = p_set and s.family_id = p_family and s.status = 'draft' and s.deleted_at is null
                  and not exists (select 1 from public.quiz_attempts a where a.set_id = s.id))
          or exists (select 1 from public.catalog_quizzes z where z.id = p_set and z.status = 'draft'
                     and not exists (select 1 from public.quiz_attempts a where a.catalog_id = z.id))) then
    insert into public.ai_usage (family_id, member_id, day, set_id, counted) values (p_family, p_member, d, p_set, false) returning id into new_id;
    return query select new_id, true, n, true;
    return;
  end if;
  if n >= p_limit then
    return query select null::uuid, false, n, false;
    return;
  end if;
  insert into public.ai_usage (family_id, member_id, day, set_id) values (p_family, p_member, d, p_set) returning id into new_id;
  return query select new_id, true, n + 1, false;
end $$;

-- ───────────────────────── Droits ─────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    -- parent
    'set_child_class(uuid, text, text)', 'set_child_subject(uuid, text, boolean)', 'shift_child_subject(uuid, text, int)', 'parent_child_subjects(uuid)',
    'parent_catalog_overview(uuid)', 'parent_catalog_attempts(uuid)', 'parent_attempt_review(uuid)', 'relaunch_catalog_evaluation(uuid, uuid, uuid)',
    -- enfant
    'child_catalog_quizzes()', 'start_catalog_evaluation(uuid, uuid)',
    -- admin (la vérification se fait DANS la fonction)
    'catalog_list(text, text, text)', 'catalog_get(uuid)', 'catalog_questions_admin(uuid)', 'catalog_create_quiz(uuid, text, text, text, text, text)',
    'create_catalog_draft(uuid, text, text, text, text, text, jsonb, public.quiz_material_kind, boolean, boolean)',
    'catalog_upsert_question(uuid, uuid, int, text, text[], int, text, text)', 'catalog_delete_question(uuid)', 'catalog_reorder_questions(uuid, uuid[])',
    'catalog_confirm_answers(uuid, jsonb)', 'catalog_update_info(uuid, text, text)', 'catalog_set_kind(uuid, public.quiz_material_kind)', 'catalog_set_paper(uuid, boolean, boolean)',
    'catalog_set_dates(uuid, date, date)', 'catalog_set_status(uuid, public.quiz_status)', 'catalog_delete_quiz(uuid)', 'ai_target_admin()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
