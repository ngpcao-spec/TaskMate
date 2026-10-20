-- D-090 : assistant de première connexion (parent) — progression suivie CÔTÉ SERVEUR, par membre, pour suivre le parent d'un appareil à l'autre.
--   * `onboarding_progress` (une ligne par PARENT) : langue confirmée (drapeau explicite : les valeurs sont préremplies), étapes PASSÉES, carte masquée.
--     Les étapes passées ne comptent jamais comme faites. Tout le reste (enfants, matières, appareil, tâches, récompenses, 2e parent) est CALCULÉ d'après
--     les vraies données par `onboarding_state()`.
--   * RLS activée dans la même migration : un parent ne lit que SA ligne ; jamais un autre membre, jamais un enfant. AUCUN droit d'écriture client :
--     tout passe par des RPC `security definer` (`onboarding_set`, `onboarding_hide_card`, `onboarding_restart`).
--   * Les parents existants reçoivent une ligne « langue confirmée » : une famille existante ne voit jamais l'étape 1 comme manquante.
create table public.onboarding_progress (
  member_id uuid primary key references public.members (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  language_confirmed_at timestamptz,
  skipped text[] not null default '{}'
    check (skipped <@ array['language', 'children', 'subjects', 'notifications', 'content', 'coparent']::text[]),
  card_hidden boolean not null default false,
  updated_at timestamptz not null default now()
);
create index onboarding_progress_family on public.onboarding_progress (family_id);
alter table public.onboarding_progress enable row level security;
revoke all on public.onboarding_progress from anon, authenticated;
grant select on public.onboarding_progress to authenticated;
create policy onboarding_progress_select on public.onboarding_progress for select to authenticated
  using (member_id = public.my_member_id() and public.my_role() = 'parent');

insert into public.onboarding_progress (member_id, family_id, language_confirmed_at)
select m.id, m.family_id, now() from public.members m where m.role = 'parent' and m.deleted_at is null
on conflict (member_id) do nothing;

-- INTERNE : le parent connecté (membership actif, rôle parent) ; refus `forbidden` sinon (enfant compris).
create function public.onboarding_require_parent() returns public.members
language plpgsql stable security definer set search_path = public as $$
declare me public.members;
begin
  me := public.require_member();
  if me.role <> 'parent' then raise exception 'forbidden' using errcode = '42501'; end if;
  return me;
end $$;
revoke all on function public.onboarding_require_parent() from public, anon, authenticated;

-- État de l'assistant du parent connecté : sa progression + les FAITS de sa famille (jamais ceux d'une autre). `available` = les matières qui ont du contenu PUBLIÉ
-- (au moins une question) pour le pays et la classe de l'enfant ; `is_owner` = le plus ancien parent de la famille (les parents invités ont un assistant court).
create function public.onboarding_state() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.members; p public.onboarding_progress; kids jsonb; owner boolean;
begin
  me := public.onboarding_require_parent();
  select * into p from public.onboarding_progress where member_id = me.id;
  owner := not exists (select 1 from public.members m
                       where m.family_id = me.family_id and m.role = 'parent' and m.deleted_at is null and (m.created_at, m.id) < (me.created_at, me.id));
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'name', c.name, 'country', c.country, 'grade', c.grade,
           'subjects', coalesce((select jsonb_agg(s.subject order by s.subject) from public.child_subjects s where s.child_id = c.id), '[]'::jsonb),
           'available', coalesce((select jsonb_agg(distinct z.subject order by z.subject) from public.catalog_quizzes z
                                  where z.status = 'published' and z.country = c.country and z.grade = c.grade
                                    and exists (select 1 from public.catalog_questions q where q.quiz_id = z.id)), '[]'::jsonb))
         order by c.sort_order, c.birth_date, c.id), '[]'::jsonb)
    into kids
  from public.children c where c.family_id = me.family_id and c.deleted_at is null;
  return jsonb_build_object(
    'is_owner', owner,
    'language_confirmed', coalesce(p.language_confirmed_at is not null, false),
    'skipped', to_jsonb(coalesce(p.skipped, '{}'::text[])),
    'card_hidden', coalesce(p.card_hidden, false),
    'children', kids,
    -- tâches isolées + séries : les occurrences d'une série ne sont pas recomptées
    'tasks', (select count(*)::int from public.tasks t where t.family_id = me.family_id and t.deleted_at is null and t.recurrence_id is null)
           + (select count(*)::int from public.recurrences r where r.family_id = me.family_id and r.deleted_at is null),
    'rewards', (select count(*)::int from public.rewards w where w.family_id = me.family_id and w.deleted_at is null),
    'parents', (select count(*)::int from public.members m where m.family_id = me.family_id and m.role = 'parent' and m.revoked_at is null and m.deleted_at is null),
    'invite_active', exists (select 1 from public.parent_invites i where i.family_id = me.family_id and i.used_at is null and i.revoked_at is null and i.expires_at > now()));
