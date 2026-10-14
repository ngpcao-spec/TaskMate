-- D-071 : avatar « dessin animé » de l'enfant — consentement du parent, candidat puis validation, quota (clé service), isolation (D-052).
-- Fixtures : famille 1 = parent 11 (membre 111), enfant A (user 13, profil 201), enfant B (user 14, profil 202) ; famille 2 = parent 21, enfant C (221).
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
create function tests.n(q text) returns bigint language plpgsql as $$
declare c bigint;
begin
  execute q;
  get diagnostics c = row_count;
  return c;
end $$;
grant execute on all functions in schema tests to authenticated, anon, service_role;

insert into auth.users (id, email, is_anonymous) values (tests.u(11), 'p1@test', false), (tests.u(13), null, false), (tests.u(14), null, false), (tests.u(21), 'pb@test', false);
insert into public.families (id, name, timezone) values (tests.u(1), 'A', 'Asia/Ho_Chi_Minh'), (tests.u(2), 'B', 'Asia/Ho_Chi_Minh');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2009-03-01'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01'), (tests.u(221), tests.u(2), 'Cam', '2012-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'),
  (tests.u(114), tests.u(1), tests.u(14), 'child', tests.u(202), 'Khang'), (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'Cha B');
select * from no_plan();

select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('child_avatars', 'avatar_usage') and c.relrowsecurity), 2, 'child_avatars et avatar_usage ont la RLS');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'avatar_usage' and column_name ~ '(content|photo|portrait|image|file|body|prompt)'), 0, 'avatar_usage ne contient AUCUN contenu ni photo');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'child_avatars' and column_name ~ '(photo|portrait|original|source)'), 0, 'child_avatars ne garde AUCUNE photo d''origine (seulement le dessin)');

-- ───────────── consentement : le parent seulement ─────────────
select tests.login(13);
select throws_ok($$select public.set_avatar_ai_allowed(tests.u(201), true)$$, '42501', 'forbidden', 'enfant: ne peut pas activer la fonction lui-même');
select throws_ok($$select public.avatar_target()$$, 'P0001', 'avatar_not_allowed', 'enfant: refusé tant que le parent n''a pas consenti');
select tests.login(21);
select throws_ok($$select public.set_avatar_ai_allowed(tests.u(201), true)$$, 'P0002', 'child_not_found', 'autre famille: refusé');
select tests.login(11);
select throws_ok($$select public.set_avatar_ai_allowed(tests.u(201), null)$$, 'P0001', 'invalid_input', 'parent: valeur nulle refusée');
select throws_ok($$select public.avatar_target(tests.u(201))$$, 'P0001', 'avatar_not_allowed', 'parent: pas de génération sans consentement');
select lives_ok($$select public.set_avatar_ai_allowed(tests.u(201), true)$$, 'parent: active la fonction pour l''enfant A');
select is((select ai_allowed from public.child_avatars where child_id = tests.u(201)), true, 'le consentement est enregistré');
reset role;
select is((select consent_by from public.child_avatars where child_id = tests.u(201)), tests.u(111), '…avec le parent qui l''a donné');
select tests.login(11);
select is(((public.avatar_target(tests.u(201)))->>'child_id')::uuid, tests.u(201), 'parent: avatar_target renvoie l''enfant visé');
select throws_ok($$select public.avatar_target(tests.u(221))$$, 'P0002', 'child_not_found', 'parent: pas l''enfant d''une autre famille');
select throws_ok($$select public.avatar_target()$$, 'P0002', 'child_not_found', 'parent: l''enfant doit être désigné');
select tests.login(13);
select is(((public.avatar_target())->>'child_id')::uuid, tests.u(201), 'enfant A (consenti): avatar_target renvoie lui-même');
select is(((public.avatar_target(tests.u(202)))->>'child_id')::uuid, tests.u(201), 'enfant A: désigner son frère est ignoré, il ne vise jamais que lui-même');
select tests.login(14);
select throws_ok($$select public.avatar_target()$$, 'P0001', 'avatar_not_allowed', 'enfant B: pas consenti, refusé');

-- ───────────── aucune écriture directe, le candidat n'est pas lisible ─────────────
select tests.login(11);
select throws_ok($$insert into public.child_avatars (child_id, family_id, ai_allowed) values (tests.u(202), tests.u(1), true)$$, '42501', null, 'parent: pas d''insertion directe (consentement = RPC seulement)');
select throws_ok($$update public.child_avatars set ai_allowed = true where child_id = tests.u(201)$$, '42501', null, 'parent: pas de mise à jour directe');
select throws_ok($$delete from public.child_avatars$$, '42501', null, 'parent: pas de suppression directe');
select throws_ok($$select candidate_b64 from public.child_avatars$$, '42501', null, 'le candidat n''est pas lisible directement');
select throws_ok($$insert into public.avatar_usage (family_id, child_id, member_id, day) values (tests.u(1), tests.u(201), tests.u(111), current_date)$$, '42501', null, 'client: aucune écriture dans avatar_usage');
select tests.login(13);
select throws_ok($$update public.child_avatars set image_b64 = 'UklGRg==' where child_id = tests.u(201)$$, '42501', null, 'enfant: ne peut pas poser lui-même une image (ni sa photo)');

