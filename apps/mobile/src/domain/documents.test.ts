import {
  allowsKey, base64Bytes, clampCount, DOC_LIMITS, fitWithin, generateErrorKey, instructionTooLong, isExamKind, kindOfFile, MATERIAL_KINDS, REQUEST_KINDS, reviewRoute, selectionErrorKey, summaryNotices,
  validateSelection, type GenerateSummaryInput,
} from './documents';

describe('kindOfFile', () => {
  it('par type MIME puis par extension', () => {
    expect(kindOfFile({ name: 'a.jpg', type: 'image/jpeg' })).toBe('image');
    expect(kindOfFile({ name: 'a', type: 'image/heic' })).toBe('image');
    expect(kindOfFile({ name: 'IMG_1.HEIC', type: '' })).toBe('image');
    expect(kindOfFile({ name: 'cours.pdf', type: 'application/pdf' })).toBe('pdf');
    expect(kindOfFile({ name: 'cours.PDF', type: '' })).toBe('pdf');
    expect(kindOfFile({ name: 'devoir.docx', type: '' })).toBe('docx');
    expect(kindOfFile({ name: 'x', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe('docx');
    expect(kindOfFile({ name: 'notes.txt', type: 'text/plain' })).toBeNull();
    expect(kindOfFile({ name: 'ancien.doc', type: 'application/msword' })).toBeNull();
  });
});

describe('validateSelection', () => {
  const img = (bytes = 1000) => ({ kind: 'image' as const, bytes });
  it('images seules (jusqu\'à 5), un PDF seul, un Word seul', () => {
    expect(validateSelection([])).toBeNull();
    expect(validateSelection([img(), img(), img(), img(), img()])).toBeNull();
    expect(validateSelection([{ kind: 'pdf', bytes: 4_000_000 }])).toBeNull();
    expect(validateSelection([{ kind: 'docx', bytes: 3_000_000 }])).toBeNull();
  });
  it('trop de fichiers, mélanges, doubles documents', () => {
    expect(validateSelection(Array.from({ length: 6 }, () => img()))).toBe('tooMany');
    expect(validateSelection([{ kind: 'pdf', bytes: 1 }, img()])).toBe('unsupportedMix');
    expect(validateSelection([{ kind: 'pdf', bytes: 1 }, { kind: 'pdf', bytes: 1 }])).toBe('unsupportedMix');
    expect(validateSelection([{ kind: 'docx', bytes: 1 }, { kind: 'pdf', bytes: 1 }])).toBe('unsupportedMix');
  });
  it('tailles : par type et au total', () => {
    expect(validateSelection([img(DOC_LIMITS.maxImageBytes + 1)])).toBe('tooLarge');
    expect(validateSelection([{ kind: 'pdf', bytes: DOC_LIMITS.maxPdfBytes + 1 }])).toBe('tooLarge');
    expect(validateSelection([{ kind: 'docx', bytes: DOC_LIMITS.maxDocxBytes + 1 }])).toBe('tooLarge');
    expect(validateSelection([img(2_500_000), img(2_500_000), img(2_500_000)])).toBe('totalTooLarge');
    expect(validateSelection([img(DOC_LIMITS.maxImageBytes), img(DOC_LIMITS.maxImageBytes)])).toBeNull(); // 6 000 000 = limite incluse
  });
});

describe('fitWithin / base64Bytes / clampCount', () => {
  it('réduit au plus grand côté, sans jamais agrandir', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 });
    expect(fitWithin(10000, 1, 1600)).toEqual({ width: 1600, height: 1 });
    expect(fitWithin(0, 0, 1600)).toEqual({ width: 0, height: 0 });
  });
  it('base64Bytes', () => {
    expect(base64Bytes('')).toBe(0);
    expect(base64Bytes('YQ==')).toBe(1);
    expect(base64Bytes('YWI=')).toBe(2);
    expect(base64Bytes('YWJj')).toBe(3);
  });
  it('clampCount : 3 à 30', () => {
    expect(clampCount(1)).toBe(3);
    expect(clampCount(100)).toBe(30);
    expect(clampCount(12.4)).toBe(12);
    expect(clampCount(DOC_LIMITS.defaultQuestions)).toBe(10);
  });
});

describe('messages d\'erreur', () => {
  it('codes serveur connus et repli', () => {
    expect(generateErrorKey('ai_not_configured')).toBe('revisions.import.errors.notConfigured');
    expect(generateErrorKey('quota_exceeded')).toBe('revisions.import.errors.quota');
    expect(generateErrorKey('invalid_output')).toBe('revisions.import.errors.aiFailed');
    expect(generateErrorKey('no_usable_content')).toBe('revisions.import.errors.noContent');
    expect(generateErrorKey('???')).toBe('revisions.import.errors.generic');
    expect(selectionErrorKey('tooLarge')).toBe('revisions.import.errors.tooLarge');
    expect(selectionErrorKey('unsupportedMix')).toBe('revisions.import.errors.unsupportedMix');
  });
});

