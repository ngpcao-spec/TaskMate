-- D-083 « Révision de la semaine dans Hôm nay » : points à la VALIDATION d'un quiz du catalogue + données d'affichage pour l'enfant (date d'ouverture, score validé).
-- Les points ne sont écrits QUE par la RPC `validate_quiz_attempt` (jamais depuis un client) : une ligne du journal immuable `point_transactions`, motif `quiz_validated`
-- (traduit côté application), note = titre du quiz. Aucune nouvelle table.

-- Nouveau motif du journal. (La valeur n'est utilisée que dans le corps de fonctions, donc à l'exécution : jamais dans la transaction qui l'ajoute.)
alter type public.point_reason add value if not exists 'quiz_validated';

-- ───────────────────────── Barème : UN seul endroit ─────────────────────────
-- score ≥ 80 % → 8 points ; score ≥ 50 % → 5 points ; en dessous → 0. Entiers seulement (aucun arrondi) : `score × 100 ≥ seuil × total`.
create function public.quiz_points_for(p_score int, p_total int) returns int
language sql immutable as $$
  select case
           when p_score is null or p_total is null or p_total <= 0 or p_score < 0 then 0
           when p_score * 100 >= 80 * p_total then 8
           when p_score * 100 >= 50 * p_total then 5
           else 0
         end
$$;
revoke all on function public.quiz_points_for(int, int) from public, anon, authenticated;

-- ───────────────────────── Garde d'unicité : une tentative crédite UNE fois ─────────────────────────
-- `points_tx_id` est unique : une tentative ne peut référencer qu'UNE écriture du journal, et une écriture qu'UNE tentative (en plus de la garde « déjà validée » de la RPC).
alter table public.quiz_attempts
  add column points_awarded int check (points_awarded is null or points_awarded > 0),
  add column points_tx_id uuid unique references public.point_transactions (id);

-- ───────────────────────── Validation : crédit des points (remplace la version 15) ─────────────────────────
-- Quiz du CATALOGUE seulement (les jeux importés par une famille restent sans points, D-055). Une seule fois PAR ENFANT ET PAR QUIZ : si une tentative précédente de cet enfant
-- sur ce quiz a déjà rapporté des points, une relance validée ne crédite plus rien (pas de points à répéter un quiz). Une première tentative sous 50 % ne rapporte rien et
-- n'empêche pas de gagner les points d'une relance. Une tentative déjà validée est ignorée (rejeu idempotent) : jamais de doublon.
create or replace function public.validate_quiz_attempt(p_attempt uuid, p_show_correction boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members; a public.quiz_attempts; r public.quiz_results; pts int; tx uuid;
begin
  me := public.quiz_require_parent();
  select * into a from public.quiz_attempts where id = p_attempt and family_id = me.family_id for update;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status = 'validated' then return; end if;
  if a.status <> 'submitted' then raise exception 'not_submitted' using errcode = 'P0001'; end if;
  update public.quiz_attempts set status = 'validated', validated_at = now(), validated_by = me.id, show_correction = coalesce(p_show_correction, false) where id = a.id;
  if a.catalog_id is not null then
    select * into r from public.quiz_results where attempt_id = a.id;
    pts := public.quiz_points_for(r.score, r.total);
    if pts > 0 and not exists (select 1 from public.quiz_attempts o where o.child_id = a.child_id and o.catalog_id = a.catalog_id and o.points_tx_id is not null) then
      perform 1 from public.children where id = a.child_id for update;  -- sérialise avec les demandes de récompense (même verrou que validate_task)
      tx := gen_random_uuid();
      insert into public.point_transactions (id, family_id, child_id, delta, reason, ref_id, note, created_by)
      values (tx, a.family_id, a.child_id, pts, 'quiz_validated', a.id, (select z.title from public.catalog_quizzes z where z.id = a.catalog_id), me.id);
      update public.quiz_attempts set points_awarded = pts, points_tx_id = tx where id = a.id;
    end if;
  end if;
end $$;

-- ───────────────────────── Enfant : liste de SES quiz du catalogue (remplace la version 23) ─────────────────────────
-- Ajoute la date d'ouverture (décalée, jour local) et le score de la tentative VALIDÉE (null tant qu'elle ne l'est pas : jamais de score avant la validation du parent).
drop function public.child_catalog_quizzes();
create function public.child_catalog_quizzes()
returns table (quiz_id uuid, subject text, week_label text, title text, question_count int, evaluation_attempt_id uuid, evaluation_status public.quiz_attempt_status,
               can_start_evaluation boolean, paper_support boolean, answer_sheet_only boolean, due_on date, answered_count int, release_on date, score int, total int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.members;
begin
  me := public.quiz_require_child();
  return query
  select f.quiz_id, f.subject, f.week_label, f.title, f.question_count, ev.id, ev.status,
         not exists (select 1 from public.quiz_attempts a where a.catalog_id = f.quiz_id and a.child_id = me.child_id),
         f.paper_support, f.answer_sheet_only, f.due_on,
         case when ev.status = 'in_progress' then (select count(*)::int from public.quiz_attempt_progress p where p.attempt_id = ev.id) else 0 end,
         f.release_on,
         case when ev.status = 'validated' then r.score end,
         case when ev.status = 'validated' then r.total end
  from public.catalog_for_child(me.child_id) f
  left join lateral (select a.id, a.status from public.quiz_attempts a where a.catalog_id = f.quiz_id and a.child_id = me.child_id
                     order by a.started_at desc, a.id limit 1) ev on true
  left join public.quiz_results r on r.attempt_id = ev.id
  where f.available
  order by f.release_on desc, f.subject, f.week_label;
end $$;
revoke all on function public.child_catalog_quizzes() from public, anon;
grant execute on function public.child_catalog_quizzes() to authenticated;
