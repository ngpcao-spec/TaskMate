#!/usr/bin/env bash
# Local substitute for `supabase db reset && supabase test db` (no Docker). See DECISIONS D-002.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
DB=taskmate_test
pg_lsclusters | grep -q online || pg_ctlcluster 16 main start
as_pg() { su postgres -c "$1"; }
as_pg "psql -qX -v ON_ERROR_STOP=1 -c 'drop database if exists $DB' -c 'create database $DB' postgres"
as_pg "psql -qX -v ON_ERROR_STOP=1 -c 'create extension if not exists pgtap' $DB"
as_pg "psql -qX -v ON_ERROR_STOP=1 -f $ROOT/scripts/supabase-shim.sql $DB" >/dev/null
shopt -s nullglob
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "apply $(basename "$f")"
  as_pg "psql -qX -v ON_ERROR_STOP=1 -f $f $DB" >/dev/null
done
if [ -f "$ROOT/supabase/seed.sql" ] && [ "${WITH_SEED:-0}" = 1 ]; then
  as_pg "psql -qX -v ON_ERROR_STOP=1 -f $ROOT/supabase/seed.sql $DB" >/dev/null
fi
shopt -s nullglob
tests=("$ROOT"/supabase/tests/*.sql)
if [ ${#tests[@]} -eq 0 ]; then echo "no pgTAP tests yet"; exit 0; fi
as_pg "pg_prove -U postgres -d $DB ${tests[*]}"
