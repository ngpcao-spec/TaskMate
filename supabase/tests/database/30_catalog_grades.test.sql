-- D-081 : classes en LISTE FERMÉE par pays (VN : 1 à 12 ; FR : CP … TERM), validées par la base ; brouillon + dates atomiques ; valeurs existantes normalisées sans perte.
-- Fixtures : famille 1 = parent 11 (ADMIN), enfant A (user 13, profil 201) ; famille 2 = parent 21 (parent ordinaire), enfant C (user 23, profil 203).
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
grant execute on all functions in schema tests to authenticated, anon, service_role;

insert into auth.users (id, email, is_anonymous) values (tests.u(11), 'admin@test', false), (tests.u(13), null, false), (tests.u(21), 'pb@test', false), (tests.u(23), null, false);
insert into public.families (id, name, timezone) values (tests.u(1), 'A', 'Asia/Ho_Chi_Minh'), (tests.u(2), 'B', 'Asia/Ho_Chi_Minh');
insert into public.children (id, family_id, name, birth_date) values (tests.u(201), tests.u(1), 'Minh', '2009-03-01'), (tests.u(203), tests.u(2), 'Lan', '2010-01-01');
insert into public.members (id, family_id, user_id, role, child_id, display_name) values
  (tests.u(111), tests.u(1), tests.u(11), 'parent', null, 'Ba'), (tests.u(113), tests.u(1), tests.u(13), 'child', tests.u(201), 'Minh'),
  (tests.u(121), tests.u(2), tests.u(21), 'parent', null, 'Cha B'), (tests.u(123), tests.u(2), tests.u(23), 'child', tests.u(203), 'Lan');
insert into public.platform_admins (user_id) values (tests.u(11));
select * from no_plan();

-- ───────────── normalisation : MÊMES cas que le test Jest `catalog-domain` ─────────────
select is(public.catalog_normalize_grade(c, r), e, format('%s « %s » → %s', c, r, coalesce(e, 'refusée')))
from (values
  ('VN', '5', '5'), ('VN', ' 5 ', '5'), ('VN', 'lớp 5', '5'), ('VN', 'Lớp 5', '5'), ('VN', 'lop 5', '5'), ('VN', 'Lớp5', '5'), ('VN', 'classe 5', '5'), ('VN', '05', '5'),
  ('VN', '1', '1'), ('VN', '12', '12'), ('VN', 'Lớp 12', '12'),
  ('VN', '0', null), ('VN', '13', null), ('VN', '', null), ('VN', 'abc', null), ('VN', '5e', null), ('VN', 'CM2', null), ('VN', 'lớp', null),
  ('FR', '5e', '5E'), ('FR', '5E', '5E'), ('FR', '5ème', '5E'), ('FR', '5eme', '5E'), ('FR', '5°', '5E'), ('FR', ' 6 e ', '6E'), ('FR', 'classe 4e', '4E'), ('FR', '3EME', '3E'),
  ('FR', 'cp', 'CP'), ('FR', 'CE1', 'CE1'), ('FR', 'ce2', 'CE2'), ('FR', 'CM1', 'CM1'), ('FR', 'cm2', 'CM2'),
  ('FR', 'seconde', '2DE'), ('FR', '2nde', '2DE'), ('FR', '2DE', '2DE'), ('FR', 'première', '1RE'), ('FR', '1ère', '1RE'), ('FR', '1re', '1RE'), ('FR', 'terminale', 'TERM'), ('FR', 'Tle', 'TERM'), ('FR', 'TERM', 'TERM'),
  ('FR', '5', null), ('FR', '12', null), ('FR', '2e', null), ('FR', '7e', null), ('FR', 'CE3', null), ('FR', 'lớp 5', null), ('FR', '', null)
) as t(c, r, e);
select is(public.catalog_normalize_grade('XX', '5'), null, 'pays inconnu : aucune classe');
select is(public.catalog_normalize_grade(null, '5'), null, 'pays absent : aucune classe');
select is(public.catalog_normalize_grade('VN', null), null, 'classe absente : null');
select is((select count(*)::int from unnest(array['1','2','3','4','5','6','7','8','9','10','11','12']) g where public.catalog_normalize_grade('VN', g) = g), 12, 'VN : les 12 classes sont canoniques');
select is((select count(*)::int from unnest(array['CP','CE1','CE2','CM1','CM2','6E','5E','4E','3E','2DE','1RE','TERM']) g where public.catalog_normalize_grade('FR', g) = g), 12, 'FR : les 12 classes sont canoniques');
select is((select count(*)::int from unnest(array['CP','CE1','CE2','CM1','CM2','6E','5E','4E','3E','2DE','1RE','TERM']) g where public.catalog_normalize_grade('VN', g) is not null), 0, 'VN ≠ FR : aucune classe française n''est vietnamienne');
select is((select count(*)::int from unnest(array['1','2','3','4','5','6','7','8','9','10','11','12']) g where public.catalog_normalize_grade('FR', g) is not null), 0, 'VN ≠ FR : aucune classe vietnamienne n''est française');

