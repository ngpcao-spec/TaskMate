import { draftQuestions, fold, isIsoDay, parseCatalogImport, splitSource, type ImportError, type ParsedQuiz } from '@/domain/catalog-import';

const quizText = (over: { header?: string; questions?: string } = {}) => `[QUIZ]
${over.header ?? `Pays: VN
Classe: 5
Matière: hist_geo
Semaine: Tuần 7
Titre: Bài 5. Văn Lang, Âu Lạc (truyền thuyết và Văn Lang)
Ouverture: 2026-10-16
Échéance: 2026-10-25`}
${over.questions ?? `1. Nhà nước Văn Lang ra đời vào khoảng thời gian nào?
A. Thế kỉ VII TCN
B. Thế kỉ VII sau CN
C. Thế kỉ III TCN
D. Thế kỉ I
Đáp án: A
Giải thích: Văn Lang ra đời vào thế kỉ VII TCN. Nguồn: Bài 5, mục 1
2. Ai đứng đầu nhà nước Văn Lang?
A. Vua Hùng
B. Thục Phán
C. Triệu Đà
D. Hai Bà Trưng
Đáp án: B
Giải thích: Đứng đầu là vua Hùng.`}`;

const ok = (text: string): ParsedQuiz[] => {
  const r = parseCatalogImport(text);
  if (!r.structured || !r.ok) throw new Error(`attendu ok : ${JSON.stringify(r)}`);
  return r.quizzes;
};
const errs = (text: string): ImportError[] => {
  const r = parseCatalogImport(text);
  if (!r.structured || r.ok) throw new Error('attendu des erreurs');
  return r.errors;
};
const codes = (text: string) => errs(text).map((e) => e.code);