end $$;
revoke all on function public.onboarding_state() from public, anon;
grant execute on function public.onboarding_state() to authenticated;

-- `confirm` (étape `language` seulement), `skip` (on peut tout passer SAUF créer un premier enfant tant qu'il n'y en a aucun), `unskip`.
create function public.onboarding_set(p_step text, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public.onboarding_require_parent();
  if p_step is null or p_step not in ('language', 'children', 'subjects', 'notifications', 'content', 'coparent') then
    raise exception 'invalid_step' using errcode = 'P0001';
  end if;
  if p_action is null or p_action not in ('confirm', 'skip', 'unskip') then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;
  if p_action = 'confirm' then
    if p_step <> 'language' then raise exception 'invalid_step' using errcode = 'P0001'; end if;
    insert into public.onboarding_progress (member_id, family_id, language_confirmed_at) values (me.id, me.family_id, now())
    on conflict (member_id) do update set language_confirmed_at = coalesce(public.onboarding_progress.language_confirmed_at, now()), updated_at = now();
  elsif p_action = 'skip' then
    if p_step = 'children' and not exists (select 1 from public.children c where c.family_id = me.family_id and c.deleted_at is null) then
      raise exception 'children_required' using errcode = 'P0001';
    end if;
    insert into public.onboarding_progress (member_id, family_id, skipped) values (me.id, me.family_id, array[p_step])
    on conflict (member_id) do update set skipped = array(select e from (select distinct e from unnest(public.onboarding_progress.skipped || p_step) e) x order by e), updated_at = now();
  else
    update public.onboarding_progress set skipped = array_remove(skipped, p_step), updated_at = now() where member_id = me.id;
  end if;
end $$;
revoke all on function public.onboarding_set(text, text) from public, anon;
grant execute on function public.onboarding_set(text, text) to authenticated;

-- « Masquer » la carte de Hôm nay (elle revient par Réglages) ou la ré-afficher.
create function public.onboarding_hide_card(p_hidden boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public.onboarding_require_parent();
  if p_hidden is null then raise exception 'invalid_action' using errcode = 'P0001'; end if;
  insert into public.onboarding_progress (member_id, family_id, card_hidden) values (me.id, me.family_id, p_hidden)
  on conflict (member_id) do update set card_hidden = excluded.card_hidden, updated_at = now();
end $$;
revoke all on function public.onboarding_hide_card(boolean) from public, anon;
grant execute on function public.onboarding_hide_card(boolean) to authenticated;

-- « Relancer l'assistant » (Réglages) : repart de zéro (langue à reconfirmer, étapes passées effacées, carte visible). Les données déjà saisies ne sont pas touchées.
create function public.onboarding_restart() returns void
language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public.onboarding_require_parent();
  insert into public.onboarding_progress (member_id, family_id) values (me.id, me.family_id)
  on conflict (member_id) do update set language_confirmed_at = null, skipped = '{}', card_hidden = false, updated_at = now();
end $$;
revoke all on function public.onboarding_restart() from public, anon;
grant execute on function public.onboarding_restart() to authenticated;
