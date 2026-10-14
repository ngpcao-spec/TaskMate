-- D-066 : l'« upsert » PostgREST (INSERT … ON CONFLICT (member_id) DO UPDATE SET member_id = …, prefs = …) est REFUSÉ aux clients (pas de droit d'UPDATE
-- sur member_id) : l'app enregistre donc par UPDATE puis INSERT. Ce test fige les deux faits : le refus (c'est voulu) et le chemin qui fonctionne.
-- Fixtures : famille 1 = parent 11 ; enfant (user 13, profil 201).
begin;
create schema tests;
grant usage on schema tests to authenticated, anon;
create function tests.u(n int) returns uuid language sql immutable
  as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create function tests.login(n int) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', tests.u(n)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
end $$;
create function tests.n(q text) returns bigint language plpgsql as $$
declare c bigint;
begin
  execute q;
  get diagnostics c = row_count;
  return c;
end $$;
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, email, is_anonymous) values (tests.u(11), 'p1@test', false), (tests.u(13), null, false);
insert into public.families (id, name) values (tests.u(1), 'A');
insert into public.children (id, family_id, name, birth_date) values (tests.u(201), tests.u(1), 'Minh', '2009-03-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh');
select * from no_plan();

-- l'upsert tel que PostgREST l'écrit : refusé (réécriture de member_id), pour un enfant comme pour un parent
select tests.login(13);
select throws_ok($$insert into public.notification_prefs (member_id, prefs) values (tests.u(113), '{"reminderBeforeStartMin":5}') on conflict (member_id) do update set member_id = excluded.member_id, prefs = excluded.prefs$$, '42501', null, 'enfant : l''upsert qui réécrit member_id est refusé');
select tests.login(11);
select throws_ok($$insert into public.notification_prefs (member_id, prefs) values (tests.u(111), '{}') on conflict (member_id) do update set member_id = excluded.member_id, prefs = excluded.prefs$$, '42501', null, 'parent : idem');

-- le chemin de l'app : UPDATE (0 ligne la première fois) puis INSERT, puis UPDATE
select is(tests.n($$update public.notification_prefs set prefs = '{"reminderBeforeStartMin":5}' where member_id = tests.u(111)$$), 0::bigint, 'parent : première fois, l''UPDATE ne touche rien');
select lives_ok($$insert into public.notification_prefs (member_id, prefs) values (tests.u(111), '{"reminderBeforeStartMin":5}')$$, 'parent : puis INSERT');
select is(tests.n($$update public.notification_prefs set prefs = '{"reminderBeforeStartMin":15}' where member_id = tests.u(111)$$), 1::bigint, 'parent : ensuite UPDATE d''une ligne');
select is((select prefs->>'reminderBeforeStartMin' from public.notification_prefs), '15', 'parent : valeur relue');
select tests.login(13);
select is(tests.n($$update public.notification_prefs set prefs = '{"reminderBeforeStartMin":5}' where member_id = tests.u(113)$$), 0::bigint, 'enfant : première fois, UPDATE vide');
select lives_ok($$insert into public.notification_prefs (member_id, prefs) values (tests.u(113), '{"reminderBeforeStartMin":20}')$$, 'enfant : INSERT de ses propres préférences');
select is(tests.n($$update public.notification_prefs set prefs = '{"reminderBeforeStartMin":25}' where member_id = tests.u(113)$$), 1::bigint, 'enfant : UPDATE ensuite');
select is(tests.n($$update public.notification_prefs set prefs = '{}' where member_id = tests.u(111)$$), 0::bigint, 'enfant : ne touche pas celles du parent');

select * from finish();
rollback;
