import { effectiveDecision, planImport, publishable, slotKey, summarize, writeSteps, type ExistingQuiz, type StepResult } from '@/domain/catalog-import-plan';
import type { ParsedQuiz } from '@/domain/catalog-import';

const quiz = (block: number, over: Partial<ParsedQuiz> = {}): ParsedQuiz => ({
  block, line: block * 10, country: 'VN', grade: '5', subject: 'hist_geo', week: `Tuần ${block}`, title: `T${block}`, releaseOn: '2026-10-16', dueOn: '2026-10-25', questions: [], ...over,
});
const existing = (over: Partial<ExistingQuiz> = {}): ExistingQuiz => ({ id: 'e1', country: 'VN', grade: '5', subject: 'hist_geo', week_label: 'Tuần 1', status: 'draft', attempts_count: 0, title: 'ancien', ...over });
let n = 0;
const newId = () => `id-${++n}`;
beforeEach(() => { n = 0; });

describe('plan d\'import d\'administration (D-081)', () => {
  it('clé de case : semaine sans casse ni espaces superflus (comme l\'index de la base)', () => {
    expect(slotKey('VN', '5', 'maths', ' Tuần   7 ')).toBe(slotKey('VN', '5', 'maths', 'tuần 7'));
    expect(slotKey('VN', '5', 'maths', 'Tuần 7')).not.toBe(slotKey('VN', '6', 'maths', 'Tuần 7'));
    expect(slotKey('VN', '5', 'maths', 'Tuần 7')).not.toBe(slotKey('FR', '5', 'maths', 'Tuần 7'));
  });

  it('cases libres : un identifiant FIXÉ par QCM, aucun conflit', () => {
    const plan = planImport([quiz(1), quiz(2)], [], newId);
    expect(plan.map((p) => [p.id, p.conflict])).toEqual([['id-1', null], ['id-2', null]]);
    expect(writeSteps(plan, {}).map((s) => [s.item.id, s.replace])).toEqual([['id-1', false], ['id-2', false]]);
  });

  it('case occupée par un brouillon sans tentative : par défaut IGNORÉ ; « remplacer » reprend l\'identifiant existant', () => {
    const plan = planImport([quiz(1), quiz(2)], [existing()], newId);
    expect(plan[0]?.conflict).toMatchObject({ kind: 'replaceable', existing: { id: 'e1' } });
    expect(plan[0]?.id).toBe('e1');
    expect(effectiveDecision(plan[0] as never, {})).toBe('skip'); // jamais d'écrasement silencieux
    expect(writeSteps(plan, {}).map((s) => s.item.quiz.block)).toEqual([2]);
    expect(effectiveDecision(plan[0] as never, { 1: 'replace' })).toBe('replace');
    expect(writeSteps(plan, { 1: 'replace' }).map((s) => [s.item.id, s.replace])).toEqual([['e1', true], ['id-1', false]]);
    expect(effectiveDecision(plan[0] as never, { 1: 'skip' })).toBe('skip');
  });

  it('case occupée par un QCM publié ou ayant des tentatives : remplacement IMPOSSIBLE, même si demandé', () => {
    const plan = planImport([quiz(1), quiz(2, { week: 'Tuần 9' })], [existing({ status: 'published' }), existing({ id: 'e2', week_label: 'Tuần 9', attempts_count: 2 })], newId);
    expect(plan.map((p) => p.conflict?.kind)).toEqual(['published', 'attempts']);
    expect(effectiveDecision(plan[0] as never, { 1: 'replace' })).toBe('skip');
    expect(effectiveDecision(plan[1] as never, { 2: 'replace' })).toBe('skip');
    expect(writeSteps(plan, { 1: 'replace', 2: 'replace' })).toEqual([]);
  });

  it('une case occupée par un QCM d\'une autre classe ou d\'un autre pays n\'est pas un conflit', () => {
    const plan = planImport([quiz(1, { week: 'Tuần 1' })], [existing({ grade: '6' }), existing({ id: 'e3', country: 'FR' })], newId);
    expect(plan[0]?.conflict).toBeNull();
  });

  it('bilan des écritures et QCM encore publiables', () => {
    const results: StepResult[] = [
      { block: 1, id: 'a', outcome: 'created' }, { block: 2, id: 'b', outcome: 'replaced' }, { block: 3, id: 'c', outcome: 'skipped' }, { block: 4, id: 'd', outcome: 'failed', error: 'x' }, { block: 5, id: 'e', outcome: 'created' },
    ];
    expect(summarize(results)).toEqual({ created: 2, replaced: 1, skipped: 1, failed: 1 });
    expect(publishable(results, []).map((r) => r.block)).toEqual([1, 2, 5]);
    expect(publishable(results, [{ block: 1, id: 'a', outcome: 'published' }, { block: 2, id: 'b', outcome: 'draft', error: 'dates_required' }]).map((r) => r.block)).toEqual([2, 5]);
  });
});
