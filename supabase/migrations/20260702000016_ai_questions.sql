-- « Révisions » PR B (D-057) : génération des questions par IA depuis un document (Edge Function `generate-questions`).
-- Cette migration ne contient ni clé d'API ni contenu de document : elle porte seulement
--  * le compteur / journal d'usage (famille, jour local, jetons, succès/échec — JAMAIS de contenu) servant au quota quotidien ;
--  * `ai_target` : autorise l'appelant (parent de la famille, enfant cible dans la famille) avec SON jeton ;
--  * `create_quiz_draft` : enregistre le résultat de l'IA comme jeu en BROUILLON, d'un seul bloc (jamais publié automatiquement).

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  member_id uuid not null references public.members (id),
  -- jour LOCAL de la famille (jamais dérivé de l'UTC)
  day date not null,
  status text not null default 'started' check (status in ('started', 'success', 'failed')),
  failure text check (failure is null or char_length(failure) <= 40),
  model text check (model is null or char_length(model) <= 80),
  input_tokens int check (input_tokens is null or input_tokens >= 0),
  output_tokens int check (output_tokens is null or output_tokens >= 0),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index ai_usage_family_day on public.ai_usage (family_id, day);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;
-- lecture : parents de la famille (aucune écriture client ; le journal est tenu par la fonction avec la clé service)
create policy ai_usage_select on public.ai_usage for select to authenticated
  using (family_id = public.my_family_id() and public.is_parent());

-- Autorisation de l'appelant (exécutée avec le JWT du parent) : renvoie famille, membre, fuseau et, si demandé, l'enfant cible.
create function public.ai_target(p_child uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.members; tz text; c public.children;
begin
  me := public.quiz_require_parent();
  select timezone into tz from public.families where id = me.family_id;
  if p_child is null then
    return jsonb_build_object('family_id', me.family_id, 'member_id', me.id, 'timezone', tz);
  end if;
  select * into c from public.children where id = p_child and family_id = me.family_id and deleted_at is null;
  if not found then raise exception 'child_not_found' using errcode = 'P0002'; end if;
  return jsonb_build_object('family_id', me.family_id, 'member_id', me.id, 'timezone', tz, 'child_id', c.id, 'child_name', c.name);
end $$;
revoke all on function public.ai_target(uuid) from public, anon;
grant execute on function public.ai_target(uuid) to authenticated;

-- Réserve une génération pour aujourd'hui (jour local de la famille) : atomique (verrou de la famille), refuse au-delà du quota.
create function public.ai_reserve(p_family uuid, p_member uuid, p_limit int, p_now timestamptz default now())
returns table (usage_id uuid, allowed boolean, used int)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare d date; n int; new_id uuid;
begin
  perform 1 from public.families f where f.id = p_family for update;
  if not found then raise exception 'family_not_found' using errcode = 'P0002'; end if;
  d := public.family_today(p_family, p_now);
  select count(*)::int into n from public.ai_usage u where u.family_id = p_family and u.day = d;
  if n >= p_limit then
    return query select null::uuid, false, n;
    return;
  end if;
  insert into public.ai_usage (family_id, member_id, day) values (p_family, p_member, d) returning id into new_id;
  return query select new_id, true, n + 1;
end $$;
revoke all on function public.ai_reserve(uuid, uuid, int, timestamptz) from public, anon, authenticated;
grant execute on function public.ai_reserve(uuid, uuid, int, timestamptz) to service_role;

create function public.ai_finish(p_id uuid, p_status text, p_failure text, p_model text, p_input int, p_output int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('success', 'failed') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  update public.ai_usage
  set status = p_status, failure = left(p_failure, 40), model = left(p_model, 80), input_tokens = p_input, output_tokens = p_output, finished_at = now()
  where id = p_id and status = 'started';
end $$;
revoke all on function public.ai_finish(uuid, text, text, text, int, int) from public, anon, authenticated;
grant execute on function public.ai_finish(uuid, text, text, text, int, int) to service_role;

create function public.ai_usage_today(p_family uuid, p_now timestamptz default now()) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.ai_usage u where u.family_id = p_family and u.day = public.family_today(p_family, p_now)
$$;
revoke all on function public.ai_usage_today(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.ai_usage_today(uuid, timestamptz) to service_role;

-- Enregistre un jeu généré : TOUJOURS en brouillon, d'un seul bloc, mêmes règles que la saisie manuelle (3 à 4 choix distincts,
-- une bonne réponse dans la plage, longueurs bornées). Rejeu idempotent sur p_set. Appelée avec le JWT du parent.
-- p_questions : [{ "prompt": text, "choices": [text…], "correct": int, "explanation": text|null }, …]
create function public.create_quiz_draft(p_set uuid, p_child uuid, p_title text, p_subject text, p_questions jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; q jsonb; i int := 0; qid uuid; ch text[]; correct int; prompt text; expl text; title text; subject text;
begin
  me := public.quiz_require_parent();
  if exists (select 1 from public.quiz_sets where id = p_set) then
    if exists (select 1 from public.quiz_sets where id = p_set and family_id = me.family_id) then return; end if;
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.children where id = p_child and family_id = me.family_id and deleted_at is null) then
    raise exception 'child_not_found' using errcode = 'P0002';
  end if;
  title := btrim(coalesce(p_title, ''));
  subject := nullif(btrim(coalesce(p_subject, '')), '');
  if char_length(title) not between 1 and 80 or (subject is not null and char_length(subject) > 40) then raise exception 'invalid_title' using errcode = 'P0001'; end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) not between 1 and 50 then
    raise exception 'invalid_question' using errcode = 'P0001';
  end if;
  insert into public.quiz_sets (id, family_id, child_id, title, subject, status, created_by) values (p_set, me.family_id, p_child, title, subject, 'draft', me.id);
  for q in select * from jsonb_array_elements(p_questions) loop
    if jsonb_typeof(q) <> 'object' or jsonb_typeof(q->'choices') <> 'array' or jsonb_typeof(q->'prompt') <> 'string' or jsonb_typeof(q->'correct') <> 'number' then
      raise exception 'invalid_question' using errcode = 'P0001';
    end if;
    prompt := btrim(q->>'prompt');
    ch := array(select btrim(x) from jsonb_array_elements_text(q->'choices') x);
    correct := (q->>'correct')::int;
    expl := case when jsonb_typeof(q->'explanation') = 'string' then nullif(btrim(q->>'explanation'), '') end;
    if char_length(prompt) not between 1 and 500 then raise exception 'invalid_question' using errcode = 'P0001'; end if;
    if not public.quiz_choices_valid(ch) then raise exception 'invalid_choices' using errcode = 'P0001'; end if;
    if (select count(distinct lower(x)) from unnest(ch) x) <> cardinality(ch) then raise exception 'duplicate_choices' using errcode = 'P0001'; end if;
    if correct < 0 or correct >= cardinality(ch) then raise exception 'invalid_correct' using errcode = 'P0001'; end if;
    if expl is not null and char_length(expl) > 500 then raise exception 'invalid_question' using errcode = 'P0001'; end if;
    qid := gen_random_uuid();
    insert into public.quiz_questions (id, set_id, family_id, position, prompt, choices) values (qid, p_set, me.family_id, i, prompt, ch);
    insert into public.quiz_answer_keys (question_id, family_id, correct_index, explanation) values (qid, me.family_id, correct, expl);
    i := i + 1;
  end loop;
end $$;
revoke all on function public.create_quiz_draft(uuid, uuid, text, text, jsonb) from public, anon;
grant execute on function public.create_quiz_draft(uuid, uuid, text, text, jsonb) to authenticated;

-- Suppression de la famille : purge aussi le journal d'usage.
create or replace function public.delete_family() returns uuid[]
language plpgsql security definer set search_path = public as $$
declare me public.members; fid uuid; users uuid[];
begin
  me := public.require_member();
  if me.role <> 'parent' then raise exception 'forbidden' using errcode = '42501'; end if;
  fid := me.family_id;
  select coalesce(array_agg(user_id), '{}') into users from public.members where family_id = fid;

  perform set_config('app.deleting_family', 'on', true);
  delete from public.ai_usage where family_id = fid;
  delete from public.quiz_answers where family_id = fid;
  delete from public.quiz_results where family_id = fid;
  delete from public.quiz_attempt_layouts where family_id = fid;
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
