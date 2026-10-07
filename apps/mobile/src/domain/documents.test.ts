import { base64Bytes, clampCount, DOC_LIMITS, fitWithin, generateErrorKey, kindOfFile, selectionErrorKey, validateSelection } from './documents';

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
  it('clampCount : 5 à 20', () => {
    expect(clampCount(1)).toBe(5);
    expect(clampCount(100)).toBe(20);
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
