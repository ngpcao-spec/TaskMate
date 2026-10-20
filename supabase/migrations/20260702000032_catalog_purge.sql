-- D-091 : suppression DÉFINITIVE d'un QCM du catalogue par l'administrateur, même publié et déjà commencé ou validé par des enfants.
--   * `catalog_delete_quiz` (D-080) reste réservée aux brouillons sans tentative. La purge est une autre RPC, explicite : `catalog_purge_quiz`, gardée par la
--     saisie du TITRE EXACT du QCM (vérifiée ici, côté serveur, pas seulement dans l'interface).
--   * Une transaction : les tentatives du QCM (réponses, résultats, mélanges, progression : CASCADE), puis le QCM (questions et clés : CASCADE). La case
--     (pays, classe, matière, semaine) redevient libre. Rejouable : un QCM déjà supprimé ne fait rien.
--   * Les POINTS DÉJÀ GAGNÉS sont CONSERVÉS : le journal `point_transactions` est immuable (SPEC §5.2) et la purge ne l'écrit ni ne le modifie. Les lignes
--     `quiz_validated` gardent leur note (le titre du quiz) ; `ref_id` n'a pas de clé étrangère, l'historique des points s'affiche donc sans la tentative.
--   * `activity_log` n'est pas touché (le titre est dans la charge utile) et la purge n'écrit AUCUNE activité : aucune notification.
--   * Trace d'audit `catalog_admin_log` : immuable, lisible par les administrateurs seulement, alimentée par la RPC.

-- ───────────────────────── Journal d'audit ─────────────────────────
create table public.catalog_admin_log (
  id uuid primary key default gen_random_uuid(),
  -- l'administrateur (pas de clé étrangère : le journal est immuable et survit à la suppression d'un compte)
  admin_id uuid not null,
  action text not null check (action in ('purge_quiz')),
  -- le QCM n'existe plus après la purge : pas de clé étrangère non plus
  quiz_id uuid not null,
  title text not null,
  -- case occupée (country, grade, subject, week_label, status) et compteurs supprimés
  slot jsonb not null default '{}'::jsonb,
  counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index catalog_admin_log_created on public.catalog_admin_log (created_at desc);

create trigger catalog_admin_log_immutable
  before update or delete on public.catalog_admin_log
  for each row execute function public.forbid_mutation();
create trigger catalog_admin_log_no_truncate
  before truncate on public.catalog_admin_log
  for each statement execute function public.forbid_mutation();

alter table public.catalog_admin_log enable row level security;
revoke all on public.catalog_admin_log from anon, authenticated;
-- lecture : les administrateurs ; écriture : AUCUN droit client (la RPC `security definer` est la seule à écrire)
grant select on public.catalog_admin_log to authenticated;
create policy catalog_admin_log_select on public.catalog_admin_log for select to authenticated using (public.is_platform_admin());

-- ───────────────────────── Compteurs d'un QCM (INTERNE) ─────────────────────────
-- Points déjà attribués = somme du journal immuable pour les tentatives de CE quiz (jamais une colonne recopiée).
create function public.catalog_quiz_counts(p_quiz uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'families', (select count(distinct a.family_id) from public.quiz_attempts a where a.catalog_id = p_quiz),
    'children', (select count(distinct a.child_id) from public.quiz_attempts a where a.catalog_id = p_quiz),
    'attempts', (select count(*) from public.quiz_attempts a where a.catalog_id = p_quiz),
    'in_progress', (select count(*) from public.quiz_attempts a where a.catalog_id = p_quiz and a.status = 'in_progress'),
    'submitted', (select count(*) from public.quiz_attempts a where a.catalog_id = p_quiz and a.status = 'submitted'),
    'validated', (select count(*) from public.quiz_attempts a where a.catalog_id = p_quiz and a.status = 'validated'),
    'points', (select coalesce(sum(t.delta), 0) from public.point_transactions t
               where t.reason = 'quiz_validated' and t.ref_id in (select a.id from public.quiz_attempts a where a.catalog_id = p_quiz)),
    'questions', (select count(*) from public.catalog_questions q where q.quiz_id = p_quiz),
    'answers', (select count(*) from public.quiz_answers w where w.attempt_id in (select a.id from public.quiz_attempts a where a.catalog_id = p_quiz))
  )
$$;
revoke all on function public.catalog_quiz_counts(uuid) from public, anon, authenticated;

-- ───────────────────────── Impact (administrateur) ─────────────────────────
create function public.catalog_quiz_impact(p_quiz uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare z public.catalog_quizzes;
begin
  perform public.catalog_require_admin();
  select * into z from public.catalog_quizzes where id = p_quiz;
  if not found then raise exception 'set_not_found' using errcode = 'P0002'; end if;
  return jsonb_build_object('quiz_id', z.id, 'title', z.title, 'subject', z.subject, 'country', z.country, 'grade', z.grade, 'week_label', z.week_label, 'status', z.status)
         || public.catalog_quiz_counts(z.id);
end $$;

-- ───────────────────────── Purge (administrateur) ─────────────────────────
create function public.catalog_purge_quiz(p_quiz uuid, p_confirm text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; z public.catalog_quizzes; counts jsonb;
begin
  uid := public.catalog_require_admin();
  select * into z from public.catalog_quizzes where id = p_quiz for update;
  if not found then return jsonb_build_object('purged', false); end if;    -- déjà supprimé : rejeu idempotent
  -- garde-fou : le titre exact, vérifié ici
  if p_confirm is distinct from z.title then raise exception 'confirm_mismatch' using errcode = 'P0001'; end if;
  counts := public.catalog_quiz_counts(z.id);
  delete from public.quiz_attempts where catalog_id = z.id;               -- réponses, résultats, mélanges, progression : CASCADE
  delete from public.catalog_quizzes where id = z.id;                     -- questions et clés : CASCADE
  insert into public.catalog_admin_log (admin_id, action, quiz_id, title, slot, counts)
  values (uid, 'purge_quiz', z.id, z.title,
          jsonb_build_object('country', z.country, 'grade', z.grade, 'subject', z.subject, 'week_label', z.week_label, 'status', z.status), counts);
  return jsonb_build_object('purged', true, 'title', z.title) || counts;
end $$;

-- ───────────────────────── Droits ─────────────────────────
do $$
declare f text;
begin
  foreach f in array array['catalog_quiz_impact(uuid)', 'catalog_purge_quiz(uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
