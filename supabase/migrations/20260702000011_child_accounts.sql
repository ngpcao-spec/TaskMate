-- Changement produit : comptes e-mail + mot de passe (parents) et comptes enfants créés PAR LE PARENT.
-- Plus de codes d'invitation, de QR ni de connexions anonymes.
--
-- Qui crée quoi : une Edge Function (create-child / reset-child-password / delete-child), qui reçoit la clé service de
-- l'environnement Supabase des fonctions, (1) vérifie côté serveur que l'appelant est PARENT de la famille concernée
-- via `child_account_target` (avec le JWT de l'appelant), (2) crée/modifie le compte auth avec la clé service,
-- (3) enregistre le lien compte ↔ profil via `register_child_account` / `remove_child_account`, EXÉCUTABLES PAR service_role SEULEMENT.
-- Un enfant (ou n'importe quel client) ne peut donc créer, modifier ni supprimer aucun compte.

-- ───────────── 1. Retrait de l'invitation ─────────────
drop function if exists public.create_invite(uuid, public.member_role);
drop function if exists public.redeem_invite(text, text, text);
drop function if exists public.redeem_invite(text, text);
drop table if exists public.redeem_attempts;
drop table if exists public.invite_codes;

-- ───────────── 2. child_accounts : identifiant de connexion de chaque enfant ─────────────
-- L'identifiant est unique sur tout le service (la connexion se fait par identifiant seul) ; l'e-mail fictif dérivé
-- n'est jamais stocké ici ni montré. Écritures : uniquement par les fonctions security definer ci-dessous.
create table public.child_accounts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  child_id uuid not null,
  member_id uuid not null unique references public.members (id),
  login_id text not null check (login_id ~ '^[a-z0-9][a-z0-9._-]{2,29}$'),
  created_at timestamptz not null default now(),
  foreign key (child_id, family_id) references public.children (id, family_id)
);
create unique index child_accounts_login_id on public.child_accounts (login_id);
create unique index child_accounts_child on public.child_accounts (child_id); -- un compte par enfant

alter table public.child_accounts enable row level security;
revoke all on public.child_accounts from anon, authenticated;
grant select on public.child_accounts to authenticated;
-- lecture : les parents de la famille uniquement (l'enfant et son frère ne voient pas les identifiants)
create policy child_accounts_select on public.child_accounts for select to authenticated
  using (family_id = public.my_family_id() and public.is_parent());
-- aucune policy ni privilège d'écriture : insert/update/delete refusés à tous les clients.

-- ───────────── 3. Autorisation : l'appelant est-il parent de la famille de cet enfant ? ─────────────
create function public.child_account_target(p_child_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.members; c public.children; a public.child_accounts; uid uuid;
begin
  me := public.require_member();
  if me.role <> 'parent' then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from public.children where id = p_child_id and family_id = me.family_id and deleted_at is null;
  -- même réponse pour « enfant d'une autre famille » et « inexistant » : aucune fuite
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into a from public.child_accounts where child_id = c.id;
  if found then select user_id into uid from public.members where id = a.member_id; end if;
  return jsonb_build_object(
    'family_id', me.family_id, 'child_id', c.id, 'child_name', c.name,
    'member_id', a.member_id, 'login_id', a.login_id, 'user_id', uid);
end $$;
revoke all on function public.child_account_target(uuid) from public, anon;
grant execute on function public.child_account_target(uuid) to authenticated;

-- ───────────── 4. Écritures (service_role uniquement, appelées par les Edge Functions) ─────────────
create function public.register_child_account(p_child_id uuid, p_user_id uuid, p_login_id text) returns uuid
language plpgsql security definer set search_path = public as $$
declare c public.children; mid uuid;
begin
  select * into c from public.children where id = p_child_id and deleted_at is null;
  if not found then raise exception 'child_not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.child_accounts where child_id = c.id) then
    raise exception 'account_exists' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.child_accounts where login_id = p_login_id) then
    raise exception 'identifier_taken' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.members where user_id = p_user_id and revoked_at is null and deleted_at is null) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  insert into public.members (family_id, user_id, role, child_id, display_name)
  values (c.family_id, p_user_id, 'child', c.id, c.name) returning id into mid;
  insert into public.child_accounts (family_id, child_id, member_id, login_id)
  values (c.family_id, c.id, mid, p_login_id);
  return mid;
exception when unique_violation then
  raise exception 'identifier_taken' using errcode = 'P0001';
end $$;

-- Retire l'accès : membre révoqué, appareils révoqués, identifiant libéré. Renvoie le user_id auth (l'Edge Function
-- verrouille ensuite le compte). L'historique (tâches, points) reste attaché au profil.
create function public.remove_child_account(p_child_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare a public.child_accounts; uid uuid;
begin
  select * into a from public.child_accounts where child_id = p_child_id;
  if not found then return null; end if;
  select user_id into uid from public.members where id = a.member_id;
  update public.members set revoked_at = now() where id = a.member_id and revoked_at is null;
  update public.devices set revoked_at = now() where member_id = a.member_id and revoked_at is null;
  delete from public.child_accounts where id = a.id;
  return uid;
end $$;

revoke all on function public.register_child_account(uuid, uuid, text), public.remove_child_account(uuid) from public, anon, authenticated;
grant execute on function public.register_child_account(uuid, uuid, text), public.remove_child_account(uuid) to service_role;

-- ───────────── 5. Un compte enfant ne crée jamais de famille ─────────────
-- Les comptes enfants portent app_metadata.account_type = 'child' (posé par l'Edge Function, non modifiable par l'utilisateur).
create or replace function public.create_family(p_name text, p_display_name text,
                                                p_timezone text default 'Asia/Ho_Chi_Minh') returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid; mid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb -> 'app_metadata' ->> 'account_type' = 'child' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.members
             where user_id = auth.uid() and revoked_at is null and deleted_at is null) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  insert into public.families (name, timezone) values (p_name, p_timezone) returning id into fid;
  insert into public.members (family_id, user_id, role, display_name)
  values (fid, auth.uid(), 'parent', p_display_name) returning id into mid;
  insert into public.rewards (family_id, title, icon, cost, sort_order) values
    (fid, 'Chơi game 1 tiếng', 'gamepad-2', 100, 1),
    (fid, 'Xem phim yêu thích', 'film', 150, 2),
    (fid, 'Dùng điện thoại thêm 30 phút', 'smartphone', 200, 3),
    (fid, 'Đồ ăn vặt', 'cookie', 100, 4);
  return fid;
end $$;

-- ───────────── 6. delete_family : purge aussi child_accounts (plus d'invite_codes) ─────────────
create or replace function public.delete_family() returns uuid[]
language plpgsql security definer set search_path = public as $$
declare me public.members; fid uuid; users uuid[];
begin
  me := public.require_member();
  if me.role <> 'parent' then raise exception 'forbidden' using errcode = '42501'; end if;
  fid := me.family_id;
  select coalesce(array_agg(user_id), '{}') into users from public.members where family_id = fid;

  perform set_config('app.deleting_family', 'on', true);
  delete from public.activity_log where family_id = fid;
  delete from public.reward_requests where family_id = fid;
  delete from public.point_transactions where family_id = fid;
  delete from public.notification_prefs where member_id in (select id from public.members where family_id = fid);
  delete from public.devices where member_id in (select id from public.members where family_id = fid);
  delete from public.child_accounts where family_id = fid;
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