-- la fonction interne n'est pas appelable par un client
select tests.login(11);
select throws_ok($$select public.catalog_normalize_grade('VN', '5')$$, '42501', null, 'client (même admin) : catalog_normalize_grade interne');
select throws_ok($$select public.catalog_normalize_existing_grades()$$, '42501', null, 'client : catalog_normalize_existing_grades interne');

-- ───────────── admin : cases du catalogue ─────────────
select lives_ok($$select public.catalog_create_quiz(tests.u(701), 'VN', 'lớp 5', 'maths', 'Tuần 1', 'T1')$$, 'admin : « lớp 5 » (VN) accepté');
select is(tests.val('select grade from public.catalog_quizzes where id = tests.u(701)'), '5', '…enregistré en « 5 »');
select lives_ok($$select public.catalog_create_quiz(tests.u(702), 'FR', '5ème', 'maths', 'Semaine 1', 'T2')$$, 'admin : « 5ème » (FR) accepté');
select is(tests.val('select grade from public.catalog_quizzes where id = tests.u(702)'), '5E', '…enregistré en « 5E »');
select throws_ok($$select public.catalog_create_quiz(tests.u(703), 'FR', '5', 'maths', 'Semaine 2', 'T')$$, 'P0001', 'invalid_grade', 'FR : « 5 » seul refusé');
select throws_ok($$select public.catalog_create_quiz(tests.u(703), 'VN', '13', 'maths', 'Tuần 2', 'T')$$, 'P0001', 'invalid_grade', 'VN : « 13 » refusée');
select throws_ok($$select public.catalog_create_quiz(tests.u(703), 'VN', '5E', 'maths', 'Tuần 2', 'T')$$, 'P0001', 'invalid_grade', 'VN : classe française refusée');
select throws_ok($$select public.catalog_create_quiz(tests.u(703), 'FR', 'CM3', 'maths', 'Semaine 2', 'T')$$, 'P0001', 'invalid_grade', 'FR : classe inconnue refusée');
select throws_ok($$select public.catalog_create_quiz(tests.u(703), 'XX', '5', 'maths', 'Tuần 2', 'T')$$, 'P0001', 'invalid_country', 'pays inconnu refusé');
select throws_ok($$select public.catalog_create_quiz(tests.u(704), 'VN', '5', 'maths', 'Tuần 1', 'Doublon')$$, 'P0001', 'catalog_slot_taken', '« 5 » et « lớp 5 » sont la MÊME case : plus de classes distinctes');
select is(tests.val('select count(*)::int from public.catalog_quizzes'), '2', 'aucun brouillon écrit par les refus');

-- ───────────── brouillon + dates, atomique ─────────────
select lives_ok($$select public.create_catalog_draft(tests.u(711), 'VN', 'Lớp 6', 'hist_geo', 'Tuần 7', 'Lịch sử',
  '[{"prompt":"Q1","choices":["a","b","c","d"],"correct":1,"explanation":"parce que","source":"Bài 5"}]'::jsonb, 'course', false, false, date '2026-10-16', date '2026-10-25')$$, 'admin : brouillon + dates en un appel');