describe('import d\'administration — lecture déterministe (D-081)', () => {
  it('un fichier sans [QUIZ] n\'est pas structuré (repli sur l\'IA)', () => {
    expect(parseCatalogImport('Bài học sur Văn Lang\n1. Question ?\nA. a\nB. b')).toEqual({ structured: false });
    expect(parseCatalogImport('')).toEqual({ structured: false });
  });

  it('un bloc complet : en-tête, dates, questions, réponses, explication et source', () => {
    const [q] = ok(quizText());
    expect(q).toMatchObject({ block: 1, line: 1, country: 'VN', grade: '5', subject: 'hist_geo', week: 'Tuần 7', title: 'Bài 5. Văn Lang, Âu Lạc (truyền thuyết và Văn Lang)', releaseOn: '2026-10-16', dueOn: '2026-10-25' });
    expect(q?.questions).toHaveLength(2);
    expect(q?.questions[0]).toMatchObject({ number: 1, prompt: 'Nhà nước Văn Lang ra đời vào khoảng thời gian nào?', correct: 0, explanation: 'Văn Lang ra đời vào thế kỉ VII TCN.', source: 'Bài 5, mục 1' });
    expect(q?.questions[0]?.choices).toEqual(['Thế kỉ VII TCN', 'Thế kỉ VII sau CN', 'Thế kỉ III TCN', 'Thế kỉ I']);
    expect(q?.questions[1]).toMatchObject({ number: 2, correct: 1, explanation: 'Đứng đầu là vua Hùng.', source: null });
  });

  it('plusieurs blocs (une année complète) dans un seul fichier, avec numéros de bloc et de ligne', () => {
    const text = `Titre du document ignoré\n${quizText()}\n\n${quizText({ header: 'Pays: FR\nClasse: 5e\nMatière: Mathématiques\nSemaine: Semaine 1\nTitre: Fractions' })}`;
    const quizzes = ok(text);
    expect(quizzes.map((q) => [q.block, q.country, q.grade, q.subject])).toEqual([[1, 'VN', '5', 'hist_geo'], [2, 'FR', '5E', 'maths']]);
    expect(quizzes[0]?.line).toBe(2);
    expect(quizzes[1]?.releaseOn).toBeNull(); // dates facultatives à la lecture (la publication les exige)
  });

  it.each([
    ['Pays', 'Quốc gia', 'Lớp', 'Môn', 'Tuần', 'Tiêu đề', 'Từ ngày', 'Đến ngày'],
    ['pays', 'Country', 'Grade', 'Subject', 'Week', 'Title', 'Open', 'Due'],
    ['PAYS', 'PAYS', 'CLASSE', 'MATIÈRE', 'SEMAINE', 'TITRE', 'OUVERTURE', 'ÉCHÉANCE'],
    ['Nước', 'Pays', 'Niveau', 'Môn học', 'Semaine', 'Tên', 'Début', 'Fin'],
  ])('clés d\'en-tête tolérantes (casse, accents, synonymes fr/vi/en) : %s', (country, _alt, grade, subject, week, title, open, due) => {
    const text = `[QUIZ]\n${country}: Việt Nam\n${grade}: lớp 5\n${subject}: Lịch sử và Địa lý\n${week}: Tuần 3\n${title}: T\n${open}: 2026-10-16\n${due}: 2026-10-25\n1. Q ?\nA. a\nB. b\nC. c\nD. d\nĐáp án: C`;
    expect(ok(text)[0]).toMatchObject({ country: 'VN', grade: '5', subject: 'hist_geo', week: 'Tuần 3', releaseOn: '2026-10-16', dueOn: '2026-10-25' });
  });

  it.each([
    ['Việt Nam', 'VN'], ['vietnam', 'VN'], ['vn', 'VN'], ['France', 'FR'], ['Pháp', 'FR'], ['fr', 'FR'],
  ])('pays « %s » → %s', (value, expected) => {
    expect(ok(quizText({ header: `Pays: ${value}\nClasse: ${expected === 'VN' ? '5' : '5e'}\nMatière: maths\nSemaine: S1\nTitre: T` }))[0]?.country).toBe(expected);
  });

  it.each([
    ['hist_geo', 'hist_geo'], ['Histoire-Géographie', 'hist_geo'], ['Lịch sử và Địa lý', 'hist_geo'], ['Toán', 'maths'], ['Mathématiques', 'maths'], ['Tiếng Anh', 'anglais'], ['English', 'anglais'],
    ['Khoa học', 'sciences'], ['Tiếng Việt', 'langue_nationale'], ['Giáo dục công dân', 'civics'], ['Công nghệ', 'technology'],
  ])('matière « %s » → %s', (value, expected) => {
    expect(ok(quizText({ header: `Pays: VN\nClasse: 5\nMatière: ${value}\nSemaine: S1\nTitre: T` }))[0]?.subject).toBe(expected);
  });

  it.each([['VN', '5', '5'], ['VN', 'Lớp 5', '5'], ['VN', 'lớp 12', '12'], ['FR', '5e', '5E'], ['FR', '5ème', '5E'], ['FR', 'CM2', 'CM2'], ['FR', 'terminale', 'TERM']])('classe %s « %s » normalisée en %s', (country, value, expected) => {
    expect(ok(quizText({ header: `Pays: ${country}\nClasse: ${value}\nMatière: maths\nSemaine: S1\nTitre: T` }))[0]?.grade).toBe(expected);
  });

  it('énoncés et choix sur plusieurs lignes, « Đáp án » avec lettre minuscule ou texte, source sur sa propre ligne', () => {
    const [q] = ok(quizText({
      questions: `1) Énoncé long
qui continue ici ?
a) premier
choix
b) deuxième
c) troisième
d) quatrième
Dap an: c. troisième
Giai thich: ligne un
ligne deux.
Nguồn: Bài 9`,
    }));
    expect(q?.questions[0]).toMatchObject({ prompt: 'Énoncé long qui continue ici ?', correct: 2, explanation: 'ligne un ligne deux.', source: 'Bài 9' });
    expect(q?.questions[0]?.choices[0]).toBe('premier choix');
  });

  it('fins de ligne Windows, lignes vides et espaces superflus', () => {
    const text = quizText().replace(/\n/g, '\r\n\r\n  ');
    expect(ok(text)[0]?.questions).toHaveLength(2);
  });

  it('draftQuestions : format de create_catalog_draft', () => {
    const [q] = ok(quizText());
    expect(draftQuestions(q as ParsedQuiz)[0]).toEqual({
      prompt: 'Nhà nước Văn Lang ra đời vào khoảng thời gian nào?', choices: ['Thế kỉ VII TCN', 'Thế kỉ VII sau CN', 'Thế kỉ III TCN', 'Thế kỉ I'], correct: 0, explanation: 'Văn Lang ra đời vào thế kỉ VII TCN.', source: 'Bài 5, mục 1',
    });
  });
});

