import { hasNoAttempts, isGoneCode, isGoneError, parseImpact, parsePurgeResult, purgeConfirmed, purgeConfirmText } from '@/domain/catalog-purge';

const TITLE = 'Ngữ văn 7 · Ôn tập chung (bản thử)';

describe('purgeConfirmed (D-091) : le titre EXACT', () => {
  it('égal au titre : confirmé', () => {
    expect(purgeConfirmed(TITLE, TITLE)).toBe(true);
  });
  it('espaces autour de la saisie tolérés (le titre est enregistré sans espace autour)', () => {
    expect(purgeConfirmed(`  ${TITLE} `, TITLE)).toBe(true);
    expect(purgeConfirmText(`  ${TITLE} `)).toBe(TITLE);
  });
  it.each([
    ['vide', ''],
    ['espaces seuls', '   '],
    ['début du titre', 'Ngữ văn 7'],
    ['titre + texte', `${TITLE}!`],
    ['casse différente', TITLE.toUpperCase()],
    ['sans accents', 'Ngu van 7 · On tap chung (ban thu)'],
    ['espace interne en moins', TITLE.replace('Ngữ văn', 'Ngữvăn')],
    ['titre d\'un autre QCM', 'Ngữ văn 7 · Tuần 8'],
  ])('refusé : %s', (_name, typed) => {
    expect(purgeConfirmed(typed, TITLE)).toBe(false);
  });
  it('un titre vide ne correspond jamais (même à une saisie vide)', () => {
    expect(purgeConfirmed('', '')).toBe(false);
  });
});

describe('parseImpact / parsePurgeResult', () => {
  const raw = { quiz_id: 'z1', title: TITLE, subject: 'langue_nationale', country: 'VN', grade: '7', week_label: 'Tuần 7', status: 'published', families: 2, children: 3, attempts: 3, in_progress: 1, submitted: 1, validated: 1, points: 8, questions: 12, answers: 20 };
  it('lit les compteurs du serveur', () => {
    expect(parseImpact(raw)).toEqual(raw);
    expect(hasNoAttempts(parseImpact(raw))).toBe(false);
  });
  it('réponse incomplète ou inattendue : zéros et textes vides (jamais de NaN ni d\'exception)', () => {
    expect(parseImpact(null)).toMatchObject({ title: '', attempts: 0, points: 0, children: 0 });
    expect(parseImpact({ attempts: 'x', points: -3, children: Number.NaN, families: 2.9 })).toMatchObject({ attempts: 0, points: 0, children: 0, families: 2 });
    expect(hasNoAttempts(parseImpact({}))).toBe(true);
  });
  it('résultat de purge : supprimé, avec les compteurs ; rejeu = non supprimé', () => {
    expect(parsePurgeResult({ purged: true, ...raw })).toMatchObject({ purged: true, title: TITLE, counts: { families: 2, children: 3, attempts: 3, validated: 1, points: 8, questions: 12 } });
    expect(parsePurgeResult({ purged: false })).toEqual({ purged: false, title: '', counts: { families: 0, children: 0, attempts: 0, validated: 0, points: 0, questions: 0 } });
    expect(parsePurgeResult(undefined).purged).toBe(false);
  });
});

describe('QCM disparu : codes serveur « introuvable »', () => {
  it('reconnaît attempt_not_found et set_not_found, rien d\'autre', () => {
    expect(isGoneCode('attempt_not_found')).toBe(true);
    expect(isGoneCode('set_not_found')).toBe(true);
    expect(isGoneCode('forbidden')).toBe(false);
    expect(isGoneCode('')).toBe(false);
  });
  it('depuis une erreur de RPC (message = code)', () => {
    expect(isGoneError({ message: 'attempt_not_found', code: 'P0002' })).toBe(true);
    expect(isGoneError(new Error('set_not_found'))).toBe(true);
    expect(isGoneError({ message: 'Network request failed' })).toBe(false);
    expect(isGoneError(null)).toBe(false);
    expect(isGoneError(undefined)).toBe(false);
    expect(isGoneError('attempt_not_found')).toBe(false);
  });
});
