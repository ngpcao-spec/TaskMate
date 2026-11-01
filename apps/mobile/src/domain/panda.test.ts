import {
  applyEnergy,
  baseStage,
  cleanPandaName,
  energyForToggle,
  expressionForMood,
  friendshipLevel,
  isPandaTrait,
  localHourOf,
  pandaMood,
  pandaStage,
  parseCompanionState,
  schoolYearStart,
  usesStagePose,
  withEnergy,
  type CompanionState,
} from './panda';

// MÊMES cas que supabase/tests/database/40_companion.test.sql (`companion_stage`, `companion_level`) : si l'un change, l'autre aussi.
const STAGE_CASES: [birth: string, today: string, offset: number, stage: number][] = [
  ['2020-08-31', '2026-10-15', 0, 2], // 6 ans au 1er septembre 2026
  ['2020-09-01', '2026-10-15', 0, 2], // 6 ans pile le 1er septembre
  ['2020-09-02', '2026-10-15', 0, 1], // 5 ans
  ['2021-08-31', '2026-10-15', 0, 1],
  ['2015-09-01', '2026-10-15', 0, 3], // 10 → 11
  ['2015-09-02', '2026-10-15', 0, 2],
  ['2011-09-01', '2026-10-15', 0, 4], // 14 → 15
  ['2011-09-02', '2026-10-15', 0, 3],
  ['2019-09-01', '2026-08-31', 0, 2], // 31 août : encore l'année scolaire 2025-2026
  ['2019-09-02', '2026-08-31', 0, 1],
  ['2019-09-02', '2026-09-01', 0, 2], // 1er septembre : nouvelle année scolaire
  ['2023-01-01', '2026-10-01', -1, 1], // borne basse
  ['2023-01-01', '2026-10-01', 1, 2],
  ['2018-01-01', '2026-10-01', -1, 1],
  ['2018-01-01', '2026-10-01', 1, 3],
  ['2009-01-01', '2026-10-01', 1, 4], // borne haute
  ['2009-01-01', '2026-10-01', -1, 3],
  ['2009-01-01', '2026-10-01', 5, 4], // décalage hors bornes : ramené à +1 puis borné
];
const LEVEL_CASES: [total: number, level: number][] = [
  [0, 1], [49, 1], [50, 2], [149, 2], [150, 3], [299, 3], [300, 4], [499, 4], [500, 5], [799, 5], [800, 6], [1100, 7], [-12, 1],
];
const NEXT_CASES: [total: number, next: number][] = [[0, 50], [299, 300], [300, 500], [500, 800], [800, 1100]];

describe('stade du panda', () => {
  it.each(STAGE_CASES)('né le %s, jour local %s, décalage %i → stade %i', (birth, today, offset, stage) => {
    expect(pandaStage(birth, today, offset)).toBe(stage);
  });
  it('l’année scolaire va du 1er septembre au 31 août (jour local)', () => {
    expect(schoolYearStart('2026-08-31')).toBe('2025-09-01');
    expect(schoolYearStart('2026-09-01')).toBe('2026-09-01');
    expect(schoolYearStart('2026-12-31')).toBe('2026-09-01');
    expect(schoolYearStart('2027-01-01')).toBe('2026-09-01');
  });
  it('le stade ne change qu’à la rentrée, jamais à l’anniversaire en cours d’année', () => {
    // 6 ans le 15 octobre 2026 : toujours « bé » jusqu’au 31 août 2027, « nhí » le 1er septembre 2027
    expect(baseStage('2020-10-15', '2026-10-20')).toBe(1);
    expect(baseStage('2020-10-15', '2027-08-31')).toBe(1);
    expect(baseStage('2020-10-15', '2027-09-01')).toBe(2);
  });
  it('un enfant né après le 1er septembre de référence : bé', () => {
    expect(baseStage('2026-10-01', '2026-10-15')).toBe(1);
  });
  it('décalage non entier ou NaN : ramené à 0, 1 ou −1', () => {
    expect(pandaStage('2018-01-01', '2026-10-01', 0.9)).toBe(2);
    expect(pandaStage('2018-01-01', '2026-10-01', Number.NaN)).toBe(2);
  });
});

describe('énergie', () => {
  it('coche +5, décoche −5', () => {
    expect(energyForToggle(true)).toBe(5);
    expect(energyForToggle(false)).toBe(-5);
  });
  it('le total ne descend jamais sous 0', () => {
    expect(applyEnergy(3, -5)).toBe(0);
    expect(applyEnergy(0, -5)).toBe(0);
    expect(applyEnergy(10, 5)).toBe(15);
  });
  it('withEnergy recalcule total, niveau et prochain palier', () => {
    const base: CompanionState = { hasCompanion: true, name: 'B', trait: 'kind', stage: 2, stageOffset: 0, energyTotal: 48, level: 1, nextLevelAt: 50 };
    expect(withEnergy(base, 5)).toMatchObject({ energyTotal: 53, level: 2, nextLevelAt: 150 });
    expect(withEnergy(base, -100)).toMatchObject({ energyTotal: 0, level: 1, nextLevelAt: 50 });
  });
});

