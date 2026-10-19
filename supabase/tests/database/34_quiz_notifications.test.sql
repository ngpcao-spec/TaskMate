-- D-088 : notifications des quiz (quiz_submitted / quiz_validated dans activity_log, une fois chacune) et état d'enregistrement des appareils (my_push_status).
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
-- tentative SOUMISE d'un enfant sur un quiz du catalogue, avec son résultat (fixture posée par le propriétaire de la base)
create function tests.submitted(att int, fam int, child int, quiz int, sc int, tt int) returns void language plpgsql security definer as $$
begin
  insert into public.quiz_attempts (id, family_id, child_id, catalog_id, status, submitted_at) values (tests.u(att), tests.u(fam), tests.u(child), tests.u(quiz), 'submitted', now());
  insert into public.quiz_results (attempt_id, family_id, child_id, score, total) values (tests.u(att), tests.u(fam), tests.u(child), sc, tt);
end $$;
grant execute on all functions in schema tests to authenticated, anon, service_role;

insert into auth.users (id, email, is_anonymous) values (tests.u(11), 'p1@test', false), (tests.u(13), null, false), (tests.u(14), null, false), (tests.u(21), 'pb@test', false), (tests.u(23), null, false);
insert into public.families (id, name, timezone) values (tests.u(1), 'A', 'Asia/Ho_Chi_Minh'), (tests.u(2), 'B', 'Asia/Ho_Chi_Minh');
insert into public.children (id, family_id, name, birth_date) values
  (tests.u(201), tests.u(1), 'Minh', '2009-03-01'), (tests.u(202), tests.u(1), 'Khang', '2013-05-01'), (tests.u(203), tests.u(2), 'Lan', '2010-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'),
  (tests.u(114), tests.u(1), tests.u(14), 'child', tests.u(202), 'Khang'), (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'Cha B'),
  (tests.u(123), tests.u(2), tests.u(23), 'child', tests.u(203), 'Lan');
