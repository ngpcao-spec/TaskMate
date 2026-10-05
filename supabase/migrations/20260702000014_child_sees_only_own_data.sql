-- D-052 — Un enfant ne voit QUE ses propres données (décision de l'humain, remplace « frères et sœurs visibles en lecture
-- seule » de la spec v4). Appliqué côté RLS / RPC, pas seulement dans l'interface : un enfant qui interroge directement l'API ne
-- peut lire ni les tâches, ni les points, ni les récompenses demandées, ni la fiche de son frère ou de sa sœur.
-- Les parents gardent la lecture de TOUS les enfants de leur famille (aucun changement pour eux). Aucune policy d'écriture n'est
-- relâchée ; aucune fonction n'est ajoutée (types générés inchangés).

-- Rappel des garde-fous d'écriture (inchangés, couverts par les tests 17) : tasks_update / tasks_insert = parent seulement ;
-- complete_task / uncomplete_task refusent un child_id qui n'est pas celui de l'enfant appelant ; request_reward n'a PAS de
-- paramètre d'enfant (toujours celui de l'appelant) ; cancel_reward_request exige requested_by = l'appelant ; goals_insert/update
-- exigent child_id = my_child_id() pour un enfant.

-- ───────────── children : l'enfant ne lit que SA fiche (prénom, âge, couleur) ─────────────
drop policy children_select on public.children;
create policy children_select on public.children for select to authenticated
  using (family_id = public.my_family_id() and (public.is_parent() or id = public.my_child_id()));

-- ───────────── members : l'enfant lit sa propre ligne et celles des parents (affichage), jamais celle d'un autre enfant ─────────────
drop policy members_select on public.members;
create policy members_select on public.members for select to authenticated
  using (
    family_id = public.my_family_id()
    and (public.is_parent() or role = 'parent' or child_id = public.my_child_id())
  );

-- ───────────── données par enfant : lignes de l'enfant appelant seulement (parents : tous) ─────────────
drop policy tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (family_id = public.my_family_id() and (public.is_parent() or child_id = public.my_child_id()));

drop policy recurrences_select on public.recurrences;
create policy recurrences_select on public.recurrences for select to authenticated
  using (family_id = public.my_family_id() and (public.is_parent() or child_id = public.my_child_id()));

drop policy goals_select on public.goals;
create policy goals_select on public.goals for select to authenticated
  using (family_id = public.my_family_id() and (public.is_parent() or child_id = public.my_child_id()));

drop policy point_transactions_select on public.point_transactions;
create policy point_transactions_select on public.point_transactions for select to authenticated
  using (family_id = public.my_family_id() and (public.is_parent() or child_id = public.my_child_id()));

-- reward_requests_select : déjà « parent = tout, enfant = les siennes » (migration 1) ; activity_log : parent seulement ;
-- devices, notification_prefs : le membre lit les siens ; child_accounts, parent_invites : parents seulement.

-- ───────────── rewards : le catalogue de la famille reste lisible ; une récompense dédiée à un AUTRE enfant, non ─────────────
drop policy rewards_select on public.rewards;
create policy rewards_select on public.rewards for select to authenticated
  using (family_id = public.my_family_id() and (public.is_parent() or child_id is null or child_id = public.my_child_id()));

-- ───────────── soldes : vue et fonctions bornées à l'enfant appelant (parents : tous les enfants de la famille) ─────────────
create or replace view public.child_balances as
  select c.id as child_id, c.family_id,
         public.child_balance(c.id) as balance,
         public.child_reserved(c.id) as reserved,
         public.child_balance(c.id) - public.child_reserved(c.id) as available,
         public.child_pending_task_points(c.id) as pending_task_points
  from public.children c
  where c.deleted_at is null and c.family_id = public.my_family_id()
    and (public.is_parent() or c.id = public.my_child_id());

-- Les fonctions sont exécutables par authenticated : sans cette borne, un enfant pourrait lire le solde d'un frère en
-- appelant child_balance(<id connu>) directement. Hors de son périmètre, elles renvoient 0 (jamais la valeur réelle).
create or replace function public.child_balance(p_child uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::int from public.point_transactions
  where child_id = p_child and family_id = public.my_family_id()
    and (public.is_parent() or p_child = public.my_child_id())
$$;
create or replace function public.child_reserved(p_child uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(cost), 0)::int from public.reward_requests
  where child_id = p_child and family_id = public.my_family_id()
    and status = 'pending' and expires_at > now()
    and (public.is_parent() or p_child = public.my_child_id())
$$;
create or replace function public.child_pending_task_points(p_child uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(points), 0)::int from public.tasks
  where child_id = p_child and family_id = public.my_family_id()
    and completed_at is not null and validated_at is null and deleted_at is null
    and (public.is_parent() or p_child = public.my_child_id())
$$;
