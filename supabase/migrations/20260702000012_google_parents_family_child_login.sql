-- Refonte des comptes (D-050) : parents connectés avec Google, plusieurs parents par famille (invitation à code haché),
-- enfants rattachés à la famille (identifiant unique PAR FAMILLE, connexion « e-mail d'un parent + identifiant + mot de passe »).
-- Droits RLS enfant/parent de la spec v4 inchangés. Les comptes enfants existants continuent de fonctionner : leur adresse
-- d'authentification actuelle est conservée telle quelle (colonne auth_email) et la connexion passe par la nouvelle Edge Function.

-- ───────────── 1. Compte Google ? (inscription d'un NOUVEAU parent = Google uniquement) ─────────────
-- Le fournisseur figure dans app_metadata (posé par Supabase Auth, non modifiable par l'utilisateur). Un parent historique
-- (e-mail + mot de passe) qui a déjà une famille continue de fonctionner ; mais créer ou rejoindre une famille exige Google.
create function public.is_google_account() returns boolean
language sql stable as $$
  select coalesce(
    (select c -> 'app_metadata' ->> 'provider' = 'google' or c -> 'app_metadata' -> 'providers' ? 'google'
     from (select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb as c) s),
    false)
$$;
revoke all on function public.is_google_account() from public, anon;
grant execute on function public.is_google_account() to authenticated, service_role;

-- ───────────── 2. Journal des essais (connexion enfant, jointure parent) ─────────────
create table public.auth_attempts (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);
create index auth_attempts_key_created on public.auth_attempts (key, created_at);
alter table public.auth_attempts enable row level security;
revoke all on public.auth_attempts from anon, authenticated;
-- aucune policy : table interne, uniquement accessible aux fonctions security definer.

-- ───────────── 3. Invitations de parent (code à usage unique, 24 h, HACHÉ en base) ─────────────
create table public.parent_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  created_by uuid not null references public.members (id),
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.members (id),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index parent_invites_code_hash on public.parent_invites (code_hash);
-- une seule invitation active par famille (régénérer annule la précédente)
create unique index parent_invites_active_family on public.parent_invites (family_id)
  where used_at is null and revoked_at is null;

alter table public.parent_invites enable row level security;
revoke all on public.parent_invites from anon, authenticated;
-- lecture : parents de la famille uniquement, SANS la colonne code_hash ; aucune écriture directe (RPC)
grant select (id, family_id, created_by, expires_at, used_at, used_by, revoked_at, created_at) on public.parent_invites to authenticated;
create policy parent_invites_select on public.parent_invites for select to authenticated
  using (family_id = public.my_family_id() and public.is_parent());

-- Génère un code de 8 caractères (alphabet sans ambiguïté, 40 bits), le HACHE (sha256) et ne renvoie le clair QU'UNE FOIS.
create function public.create_parent_invite() returns text
language plpgsql security definer set search_path = public as $$
declare me public.members; raw bytea; code text := ''; i int;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  me := public.require_member();
  if me.role <> 'parent' then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.parent_invites set revoked_at = now()
  where family_id = me.family_id and used_at is null and revoked_at is null;
  -- octets 0-5 et 9-10 d'un UUID v4 : 100 % aléatoires ; 256 % 32 = 0 → tirage uniforme
  raw := uuid_send(gen_random_uuid());
  foreach i in array array[0, 1, 2, 3, 4, 5, 9, 10] loop
    code := code || substr(alphabet, (get_byte(raw, i) % 32) + 1, 1);
  end loop;
  insert into public.parent_invites (family_id, created_by, code_hash, expires_at)
  values (me.family_id, me.id, encode(sha256(convert_to(code, 'utf8')), 'hex'), now() + interval '24 hours');
  return code;
end $$;
revoke all on function public.create_parent_invite() from public, anon;
grant execute on function public.create_parent_invite() to authenticated;

create function public.revoke_parent_invite() returns void
language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public.require_member();
  if me.role <> 'parent' then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.parent_invites set revoked_at = now()
  where family_id = me.family_id and used_at is null and revoked_at is null;
end $$;
revoke all on function public.revoke_parent_invite() from public, anon;
grant execute on function public.revoke_parent_invite() to authenticated;

-- « Rejoindre une famille » : renvoie l'id du membre créé, ou NULL si le code est faux/expiré/déjà utilisé/annulé
-- (l'échec est journalisé : la limite d'essais survit à l'appel). Après 5 échecs en 15 min : too_many_attempts.
create function public.join_family_with_code(p_code text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv public.parent_invites; mid uuid; k text := 'j:' || auth.uid()::text; fails int; name text := btrim(coalesce(p_display_name, ''));
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if claims -> 'app_metadata' ->> 'account_type' = 'child' then raise exception 'forbidden' using errcode = '42501'; end if;
  if not public.is_google_account() then raise exception 'google_required' using errcode = '42501'; end if;
  if exists (select 1 from public.members where user_id = auth.uid() and revoked_at is null and deleted_at is null) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  if char_length(name) not between 1 and 40 then raise exception 'invalid_name' using errcode = '22023'; end if;

  select count(*) into fails from public.auth_attempts where key = k and created_at > now() - interval '15 minutes';
  if fails >= 5 then raise exception 'too_many_attempts' using errcode = 'P0001'; end if;

  select * into inv from public.parent_invites
  where code_hash = encode(sha256(convert_to(upper(btrim(coalesce(p_code, ''))), 'utf8')), 'hex')
    and used_at is null and revoked_at is null and expires_at > now()
  for update;
  if not found then
    insert into public.auth_attempts (key) values (k);
    return null;
  end if;

  insert into public.members (family_id, user_id, role, display_name) values (inv.family_id, auth.uid(), 'parent', name)
  returning id into mid;
  update public.parent_invites set used_at = now(), used_by = mid where id = inv.id;
  return mid;
end $$;
revoke all on function public.join_family_with_code(text, text) from public, anon;
grant execute on function public.join_family_with_code(text, text) to authenticated;

-- Un parent quitte la famille ; le dernier parent ne peut partir qu'en supprimant la famille (delete_family).
create function public.leave_family() returns void
language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public.require_member();
  if me.role <> 'parent' then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.members
                 where family_id = me.family_id and role = 'parent' and id <> me.id and revoked_at is null and deleted_at is null) then
    raise exception 'last_parent' using errcode = 'P0001';
  end if;
  update public.members set revoked_at = now() where id = me.id;
  update public.devices set revoked_at = now() where member_id = me.id and revoked_at is null;
end $$;
revoke all on function public.leave_family() from public, anon;
grant execute on function public.leave_family() to authenticated;

-- ───────────── 4. Créer une famille : Google uniquement (comptes enfants toujours refusés) ─────────────
create or replace function public.create_family(p_name text, p_display_name text,
                                                p_timezone text default 'Asia/Ho_Chi_Minh') returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid; mid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb -> 'app_metadata' ->> 'account_type' = 'child' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not public.is_google_account() then raise exception 'google_required' using errcode = '42501'; end if;
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

-- ───────────── 5. Comptes enfants : identifiant unique PAR FAMILLE, adresse d'authentification conservée ─────────────
alter table public.child_accounts add column auth_email text;
-- migration de données : les comptes existants gardent l'adresse qu'ils ont dans auth.users (ancien schéma, sans rien casser)
update public.child_accounts set auth_email = login_id || '@child.taskmate.invalid';
alter table public.child_accounts alter column auth_email set not null;
drop index public.child_accounts_login_id;
create unique index child_accounts_family_login on public.child_accounts (family_id, login_id);
create unique index child_accounts_auth_email on public.child_accounts (auth_email);
-- l'adresse interne n'est jamais exposée au client (ni aux parents)
revoke select on public.child_accounts from authenticated;
grant select (id, family_id, child_id, member_id, login_id, created_at) on public.child_accounts to authenticated;

drop function public.register_child_account(uuid, uuid, text);
create function public.register_child_account(p_child_id uuid, p_user_id uuid, p_login_id text, p_auth_email text) returns uuid
language plpgsql security definer set search_path = public as $$
declare c public.children; mid uuid;
begin
  select * into c from public.children where id = p_child_id and deleted_at is null;
  if not found then raise exception 'child_not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.child_accounts where child_id = c.id) then
    raise exception 'account_exists' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.child_accounts where family_id = c.family_id and login_id = p_login_id) then
    raise exception 'identifier_taken' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.members where user_id = p_user_id and revoked_at is null and deleted_at is null) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  insert into public.members (family_id, user_id, role, child_id, display_name)
  values (c.family_id, p_user_id, 'child', c.id, c.name) returning id into mid;
  insert into public.child_accounts (family_id, child_id, member_id, login_id, auth_email)
  values (c.family_id, c.id, mid, p_login_id, p_auth_email);
  return mid;
exception when unique_violation then
  raise exception 'identifier_taken' using errcode = 'P0001';
end $$;
revoke all on function public.register_child_account(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.register_child_account(uuid, uuid, text, text) to service_role;

-- ───────────── 6. Connexion enfant (Edge Function `child-login`, service_role uniquement) ─────────────
-- Étape 1 : verrou + résolution. L'e-mail d'un parent désigne la famille ; (famille, identifiant) désigne le compte.
-- Réponse volontairement identique que l'e-mail, l'identifiant ou le mot de passe soit faux (aucune énumération).
-- Verrouillage temporaire : 10 échecs / 15 min par IP, 20 échecs / 15 min par famille (ou par e-mail inconnu, haché).
create function public.child_login_prepare(p_ip text, p_parent_email text, p_login_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare norm_email text := lower(btrim(coalesce(p_parent_email, ''))); fid uuid; fkey text; aemail text; ip_key text; ip_fails int; fam_fails int;
begin
  select m.family_id into fid
  from auth.users u join public.members m on m.user_id = u.id
  where lower(u.email) = norm_email and m.role = 'parent' and m.revoked_at is null and m.deleted_at is null
  limit 1;
  fkey := coalesce('f:' || fid::text, 'e:' || encode(sha256(convert_to(norm_email, 'utf8')), 'hex'));
  ip_key := 'i:' || encode(sha256(convert_to(coalesce(p_ip, ''), 'utf8')), 'hex');

  select count(*) into ip_fails from public.auth_attempts where key = ip_key and created_at > now() - interval '15 minutes';
  select count(*) into fam_fails from public.auth_attempts where key = fkey and created_at > now() - interval '15 minutes';
  if ip_fails >= 10 or fam_fails >= 20 then
    return jsonb_build_object('locked', true, 'family_key', fkey, 'ip_key', ip_key, 'auth_email', null);
  end if;
  if fid is not null then
    select auth_email into aemail from public.child_accounts
    where family_id = fid and login_id = lower(btrim(coalesce(p_login_id, '')));
  end if;
  return jsonb_build_object('locked', false, 'family_key', fkey, 'ip_key', ip_key, 'auth_email', aemail);
end $$;

-- Étape 2 : journalise un échec (par IP ET par famille) et purge le journal ancien.
create function public.child_login_record_failure(p_ip_key text, p_family_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.auth_attempts where created_at < now() - interval '1 day';
  insert into public.auth_attempts (key) values (p_ip_key), (p_family_key);
end $$;
revoke all on function public.child_login_prepare(text, text, text), public.child_login_record_failure(text, text) from public, anon, authenticated;
grant execute on function public.child_login_prepare(text, text, text), public.child_login_record_failure(text, text) to service_role;

-- ───────────── 7. delete_family : purge aussi les invitations ─────────────
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
