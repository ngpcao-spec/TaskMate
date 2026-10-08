-- « Révisions : supports multiples » (D-061) : le parent a des supports différents selon la matière (examen papier, examen avec corrigé, cours,
-- liste à apprendre). Cette migration porte uniquement des MÉTADONNÉES : aucun fichier, aucune figure, aucun bucket n'est conservé.
--
--  * `quiz_sets.material_kind` : type de support ENREGISTRÉ sur le jeu (corrigeable par le parent, jamais par écriture directe) ; il pilote la règle de
--    publication ci-dessous. `kind_detected` : ce type a été choisi par l'IA (mode Auto) et non par le parent.
--  * `quiz_questions.origin_number` (numéro d'origine « Câu 5 ») et `needs_figure` (la question s'appuie sur une figure absente du texte).
--  * `quiz_answer_keys.to_verify` (« réponse à vérifier ») et `confirmed` (réponse confirmée par le parent) : dans la table de la CLÉ, donc
--    JAMAIS lisibles par l'enfant (ni par table ni par RPC, D-059 inchangé).
--  * Règle de publication, côté SERVEUR (`set_quiz_status`) : refusée tant qu'une question « à vérifier » n'est pas confirmée (tous les types), et,
--    pour les types examen, tant qu'une réponse n'est pas confirmée. Un type détecté par l'IA ne peut donc pas affaiblir le contrôle : il se
--    corrige (`set_quiz_material_kind`), mais une question signalée reste bloquante quel que soit le type.
--  * Relance gratuite après correction du type : `ai_usage.set_id` / `counted` (une relance par jeu ne consomme pas de quota).

create type public.quiz_material_kind as enum ('exam', 'exam_key', 'course', 'list');

alter table public.quiz_sets
  add column material_kind public.quiz_material_kind not null default 'course',
  add column kind_detected boolean not null default false;

alter table public.quiz_questions
  add column origin_number int check (origin_number is null or origin_number between 1 and 999),
  add column needs_figure boolean not null default false;

alter table public.quiz_answer_keys
  add column to_verify boolean not null default false,
  add column confirmed boolean not null default false;

alter table public.ai_usage
  add column set_id uuid,
  add column counted boolean not null default true;
create index ai_usage_set on public.ai_usage (family_id, set_id) where set_id is not null;

-- ───────────────────────── RPC parent ─────────────────────────
-- Type de support corrigé par le parent (brouillon sans tentative). Les nouvelles règles de publication s'appliquent aussitôt.
create function public.set_quiz_material_kind(p_set uuid, p_kind public.quiz_material_kind) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; s public.quiz_sets;
begin
  me := public.quiz_require_parent();
  s := public.quiz_editable_set(p_set, me.family_id);
  if p_kind is null then raise exception 'invalid_kind' using errcode = 'P0001'; end if;
  update public.quiz_sets set material_kind = p_kind, kind_detected = false where id = s.id;
end $$;

