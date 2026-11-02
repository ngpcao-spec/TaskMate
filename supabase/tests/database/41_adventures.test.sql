-- D-105 : aventures du panda (catalogue, child_adventures, child_discoveries, adventure_state / start / collect).
-- Fixtures : famille 1 = parent 11, enfant A (user 13, profil 201), enfant B (user 14, profil 202) ; famille 2 = parent 21, enfant C (user 23, profil 203).
begin;
create schema tests;
grant usage on schema tests to authenticated, anon, service_role;
create function tests.u(n int) returns uuid language sql immutable
  as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create function tests.login(n int) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', tests.u(n)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
end $$;
create function tests.val(q text) returns text language plpgsql security definer as $$
declare r text;
begin execute q into r; return r; end $$;
create function tests.n(q text) returns bigint language plpgsql as $$
declare c bigint;
begin
  execute q;
  get diagnostics c = row_count;
  return c;
end $$;
-- énergie posée par le propriétaire de la base (le journal est immuable : on n'ajoute que des lignes)
create function tests.energy(child int, amount int) returns void language sql security definer as $$
  insert into public.companion_energy (id, child_id, family_id, amount, reason, source_id)
  select gen_random_uuid(), c.id, c.family_id, amount, 'task_checked', gen_random_uuid() from public.children c where c.id = tests.u(child)
$$;
-- « le lendemain » : on recule d'un jour les dates de l'aventure (le serveur est seul juge du jour local)
create function tests.next_day(adv int) returns void language sql security definer as $$
  update public.child_adventures set departed_on = departed_on - 1, returns_on = returns_on - 1 where id = tests.u(adv)
$$;
create function tests.st(child int) returns jsonb language plpgsql as $$ begin return public.adventure_state(tests.u(child)); end $$;
grant execute on all functions in schema tests to authenticated, anon, service_role;

insert into auth.users (id, email, is_anonymous) values (tests.u(11), 'p1@test', false), (tests.u(13), null, false), (tests.u(14), null, false), (tests.u(21), 'pb@test', false), (tests.u(23), null, false);
insert into public.families (id, name, timezone) values (tests.u(1), 'A', 'Asia/Ho_Chi_Minh'), (tests.u(2), 'B', 'Asia/Ho_Chi_Minh');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2013-05-01'), (tests.u(202), tests.u(1), 'Khang', '2015-05-01'), (tests.u(203), tests.u(2), 'Lan', '2010-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'),
  (tests.u(114), tests.u(1), tests.u(14), 'child', tests.u(202), 'Khang'), (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'Cha B'),
  (tests.u(123), tests.u(2), tests.u(23), 'child', tests.u(203), 'Lan');
select * from no_plan();

-- ═══ structure, catalogue et droits ═══
select has_table('public', 'adventure_destinations', 'table adventure_destinations');
select has_table('public', 'adventure_discoveries', 'table adventure_discoveries');
select has_table('public', 'child_adventures', 'table child_adventures');
select has_table('public', 'child_discoveries', 'table child_discoveries');
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.adventure_destinations'::regclass, 'public.adventure_discoveries'::regclass, 'public.child_adventures'::regclass, 'public.child_discoveries'::regclass)), 'RLS activée sur les quatre tables');
select is(tests.val('select string_agg(slug || '':'' || min_level, '','' order by sort_order) from public.adventure_destinations'),
          'ha-long:1,hoi-an:2,mekong:3,da-lat:4,sa-pa:5,phong-nha:6', 'six destinations, dans l''ordre, débloquées aux niveaux 1 à 6');
select is(tests.val('select string_agg(destination_slug || ''='' || n, '','' order by destination_slug) from (select destination_slug, count(*) n from public.adventure_discoveries group by 1) x'),
          'da-lat=5,ha-long=6,hoi-an=6,mekong=6,phong-nha=4,sa-pa=3', '30 trouvailles réparties par destination');
select ok(tests.val('select bool_and(slug like destination_slug || ''-%'') from public.adventure_discoveries')::boolean, 'chaque trouvaille appartient à sa destination');
select is(tests.val('select count(*) from public.adventure_discoveries'), '30', '30 trouvailles');

select ok(not has_table_privilege('anon', 'public.adventure_destinations', 'select'), 'anon: catalogue illisible');
select ok(not has_table_privilege('anon', 'public.child_adventures', 'select'), 'anon: aventures illisibles');
select ok(not has_table_privilege('anon', 'public.child_discoveries', 'select'), 'anon: carnet illisible');
select ok(not has_table_privilege('authenticated', 'public.adventure_destinations', 'insert') and not has_table_privilege('authenticated', 'public.adventure_destinations', 'update') and not has_table_privilege('authenticated', 'public.adventure_destinations', 'delete'), 'catalogue des destinations : aucune écriture client');
select ok(not has_table_privilege('authenticated', 'public.adventure_discoveries', 'insert') and not has_table_privilege('authenticated', 'public.adventure_discoveries', 'update') and not has_table_privilege('authenticated', 'public.adventure_discoveries', 'delete'), 'catalogue des trouvailles : aucune écriture client');
select ok(not has_table_privilege('authenticated', 'public.child_adventures', 'insert') and not has_table_privilege('authenticated', 'public.child_adventures', 'update') and not has_table_privilege('authenticated', 'public.child_adventures', 'delete'), 'aventures : aucune écriture client');
select ok(not has_table_privilege('authenticated', 'public.child_discoveries', 'insert') and not has_table_privilege('authenticated', 'public.child_discoveries', 'update') and not has_table_privilege('authenticated', 'public.child_discoveries', 'delete'), 'carnet : aucune écriture client');
select ok(not has_function_privilege('anon', 'public.adventure_state(uuid)', 'execute'), 'adventure_state: non exécutable par anon');
select ok(not has_function_privilege('anon', 'public.adventure_start(uuid,uuid,text)', 'execute'), 'adventure_start: non exécutable par anon');
select ok(not has_function_privilege('anon', 'public.adventure_collect(uuid,uuid)', 'execute'), 'adventure_collect: non exécutable par anon');
select ok(not has_function_privilege('authenticated', 'public.adventure_gauge(uuid)', 'execute'), 'adventure_gauge: interne');
select ok(not has_function_privilege('authenticated', 'public.adventure_energy_total(uuid)', 'execute'), 'adventure_energy_total: interne');
select ok(not has_function_privilege('authenticated', 'public.adventure_require_self(uuid)', 'execute'), 'adventure_require_self: interne');

select tests.login(13);
select is(tests.n('select 1 from public.adventure_destinations'), 6::bigint, 'un enfant lit le catalogue des destinations');
select is(tests.n('select 1 from public.adventure_discoveries'), 30::bigint, '…et celui des trouvailles');

-- ═══ jauge et états ═══
select is(tests.st(201) ->> 'state', 'filling', 'sans énergie : la jauge se remplit');
select is(tests.st(201) ->> 'gauge', '0', '…jauge 0');
select is(tests.st(201) ->> 'cost', '60', '…coût 60');
select is(tests.st(201) -> 'unlocked', '["ha-long"]'::jsonb, 'niveau 1 : seul Hạ Long est débloqué');
select is(tests.st(201) ->> 'found_count', '0', 'carnet vide');
select is(tests.st(201) ->> 'total_count', '30', '30 trouvailles à découvrir');
select is(tests.st(201) -> 'active', 'null'::jsonb, 'aucune aventure en cours');
select is(jsonb_array_length(tests.st(201) -> 'destinations'), 6, 'le catalogue (ordre, niveaux, trouvailles) vient de la base');

reset role;
select tests.energy(201, 50);
select tests.login(13);
select is(tests.st(201) ->> 'gauge', '50', 'énergie 50 : jauge 50');
select throws_ok($$select public.adventure_start(tests.u(201), tests.u(900), 'ha-long')$$, 'P0001', 'gauge_not_full', 'départ refusé : jauge trop basse');
reset role;
select tests.energy(201, 10);
select tests.energy(201, 10);
select tests.login(13);
select is(tests.st(201) ->> 'gauge', '60', 'énergie 70 : jauge bornée à 60 (coût D-106)');
select is(tests.st(201) ->> 'state', 'ready_to_go', '…prête à partir');
select throws_ok($$select public.adventure_start(tests.u(201), tests.u(900), 'hoi-an')$$, 'P0001', 'destination_locked', 'départ refusé : destination verrouillée (niveau 1)');
select throws_ok($$select public.adventure_start(tests.u(201), tests.u(900), 'atlantide')$$, 'P0002', 'destination_not_found', 'destination inconnue refusée');
select throws_ok($$select public.adventure_start(tests.u(202), tests.u(900), 'ha-long')$$, '42501', 'forbidden', 'A ne fait pas partir le panda de B');
select tests.login(11);
select throws_ok($$select public.adventure_start(tests.u(201), tests.u(900), 'ha-long')$$, '42501', 'forbidden', 'un parent ne lance jamais d''aventure');

-- ═══ départ ═══
select tests.login(13);
select lives_ok($$select public.adventure_start(tests.u(201), tests.u(901), 'ha-long')$$, 'A part à Hạ Long');
select is(tests.val('select returns_on - departed_on from public.child_adventures where id = tests.u(901)'), '1', 'retour = lendemain');
select is(tests.val('select departed_on::text from public.child_adventures where id = tests.u(901)'), tests.val('select public.family_today(tests.u(1))::text'), 'départ = jour LOCAL de la famille');
select is(tests.val('select energy_mark from public.child_adventures where id = tests.u(901)'), '70', 'energy_mark = énergie totale au départ');
select is(public.companion_state(tests.u(201)) ->> 'energy_total', '70', 'partir ne retire AUCUNE énergie');
select is(tests.st(201) ->> 'gauge', '0', 'la jauge repart de 0 après le départ');
select is(tests.st(201) ->> 'state', 'away', 'le panda est en voyage');
select is(tests.st(201) -> 'active' ->> 'destination', 'ha-long', '…à Hạ Long');
select lives_ok($$select public.adventure_start(tests.u(201), tests.u(901), 'ha-long')$$, 'rejeu du départ (même id) : sans erreur');
select is(tests.val('select count(*) from public.child_adventures where child_id = tests.u(201)'), '1', '…une seule aventure');
reset role;
select tests.energy(201, 60);
select tests.login(13);
select throws_ok($$select public.adventure_start(tests.u(201), tests.u(902), 'ha-long')$$, 'P0001', 'adventure_in_progress', 'une seule aventure en cours (même jauge pleine)');
select throws_ok($$select public.adventure_collect(tests.u(201), tests.u(901))$$, 'P0001', 'not_back_yet', 'récupération refusée avant le retour');
select tests.login(11);
select throws_ok($$select public.adventure_collect(tests.u(201), tests.u(901))$$, '42501', 'forbidden', 'un parent ne récupère jamais d''aventure');
select tests.login(14);
select throws_ok($$select public.adventure_collect(tests.u(201), tests.u(901))$$, '42501', 'forbidden', 'B ne récupère pas l''aventure de A');

-- ═══ retour et trouvaille ═══
reset role;
select tests.next_day(901);
select tests.login(13);
select is(tests.st(201) ->> 'state', 'back', 'le lendemain : le panda est rentré');
select lives_ok($$select public.adventure_collect(tests.u(201), tests.u(901))$$, 'A récupère la trouvaille');
select ok(tests.val('select discovery_slug from public.child_adventures where id = tests.u(901)') like 'ha-long-%', 'trouvaille tirée parmi celles de Hạ Long');
select is(tests.val('select duplicate::text from public.child_adventures where id = tests.u(901)'), 'false', '…pas un doublon');
select is(tests.val('select count(*) || ''/'' || sum(times_found) from public.child_discoveries where child_id = tests.u(201)'), '1/1', 'carnet : 1 trouvaille, trouvée 1 fois');
select is(public.adventure_collect(tests.u(201), tests.u(901)) ->> 'discovery_slug', tests.val('select discovery_slug from public.child_adventures where id = tests.u(901)'), 'second appel : même trouvaille');
select is(tests.val('select sum(times_found) from public.child_discoveries where child_id = tests.u(201)'), '1', '…times_found ne bouge pas');
select is(tests.st(201) ->> 'found_count', '1', 'état : 1 trouvaille');
select is(tests.st(201) -> 'last' ->> 'id', tests.u(901)::text, 'état : dernière aventure récupérée');
select is(tests.st(201) -> 'active', 'null'::jsonb, 'plus d''aventure en cours');
select is(tests.st(201) ->> 'gauge', '60', 'énergie gagnée pendant le voyage : comptée pour la jauge suivante (130 − 70)');
select is(tests.st(201) -> 'unlocked', '["ha-long", "hoi-an"]'::jsonb, 'niveau 2 (130 ≥ 100) : Hội An débloqué');

-- ═══ tout trouvé : doublon ═══
reset role;
insert into public.child_discoveries (child_id, family_id, discovery_slug)
  select tests.u(201), tests.u(1), slug from public.adventure_discoveries where destination_slug = 'ha-long' on conflict do nothing;
select tests.login(13);
select lives_ok($$select public.adventure_start(tests.u(201), tests.u(903), 'ha-long')$$, 'A repart à Hạ Long');
reset role;
select tests.next_day(903);
select tests.login(13);
select is(public.adventure_collect(tests.u(201), tests.u(903)) ->> 'duplicate', 'true', 'toutes les trouvailles déjà là : doublon');
select is(tests.val('select sum(times_found) from public.child_discoveries f join public.adventure_discoveries d on d.slug = f.discovery_slug where f.child_id = tests.u(201) and d.destination_slug = ''ha-long'''), '7', '…le compteur d''une trouvaille augmente (6 + 1)');
select is(tests.val('select max(times_found) from public.child_discoveries where child_id = tests.u(201)'), '2', '…une trouvaille passe à ×2');

-- ═══ énergie retirée après un départ : la jauge baisse, jamais sous 0 ═══
reset role;
select tests.energy(201, -100);
select tests.login(13);
select is(tests.st(201) ->> 'gauge', '0', 'décocher après un départ fait baisser la jauge suivante (bornée à 0)');

-- ═══ isolation (D-052) ═══
select tests.login(14);
select is(tests.n('select 1 from public.child_adventures'), 0::bigint, 'B: ne lit aucune aventure de A');
select is(tests.n('select 1 from public.child_discoveries'), 0::bigint, 'B: ne lit pas le carnet de A');
select throws_ok($$select public.adventure_state(tests.u(201))$$, '42501', 'forbidden', 'B: adventure_state de A refusé');
select tests.login(11);
select is(tests.n('select 1 from public.child_adventures where child_id = tests.u(201)'), 2::bigint, 'parent: lit les aventures de SA famille');
select ok(tests.n('select 1 from public.child_discoveries where child_id = tests.u(201)') > 0, 'parent: lit le carnet de SA famille');
select is(public.adventure_state(tests.u(201)) ->> 'found_count', '6', 'parent: adventure_state de son enfant');
select tests.login(21);
select is(tests.n('select 1 from public.child_adventures'), 0::bigint, 'parent d''une autre famille: aucune aventure');
select is(tests.n('select 1 from public.child_discoveries'), 0::bigint, '…aucun carnet');
select throws_ok($$select public.adventure_state(tests.u(201))$$, '42501', 'forbidden', '…adventure_state refusé');
select tests.login(23);
select throws_ok($$select public.adventure_state(tests.u(201))$$, '42501', 'forbidden', 'enfant d''une autre famille: refusé');
reset role;
set local role anon;
select throws_ok($$select public.adventure_state(tests.u(201))$$, '42501', null, 'anon: refusé');
reset role;

-- ═══ aucune écriture directe ═══
select tests.login(13);
select throws_ok($$insert into public.child_adventures (id, child_id, family_id, destination_slug, departed_on, returns_on, energy_mark) values (gen_random_uuid(), tests.u(201), tests.u(1), 'ha-long', current_date, current_date + 1, 0)$$, '42501', null, 'enfant: INSERT direct d''aventure refusé');
select throws_ok($$update public.child_adventures set returns_on = current_date$$, '42501', null, 'enfant: UPDATE direct refusé (pas de retour avancé)');
select throws_ok($$insert into public.child_discoveries (child_id, family_id, discovery_slug) values (tests.u(201), tests.u(1), 'phong-nha-cristal')$$, '42501', null, 'enfant: INSERT direct dans le carnet refusé');
select throws_ok($$update public.child_discoveries set times_found = 99$$, '42501', null, 'enfant: UPDATE direct du carnet refusé');
select throws_ok($$delete from public.child_discoveries$$, '42501', null, 'enfant: DELETE direct du carnet refusé');
select throws_ok($$insert into public.adventure_destinations (slug, min_level, sort_order) values ('x', 1, 9)$$, '42501', null, 'enfant: catalogue non modifiable');
select tests.login(11);
select throws_ok($$delete from public.child_adventures$$, '42501', null, 'parent: DELETE direct refusé');
select throws_ok($$update public.child_discoveries set times_found = 1$$, '42501', null, 'parent: UPDATE direct du carnet refusé');
select throws_ok($$update public.adventure_discoveries set destination_slug = 'sa-pa'$$, '42501', null, 'parent: catalogue non modifiable');

-- ═══ suppression de la famille : cascade (delete_family() inchangée) ═══
select lives_ok($$select public.delete_family()$$, 'le parent supprime sa famille');
reset role;
select is(tests.val('select count(*) from public.child_adventures where family_id = ''' || tests.u(1) || ''''), '0', '…plus d''aventure');
select is(tests.val('select count(*) from public.child_discoveries where family_id = ''' || tests.u(1) || ''''), '0', '…plus de carnet');
select is(tests.val('select count(*) from public.adventure_discoveries'), '30', '…le catalogue reste');

select * from finish();
rollback;
