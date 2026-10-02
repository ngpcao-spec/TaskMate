#!/usr/bin/env bash
# Tests de concurrence réelle (2 sessions) : verrous FOR UPDATE des RPC (SPEC §5.2, §8).
# Complète pgTAP, qui ne peut pas ouvrir deux connexions.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd); DB=taskmate_conc
as_pg() { su postgres -c "$1"; }
q() { as_pg "psql -qXtA -v ON_ERROR_STOP=1 -d $DB -c \"$1\""; }
as_pg "psql -qX -c 'drop database if exists $DB' -c 'create database $DB' postgres" >/dev/null 2>&1
as_pg "psql -qX -v ON_ERROR_STOP=1 -f $ROOT/scripts/supabase-shim.sql $DB" >/dev/null
shopt -s nullglob
for f in "$ROOT"/supabase/migrations/*.sql; do as_pg "psql -qX -v ON_ERROR_STOP=1 -f $f $DB" >/dev/null 2>&1; done
u() { printf '00000000-0000-0000-0000-%012d' "$1"; }
as_pg "psql -qX -v ON_ERROR_STOP=1 -d $DB" >/dev/null <<SQL
insert into auth.users(id) values ('$(u 11)'),('$(u 12)'),('$(u 13)'),('$(u 14)');
insert into families(id,name) values ('$(u 1)','A');
insert into children(id,family_id,name,birth_date) values ('$(u 201)','$(u 1)','Minh','2009-01-01');
insert into members(id,family_id,user_id,role,child_id,display_name) values
 ('$(u 111)','$(u 1)','$(u 11)','parent',null,'P1'),('$(u 112)','$(u 1)','$(u 12)','parent',null,'P2'),
 ('$(u 113)','$(u 1)','$(u 13)','child','$(u 201)','Minh tel1'),('$(u 114)','$(u 1)','$(u 14)','child','$(u 201)','Minh tel2');
insert into rewards(id,family_id,title,cost) values ('$(u 401)','$(u 1)','Game',100);
insert into point_transactions(id,family_id,child_id,delta,reason,created_by) values ('$(u 501)','$(u 1)','$(u 201)',150,'manual_adjust','$(u 111)');
SQL

session() { # $1 = user n, $2 = sql, $3 = sleep avant commit
  as_pg "psql -qXtA -d $DB" <<SQL 2>&1 || true
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','$(u "$1")',true);
$2
select pg_sleep(${3:-0});
commit;
SQL
}

fail() { echo "FAIL: $1"; exit 1; }

echo "== 2 demandes simultanées dont le total dépasse le disponible =="
session 13 "select public.request_reward('$(u 401)','$(u 701)');" 1.5 > /tmp/conc_a.out &
sleep 0.5
session 14 "select public.request_reward('$(u 401)','$(u 702)');" 0 > /tmp/conc_b.out
wait
n=$(q "select count(*) from reward_requests where status='pending'")
[ "$n" = 1 ] || fail "attendu 1 demande pending, obtenu $n"
grep -q insufficient_balance /tmp/conc_a.out /tmp/conc_b.out || fail "la seconde demande aurait dû être refusée"
echo "ok : une seule demande acceptée"

echo "== 2 parents approuvent la même demande simultanément =="
rid=$(q "select id from reward_requests where status='pending'")
session 11 "select public.approve_reward_request('$rid','$(u 801)');" 1.5 > /tmp/conc_a.out &
sleep 0.5
session 12 "select public.approve_reward_request('$rid','$(u 802)');" 0 > /tmp/conc_b.out
wait
n=$(q "select count(*) from point_transactions where reason='reward_redeemed'")
[ "$n" = 1 ] || fail "attendu 1 débit, obtenu $n"
grep -q not_pending /tmp/conc_a.out /tmp/conc_b.out || fail "le second parent aurait dû échouer proprement"
b=$(q "select balance from child_balances_raw" 2>/dev/null || q "select sum(delta) from point_transactions")
[ "$b" = 50 ] || fail "solde attendu 50, obtenu $b"
echo "ok : un seul débit, solde 50"
