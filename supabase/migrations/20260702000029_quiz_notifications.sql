-- D-088 : notifications des quiz « Ôn tập » + diagnostic d'envoi. Aucune table nouvelle (RLS inchangée).
--   1. `submit_quiz_evaluation` journalise `quiz_submitted` (parents notifiés : « à valider ») à la PREMIÈRE soumission seulement ;
--   2. `validate_quiz_attempt` journalise `quiz_validated` (l'enfant est notifié) à la validation EFFECTIVE seulement ;
--   3. `devices.last_push_at` / `last_push_result` : résultat du dernier envoi, écrit par `send-push` (rôle de service) — aucune écriture client ;
--   4. `my_push_status(p_endpoint)` : l'état d'enregistrement des appareils DU MEMBRE appelant, lu de la base (jamais d'un état local du navigateur).
-- Les écritures d'activité restent dans les RPC `security definer` (`log_activity` : aucun droit client) ; `activity_log` est lisible par les PARENTS seulement
-- (un enfant n'y lit jamais rien, D-052) et n'a aucun droit d'écriture client.

-- ───────────────────────── 1. Soumission : quiz_submitted ─────────────────────────
create or replace function public.submit_quiz_evaluation(p_attempt uuid, p_answers jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; a public.quiz_attempts; lay jsonb; eff jsonb; e jsonb; qid uuid; ch int; orig int; q record; sc int := 0; tt int; ok boolean; qt text; qs text;
begin
  me := public.quiz_require_child();
  select * into a from public.quiz_attempts where id = p_attempt and child_id = me.child_id and family_id = me.family_id for update;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  if a.status <> 'in_progress' then return; end if;  -- double envoi : ignoré (aucune seconde notification)
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
  -- notification : titre et matière du quiz (catalogue ou jeu de la famille). Jamais le score : le parent le lit à la validation.
  if a.catalog_id is not null then
    select z.title, z.subject into qt, qs from public.catalog_quizzes z where z.id = a.catalog_id;
  else
    select s.title, s.subject into qt, qs from public.quiz_sets s where s.id = a.set_id;
  end if;
  perform public.log_activity(a.family_id, a.child_id, me.id, 'quiz_submitted',
    jsonb_build_object('attempt_id', a.id, 'quiz_id', coalesce(a.catalog_id, a.set_id), 'title', coalesce(qt, ''), 'subject', coalesce(qs, '')));
end $$;

-- ───────────────────────── 2. Validation : quiz_validated ─────────────────────────
create or replace function public.validate_quiz_attempt(p_attempt uuid, p_show_correction boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; a public.quiz_attempts; r public.quiz_results; pts int := 0; tx uuid; qt text; qs text;
begin
  me := public.quiz_require_parent();
  select * into a from public.quiz_attempts where id = p_attempt and family_id = me.family_id for update;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status = 'validated' then return; end if;  -- rejeu idempotent : aucune seconde notification
  if a.status <> 'submitted' then raise exception 'not_submitted' using errcode = 'P0001'; end if;
  update public.quiz_attempts set status = 'validated', validated_at = now(), validated_by = me.id, show_correction = coalesce(p_show_correction, false) where id = a.id;
  select * into r from public.quiz_results where attempt_id = a.id;
  if a.catalog_id is not null then
    pts := public.quiz_points_for(r.score, r.total);
    if pts > 0 and not exists (select 1 from public.quiz_attempts o where o.child_id = a.child_id and o.catalog_id = a.catalog_id and o.points_tx_id is not null) then
      perform 1 from public.children where id = a.child_id for update;  -- sérialise avec les demandes de récompense (même verrou que validate_task)
      tx := gen_random_uuid();
      insert into public.point_transactions (id, family_id, child_id, delta, reason, ref_id, note, created_by)
      values (tx, a.family_id, a.child_id, pts, 'quiz_validated', a.id, (select z.title from public.catalog_quizzes z where z.id = a.catalog_id), me.id);
      update public.quiz_attempts set points_awarded = pts, points_tx_id = tx where id = a.id;
    else
      pts := 0;  -- aucun point crédité (sous 50 % ou déjà récompensé) : la notification ne promet rien
    end if;
    select z.title, z.subject into qt, qs from public.catalog_quizzes z where z.id = a.catalog_id;
  else
    select s.title, s.subject into qt, qs from public.quiz_sets s where s.id = a.set_id;
  end if;
  perform public.log_activity(a.family_id, a.child_id, me.id, 'quiz_validated',
    jsonb_build_object('attempt_id', a.id, 'quiz_id', coalesce(a.catalog_id, a.set_id), 'title', coalesce(qt, ''), 'subject', coalesce(qs, ''),
                       'score', r.score, 'total', r.total, 'points', pts, 'show_correction', coalesce(p_show_correction, false)));
end $$;

-- ───────────────────────── 3. Dernier envoi par appareil (écrit par send-push seulement) ─────────────────────────
alter table public.devices add column last_push_at timestamptz;
alter table public.devices add column last_push_result text check (last_push_result is null or char_length(last_push_result) <= 80);

-- ───────────────────────── 4. État d'enregistrement DU MEMBRE (lu de la base) ─────────────────────────
-- `this_device` : une ligne ACTIVE de CE membre porte `p_endpoint` (abonnement Web Push de ce navigateur). Jamais l'état d'un autre membre ni d'un autre appareil.
create function public.my_push_status(p_endpoint text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.members; n int; here boolean := false; at timestamptz; res text;
begin
  me := public.require_member();
  select count(*)::int into n from public.devices d where d.member_id = me.id and d.revoked_at is null and (d.expo_push_token is not null or d.web_push_subscription is not null);
  if p_endpoint is not null then
    select exists (select 1 from public.devices d where d.member_id = me.id and d.revoked_at is null and d.web_push_subscription->>'endpoint' = p_endpoint) into here;
  end if;
  select d.last_push_at, d.last_push_result into at, res from public.devices d
  where d.member_id = me.id and d.revoked_at is null and d.last_push_at is not null order by d.last_push_at desc limit 1;
  return jsonb_build_object('active_devices', n, 'this_device', here, 'last_push_at', at, 'last_push_result', res);
end $$;
revoke all on function public.my_push_status(text) from public, anon;
grant execute on function public.my_push_status(text) to authenticated;