describe('import d\'administration — validation (tout ou rien, ligne fautive)', () => {
  const base = { country: 'Pays: VN', grade: 'Classe: 5', subject: 'Matière: maths', week: 'Semaine: S1', title: 'Titre: T' };
  const header = (over: Partial<typeof base> & { extra?: string } = {}) => [over.country ?? base.country, over.grade ?? base.grade, over.subject ?? base.subject, over.week ?? base.week, over.title ?? base.title, over.extra ?? ''].filter(Boolean).join('\n');
  const q = '1. Q ?\nA. a\nB. b\nC. c\nD. d\nĐáp án: B';

  it.each([
    ['pays inconnu', header({ country: 'Pays: Japon' }), 'invalid_country', 2],
    ['classe inconnue pour le pays', header({ grade: 'Classe: 13' }), 'invalid_grade', 3],
    ['classe française pour le Vietnam', header({ grade: 'Classe: 5e' }), 'invalid_grade', 3],
    ['classe VN pour la France', header({ country: 'Pays: FR', grade: 'Classe: 5' }), 'invalid_grade', 3],
    ['matière inconnue', header({ subject: 'Matière: peinture' }), 'invalid_subject', 4],
    ['clé d\'en-tête inconnue', header({ extra: 'Couleur: rouge' }), 'unknown_header', 7],
    ['date impossible', header({ extra: 'Ouverture: 2026-02-30\nÉchéance: 2026-03-02' }), 'invalid_date', 7],
    ['date au mauvais format', header({ extra: 'Ouverture: 16/10/2026\nÉchéance: 2026-10-25' }), 'invalid_date', 7],
    ['une seule date', header({ extra: 'Ouverture: 2026-10-16' }), 'dates_pair', 7],
    ['échéance avant l\'ouverture', header({ extra: 'Ouverture: 2026-10-25\nÉchéance: 2026-10-16' }), 'dates_order', 8],
  ])('%s', (_n, head, code, line) => {
    const found = errs(`[QUIZ]\n${head}\n${q}`);
    expect(found.find((e) => e.code === code)).toMatchObject({ code, line, block: 1 });
  });

  it.each([
    ['pays manquant', ['Classe: 5', 'Matière: maths', 'Semaine: S1', 'Titre: T'], 'country'],
    ['semaine vide', ['Pays: VN', 'Classe: 5', 'Matière: maths', 'Semaine:', 'Titre: T'], 'week'],
    ['titre manquant', ['Pays: VN', 'Classe: 5', 'Matière: maths', 'Semaine: S1'], 'title'],
  ])('en-tête incomplet : %s', (_n, lines, key) => {
    expect(errs(`[QUIZ]\n${lines.join('\n')}\n${q}`).find((e) => e.code === 'missing_header')).toMatchObject({ params: { key }, line: 1, block: 1 });
  });

  it('semaine et titre trop longs', () => {
    expect(codes(`[QUIZ]\n${header({ week: `Semaine: ${'x'.repeat(41)}`, title: `Titre: ${'y'.repeat(81)}` })}\n${q}`)).toEqual(expect.arrayContaining(['week_too_long', 'title_too_long']));
  });

  it.each([
    ['trois choix', '1. Q ?\nA. a\nB. b\nC. c\nĐáp án: A', 'choice_count'],
    ['cinq choix', '1. Q ?\nA. a\nB. b\nC. c\nD. d\nE. e\nĐáp án: A', 'choice_count'],
    ['choix hors ordre', '1. Q ?\nA. a\nC. c\nB. b\nD. d\nĐáp án: A', 'choice_count'],
    ['sans réponse', '1. Q ?\nA. a\nB. b\nC. c\nD. d', 'missing_answer'],
    ['réponse hors A–D', '1. Q ?\nA. a\nB. b\nC. c\nD. d\nĐáp án: E', 'invalid_answer'],
    ['réponse illisible', '1. Q ?\nA. a\nB. b\nC. c\nD. d\nĐáp án: 7', 'invalid_answer'],
    ['choix en double', '1. Q ?\nA. a\nB. a\nC. c\nD. d\nĐáp án: A', 'duplicate_choice'],
    ['choix en double (casse et accents)', '1. Q ?\nA. Hà Nội\nB. HA NOI\nC. c\nD. d\nĐáp án: A', 'duplicate_choice'],
    ['choix vide', '1. Q ?\nA. a\nB.\nC. c\nD. d\nĐáp án: A', 'choice_empty'],
    ['énoncé vide', '1.\nA. a\nB. b\nC. c\nD. d\nĐáp án: A', 'prompt_empty'],
    ['énoncé trop long', `1. ${'x'.repeat(501)}\nA. a\nB. b\nC. c\nD. d\nĐáp án: A`, 'prompt_too_long'],
    ['choix trop long', `1. Q\nA. ${'x'.repeat(201)}\nB. b\nC. c\nD. d\nĐáp án: A`, 'choice_too_long'],
    ['explication trop longue', `1. Q\nA. a\nB. b\nC. c\nD. d\nĐáp án: A\nGiải thích: ${'x'.repeat(501)}`, 'explanation_too_long'],
    ['source trop longue', `1. Q\nA. a\nB. b\nC. c\nD. d\nĐáp án: A\nGiải thích: ok. Nguồn: ${'x'.repeat(201)}`, 'source_too_long'],
    ['numéro en double', `${q}\n${q}`, 'duplicate_number'],
    ['aucune question', '', 'no_questions'],
  ])('question : %s', (_n, body, code) => {
    expect(codes(`[QUIZ]\n${header()}\n${body}`)).toContain(code);
  });

  it('plus de 30 questions', () => {
    const many = Array.from({ length: 31 }, (_, i) => `${i + 1}. Q${i} ?\nA. a\nB. b\nC. c\nD. d\nĐáp án: A`).join('\n');
    expect(errs(`[QUIZ]\n${header()}\n${many}`).find((e) => e.code === 'too_many_questions')).toMatchObject({ params: { found: 31, max: 30 } });
    const thirty = Array.from({ length: 30 }, (_, i) => `${i + 1}. Q${i} ?\nA. a\nB. b\nC. c\nD. d\nĐáp án: A`).join('\n');
    expect(ok(`[QUIZ]\n${header()}\n${thirty}`)[0]?.questions).toHaveLength(30);
  });

  it('numéro de ligne exact de la question fautive dans le fichier', () => {
    const text = `Introduction\n[QUIZ]\n${header()}\n1. Bonne ?\nA. a\nB. b\nC. c\nD. d\nĐáp án: A\n2. Mauvaise ?\nA. a\nB. b\nC. c\nĐáp án: A`;
    expect(errs(text)).toEqual([expect.objectContaining({ code: 'choice_count', line: 14, block: 1 })]);
  });

  it('TOUT OU RIEN : une seule erreur dans un fichier de 3 blocs → aucun QCM retourné', () => {
    const good = quizText();
    const bad = quizText({ header: 'Pays: VN\nClasse: 5\nMatière: peinture\nSemaine: S2\nTitre: T' });
    const r = parseCatalogImport(`${good}\n${bad}\n${quizText({ header: 'Pays: VN\nClasse: 6\nMatière: maths\nSemaine: S3\nTitre: T' })}`);
    expect(r.structured && !r.ok).toBe(true);
    expect('quizzes' in r).toBe(false);
    if (r.structured && !r.ok) expect(r.errors.map((e) => [e.block, e.code])).toEqual([[2, 'invalid_subject']]);
  });

  it('plusieurs erreurs : toutes listées, triées par ligne, avec leur bloc', () => {
    const text = `${quizText({ header: 'Pays: XX\nClasse: 5\nMatière: maths\nSemaine: S1\nTitre: T' })}\n${quizText({ header: 'Pays: VN\nClasse: 99\nMatière: maths\nSemaine: S2\nTitre: T' })}`;
    const found = errs(text);
    expect(found.map((e) => [e.block, e.code])).toEqual([[1, 'invalid_country'], [2, 'invalid_grade']]);
    expect(found[0]!.line).toBeLessThan(found[1]!.line);
  });

  it('même case deux fois dans le fichier (pays + classe + matière + semaine) : refusé', () => {
    const found = errs(`${quizText()}\n${quizText()}`);
    expect(found).toEqual([expect.objectContaining({ code: 'duplicate_slot', block: 2, params: { other: 1, otherLine: 1 } })]);
  });
  it('même semaine mais classe ou matière différente : accepté', () => {
    expect(ok(`${quizText()}\n${quizText({ header: 'Pays: VN\nClasse: 6\nMatière: hist_geo\nSemaine: Tuần 7\nTitre: T' })}`)).toHaveLength(2);
  });

  it('ligne hors question dans un bloc', () => {
    expect(ok(`[QUIZ]\n${header()}\n${q}\nGiải thích: x\n`)[0]?.questions).toHaveLength(1);
    expect(codes(`[QUIZ]\n${header()}\n1. Q ?\nA. a\nB. b\nC. c\nD. d\nĐáp án: A\nligne perdue après la réponse`)).toContain('unexpected_line');
  });
});