describe('niveau d’amitié', () => {
  it.each(LEVEL_CASES)('énergie %i → niveau %i', (total, level) => {
    expect(friendshipLevel(total).level).toBe(level);
  });
  it.each(NEXT_CASES)('énergie %i → prochain palier %i', (total, next) => {
    expect(friendshipLevel(total).next).toBe(next);
  });
  it('progression vers le niveau suivant', () => {
    expect(friendshipLevel(0)).toMatchObject({ from: 0, next: 50, into: 0, span: 50, progress: 0 });
    expect(friendshipLevel(25).progress).toBe(0.5);
    expect(friendshipLevel(50)).toMatchObject({ level: 2, from: 50, next: 150, into: 0 });
    expect(friendshipLevel(650)).toMatchObject({ level: 5, from: 500, next: 800, into: 150, progress: 0.5 });
  });
  it('valeurs invalides ramenées à 0', () => {
    expect(friendshipLevel(Number.NaN).level).toBe(1);
    expect(friendshipLevel(Number.POSITIVE_INFINITY).level).toBe(1);
    expect(friendshipLevel(12.9).into).toBe(12);
  });
});

describe('humeur du panda', () => {
  it('aucune tâche faite : calme, ou endormi à partir de 20 h', () => {
    expect(pandaMood(0, 3, 9)).toBe('calme');
    expect(pandaMood(0, 3, 19)).toBe('calme');
    expect(pandaMood(0, 3, 20)).toBe('dort');
    expect(pandaMood(0, 0, 21)).toBe('dort');
    expect(pandaMood(0, 0, 10)).toBe('calme');
  });
  it('au moins une faite : content', () => {
    expect(pandaMood(1, 3, 10)).toBe('content');
    expect(pandaMood(1, 2, 10)).toBe('content'); // la moitié pile n’est pas « plus de la moitié »
  });
  it('plus de la moitié : très heureux', () => {
    expect(pandaMood(2, 3, 10)).toBe('tres-heureux');
    expect(pandaMood(3, 5, 10)).toBe('tres-heureux');
  });
  it('toutes, avec au moins une prévue : fier (même tard)', () => {
    expect(pandaMood(3, 3, 10)).toBe('fier');
    expect(pandaMood(1, 1, 22)).toBe('fier');
  });
  it('jamais d’humeur triste ni culpabilisante', () => {
    const all = new Set<string>();
    for (let done = 0; done <= 5; done++) for (let total = 0; total <= 5; total++) for (const h of [8, 14, 21]) all.add(pandaMood(done, total, h));
    expect([...all].sort()).toEqual(['calme', 'content', 'dort', 'fier', 'tres-heureux']);
  });
  it('expression : « calme » montre le visage content ; pose en pied pour calme et content', () => {
    expect(expressionForMood('calme')).toBe('content');
    expect(expressionForMood('fier')).toBe('fier');
    expect(usesStagePose('calme')).toBe(true);
    expect(usesStagePose('content')).toBe(true);
    expect(usesStagePose('tres-heureux')).toBe(false);
    expect(usesStagePose('dort')).toBe(false);
  });
  it('heure locale lue dans HH:MM', () => {
    expect(localHourOf('20:05')).toBe(20);
    expect(localHourOf('07:59')).toBe(7);
  });
});

describe('nom et trait', () => {
  it('nom : 1 à 20 caractères, espaces retirés', () => {
    expect(cleanPandaName('  Bambou ')).toBe('Bambou');
    expect(cleanPandaName('')).toBeNull();
    expect(cleanPandaName('   ')).toBeNull();
    expect(cleanPandaName('x'.repeat(20))).toBe('x'.repeat(20));
    expect(cleanPandaName('x'.repeat(21))).toBeNull();
  });
  it('traits connus', () => {
    expect(isPandaTrait('brave')).toBe(true);
    expect(isPandaTrait('grumpy')).toBe(false);
    expect(isPandaTrait(3)).toBe(false);
  });
});

describe('lecture de companion_state', () => {
  it('réponse complète', () => {
    expect(parseCompanionState({ has_companion: true, name: 'Bambou', trait: 'kind', stage: 3, stage_offset: 1, energy_total: 120, level: 2, next_level_at: 150 })).toEqual({
      hasCompanion: true,
      name: 'Bambou',
      trait: 'kind',
      stage: 3,
      stageOffset: 1,
      energyTotal: 120,
      level: 2,
      nextLevelAt: 150,
    });
  });
  it('sans compagnon ni valeurs : valeurs sûres', () => {
    expect(parseCompanionState(null)).toEqual({ hasCompanion: false, name: null, trait: null, stage: 1, stageOffset: 0, energyTotal: 0, level: 1, nextLevelAt: 50 });
    expect(parseCompanionState({ stage: 9, stage_offset: 4, trait: 'x', energy_total: -3, level: 0, next_level_at: 'a' })).toMatchObject({ stage: 1, stageOffset: 0, trait: null, energyTotal: 0, level: 1, nextLevelAt: 50 });
  });
});