-- Le parent CONFIRME les réponses (grille « Đáp án ») : p_answers = [{ "question_id": uuid, "correct": int }, …] ; la réponse choisie devient la clé,
-- confirmée, et le signalement « à vérifier » est levé. Atomique : tout ou rien.
create function public.confirm_quiz_answers(p_set uuid, p_answers jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; s public.quiz_sets; a jsonb; qid uuid; n int; c int;
begin
  me := public.quiz_require_parent();
  s := public.quiz_editable_set(p_set, me.family_id);
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
    select cardinality(q.choices) into n from public.quiz_questions q where q.id = qid and q.set_id = s.id;
    if not found then raise exception 'invalid_question' using errcode = 'P0001'; end if;
    if c < 0 or c >= n then raise exception 'invalid_correct' using errcode = 'P0001'; end if;
    update public.quiz_answer_keys set correct_index = c, confirmed = true, to_verify = false where question_id = qid;
  end loop;
end $$;

-- Saisie d'une question : une réponse choisie à la main est une confirmation ; modifier la bonne réponse d'une question existante la confirme aussi
-- (et lève « à vérifier ») ; modifier seulement l'énoncé ou les choix ne confirme rien.
create or replace function public.upsert_quiz_question(p_id uuid, p_set uuid, p_position int, p_prompt text, p_choices text[], p_correct int, p_explanation text)
returns void language plpgsql security definer set search_path = public as $$
declare me public.members; s public.quiz_sets; existing public.quiz_questions; k public.quiz_answer_keys; n int; expl text;
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
    select * into k from public.quiz_answer_keys where question_id = p_id;
    update public.quiz_answer_keys
    set correct_index = p_correct, explanation = expl,
        confirmed = (k.confirmed or k.correct_index <> p_correct),
        to_verify = (k.to_verify and k.correct_index = p_correct)
    where question_id = p_id;
  else
    insert into public.quiz_questions (id, set_id, family_id, position, prompt, choices) values (p_id, s.id, s.family_id, p_position, p_prompt, p_choices);
    insert into public.quiz_answer_keys (question_id, family_id, correct_index, explanation, confirmed) values (p_id, s.family_id, p_correct, expl, true);
  end if;
end $$;

-- Publication : règle de sécurité côté serveur (voir l'en-tête). Dépublier reste libre.
create or replace function public.set_quiz_status(p_set uuid, p_status public.quiz_status) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; s public.quiz_sets;
begin
  me := public.quiz_require_parent();
  select * into s from public.quiz_sets where id = p_set and family_id = me.family_id and deleted_at is null for update;
  if not found then raise exception 'set_not_found' using errcode = 'P0002'; end if;
  if s.status = p_status then return; end if;
  if p_status = 'published' then
    if not exists (select 1 from public.quiz_questions where set_id = s.id) then
      raise exception 'no_questions' using errcode = 'P0001';
    end if;
    -- une réponse signalée « à vérifier » bloque la publication, QUEL QUE SOIT le type (y compris un type détecté par l'IA)
    if exists (select 1 from public.quiz_questions q join public.quiz_answer_keys k on k.question_id = q.id where q.set_id = s.id and k.to_verify) then
      raise exception 'answers_to_verify' using errcode = 'P0001';
    end if;
    -- types examen : chaque réponse doit avoir été confirmée par le parent
    if s.material_kind in ('exam', 'exam_key')
       and exists (select 1 from public.quiz_questions q join public.quiz_answer_keys k on k.question_id = q.id where q.set_id = s.id and not k.confirmed) then
      raise exception 'answers_not_confirmed' using errcode = 'P0001';
    end if;
  end if;
  update public.quiz_sets set status = p_status where id = s.id;
end $$;

-- Copie : reprend le type et les drapeaux (la copie reste un brouillon ; « détecté par l'IA » ne se copie pas).
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

-- Jeu généré par l'IA : TOUJOURS un brouillon, d'un seul bloc, jamais publié. Les réponses ne sont JAMAIS confirmées à la création ; une question qui
-- dépend d'une figure est TOUJOURS « à vérifier » (invariant appliqué ici, quoi qu'envoie la fonction). `p_replace` : relance après correction du
-- type, sur le MÊME brouillon (même enfant, sans tentative) — remplace les questions, jamais un jeu publié.
-- p_questions : [{ "prompt": text, "choices": [text…], "correct": int, "explanation": text|null, "number": int|null, "needs_figure": bool, "to_verify": bool }, …]
drop function public.create_quiz_draft(uuid, uuid, text, text, jsonb);
create function public.create_quiz_draft(
  p_set uuid, p_child uuid, p_title text, p_subject text, p_questions jsonb,
  p_kind public.quiz_material_kind default 'course', p_kind_detected boolean default false, p_replace boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; s public.quiz_sets; q jsonb; i int := 0; qid uuid; ch text[]; correct int; v_prompt text; expl text; v_title text; v_subject text;
        num int; figure boolean; verify boolean;
begin
  me := public.quiz_require_parent();
  select * into s from public.quiz_sets where id = p_set;
  if found then
    if s.family_id <> me.family_id then raise exception 'forbidden' using errcode = '42501'; end if;
    if not coalesce(p_replace, false) then return; end if;  -- rejeu idempotent
    if s.child_id <> p_child or s.deleted_at is not null then raise exception 'forbidden' using errcode = '42501'; end if;
    s := public.quiz_editable_set(p_set, me.family_id);  -- brouillon sans tentative, sinon erreur
  elsif coalesce(p_replace, false) then
    raise exception 'set_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.children where id = p_child and family_id = me.family_id and deleted_at is null) then
    raise exception 'child_not_found' using errcode = 'P0002';
  end if;
  v_title := btrim(coalesce(p_title, ''));
  v_subject := nullif(btrim(coalesce(p_subject, '')), '');
  if char_length(v_title) not between 1 and 80 or (v_subject is not null and char_length(v_subject) > 40) then raise exception 'invalid_title' using errcode = 'P0001'; end if;
  if p_kind is null then raise exception 'invalid_kind' using errcode = 'P0001'; end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) not between 1 and 50 then
    raise exception 'invalid_question' using errcode = 'P0001';
  end if;
  if s.id is null then
    insert into public.quiz_sets (id, family_id, child_id, title, subject, status, created_by, material_kind, kind_detected)
    values (p_set, me.family_id, p_child, v_title, v_subject, 'draft', me.id, p_kind, coalesce(p_kind_detected, false));
  else
    delete from public.quiz_questions where set_id = s.id;  -- les clés partent avec (cascade)
    update public.quiz_sets set title = v_title, subject = v_subject, material_kind = p_kind, kind_detected = coalesce(p_kind_detected, false) where id = s.id;
  end if;
  for q in select * from jsonb_array_elements(p_questions) loop
    if jsonb_typeof(q) <> 'object' or jsonb_typeof(q->'choices') <> 'array' or jsonb_typeof(q->'prompt') <> 'string' or jsonb_typeof(q->'correct') <> 'number' then
      raise exception 'invalid_question' using errcode = 'P0001';
    end if;
    v_prompt := btrim(q->>'prompt');
    ch := array(select btrim(x) from jsonb_array_elements_text(q->'choices') x);
    correct := (q->>'correct')::int;
    expl := case when jsonb_typeof(q->'explanation') = 'string' then nullif(btrim(q->>'explanation'), '') end;
    if char_length(v_prompt) not between 1 and 500 then raise exception 'invalid_question' using errcode = 'P0001'; end if;
    if not public.quiz_choices_valid(ch) then raise exception 'invalid_choices' using errcode = 'P0001'; end if;
    if (select count(distinct lower(x)) from unnest(ch) x) <> cardinality(ch) then raise exception 'duplicate_choices' using errcode = 'P0001'; end if;
    if correct < 0 or correct >= cardinality(ch) then raise exception 'invalid_correct' using errcode = 'P0001'; end if;
    if expl is not null and char_length(expl) > 500 then raise exception 'invalid_question' using errcode = 'P0001'; end if;
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
    insert into public.quiz_questions (id, set_id, family_id, position, prompt, choices, origin_number, needs_figure)
    values (qid, p_set, me.family_id, i, v_prompt, ch, num, figure);
    insert into public.quiz_answer_keys (question_id, family_id, correct_index, explanation, to_verify, confirmed)
    values (qid, me.family_id, correct, expl, verify, false);
    i := i + 1;
  end loop;
end $$;
revoke all on function public.create_quiz_draft(uuid, uuid, text, text, jsonb, public.quiz_material_kind, boolean, boolean) from public, anon;
grant execute on function public.create_quiz_draft(uuid, uuid, text, text, jsonb, public.quiz_material_kind, boolean, boolean) to authenticated;

-- ───────────────────────── Quota : relance gratuite après correction du type ─────────────────────────
-- Une génération réussie pour un jeu (p_set) donne droit à UNE relance gratuite sur le MÊME brouillon (sans tentative) : elle ne compte pas dans le
-- quota du jour (et passe même au-delà de la limite). Une relance gratuite échouée ne la consomme pas. Toute autre demande suit le quota normal.
drop function public.ai_reserve(uuid, uuid, int, timestamptz);
create function public.ai_reserve(p_family uuid, p_member uuid, p_limit int, p_now timestamptz default now(), p_set uuid default null, p_retry boolean default false)
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
     and exists (select 1 from public.quiz_sets s where s.id = p_set and s.family_id = p_family and s.status = 'draft' and s.deleted_at is null
                 and not exists (select 1 from public.quiz_attempts a where a.set_id = s.id)) then
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
revoke all on function public.ai_reserve(uuid, uuid, int, timestamptz, uuid, boolean) from public, anon, authenticated;
grant execute on function public.ai_reserve(uuid, uuid, int, timestamptz, uuid, boolean) to service_role;

create or replace function public.ai_usage_today(p_family uuid, p_now timestamptz default now()) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.ai_usage u where u.family_id = p_family and u.day = public.family_today(p_family, p_now) and u.counted
$$;

-- Droits des nouvelles fonctions parent.
do $$
declare f text;
begin
  foreach f in array array['set_quiz_material_kind(uuid, public.quiz_material_kind)', 'confirm_quiz_answers(uuid, jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