create function tests.m() returns date language sql stable security definer as $$ select date_trunc('week', public.family_today(tests.u(1))::timestamp)::date $$;
grant execute on function tests.m() to authenticated, anon, service_role;
-- compteur lisible par le propriétaire de la base (activity_log : un enfant n'y lit rien)
create function tests.acts(t text, att int default null) returns int language plpgsql security definer as $$
declare n int;
begin
  select count(*)::int into n from public.activity_log where type = t and (att is null or payload->>'attempt_id' = tests.u(att)::text);
  return n;
end $$;
grant execute on function tests.acts(text, int) to authenticated, anon, service_role;
insert into public.catalog_quizzes (id, country, grade, subject, week_label, title, status, release_on, due_on) values
  (tests.u(701), 'VN', '7', 'hist_geo', 'Tuần 1', 'Văn Lang', 'published', tests.m(), tests.m() + 6),
  (tests.u(702), 'VN', '7', 'hist_geo', 'Tuần 2', 'Phong kiến', 'published', tests.m(), tests.m() + 6);
insert into public.catalog_questions (quiz_id, position, prompt, choices) values
  (tests.u(701), 0, 'Q1', array['a','b','c','d']), (tests.u(702), 0, 'Q1', array['a','b','c','d']);
insert into public.catalog_answer_keys (question_id, correct_index, confirmed) select id, 0, true from public.catalog_questions;
update public.children set country = 'VN', grade = '7' where id in (tests.u(201), tests.u(202));
insert into public.child_subjects (child_id, family_id, subject) values (tests.u(201), tests.u(1), 'hist_geo'), (tests.u(202), tests.u(1), 'hist_geo');
select * from no_plan();

-- ───────────── soumission : UNE ligne quiz_submitted, jamais de doublon ─────────────
select tests.login(13);
select lives_ok($$select public.start_catalog_evaluation(tests.u(701), tests.u(801))$$, 'A démarre le quiz');
select is(tests.acts('quiz_submitted'), 0, 'démarrer ne notifie pas');
select lives_ok($$select public.submit_quiz_evaluation(tests.u(801), '[]'::jsonb)$$, 'A envoie');
select is(tests.acts('quiz_submitted', 801), 1, 'soumission : 1 ligne quiz_submitted');
select lives_ok($$select public.submit_quiz_evaluation(tests.u(801), '[]'::jsonb)$$, 'rejeu de l''envoi : sans erreur');
select is(tests.acts('quiz_submitted', 801), 1, '…aucune ligne de plus (soumission déjà faite)');
select is(tests.val('select actor_member_id::text || ''/'' || child_id::text || ''/'' || (payload->>''title'') || ''/'' || (payload->>''subject'') from public.activity_log where type = ''quiz_submitted'' and payload->>''attempt_id'' = ''' || tests.u(801) || ''''),
          tests.u(113)::text || '/' || tests.u(201)::text || '/Văn Lang/hist_geo', 'ligne : acteur = l''enfant, enfant, titre, matière');
select is(tests.val('select (payload ? ''score'')::text from public.activity_log where type = ''quiz_submitted'' and payload->>''attempt_id'' = ''' || tests.u(801) || ''''), 'false', 'jamais le score avant la validation');
select lives_ok($$select public.submit_quiz_evaluation(tests.u(801), '{}'::jsonb)$$, 'encore un rejeu (contenu quelconque) : ignoré');
select is(tests.acts('quiz_submitted', 801), 1, '…toujours 1 ligne');
select tests.login(14);
select throws_ok($$select public.submit_quiz_evaluation(tests.u(801), '[]'::jsonb)$$, '42501', 'forbidden', 'le frère ne peut pas envoyer la tentative de A');
select is(tests.acts('quiz_submitted'), 1, '…aucune ligne de plus');

-- ───────────── validation : UNE ligne quiz_validated, jamais de doublon ─────────────
select tests.login(11);
select is(tests.acts('quiz_validated'), 0, 'avant validation : rien');
select lives_ok($$select public.validate_quiz_attempt(tests.u(801), true)$$, 'le parent valide (correction visible)');
select is(tests.acts('quiz_validated', 801), 1, 'validation : 1 ligne quiz_validated');
select lives_ok($$select public.validate_quiz_attempt(tests.u(801), false)$$, 'revalidation : sans erreur');
select is(tests.acts('quiz_validated', 801), 1, '…aucune ligne de plus');
select is(tests.val('select (payload->>''score'') || ''/'' || (payload->>''total'') || ''/'' || (payload->>''points'') || ''/'' || (payload->>''show_correction'') || ''/'' || actor_member_id::text from public.activity_log where type = ''quiz_validated'' and payload->>''attempt_id'' = ''' || tests.u(801) || ''''),
          '0/1/0/true/' || tests.u(111)::text, 'ligne : score, total, points (0 possible), correction, acteur = le parent (la revalidation ne change rien)');
reset role;
select tests.submitted(802, 1, 201, 702, 16, 16);
select tests.login(11);
select lives_ok($$select public.validate_quiz_attempt(tests.u(802), false)$$, 'validation à 100 %');
select is(tests.val('select (payload->>''points'') || ''/'' || (payload->>''total'') from public.activity_log where type = ''quiz_validated'' and payload->>''attempt_id'' = ''' || tests.u(802) || ''''), '8/16', 'points attribués dans la ligne (le barème serveur)');
select is(tests.val('select delta::text from public.point_transactions where ref_id = ''' || tests.u(802) || ''''), '8', '…égaux au crédit réellement écrit');
-- un refus ne laisse aucune ligne
select throws_ok($$select public.validate_quiz_attempt(tests.u(999), false)$$, 'P0002', 'attempt_not_found', 'tentative inconnue refusée');
select is(tests.acts('quiz_validated'), 2, '…aucune ligne de plus');
select tests.login(13);
select throws_ok($$select public.validate_quiz_attempt(tests.u(801), false)$$, '42501', 'forbidden', 'un enfant ne valide pas');
select is(tests.acts('quiz_validated'), 2, '…aucune ligne de plus');
select tests.login(21);
select throws_ok($$select public.validate_quiz_attempt(tests.u(802), false)$$, 'P0002', 'attempt_not_found', 'autre famille : refusé');

-- ───────────── lecture et écriture de activity_log ─────────────
select tests.login(13);
select is((select count(*)::int from public.activity_log), 0, 'enfant A : ne lit AUCUNE ligne (ni les siennes, ni celles du frère)');
select tests.login(14);
select is((select count(*)::int from public.activity_log), 0, 'enfant B : ne lit rien non plus (D-052)');
select tests.login(11);
select is((select count(*)::int from public.activity_log where type in ('quiz_submitted', 'quiz_validated')), 3, 'parent : les 3 lignes de SA famille');
select tests.login(21);
select is((select count(*)::int from public.activity_log where type in ('quiz_submitted', 'quiz_validated')), 0, 'parent d''une autre famille : aucune');
select tests.login(13);
select throws_ok($$insert into public.activity_log (family_id, child_id, type, payload) values (tests.u(1), tests.u(201), 'quiz_validated', '{}')$$, '42501', null, 'enfant : aucune écriture dans activity_log');
select tests.login(11);
select throws_ok($$insert into public.activity_log (family_id, child_id, type, payload) values (tests.u(1), tests.u(201), 'quiz_submitted', '{}')$$, '42501', null, 'parent : aucune écriture directe non plus');
select throws_ok($$update public.activity_log set type = 'x'$$, '42501', null, 'parent : aucune modification');
select throws_ok($$select public.log_activity(tests.u(1), tests.u(201), tests.u(111), 'quiz_validated', '{}')$$, '42501', null, 'log_activity : aucun droit client');

-- ───────────── état d'enregistrement : lu de la base, par membre ─────────────
select tests.login(11);
select is((public.my_push_status('https://push.example/ba'))::text, '{"this_device": false, "last_push_at": null, "active_devices": 0, "last_push_result": null}', 'aucun appareil : this_device faux, 0 actif, aucun envoi');
select lives_ok($$select public.register_web_push('{"endpoint":"https://push.example/ba","keys":{"p256dh":"k","auth":"a"}}'::jsonb)$$, 'le parent enregistre ce navigateur');
select is((public.my_push_status('https://push.example/ba')->>'this_device')::boolean, true, 'ce navigateur : enregistré');
select is((public.my_push_status('https://push.example/autre')->>'this_device')::boolean, false, 'un autre navigateur : non');
select is((public.my_push_status()->>'active_devices')::int, 1, 'un appareil actif');
-- changement de compte sur le MÊME navigateur : l'ancien membre n'est plus enregistré, le nouveau l'est
select tests.login(13);
select is((public.my_push_status('https://push.example/ba')->>'this_device')::boolean, false, 'l''enfant n''est pas enregistré tant qu''il ne l''a pas fait (la ligne du parent ne compte pas pour lui)');
select lives_ok($$select public.register_web_push('{"endpoint":"https://push.example/ba","keys":{"p256dh":"k","auth":"a"}}'::jsonb)$$, 'l''enfant enregistre le même navigateur');
select is((public.my_push_status('https://push.example/ba')->>'this_device')::boolean, true, 'enfant : enregistré');
select tests.login(11);
select is((public.my_push_status('https://push.example/ba')->>'this_device')::boolean, false, 'le parent n''est PLUS enregistré sur ce navigateur (réattribué)');
select is((public.my_push_status()->>'active_devices')::int, 0, '…et n''a plus d''appareil actif');
select lives_ok($$select public.unregister_web_push('https://push.example/ba')$$, 'désinscription du parent (sans effet sur la ligne de l''enfant)');
select tests.login(13);
select is((public.my_push_status('https://push.example/ba')->>'this_device')::boolean, true, 'la ligne de l''enfant est intacte');
select tests.login(14);
select is((public.my_push_status('https://push.example/ba')->>'this_device')::boolean, false, 'le frère n''est pas concerné');
select is((public.my_push_status()->>'active_devices')::int, 0, '…0 appareil');

-- dernier envoi : écrit par le serveur seulement
reset role;
update public.devices set last_push_at = now(), last_push_result = 'sent' where web_push_subscription->>'endpoint' = 'https://push.example/ba' and revoked_at is null;
select tests.login(13);
select is(public.my_push_status()->>'last_push_result', 'sent', 'dernier résultat d''envoi visible du membre concerné');
select tests.login(14);
select is(public.my_push_status()->>'last_push_result', null, 'le frère ne voit pas celui de A');
select tests.login(13);
select throws_ok($$update public.devices set last_push_result = 'sent'$$, '42501', null, 'aucune écriture client sur devices.last_push_result');
select tests.login(11);
select throws_ok($$update public.devices set last_push_at = now()$$, '42501', null, 'parent : non plus');
reset role;
select ok(not has_function_privilege('anon', 'public.my_push_status(text)', 'execute'), 'anon : aucun accès à my_push_status');
select ok(has_function_privilege('authenticated', 'public.my_push_status(text)', 'execute'), 'authenticated : accès (la fonction borne au membre)');
set local role anon;
select throws_ok($$select public.my_push_status()$$, '42501', null, 'anon : refusé');
reset role;

select * from finish();
rollback;