select is(tests.val('select grade from public.catalog_quizzes where id = tests.u(711)'), '6', '…classe normalisée');
select is(tests.val('select release_on::text || ''/'' || due_on::text from public.catalog_quizzes where id = tests.u(711)'), '2026-10-16/2026-10-25', '…dates enregistrées avec le brouillon');
select is(tests.val('select status::text from public.catalog_quizzes where id = tests.u(711)'), 'draft', '…en brouillon');
select throws_ok($$select public.create_catalog_draft(tests.u(712), 'VN', '6', 'maths', 'Tuần 1', 'X', '[{"prompt":"Q","choices":["a","b","c","d"],"correct":0}]'::jsonb, 'course', false, false, date '2026-10-25', date '2026-10-16')$$, 'P0001', 'invalid_dates', 'échéance avant l''ouverture : refusé');
select throws_ok($$select public.create_catalog_draft(tests.u(712), 'VN', '6', 'maths', 'Tuần 1', 'X', '[{"prompt":"Q","choices":["a","b","c","d"],"correct":0}]'::jsonb, 'course', false, false, date '2026-10-16', null)$$, 'P0001', 'invalid_dates', 'une seule date : refusé');
select throws_ok($$select public.create_catalog_draft(tests.u(712), 'VN', '6', 'maths', 'Tuần 1', 'X', '[{"prompt":"Q","choices":["a","b","c","d"],"correct":0}]'::jsonb, 'course', false, false, date '1999-01-01', date '1999-02-01')$$, 'P0001', 'invalid_dates', 'date hors bornes : refusé');
select throws_ok($$select public.create_catalog_draft(tests.u(712), 'FR', '5', 'maths', 'Tuần 1', 'X', '[{"prompt":"Q","choices":["a","b","c","d"],"correct":0}]'::jsonb)$$, 'P0001', 'invalid_grade', 'FR « 5 » : refusé');
select throws_ok($$select public.create_catalog_draft(tests.u(712), 'VN', '6', 'maths', 'Tuần 1', 'X', '[{"prompt":"Q","choices":["a","b","c","d"],"correct":9}]'::jsonb, 'course', false, false, date '2026-10-16', date '2026-10-25')$$, 'P0001', 'invalid_correct', 'question invalide : refusé');
select is(tests.val('select count(*)::int from public.catalog_quizzes where id = tests.u(712)'), '0', 'TOUT OU RIEN : aucun brouillon, aucune date écrite après un refus');
select lives_ok($$select public.create_catalog_draft(tests.u(711), 'VN', '6', 'hist_geo', 'Tuần 7', 'Lịch sử',
  '[{"prompt":"Rejeu","choices":["a","b","c","d"],"correct":0}]'::jsonb, 'course', false, false, date '2026-10-16', date '2026-10-25')$$, 'rejeu avec le même id : idempotent');
select is(tests.val('select prompt from public.catalog_questions where quiz_id = tests.u(711)'), 'Q1', '…rien n''est remplacé ni dupliqué');
select throws_ok($$select public.create_catalog_draft(tests.u(713), 'VN', '6', 'hist_geo', '  tuần   7 ', 'Autre', '[{"prompt":"Q","choices":["a","b","c","d"],"correct":0}]'::jsonb)$$, 'P0001', 'catalog_slot_taken', 'case occupée (casse et espaces de la semaine ignorés) : message explicite, pas d''écrasement silencieux');

-- Remplacer : seulement un brouillon sans tentative
select lives_ok($$select public.create_catalog_draft(tests.u(711), 'VN', '6', 'hist_geo', 'Tuần 7', 'Lịch sử v2',
  '[{"prompt":"Q-new","choices":["a","b","c","d"],"correct":2}]'::jsonb, 'course', false, true, date '2026-11-02', date '2026-11-08')$$, 'remplacer un brouillon sans tentative');
