-- D-090 : assistant de première connexion (onboarding_progress + RPC). Fixtures : famille 1 = parents 11 (le plus ancien) et 12, enfants A (user 13) et B (user 14) ;
-- famille 2 = parent 21 + enfant C (user 23) ; famille 3 = parent 31, SANS enfant.
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
-- tentative SOUMISE d'un enfant sur un quiz du catalogue, avec son résultat (fixture posée par le propriétaire de la base)
create function tests.submitted(att int, fam int, child int, quiz int, sc int, tt int) returns void language plpgsql security definer as $$
begin
  insert into public.quiz_attempts (id, family_id, child_id, catalog_id, status, submitted_at) values (tests.u(att), tests.u(fam), tests.u(child), tests.u(quiz), 'submitted', now());
  insert into public.quiz_results (attempt_id, family_id, child_id, score, total) values (tests.u(att), tests.u(fam), tests.u(child), sc, tt);
end $$;
grant execute on all functions in schema tests to authenticated, anon, service_role;

insert into auth.users (id, email, is_anonymous) values (tests.u(11), 'p1@test', false), (tests.u(12), 'p2@test', false), (tests.u(13), null, false), (tests.u(14), null, false),
  (tests.u(21), 'pb@test', false), (tests.u(23), null, false), (tests.u(31), 'pc@test', false);