describe('validateSelection avec corrigé (rôle « key »)', () => {
  const img = (role?: 'exam' | 'key', bytes = 1000) => ({ kind: 'image' as const, bytes, role });
  it('le corrigé est un groupe à part : examen en PDF + corrigé en photos est valide', () => {
    expect(validateSelection([{ kind: 'pdf', bytes: 1000, role: 'exam' }, img('key'), img('key')])).toBeNull();
    expect(validateSelection([img('exam'), { kind: 'docx', bytes: 1000, role: 'key' }])).toBeNull();
  });
  it('dans CHAQUE groupe : images seules, OU un seul document', () => {
    expect(validateSelection([{ kind: 'pdf', bytes: 1, role: 'key' }, img('key')])).toBe('unsupportedMix');
    expect(validateSelection([{ kind: 'pdf', bytes: 1, role: 'key' }, { kind: 'pdf', bytes: 1, role: 'key' }])).toBe('unsupportedMix');
    expect(validateSelection([{ kind: 'pdf', bytes: 1, role: 'exam' }, img('exam')])).toBe('unsupportedMix');
  });
  it('le corrigé compte dans les mêmes limites : 5 fichiers au total, 6 Mo au total', () => {
    expect(validateSelection([img('exam'), img('exam'), img('exam'), img('key'), img('key')])).toBeNull();
    expect(validateSelection([img('exam'), img('exam'), img('exam'), img('key'), img('key'), img('key')])).toBe('tooMany');
    expect(validateSelection([img('exam', 2_500_000), img('exam', 2_500_000), img('key', 2_500_000)])).toBe('totalTooLarge');
  });
});

describe('types de support', () => {
  it('liste extensible : 4 types + Auto (par défaut, en tête)', () => {
    expect([...MATERIAL_KINDS]).toEqual(['exam', 'exam_key', 'course', 'list']);
    expect([...REQUEST_KINDS]).toEqual(['auto', 'exam', 'exam_key', 'course', 'list']);
  });
  it('types examen ; corrigé accepté avec Auto et « examen avec corrigé » seulement', () => {
    expect(MATERIAL_KINDS.filter(isExamKind)).toEqual(['exam', 'exam_key']);
    expect(REQUEST_KINDS.filter(allowsKey)).toEqual(['auto', 'exam_key']);
  });
  it('relecture : la grille Đáp án pour les examens, l\'éditeur sinon', () => {
    expect(reviewRoute('exam')).toBe('/quiz/answers');
    expect(reviewRoute('exam_key')).toBe('/quiz/answers');
    expect(reviewRoute('course')).toBe('/quiz/[id]');
    expect(reviewRoute('list')).toBe('/quiz/[id]');
  });
  it('consigne du parent : 300 caractères au plus (espaces de bord ignorés)', () => {
    expect(instructionTooLong('x'.repeat(300))).toBe(false);
    expect(instructionTooLong('x'.repeat(301))).toBe(true);
    expect(instructionTooLong(`  ${'x'.repeat(300)}  `)).toBe(false);
    expect(DOC_LIMITS.maxInstruction).toBe(300);
  });
});

describe('summaryNotices : jamais de coupe ni d\'omission silencieuse', () => {
  const base: GenerateSummaryInput = { kind: 'exam', kind_detected: true, kind_doubt: false, count: 30, found: 30, capped: false, ignored: [], ignored_count: 0, to_verify_count: 0, figure_count: 0, truncated: false };
  it('rien à signaler', () => {
    expect(summaryNotices(base)).toEqual([]);
  });
  it('plafond : « 42 QCM trouvées, 30 reprises »', () => {
    expect(summaryNotices({ ...base, found: 42, capped: true })).toEqual([{ key: 'revisions.import.result.capped', values: { found: 42, kept: 30 } }]);
  });
  it('non-QCM ignorés : nombre et numéros', () => {
    expect(summaryNotices({ ...base, ignored: ['Câu 13', 'Câu 14', 'Câu 15'], ignored_count: 3 })).toEqual([{ key: 'revisions.import.result.ignored', values: { count: 3, labels: 'Câu 13, Câu 14, Câu 15' } }]);
  });
  it('doute, figures, réponses à vérifier, texte tronqué — dans cet ordre', () => {
    const keys = summaryNotices({ ...base, kind_doubt: true, figure_count: 2, to_verify_count: 5, truncated: true, found: 40, capped: true, ignored: ['Câu 1'], ignored_count: 1 }).map((n) => n.key);
    expect(keys).toEqual([
      'revisions.import.result.doubt', 'revisions.import.result.capped', 'revisions.import.result.ignored', 'revisions.import.result.figures', 'revisions.import.result.toVerify', 'revisions.import.truncated',
    ]);
  });
});

describe('messages d\'erreur des supports multiples', () => {
  it('codes serveur', () => {
    expect(generateErrorKey('key_required')).toBe('revisions.import.errors.keyRequired');
    expect(generateErrorKey('key_not_allowed')).toBe('revisions.import.errors.keyNotAllowed');
    expect(generateErrorKey('instruction_too_long')).toBe('revisions.import.errors.instructionTooLong');
    expect(generateErrorKey('save_failed')).toBe('revisions.import.errors.saveFailed');
    expect(generateErrorKey('invalid_kind')).toBe('revisions.import.errors.generic');
  });
});