select is(tests.val('select prompt from public.catalog_questions where quiz_id = tests.u(711)'), 'Q-new', '…questions remplacées');
select is(tests.val('select title || ''/'' || release_on::text from public.catalog_quizzes where id = tests.u(711)'), 'Lịch sử v2/2026-11-02', '…titre et dates remplacés');
select lives_ok($$select public.create_catalog_draft(tests.u(711), 'VN', '6', 'hist_geo', 'Tuần 7', 'Lịch sử v3',
  '[{"prompt":"Q-3","choices":["a","b","c","d"],"correct":2}]'::jsonb, 'course', false, true)$$, 'remplacer sans dates : les dates existantes sont conservées');
select is(tests.val('select release_on::text from public.catalog_quizzes where id = tests.u(711)'), '2026-11-02', '…dates conservées');
select lives_ok($$select public.catalog_set_status(tests.u(711), 'published')$$, 'publier');
select throws_ok($$select public.create_catalog_draft(tests.u(711), 'VN', '6', 'hist_geo', 'Tuần 7', 'X', '[{"prompt":"Q","choices":["a","b","c","d"],"correct":0}]'::jsonb, 'course', false, true)$$, 'P0001', 'set_published', 'remplacer un QCM publié : refusé');
select lives_ok($$select public.catalog_set_status(tests.u(711), 'draft')$$, 'dépublier');
reset role;
insert into public.quiz_attempts (id, family_id, child_id, catalog_id) values (tests.u(801), tests.u(1), tests.u(201), tests.u(711));
select tests.login(11);
select throws_ok($$select public.create_catalog_draft(tests.u(711), 'VN', '6', 'hist_geo', 'Tuần 7', 'X', '[{"prompt":"Q","choices":["a","b","c","d"],"correct":0}]'::jsonb, 'course', false, true)$$, 'P0001', 'set_has_attempts', 'remplacer un QCM ayant des tentatives : refusé');
select throws_ok($$select public.create_catalog_draft(tests.u(799), 'VN', '6', 'maths', 'Tuần 9', 'X', '[{"prompt":"Q","choices":["a","b","c","d"],"correct":0}]'::jsonb, 'course', false, true)$$, 'P0002', 'set_not_found', 'remplacer un QCM inexistant : refusé');

-- non admin
select tests.login(21);
select throws_ok($$select public.create_catalog_draft(tests.u(720), 'VN', '6', 'maths', 'Tuần 1', 'X', '[{"prompt":"Q","choices":["a","b","c","d"],"correct":0}]'::jsonb, 'course', false, false, date '2026-10-16', date '2026-10-25')$$, '42501', 'forbidden', 'non admin : import refusé (dates comprises)');
select throws_ok($$select public.create_catalog_draft(tests.u(711), 'VN', '6', 'hist_geo', 'Tuần 7', 'X', '[{"prompt":"Q","choices":["a","b","c","d"],"correct":0}]'::jsonb, 'course', false, true)$$, '42501', 'forbidden', 'non admin : remplacement refusé');
select tests.login(13);
select throws_ok($$select public.create_catalog_draft(tests.u(720), 'VN', '6', 'maths', 'Tuần 1', 'X', '[{"prompt":"Q","choices":["a","b","c","d"],"correct":0}]'::jsonb)$$, '42501', 'forbidden', 'enfant : import refusé');
select is(tests.val('select count(*)::int from public.catalog_quizzes where id = tests.u(720)'), '0', 'rien écrit par les non-admins');