insert into public.families (id, name, timezone) values (tests.u(1), 'A', 'Asia/Ho_Chi_Minh'), (tests.u(2), 'B', 'Asia/Ho_Chi_Minh'), (tests.u(3), 'C', 'Asia/Ho_Chi_Minh');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2009-03-01'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01'), (tests.u(203), tests.u(2), 'Lan', '2010-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name, created_at) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba', now() - interval '2 days'), (tests.u(112), tests.u(1), tests.u(12), 'parent', null, 'Mẹ', now() - interval '1 day'),
  (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh', now()), (tests.u(114), tests.u(1), tests.u(14), 'child', tests.u(202), 'Khang', now()),
  (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'Cha B', now()), (tests.u(123), tests.u(2), tests.u(23), 'child', tests.u(203), 'Lan', now()),
  (tests.u(131), tests.u(3), tests.u(31), 'parent', null, 'Cô C', now());
-- contenu du catalogue : 7 / hist_geo publié avec question ; 7 / maths BROUILLON ; 7 / sciences publié SANS question ; 8 / anglais publié (autre classe)
insert into public.catalog_quizzes (id, country, grade, subject, week_label, title, status, release_on, due_on) values
  (tests.u(701), 'VN', '7', 'hist_geo', 'Tuần 1', 'Văn Lang', 'published', current_date, current_date + 6),
  (tests.u(702), 'VN', '7', 'maths', 'Tuần 1', 'Brouillon', 'draft', current_date, current_date + 6),
  (tests.u(703), 'VN', '7', 'sciences', 'Tuần 1', 'Vide', 'published', current_date, current_date + 6),
  (tests.u(704), 'VN', '8', 'anglais', 'Tuần 1', 'Lớp 8', 'published', current_date, current_date + 6);
insert into public.catalog_questions (quiz_id, position, prompt, choices) values
  (tests.u(701), 0, 'Q', array['a','b','c','d']), (tests.u(702), 0, 'Q', array['a','b','c','d']), (tests.u(704), 0, 'Q', array['a','b','c','d']);
select * from no_plan();

-- ───────────── lecture : un parent, sa progression et les faits de SA famille ─────────────
select tests.login(11);
select is((public.onboarding_state()->>'is_owner')::boolean, true, 'parent le plus ancien : propriétaire (assistant complet)');
select is((public.onboarding_state()->>'language_confirmed')::boolean, false, 'nouveau parent : langue pas encore confirmée');
select is(public.onboarding_state()->'skipped', '[]'::jsonb, 'aucune étape passée');
select is((public.onboarding_state()->>'card_hidden')::boolean, false, 'carte visible');
select is(jsonb_array_length(public.onboarding_state()->'children'), 2, 'deux enfants de SA famille (jamais ceux d''une autre)');
select is((public.onboarding_state()->>'parents')::int, 2, 'deux parents');
select is(((public.onboarding_state()->>'tasks')::int + (public.onboarding_state()->>'rewards')::int), 0, 'ni tâche ni récompense');
select is((public.onboarding_state()->>'invite_active')::boolean, false, 'pas d''invitation');
select tests.login(12);
select is((public.onboarding_state()->>'is_owner')::boolean, false, 'parent invité (plus récent) : assistant court');
select tests.login(31);
select is(jsonb_array_length(public.onboarding_state()->'children'), 0, 'famille sans enfant : liste vide');

-- ───────────── écritures : confirmer, passer, rétablir ─────────────
select tests.login(11);
select lives_ok($$select public.onboarding_set('language', 'confirm')$$, 'confirmer la langue');
select is((public.onboarding_state()->>'language_confirmed')::boolean, true, '…enregistré côté serveur');
select lives_ok($$select public.onboarding_set('language', 'confirm')$$, 'reconfirmer : sans erreur');
select lives_ok($$select public.onboarding_set('subjects', 'skip')$$, 'passer les matières');
select lives_ok($$select public.onboarding_set('subjects', 'skip')$$, 'passer deux fois : sans erreur');
select lives_ok($$select public.onboarding_set('content', 'skip')$$, 'passer les tâches et récompenses');
select is(public.onboarding_state()->'skipped', '["content", "subjects"]'::jsonb, 'étapes passées sans doublon');
select lives_ok($$select public.onboarding_set('subjects', 'unskip')$$, 'rétablir une étape');
select is(public.onboarding_state()->'skipped', '["content"]'::jsonb, '…retirée');
select lives_ok($$select public.onboarding_set('children', 'skip')$$, 'passer « enfants » est permis quand la famille a déjà un enfant');
select lives_ok($$select public.onboarding_set('children', 'unskip')$$, 'rétablir');
select throws_ok($$select public.onboarding_set('inconnue', 'skip')$$, 'P0001', 'invalid_step', 'étape inconnue refusée');
select throws_ok($$select public.onboarding_set(null, 'skip')$$, 'P0001', 'invalid_step', 'étape nulle refusée');
select throws_ok($$select public.onboarding_set('subjects', 'confirm')$$, 'P0001', 'invalid_step', '« confirmer » ne vaut que pour la langue');
select throws_ok($$select public.onboarding_set('subjects', 'effacer')$$, 'P0001', 'invalid_action', 'action inconnue refusée');
select throws_ok($$select public.onboarding_set('subjects', null)$$, 'P0001', 'invalid_action', 'action nulle refusée');
select is(public.onboarding_state()->'skipped', '["content"]'::jsonb, 'aucun refus n''a modifié la progression');
select lives_ok($$select public.onboarding_hide_card(true)$$, 'masquer la carte');
select is((public.onboarding_state()->>'card_hidden')::boolean, true, '…masquée');
select throws_ok($$select public.onboarding_hide_card(null)$$, 'P0001', 'invalid_action', 'valeur nulle refusée');
select lives_ok($$select public.onboarding_hide_card(false)$$, 'ré-afficher');

-- un parent SANS enfant ne peut pas passer l'étape « enfants »
select tests.login(31);
select throws_ok($$select public.onboarding_set('children', 'skip')$$, 'P0001', 'children_required', 'sans enfant : « enfants » n''est pas passable');
select is(public.onboarding_state()->'skipped', '[]'::jsonb, '…rien d''enregistré');
select lives_ok($$select public.onboarding_set('subjects', 'skip')$$, 'les autres étapes restent passables');

-- ───────────── faits calculés d'après les vraies données ─────────────
select tests.login(11);
select lives_ok($$select public.set_child_class(tests.u(201), 'VN', '7')$$, 'classe de A');
select lives_ok($$select public.set_child_class(tests.u(202), 'VN', '9')$$, 'classe de B (sans contenu)');
select is(public.onboarding_state()->'children'->0->'available', '["hist_geo"]'::jsonb, 'matières proposées = contenu PUBLIÉ avec question de CE pays et CETTE classe (ni brouillon, ni quiz vide, ni autre classe)');
select is(public.onboarding_state()->'children'->1->'available', '[]'::jsonb, 'classe sans contenu : rien à activer');
select is(public.onboarding_state()->'children'->0->'subjects', '[]'::jsonb, 'aucune matière activée');
select lives_ok($$select public.set_child_subject(tests.u(201), 'hist_geo', true)$$, 'activer une matière');
select is(public.onboarding_state()->'children'->0->'subjects', '["hist_geo"]'::jsonb, '…vue par l''assistant');
select lives_ok($$select public.create_parent_invite()$$, 'invitation du 2e parent');
select is((public.onboarding_state()->>'invite_active')::boolean, true, '…invitation active');
select lives_ok($$select public.revoke_parent_invite()$$, 'annulation');
select is((public.onboarding_state()->>'invite_active')::boolean, false, '…plus active');
reset role;
insert into public.rewards (family_id, title, icon, cost) values (tests.u(1), '30 phút', 'gift', 50);
insert into public.recurrences (id, family_id, child_id, title, category, time_kind, points, rule, starts_on, created_by)
  values (tests.u(901), tests.u(1), tests.u(201), 'Đánh răng', 'personal', 'anytime', 5, 'daily', current_date, tests.u(111));
select tests.login(11);
select is((public.onboarding_state()->>'rewards')::int, 1, 'une récompense comptée');
select is((public.onboarding_state()->>'tasks')::int, 1, 'un modèle de tâche (série) compte pour UNE tâche, sans recompter ses occurrences');
select tests.login(21);
select is((public.onboarding_state()->>'rewards')::int, 0, 'autre famille : ne voit pas les récompenses de la famille 1');
select is(jsonb_array_length(public.onboarding_state()->'children'), 1, '…ni ses enfants');

-- ───────────── relancer l'assistant ─────────────
select tests.login(11);
select lives_ok($$select public.onboarding_restart()$$, 'relancer l''assistant');
select is((public.onboarding_state()->>'language_confirmed')::boolean, false, '…langue à reconfirmer');
select is(public.onboarding_state()->'skipped', '[]'::jsonb, '…étapes passées effacées');
select is((public.onboarding_state()->>'card_hidden')::boolean, false, '…carte visible');
select is(jsonb_array_length(public.onboarding_state()->'children'), 2, '…les données saisies ne sont pas touchées');
select is((public.onboarding_state()->'children'->0->'subjects'), '["hist_geo"]'::jsonb, '…matières conservées');

-- ───────────── isolation et droits ─────────────
-- chaque parent ne lit que SA ligne
select tests.login(12);
select lives_ok($$select public.onboarding_set('language', 'confirm')$$, 'le parent 12 confirme SA langue');
select is((select count(*)::int from public.onboarding_progress), 1, 'parent 12 : une seule ligne lisible (la sienne)');
select is((public.onboarding_state()->>'language_confirmed')::boolean, true, '…sa progression');
select tests.login(11);
select is((select count(*)::int from public.onboarding_progress), 1, 'parent 11 : une seule ligne lisible (la sienne)');
select is((public.onboarding_state()->>'language_confirmed')::boolean, false, '…la confirmation de 12 ne la modifie pas');
select is((select member_id from public.onboarding_progress), tests.u(111), '…et c''est bien la sienne');
select tests.login(21);
select is((select count(*)::int from public.onboarding_progress), 0, 'parent d''une autre famille : aucune ligne');
-- un enfant : aucune lecture, aucune RPC
select tests.login(13);
select is((select count(*)::int from public.onboarding_progress), 0, 'enfant : aucune ligne lisible');
select throws_ok($$select public.onboarding_state()$$, '42501', 'forbidden', 'enfant : onboarding_state refusé');
select throws_ok($$select public.onboarding_set('language', 'confirm')$$, '42501', 'forbidden', 'enfant : onboarding_set refusé');
select throws_ok($$select public.onboarding_hide_card(true)$$, '42501', 'forbidden', 'enfant : onboarding_hide_card refusé');
select throws_ok($$select public.onboarding_restart()$$, '42501', 'forbidden', 'enfant : onboarding_restart refusé');
-- aucune écriture directe
select tests.login(11);
select throws_ok($$insert into public.onboarding_progress (member_id, family_id) values (tests.u(112), tests.u(1))$$, '42501', null, 'parent : insertion directe refusée (même pour un autre membre)');
select throws_ok($$update public.onboarding_progress set card_hidden = true$$, '42501', null, 'parent : modification directe refusée');
select throws_ok($$delete from public.onboarding_progress$$, '42501', null, 'parent : suppression directe refusée');
select tests.login(13);
select throws_ok($$insert into public.onboarding_progress (member_id, family_id) values (tests.u(113), tests.u(1))$$, '42501', null, 'enfant : insertion directe refusée');
-- anonyme
reset role;
set local role anon;
select throws_ok($$select public.onboarding_state()$$, '42501', null, 'anonyme : refusé');
select throws_ok($$select * from public.onboarding_progress$$, '42501', null, 'anonyme : table fermée');
reset role;
-- les fonctions internes ne sont pas appelables
select tests.login(11);
select throws_ok($$select public.onboarding_require_parent()$$, '42501', null, 'fonction interne : aucun droit client');

select * from finish();
rollback;