describe('aides', () => {
  it('fold : sans accents, đ → d', () => {
    expect(fold('Đáp án Lịch sử')).toBe('dap an lich su');
  });
  it('dates : jours réels entre 2020 et 2100 seulement', () => {
    expect(isIsoDay('2026-10-16')).toBe(true);
    expect(isIsoDay('2028-02-29')).toBe(true);
    expect(isIsoDay('2026-02-29')).toBe(false);
    expect(isIsoDay('2019-12-31')).toBe(false);
    expect(isIsoDay('2101-01-01')).toBe(false);
    expect(isIsoDay('16-10-2026')).toBe(false);
  });
  it('source : la dernière mention « Nguồn: » ou « Source: » ; rien sinon', () => {
    expect(splitSource('Texte. Nguồn: Bài 5, mục 1')).toEqual({ explanation: 'Texte.', source: 'Bài 5, mục 1' });
    expect(splitSource('Texte. Source : p. 12')).toEqual({ explanation: 'Texte.', source: 'p. 12' });
    expect(splitSource('Voir Nguồn: a puis Nguồn: b')).toEqual({ explanation: 'Voir Nguồn: a puis', source: 'b' });
    expect(splitSource('Aucune référence')).toEqual({ explanation: 'Aucune référence', source: null });
    expect(splitSource('Texte. Nguồn:')).toEqual({ explanation: 'Texte.', source: null });
    expect(splitSource('Resources: x')).toEqual({ explanation: 'Resources: x', source: null });
  });
});