-- ───────────── classe de l'enfant (parent) ─────────────
select tests.login(11);
select lives_ok($$select public.set_child_class(tests.u(201), 'VN', 'Lớp 7')$$, 'parent : « Lớp 7 » (VN)');
select is(tests.val('select grade from public.children where id = tests.u(201)'), '7', '…enregistrée en « 7 »');
select lives_ok($$select public.set_child_class(tests.u(201), 'FR', 'cm2')$$, 'parent : « cm2 » (FR)');
select is(tests.val('select country || ''/'' || grade from public.children where id = tests.u(201)'), 'FR/CM2', '…FR/CM2');
select throws_ok($$select public.set_child_class(tests.u(201), 'FR', '5')$$, 'P0001', 'invalid_grade', 'FR « 5 » refusée');
select throws_ok($$select public.set_child_class(tests.u(201), 'VN', 'CM2')$$, 'P0001', 'invalid_grade', 'VN « CM2 » refusée');
select throws_ok($$select public.set_child_class(tests.u(201), 'VN', '13')$$, 'P0001', 'invalid_grade', 'VN « 13 » refusée');
select throws_ok($$select public.set_child_class(tests.u(201), 'VN', '')$$, 'P0001', 'invalid_grade', 'classe vide avec un pays : refusée');
select throws_ok($$select public.set_child_class(tests.u(201), 'XX', '5')$$, 'P0001', 'invalid_country', 'pays inconnu refusé');
select is(tests.val('select country || ''/'' || grade from public.children where id = tests.u(201)'), 'FR/CM2', 'les refus ne changent rien');
select lives_ok($$select public.set_child_class(tests.u(201), null, null)$$, 'parent : efface la classe');
select is(tests.val('select coalesce(country, ''-'') || ''/'' || coalesce(grade, ''-'') from public.children where id = tests.u(201)'), '-/-', '…effacée');
select tests.login(13);
select throws_ok($$select public.set_child_class(tests.u(201), 'VN', '5')$$, '42501', 'forbidden', 'enfant : ne règle pas sa classe');
select tests.login(21);
select throws_ok($$select public.set_child_class(tests.u(201), 'VN', '5')$$, 'P0002', 'child_not_found', 'autre famille : refusé');

-- ───────────── valeurs existantes : normalisées SANS PERTE ─────────────
reset role;
alter table public.catalog_quizzes disable trigger user;
insert into public.catalog_quizzes (id, country, grade, subject, week_label, title) values
  (tests.u(731), 'VN', 'LỚP 8', 'maths', 'Tuần 1', 'legacy 1'), (tests.u(732), 'FR', '4EME', 'maths', 'Semaine 1', 'legacy 2'),
  (tests.u(733), 'VN', 'LỚP 9', 'maths', 'Tuần 2', 'legacy 3'), (tests.u(734), 'VN', '9', 'maths', 'tuần 2', 'legacy 4 occupe déjà la case'),
  (tests.u(735), 'VN', 'QUINTA', 'maths', 'Tuần 3', 'legacy 5 hors liste');
alter table public.catalog_quizzes enable trigger user;
update public.children set country = 'FR', grade = 'QUATRIÈME' where id = tests.u(203);
update public.children set country = 'VN', grade = 'LỚP 3' where id = tests.u(201);
select is(public.catalog_normalize_existing_grades(), 3, 'normalisation : 3 quiz et enfants modifiés (VN « LỚP 3 », « LỚP 8 », FR « 4EME »)');
select is((select grade from public.catalog_quizzes where id = tests.u(731)), '8', 'quiz « lớp 8 » → « 8 »');
select is((select grade from public.catalog_quizzes where id = tests.u(732)), '4E', 'quiz « 4eme » (FR) → « 4E »');
select is((select grade from public.catalog_quizzes where id = tests.u(733)), 'LỚP 9', 'quiz dont la forme canonique occuperait déjà une case : conservé (pas de perte)');
select is((select grade from public.catalog_quizzes where id = tests.u(735)), 'QUINTA', 'valeur hors liste : CONSERVÉE telle quelle, jamais supprimée');
select is((select grade from public.children where id = tests.u(201)), '3', 'enfant « lớp 3 » → « 3 »');
select is((select grade from public.children where id = tests.u(203)), 'QUATRIÈME', 'enfant hors liste : conservé');
select is(public.catalog_normalize_existing_grades(), 0, 'rejouable : plus rien à changer');
select is((select count(*)::int from public.catalog_quizzes), 8, 'aucun quiz supprimé');

select * from finish();
rollback;
