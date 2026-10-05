-- Durcissement de l'authentification des enfants (D-051).
-- Problème : l'adresse interne d'un compte enfant (`<identifiant>@child.taskmate.invalid`) était devinable et GoTrue acceptait
-- `signInWithPassword` avec le mot de passe de l'enfant : le verrou anti-essais de `child-login` était contournable.
-- Principe : le mot de passe de l'enfant n'est plus connu de GoTrue. Il est vérifié par `child-login` contre un HACHAGE bcrypt
-- conservé ici (jamais lisible côté client) ; la session est ensuite émise par GoTrue pour une adresse ALÉATOIRE (UUID) dont le
-- mot de passe GoTrue est aléatoire et inconnu de tous. Seule `child-login` (service_role) peut donc ouvrir une session enfant.

alter table public.child_accounts add column password_hash text;
-- colonne absente des grants SELECT (migration 12 : grant select par colonnes) → illisible pour authenticated/anon, y compris les parents

-- bcrypt de pgcrypto (schéma `extensions` sur Supabase, `public` dans le shim de test) : compatible avec les hachages de GoTrue ($2a$).
-- Écritures : service_role seulement (appelées par les Edge Functions create-child / reset-child-password).
drop function public.register_child_account(uuid, uuid, text, text);
create function public.register_child_account(p_child_id uuid, p_user_id uuid, p_login_id text, p_auth_email text, p_password text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare c public.children; mid uuid;
begin
  if p_password is null or char_length(p_password) < 6 then raise exception 'weak_password' using errcode = '22023'; end if;
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
  insert into public.child_accounts (family_id, child_id, member_id, login_id, auth_email, password_hash)
  values (c.family_id, c.id, mid, p_login_id, p_auth_email, crypt(p_password, gen_salt('bf', 10)));
  return mid;
exception when unique_violation then
  raise exception 'identifier_taken' using errcode = 'P0001';
end $$;
revoke all on function public.register_child_account(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.register_child_account(uuid, uuid, text, text, text) to service_role;

-- Nouveau mot de passe d'un enfant (par un parent, via reset-child-password) : change le haché ; GoTrue n'est pas concerné.
create function public.set_child_password(p_child_id uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_password is null or char_length(p_password) < 6 then raise exception 'weak_password' using errcode = '22023'; end if;
  update public.child_accounts set password_hash = crypt(p_password, gen_salt('bf', 10)) where child_id = p_child_id;
  if not found then raise exception 'no_account' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.set_child_password(uuid, text) from public, anon, authenticated;
grant execute on function public.set_child_password(uuid, text) to service_role;

-- Vérification du mot de passe par child-login. Coût constant : un compte inconnu subit aussi un calcul bcrypt (pas de signal de
-- temps sur l'existence du compte).
create function public.child_login_check_password(p_auth_email text, p_password text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare stored text; dummy constant text := '$2a$10$abcdefghijklmnopqrstuuAbCdEfGhIjKlMnOpQrStUvWxYzAbCdE';
begin
  select password_hash into stored from public.child_accounts where auth_email = p_auth_email;
  if stored is null then
    perform crypt(coalesce(p_password, ''), dummy);
    return false;
  end if;
  return crypt(coalesce(p_password, ''), stored) = stored;
end $$;
revoke all on function public.child_login_check_password(text, text) from public, anon, authenticated;
grant execute on function public.child_login_check_password(text, text) to service_role;

-- ───────────── Migration des comptes existants ─────────────
-- Pour chaque compte sans haché : (1) copie le bcrypt de GoTrue (le MÊME mot de passe continue de fonctionner) ; (2) remplace
-- l'adresse GoTrue par un UUID aléatoire (users + identité e-mail) ; (3) remplace le mot de passe GoTrue par un secret aléatoire
-- que personne ne connaît. Identifiant visible, membre, profil, tâches et points : intacts. Rejouable (ne traite que les comptes
-- sans haché). Appelée une fois ci-dessous ; exposée au service_role pour les tests (E2E sur le vrai GoTrue).
create function public.migrate_legacy_child_accounts() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare r record; new_email text; n int := 0;
begin
  for r in
    select a.id as account_id, u.id as user_id, u.encrypted_password as legacy_hash
    from public.child_accounts a join auth.users u on u.email = a.auth_email
    where a.password_hash is null and u.encrypted_password is not null
  loop
    new_email := gen_random_uuid()::text || '@child.taskmate.invalid';
    update public.child_accounts set password_hash = r.legacy_hash, auth_email = new_email where id = r.account_id;
    update auth.users
    set email = new_email,
        encrypted_password = crypt(gen_random_uuid()::text || gen_random_uuid()::text, gen_salt('bf', 10)),
        updated_at = now()
    where id = r.user_id;
    -- identité e-mail (provider_id = id de l'utilisateur sur Supabase ; `email` y est une colonne générée)
    update auth.identities
    set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(new_email)),
        updated_at = now()
    where user_id = r.user_id and provider = 'email';
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.migrate_legacy_child_accounts() from public, anon, authenticated;
grant execute on function public.migrate_legacy_child_accounts() to service_role;

select public.migrate_legacy_child_accounts();
