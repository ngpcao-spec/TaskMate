-- Connexion enfant (D-050) : identifiant unique PAR famille, résolution « e-mail d'un parent + identifiant »,
-- réponse identique pour tout champ faux, verrouillage par IP et par famille. Fonctions réservées au service_role.
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
grant execute on all functions in schema tests to authenticated, anon, service_role;

insert into auth.users (id, email, is_anonymous) values
  (tests.u(11), 'Parent1@Test', false), (tests.u(12), 'p2@test', false), (tests.u(21), 'pb@test', false),
  (tests.u(41), 'minh@child.taskmate.invalid', false), (tests.u(42), 'minh.fam2@child.taskmate.invalid', false),
  (tests.u(43), 'khang.fam1@child.taskmate.invalid', false), (tests.u(31), 'revoque@test', false);
insert into public.families (id, name) values (tests.u(1), 'A'), (tests.u(2), 'B');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2009-03-01'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01'), (tests.u(221), tests.u(2), 'Minh B', '2012-01-01');
insert into public.members (id, family_id, user_id, role, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', 'Ba'), (tests.u(112), tests.u(1), tests.u(12), 'parent', 'Mẹ'),
  (tests.u(121), tests.u(2), tests.u(21), 'parent', 'PB');
insert into public.members (id, family_id, user_id, role, display_name, revoked_at) values
  (tests.u(131), tests.u(1), tests.u(31), 'parent', 'Parti', now());
select * from no_plan();

-- ═══ comptes de deux familles avec le MÊME identifiant ═══
reset role;
set local role service_role;
select lives_ok($$select public.register_child_account(tests.u(201), tests.u(41), 'minh', 'minh@child.taskmate.invalid', 'secret1')$$, 'register: « minh » dans la famille A (ancien format d''adresse conservé)');
select lives_ok($$select public.register_child_account(tests.u(221), tests.u(42), 'minh', 'minh.fam2@child.taskmate.invalid', 'secret1')$$, 'register: le MÊME identifiant « minh » dans la famille B (unique par famille)');
select throws_ok($$select public.register_child_account(tests.u(202), tests.u(43), 'minh', 'khang.fam1@child.taskmate.invalid', 'secret1')$$, 'P0001', 'identifier_taken', 'register: déjà pris DANS la famille A');
select lives_ok($$select public.register_child_account(tests.u(202), tests.u(43), 'khang', 'khang.fam1@child.taskmate.invalid', 'secret1')$$, 'register: autre identifiant dans la famille A');
select throws_ok($$insert into public.child_accounts (family_id, child_id, member_id, login_id, auth_email) values (tests.u(1), tests.u(201), (select id from public.members where user_id = tests.u(43)), 'autre', 'minh@child.taskmate.invalid')$$, '23505', null, 'auth_email: unique');

-- ═══ résolution ═══
select is((select public.child_login_prepare('1.2.3.4', 'parent1@test', 'minh')->>'auth_email'), 'minh@child.taskmate.invalid', 'prepare: e-mail d''un parent (casse ignorée) + identifiant → adresse du compte A');
select is((select public.child_login_prepare('1.2.3.4', 'p2@test', 'MINH')->>'auth_email'), 'minh@child.taskmate.invalid', 'prepare: l''autre parent de la famille, identifiant en majuscules');
select is((select public.child_login_prepare('1.2.3.4', 'pb@test', 'minh')->>'auth_email'), 'minh.fam2@child.taskmate.invalid', 'prepare: la famille B résout SON « minh »');
select is((select public.child_login_prepare('1.2.3.4', 'pb@test', 'khang')->>'auth_email'), null, 'prepare: l''identifiant de la famille A est introuvable via la famille B');
select is((select public.child_login_prepare('1.2.3.4', 'inconnu@test', 'minh')->>'auth_email'), null, 'prepare: e-mail inconnu');
select is((select public.child_login_prepare('1.2.3.4', 'parent1@test', 'fantome')->>'auth_email'), null, 'prepare: identifiant inconnu');
select is((select public.child_login_prepare('1.2.3.4', 'revoque@test', 'minh')->>'auth_email'), null, 'prepare: un parent révoqué ne désigne plus la famille');
select is((select public.child_login_prepare('1.2.3.4', 'minh@child.taskmate.invalid', 'minh')->>'auth_email'), null, 'prepare: l''adresse interne d''un enfant n''est pas un parent');
select is((select public.child_login_prepare('1.2.3.4', null, null)->>'auth_email'), null, 'prepare: champs vides');
-- aucune énumération : toutes les réponses d'échec ont la même forme
select is((select count(distinct (select array_agg(k order by k) from jsonb_object_keys(r) k))::int
           from (values (public.child_login_prepare('9.9.9.9', 'inconnu@test', 'x')), (public.child_login_prepare('9.9.9.9', 'parent1@test', 'x')),
                        (public.child_login_prepare('9.9.9.9', 'parent1@test', 'minh'))) v(r)), 1, 'prepare: même forme de réponse (e-mail faux, identifiant faux, tout juste)');
select is((select public.child_login_prepare('9.9.9.9', 'inconnu@test', 'x')->>'locked'), 'false', 'prepare: e-mail inconnu non verrouillé au départ (même comportement qu''un e-mail connu)');

-- ═══ privilèges : service_role uniquement ═══
select tests.login(11);
select throws_ok($$select public.child_login_prepare('1.1.1.1', 'p2@test', 'minh')$$, '42501', null, 'prepare: refusé à un parent');
select throws_ok($$select public.child_login_record_failure('i:x', 'f:y')$$, '42501', null, 'record: refusé à un parent');
select throws_ok($$select 1 from public.auth_attempts$$, '42501', null, 'auth_attempts: illisible par un parent');
reset role;
set local role anon;
select throws_ok($$select public.child_login_prepare('1.1.1.1', 'p2@test', 'minh')$$, '42501', null, 'prepare: refusé à anon');
select throws_ok($$select public.child_login_record_failure('i:x', 'f:y')$$, '42501', null, 'record: refusé à anon');
reset role;

-- ═══ verrouillage par IP : 10 échecs / 15 min ═══
set local role service_role;
select is((select count(*)::int from (select public.child_login_record_failure(p->>'ip_key', p->>'family_key') from (select public.child_login_prepare('5.5.5.5', 'p2@test', 'faux') p, generate_series(1, 10)) s) t), 10, 'record: 10 échecs depuis la même IP');
select is((select public.child_login_prepare('5.5.5.5', 'p2@test', 'minh')->>'locked'), 'true', 'IP: verrouillée après 10 échecs, même avec les bons identifiants');
select is((select public.child_login_prepare('5.5.5.5', 'p2@test', 'minh')->>'auth_email'), null, 'IP: verrouillée = aucune adresse renvoyée');
select is((select public.child_login_prepare('6.6.6.6', 'pb@test', 'minh')->>'locked'), 'false', 'IP: une autre IP, une autre famille, n''est pas touchée');
-- ═══ verrouillage par famille : 20 échecs / 15 min, depuis des IP différentes ═══
select is((select count(*)::int from (select public.child_login_record_failure('i:' || i, (public.child_login_prepare('7.7.7.7', 'pb@test', 'x')->>'family_key')) from generate_series(1, 20) i) t), 20, 'record: 20 échecs sur la famille B depuis 20 IP');
select is((select public.child_login_prepare('8.8.8.8', 'pb@test', 'minh')->>'locked'), 'true', 'famille: verrouillée après 20 échecs, depuis une IP neuve');
select is((select public.child_login_prepare('8.8.8.8', 'p2@test', 'minh')->>'locked'), 'false', 'famille: la famille A n''est pas verrouillée');
-- e-mail inconnu : verrou par e-mail (haché), même seuil → pas de signal « cet e-mail n'existe pas »
select is((select count(*)::int from (select public.child_login_record_failure('i:z' || i, (public.child_login_prepare('7.7.7.7', 'nobody@test', 'x')->>'family_key')) from generate_series(1, 20) i) t), 20, 'record: 20 échecs sur un e-mail inconnu');
select is((select public.child_login_prepare('8.8.8.8', 'nobody@test', 'x')->>'locked'), 'true', 'e-mail inconnu: verrouillé comme un e-mail connu');
-- le verrou est temporaire
reset role;
select is((select count(*)::int from public.auth_attempts where key like 'e:%'), 20, 'journal: la clé d''un e-mail inconnu est un hachage (pas l''adresse)');
update public.auth_attempts set created_at = now() - interval '16 minutes';
set local role service_role;
select is((select public.child_login_prepare('5.5.5.5', 'p2@test', 'minh')->>'locked'), 'false', 'IP: déverrouillée après 15 minutes');
select is((select public.child_login_prepare('8.8.8.8', 'pb@test', 'minh')->>'locked'), 'false', 'famille: déverrouillée après 15 minutes');
reset role;
-- le journal ancien (> 1 jour) est purgé à l'écriture suivante
update public.auth_attempts set created_at = now() - interval '2 days';
set local role service_role;
select public.child_login_record_failure('i:neuf', 'f:neuf');
reset role;
select is((select count(*)::int from public.auth_attempts), 2, 'journal: les essais de plus d''un jour sont purgés');

select * from finish();
rollback;