-- ───────────── les RPC de la fonction ne sont pas appelables par un client ─────────────
select tests.login(11);
select throws_ok($$select * from public.avatar_reserve(tests.u(1), tests.u(201), tests.u(111), 3, 10, 20)$$, '42501', null, 'client: avatar_reserve interdit');
select throws_ok($$select public.avatar_finish(tests.u(900), 'success', null, 'm')$$, '42501', null, 'client: avatar_finish interdit');
select throws_ok($$select public.avatar_used_today(tests.u(201), tests.u(1))$$, '42501', null, 'client: avatar_used_today interdit');
select throws_ok($$select public.avatar_save_candidate(tests.u(201), tests.u(1), 'UklGRg==')$$, '42501', null, 'client: avatar_save_candidate interdit (un client ne dépose pas d''image)');

-- ───────────── quota (clé service) : par enfant, par famille, essais échoués non comptés, plafond total ─────────────
reset role;
set local role service_role;
-- 02:00 le 2 juillet à Hô Chi Minh (= 1er juillet 19:00 UTC)
select is((select allowed from public.avatar_reserve(tests.u(1), tests.u(201), tests.u(111), 2, 10, 4, timestamptz '2026-07-01 19:00:00+00')), true, 'quota: 1re génération autorisée');
select is((select used from public.avatar_reserve(tests.u(1), tests.u(201), tests.u(111), 2, 10, 4, timestamptz '2026-07-01 19:10:00+00')), 2, 'quota: 2e autorisée (2 utilisées)');
select is((select allowed from public.avatar_reserve(tests.u(1), tests.u(201), tests.u(111), 2, 10, 4, timestamptz '2026-07-01 19:20:00+00')), false, 'quota: 3e REFUSÉE (limite 2 par enfant)');
select is((select allowed from public.avatar_reserve(tests.u(1), tests.u(202), tests.u(111), 2, 10, 4, timestamptz '2026-07-01 19:20:00+00')), true, 'quota: le frère a SON propre quota');
select is((select allowed from public.avatar_reserve(tests.u(1), tests.u(201), tests.u(111), 2, 10, 4, timestamptz '2026-07-02 17:30:00+00')), true, 'quota: nouveau jour local → nouveau quota');
-- un essai échoué ne compte pas : on en marque un comme échoué, une place se libère
select public.avatar_finish((select id from public.avatar_usage where child_id = tests.u(201) order by created_at limit 1), 'failed', 'timeout', 'm');
select is((select allowed from public.avatar_reserve(tests.u(1), tests.u(201), tests.u(111), 2, 10, 40, timestamptz '2026-07-01 19:30:00+00')), true, 'quota: un essai échoué ne consomme pas le quota');
select is((select allowed from public.avatar_reserve(tests.u(1), tests.u(201), tests.u(111), 5, 10, 3, timestamptz '2026-07-01 19:40:00+00')), false, 'quota: plafond TOTAL d''essais du jour (échoués compris)');
select is((select allowed from public.avatar_reserve(tests.u(1), tests.u(202), tests.u(111), 5, 2, 40, timestamptz '2026-07-01 19:40:00+00')), false, 'quota: plafond par famille');
select is(public.avatar_used_today(tests.u(201), tests.u(1), timestamptz '2026-07-01 19:45:00+00'), 2, 'avatar_used_today: 2 générations réussies ou en cours (l''échouée n''est pas comptée)');
select throws_ok($$select public.avatar_finish(tests.u(900), 'weird', null, 'm')$$, 'P0001', 'invalid_status', 'avatar_finish: statut inconnu refusé');

-- ───────────── enregistrement du candidat (clé service) ─────────────
select throws_ok($$select public.avatar_save_candidate(tests.u(202), tests.u(1), 'UklGRg==')$$, 'P0001', 'avatar_not_allowed', 'candidat: refusé sans consentement (enfant B)');
select throws_ok($$select public.avatar_save_candidate(tests.u(201), tests.u(1), 'not-a-webp')$$, '23514', null, 'candidat: un fichier qui n''est pas du WebP est refusé par la base');
select lives_ok($$select public.avatar_save_candidate(tests.u(201), tests.u(1), 'UklGRgAAAAA=')$$, 'candidat: enregistré (enfant A, consenti)');
reset role;
select is((select candidate_b64 from public.child_avatars where child_id = tests.u(201)), 'UklGRgAAAAA=', 'le candidat est en base, pas encore l''avatar');
select is((select image_b64 from public.child_avatars where child_id = tests.u(201)), null, 'l''avatar courant n''a pas changé');

