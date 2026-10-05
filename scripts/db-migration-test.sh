#!/usr/bin/env bash
# Migration de données (D-050) : des comptes enfants créés AVANT la migration 12 (identifiant global, adresse
# `<identifiant>@child.taskmate.invalid`) doivent continuer à fonctionner avec le nouveau formulaire de connexion.
# Ce script applique les migrations 1 → 11, insère des données « de production », applique la 12 puis vérifie.
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
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-000000000011', 'parent@legacy.test', false),
  ('00000000-0000-0000-0000-000000000041', 'minh@child.taskmate.invalid', false),
  ('00000000-0000-0000-0000-000000000042', 'khang@child.taskmate.invalid', false);
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
SQL

as_pg "psql -qX -v ON_ERROR_STOP=1 -f $ROOT/supabase/migrations/20260702000012_google_parents_family_child_login.sql $DB" >/dev/null 2>&1

fail=0
check() { if [ "$2" = "$3" ]; then echo "ok   : $1"; else echo "FAIL : $1 (obtenu '$2', attendu '$3')"; fail=1; fi; }
check "les comptes existants gardent leur adresse d'authentification" \
  "$(q "select string_agg(auth_email, ',' order by login_id) from public.child_accounts")" "khang@child.taskmate.invalid,minh@child.taskmate.invalid"
check "chaque adresse conservée existe bien dans auth.users" \
  "$(q "select count(*) from public.child_accounts a join auth.users u on u.email = a.auth_email")" "2"
check "membres enfants et profils intacts" "$(q "select count(*) from public.members where role = 'child' and revoked_at is null")" "2"
check "connexion enfant : e-mail du parent + identifiant → ancienne adresse" \
  "$(q "select public.child_login_prepare('1.1.1.1', 'Parent@Legacy.test', 'minh')->>'auth_email'")" "minh@child.taskmate.invalid"
check "connexion enfant : mauvais e-mail → aucune adresse" \
  "$(q "select coalesce(public.child_login_prepare('1.1.1.1', 'autre@legacy.test', 'minh')->>'auth_email', 'null')")" "null"
check "l'identifiant n'est plus unique globalement (index par famille)" \
  "$(q "select count(*) from pg_indexes where indexname = 'child_accounts_login_id'")" "0"
check "…mais reste unique dans la famille" \
  "$(q "select count(*) from pg_indexes where indexname = 'child_accounts_family_login'")" "1"
exit $fail
