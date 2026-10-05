#!/usr/bin/env bash
# Migration de données (D-050, D-051) : des comptes enfants créés AVANT les migrations 12 et 13 (identifiant global, adresse devinable
# `<identifiant>@child.taskmate.invalid`, mot de passe connu de GoTrue) doivent continuer à fonctionner avec le formulaire de
# connexion actuel (même e-mail parent, même identifiant, même mot de passe) SANS adresse ni mot de passe GoTrue devinables.
# Ce script applique les migrations 1 → 11, insère des données « de production », applique la 12 et la 13 puis vérifie.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
DB=taskmate_migr
as_pg() { su postgres -c "$1"; }
q() { as_pg "psql -qXtA -v ON_ERROR_STOP=1 -c \"$1\" $DB"; }
as_pg "psql -qX -v ON_ERROR_STOP=1 -c 'drop database if exists $DB' -c 'create database $DB' postgres"
as_pg "psql -qX -v ON_ERROR_STOP=1 -f $ROOT/scripts/supabase-shim.sql $DB" >/dev/null 2>&1
for f in "$ROOT"/supabase/migrations/2026070200000[1-9]_*.sql "$ROOT"/supabase/migrations/20260702000010_*.sql "$ROOT"/supabase/migrations/20260702000011_*.sql; do
  as_pg "psql -qX -v ON_ERROR_STOP=1 -f $f $DB" >/dev/null 2>&1
done

# données existantes : une famille, un parent (e-mail), deux enfants avec compte (ancien schéma)
as_pg "psql -qX -v ON_ERROR_STOP=1 $DB" >/dev/null <<'SQL'
insert into auth.users (id, email, encrypted_password, is_anonymous) values
  ('00000000-0000-0000-0000-000000000011', 'parent@legacy.test', null, false),
  ('00000000-0000-0000-0000-000000000041', 'minh@child.taskmate.invalid', crypt('abc123', gen_salt('bf', 10)), false),
  ('00000000-0000-0000-0000-000000000042', 'khang@child.taskmate.invalid', crypt('motdepasse', gen_salt('bf', 10)), false);
insert into auth.identities (user_id, provider, provider_id, identity_data) values
  ('00000000-0000-0000-0000-000000000041', 'email', '00000000-0000-0000-0000-000000000041', '{"email":"minh@child.taskmate.invalid"}'),
  ('00000000-0000-0000-0000-000000000042', 'email', '00000000-0000-0000-0000-000000000042', '{"email":"khang@child.taskmate.invalid"}');
insert into public.families (id, name) values ('00000000-0000-0000-0000-000000000001', 'Legacy');
insert into public.children (id, family_id, name, birth_date) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', 'Minh', '2012-01-01'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001', 'Khang', '2014-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'parent', null, 'Ba'),
  ('00000000-0000-0000-0000-000000000113', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000041', 'child', '00000000-0000-0000-0000-000000000201', 'Minh'),
  ('00000000-0000-0000-0000-000000000114', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000042', 'child', '00000000-0000-0000-0000-000000000202', 'Khang');
insert into public.child_accounts (family_id, child_id, member_id, login_id) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000113', 'minh'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000114', 'khang');
insert into public.tasks (family_id, child_id, title, date, created_by) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', 'Devoirs', '2026-07-02', '00000000-0000-0000-0000-000000000111');
SQL

as_pg "psql -qX -v ON_ERROR_STOP=1 -f $ROOT/supabase/migrations/20260702000012_google_parents_family_child_login.sql $DB" >/dev/null 2>&1
as_pg "psql -qX -v ON_ERROR_STOP=1 -f $ROOT/supabase/migrations/20260702000013_child_auth_hardening.sql $DB" >/dev/null 2>&1

fail=0
check() { if [ "$2" = "$3" ]; then echo "ok   : $1"; else echo "FAIL : $1 (obtenu '$2', attendu '$3')"; fail=1; fi; }
UUID_MAIL='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@child\\.taskmate\\.invalid$'
check "les 2 comptes existants ont une adresse interne ALÉATOIRE (UUID)" \
  "$(q "select count(*) from public.child_accounts where auth_email ~ '$UUID_MAIL'")" "2"
check "plus aucune adresse devinable dans auth.users" \
  "$(q "select count(*) from auth.users where email in ('minh@child.taskmate.invalid', 'khang@child.taskmate.invalid')")" "0"
check "chaque adresse interne existe dans auth.users et dans l'identité e-mail" \
  "$(q "select count(*) from public.child_accounts a join auth.users u on u.email = a.auth_email join auth.identities i on i.user_id = u.id and i.identity_data->>'email' = a.auth_email")" "2"
check "identifiants visibles, membres, profils et tâches intacts" \
  "$(q "select string_agg(login_id, ',' order by login_id) from public.child_accounts")|$(q "select count(*) from public.members where role = 'child' and revoked_at is null")|$(q "select count(*) from public.tasks")" "khang,minh|2|1"
check "connexion directe GoTrue impossible : l'ancien mot de passe n'ouvre plus le compte" \
  "$(q "select count(*) from auth.users where email like '%@child.taskmate.invalid' and (crypt('abc123', encrypted_password) = encrypted_password or crypt('motdepasse', encrypted_password) = encrypted_password)")" "0"
check "child-login : MÊME mot de passe, via le haché (minh)" \
  "$(q "select public.child_login_check_password((select auth_email from public.child_accounts where login_id = 'minh'), 'abc123')")" "t"
check "child-login : MÊME mot de passe, via le haché (khang)" \
  "$(q "select public.child_login_check_password((select auth_email from public.child_accounts where login_id = 'khang'), 'motdepasse')")" "t"
check "child-login : mauvais mot de passe refusé" \
  "$(q "select public.child_login_check_password((select auth_email from public.child_accounts where login_id = 'minh'), 'faux')")" "f"
check "connexion enfant : e-mail du parent (casse ignorée) + identifiant → nouvelle adresse" \
  "$(q "select public.child_login_prepare('1.1.1.1', 'Parent@Legacy.test', 'minh')->>'auth_email'")" "$(q "select auth_email from public.child_accounts where login_id = 'minh'")"
check "connexion enfant : mauvais e-mail → aucune adresse" \
  "$(q "select coalesce(public.child_login_prepare('1.1.1.1', 'autre@legacy.test', 'minh')->>'auth_email', 'null')")" "null"
check "l'identifiant n'est plus unique globalement (index par famille)" \
  "$(q "select count(*) from pg_indexes where indexname = 'child_accounts_login_id'")" "0"
check "…mais reste unique dans la famille" \
  "$(q "select count(*) from pg_indexes where indexname = 'child_accounts_family_login'")" "1"
exit $fail
