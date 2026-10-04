begin;
select plan(7);
select ok(exists (select 1 from pg_publication where pubname = 'supabase_realtime'), 'publication supabase_realtime présente');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tasks'), 'realtime: tasks publiée');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'point_transactions'), 'realtime: point_transactions publiée');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'reward_requests'), 'realtime: reward_requests publiée');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'goals'), 'realtime: goals publiée');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'rewards'), 'realtime: rewards publiée');
-- les tables sensibles ne sont PAS diffusées
select is((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('child_accounts', 'devices', 'members', 'activity_log')), 0, 'realtime: child_accounts/devices/members/activity_log non diffusées');
select * from finish();
rollback;
