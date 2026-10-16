-- D-081 : import d'administration « un seul fichier ». Classes en LISTE FERMÉE par pays (VN : 1 à 12 ; FR : CP, CE1, CE2, CM1, CM2, 6E, 5E, 4E, 3E, 2DE, 1RE, TERM) validées
-- par la base (`catalog_check_slot`, `set_child_class`, `create_catalog_draft`) ; dates d'ouverture / d'échéance écrites avec le brouillon dans UNE transaction.
-- La migration 23 (déjà appliquée) n'est pas modifiée : les fonctions sont remplacées ici. Les valeurs existantes sont normalisées SANS PERTE (jamais supprimées ni mises à NULL).

-- ───────────────────────── Normalisation d'une classe saisie (INTERNE) ─────────────────────────
-- Saisie tolérante → forme canonique du pays, ou NULL si la classe n'existe pas dans ce pays. Miroir de `normalizeGradeFor` (apps/mobile/src/domain/catalog.ts), mêmes cas testés.
create function public.catalog_normalize_grade(p_country text, p_raw text) returns text
language plpgsql immutable set search_path = public as $$
declare s text; m text[];
begin
  if p_country is null or p_raw is null then return null; end if;
  s := lower(btrim(p_raw));
  s := regexp_replace(s, '^(l[^\s\d]{1,3}p|classe|class|grade|niveau)[\s:.-]*', '');
  s := regexp_replace(s, '[\s._-]', '', 'g');
  if p_country = 'VN' then
    m := regexp_match(s, '^0?([1-9]|1[0-2])$');
    return m[1];
  elsif p_country = 'FR' then
    if s = 'cp' then return 'CP'; end if;
    m := regexp_match(s, '^(ce|cm)([12])$');
    if m is not null then return upper(m[1]) || m[2]; end if;
    m := regexp_match(s, '^([3-6])(e|è|eme|ème|°)$');
    if m is not null then return m[1] || 'E'; end if;
    if s ~ '^(2de|2nde|2d|seconde)$' then return '2DE'; end if;
    if s ~ '^(1re|1ere|1ère|premiere|première)$' then return '1RE'; end if;
    if s ~ '^(term|tle|terminale)$' then return 'TERM'; end if;
  end if;
  return null;
end $$;
revoke all on function public.catalog_normalize_grade(text, text) from public, anon, authenticated;

-- ───────────────────────── Validation d'une case (remplace la version 23) ─────────────────────────
create or replace function public.catalog_check_slot(p_country text, p_grade text, p_subject text, p_week text, p_title text)
returns table (grade text, week_label text, title text)
language plpgsql immutable as $$
begin
  if p_country is null or p_country not in ('VN', 'FR') then raise exception 'invalid_country' using errcode = 'P0001'; end if;
  grade := public.catalog_normalize_grade(p_country, p_grade);
  if grade is null then raise exception 'invalid_grade' using errcode = 'P0001'; end if;
  if p_subject is null or p_subject !~ '^[a-z][a-z_]{1,29}$' then raise exception 'invalid_subject' using errcode = 'P0001'; end if;
  week_label := btrim(coalesce(p_week, ''));
  if char_length(week_label) not between 1 and 40 then raise exception 'invalid_week' using errcode = 'P0001'; end if;
  title := btrim(coalesce(p_title, ''));
  if char_length(title) not between 1 and 80 then raise exception 'invalid_title' using errcode = 'P0001'; end if;
  return next;
end $$;