-- ───────────── validation, abandon, suppression ─────────────
select tests.login(14);
select throws_ok($$select public.confirm_child_avatar(tests.u(201))$$, '42501', 'forbidden', 'enfant B: ne valide pas l''avatar de son frère');
select throws_ok($$select public.remove_child_avatar(tests.u(201))$$, '42501', 'forbidden', 'enfant B: ne supprime pas l''avatar de son frère');
select throws_ok($$select public.discard_avatar_candidate(tests.u(201))$$, '42501', 'forbidden', 'enfant B: n''abandonne pas le candidat de son frère');
select tests.login(21);
select throws_ok($$select public.confirm_child_avatar(tests.u(201))$$, 'P0002', 'child_not_found', 'autre famille: refusé');
select tests.login(13);
select throws_ok($$select public.confirm_child_avatar(tests.u(202))$$, '42501', 'forbidden', 'enfant A: ne valide que SON avatar');
select lives_ok($$select public.confirm_child_avatar(tests.u(201))$$, 'enfant A: valide son candidat');
select is((select image_b64 from public.child_avatars where child_id = tests.u(201)), 'UklGRgAAAAA=', 'le candidat est devenu l''avatar');
select is((select version from public.child_avatars where child_id = tests.u(201)), 1, 'la version augmente (invalidation des caches)');
select throws_ok($$select public.confirm_child_avatar(tests.u(201))$$, 'P0002', 'no_candidate', 'plus de candidat : rien à valider');

-- isolation D-052 : l'enfant B ne voit rien de A ; le parent voit sa famille ; l'autre famille ne voit rien
select tests.login(14);
select is(tests.n('select 1 from public.child_avatars'), 0::bigint, 'enfant B: ne voit aucune ligne (ni l''avatar de son frère)');
select tests.login(13);
select is(tests.n('select 1 from public.child_avatars'), 1::bigint, 'enfant A: ne voit que sa ligne');
select tests.login(21);
select is(tests.n('select 1 from public.child_avatars'), 0::bigint, 'autre famille: ne voit rien');
select tests.login(11);
select is(tests.n('select 1 from public.child_avatars'), 1::bigint, 'parent: voit la ligne de son enfant');
select is(tests.n('select 1 from public.avatar_usage'), 5::bigint, 'parent: lit le journal d''usage de sa famille');
select tests.login(13);
select is(tests.n('select 1 from public.avatar_usage'), 0::bigint, 'enfant: ne lit pas le journal d''usage');

-- retrait de l'autorisation : le candidat en attente disparaît, l'avatar courant reste, la génération est refusée
reset role;
update public.child_avatars set candidate_b64 = 'UklGRgBBBBB=' where child_id = tests.u(201);
select tests.login(11);
select lives_ok($$select public.set_avatar_ai_allowed(tests.u(201), false)$$, 'parent: coupe l''autorisation');
select throws_ok($$select public.avatar_target(tests.u(201))$$, 'P0001', 'avatar_not_allowed', 'génération refusée après retrait');
reset role;
select is((select candidate_b64 from public.child_avatars where child_id = tests.u(201)), null, 'le candidat en attente est effacé');
select is((select image_b64 from public.child_avatars where child_id = tests.u(201)), 'UklGRgAAAAA=', 'l''avatar courant reste');
select is((select consent_at from public.child_avatars where child_id = tests.u(201)), null, 'la date de consentement est effacée avec lui');
set local role service_role;
select throws_ok($$select public.avatar_save_candidate(tests.u(201), tests.u(1), 'UklGRgAAAAA=')$$, 'P0001', 'avatar_not_allowed', 'la fonction ne peut plus déposer de candidat');
-- suppression : possible même sans autorisation
select tests.login(13);
select lives_ok($$select public.remove_child_avatar(tests.u(201))$$, 'enfant A: supprime son avatar (même sans autorisation)');
select is((select image_b64 from public.child_avatars where child_id = tests.u(201)), null, 'avatar supprimé');
select is((select version from public.child_avatars where child_id = tests.u(201)), 2, 'la version augmente encore');

-- enfant retiré de la famille (suppression douce) : sa ligne disparaît ; suppression définitive : en cascade
reset role;
insert into public.child_avatars (child_id, family_id, ai_allowed, image_b64) values (tests.u(202), tests.u(1), true, 'UklGRgAAAAA=');
select tests.login(11);
update public.children set deleted_at = now() where id = tests.u(202);
reset role;
select is((select count(*)::int from public.child_avatars where child_id = tests.u(202)), 0, 'enfant retiré (suppression douce): son avatar est effacé');
delete from public.members where id = tests.u(113);
delete from public.children where id = tests.u(201);
select is((select count(*)::int from public.child_avatars where child_id = tests.u(201)) + (select count(*)::int from public.avatar_usage where child_id = tests.u(201)), 0, 'suppression de l''enfant: avatar et journal supprimés en cascade');

select * from finish();
rollback;