-- ───────────────────────── Classe de l'enfant (remplace la version 23) ─────────────────────────
create or replace function public.set_child_class(p_child uuid, p_country text, p_grade text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; g text;
begin
  me := public.quiz_require_parent();
  if not exists (select 1 from public.children where id = p_child and family_id = me.family_id and deleted_at is null) then
    raise exception 'child_not_found' using errcode = 'P0002';
  end if;
  if p_country is null and nullif(btrim(coalesce(p_grade, '')), '') is null then
    update public.children set country = null, grade = null where id = p_child;
    return;
  end if;
  if p_country is null or p_country not in ('VN', 'FR') then raise exception 'invalid_country' using errcode = 'P0001'; end if;
  g := public.catalog_normalize_grade(p_country, p_grade);
  if g is null then raise exception 'invalid_grade' using errcode = 'P0001'; end if;
  update public.children set country = p_country, grade = g where id = p_child;
end $$;

-- ───────────────────────── Brouillon du catalogue + dates, atomique (remplace la version 23) ─────────────────────────
drop function public.create_catalog_draft(uuid, text, text, text, text, text, jsonb, public.quiz_material_kind, boolean, boolean);
create function public.create_catalog_draft(
  p_quiz uuid, p_country text, p_grade text, p_subject text, p_week text, p_title text, p_questions jsonb,
  p_kind public.quiz_material_kind default 'course', p_kind_detected boolean default false, p_replace boolean default false,
  p_release date default null, p_due date default null
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
  -- dates (jours locaux) : les deux ou aucune ; écrites dans LA MÊME transaction que le brouillon (tout ou rien)
  if (p_release is null) <> (p_due is null) then raise exception 'invalid_dates' using errcode = 'P0001'; end if;
  if p_release is not null and (p_due < p_release or p_release not between date '2020-01-01' and date '2100-01-01' or p_due not between date '2020-01-01' and date '2100-01-01') then
    raise exception 'invalid_dates' using errcode = 'P0001';
  end if;
  if p_kind is null then raise exception 'invalid_kind' using errcode = 'P0001'; end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) not between 1 and 50 then
    raise exception 'invalid_question' using errcode = 'P0001';
  end if;
  begin
    if z.id is null then
      insert into public.catalog_quizzes (id, country, grade, subject, week_label, title, material_kind, kind_detected, release_on, due_on, created_by)
      values (p_quiz, p_country, c.grade, p_subject, c.week_label, c.title, p_kind, coalesce(p_kind_detected, false), p_release, p_due, uid);
    else
      delete from public.catalog_questions where quiz_id = z.id;  -- les clés partent avec (cascade)
      update public.catalog_quizzes set country = p_country, grade = c.grade, subject = p_subject, week_label = c.week_label, title = c.title,
             material_kind = p_kind, kind_detected = coalesce(p_kind_detected, false),
             release_on = coalesce(p_release, release_on), due_on = coalesce(p_due, due_on) where id = z.id;
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
revoke all on function public.create_catalog_draft(uuid, text, text, text, text, text, jsonb, public.quiz_material_kind, boolean, boolean, date, date) from public, anon;
grant execute on function public.create_catalog_draft(uuid, text, text, text, text, text, jsonb, public.quiz_material_kind, boolean, boolean, date, date) to authenticated;

-- ───────────────────────── Une case = un QCM, sans tenir compte de la casse ni des espaces de la semaine ─────────────────────────
-- « Tuần 7 », « tuần 7 » et « Tuần  7 » sont la MÊME semaine : plus de doublon par simple différence de saisie (la contrainte de la migration 23 est remplacée).
alter table public.catalog_quizzes drop constraint catalog_quizzes_slot;
create unique index catalog_quizzes_slot on public.catalog_quizzes (country, grade, subject, lower(regexp_replace(btrim(week_label), '\s+', ' ', 'g')));

-- ───────────────────────── Valeurs existantes, sans perte (INTERNE) ─────────────────────────
-- Remplace par la forme canonique les classes déjà enregistrées lorsqu'elles se normalisent ; une valeur qui ne correspond à aucune classe est CONSERVÉE telle quelle
-- (signalée), jamais supprimée. Un quiz du catalogue dont la forme canonique occuperait déjà une case est laissé en l'état (signalé).
create function public.catalog_normalize_existing_grades() returns int
language plpgsql security definer set search_path = public as $$
declare r record; g text; changed int := 0;
begin
  for r in select id, country, grade from public.children where country is not null and grade is not null loop
    g := public.catalog_normalize_grade(r.country, r.grade);
    if g is null then
      raise notice 'classe conservée telle quelle (hors liste) : enfant % %/%', r.id, r.country, r.grade;
    elsif g <> r.grade then
      update public.children set grade = g where id = r.id;
      changed := changed + 1;
    end if;
  end loop;
  for r in select id, country, grade from public.catalog_quizzes loop
    g := public.catalog_normalize_grade(r.country, r.grade);
    if g is null then
      raise notice 'classe conservée telle quelle (hors liste) : quiz % %/%', r.id, r.country, r.grade;
    elsif g <> r.grade then
      begin
        update public.catalog_quizzes set grade = g where id = r.id;
        changed := changed + 1;
      exception when unique_violation then
        raise notice 'classe non normalisée (case déjà occupée) : quiz % %/% → %', r.id, r.country, r.grade, g;
      end;
    end if;
  end loop;
  return changed;
end $$;
revoke all on function public.catalog_normalize_existing_grades() from public, anon, authenticated;
select public.catalog_normalize_existing_grades();
