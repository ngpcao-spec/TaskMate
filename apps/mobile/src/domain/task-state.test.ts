import { optimisticToggle, parentPointsDelta, taskState } from './task-state';

const t = (c: string | null, v: string | null, points = 10) => ({ completed_at: c, validated_at: v, points });

describe('taskState', () => {
  it('todo / pending / validated', () => {
    expect(taskState(t(null, null))).toBe('todo');
    expect(taskState(t('x', null))).toBe('pending');
    expect(taskState(t('x', 'y'))).toBe('validated');
  });
});

describe('optimisticToggle', () => {
  it('enfant : la coche passe en attente, jamais validée', () => {
    expect(optimisticToggle(t(null, null), true, false, 'N')).toEqual({ completed_at: 'N', validated_at: null, rejection_note: null, rejected_at: null });
  });
  it('parent : coche + validation d’office', () => {
    expect(optimisticToggle(t(null, null), true, true, 'N')).toMatchObject({ completed_at: 'N', validated_at: 'N' });
  });
  it('décocher remet à zéro', () => {
    expect(optimisticToggle(t('x', 'y'), false, true, 'N')).toEqual({ completed_at: null, validated_at: null });
  });
});

describe('parentPointsDelta', () => {
  it('coche parent : +points ; déjà cochée : rien', () => {
    expect(parentPointsDelta('toggle-on', t(null, null, 15))).toBe(15);
    expect(parentPointsDelta('toggle-on', t('x', null, 15))).toBe(0);
  });
  it('validation : +points seulement si pending', () => {
    expect(parentPointsDelta('validate', t('x', null))).toBe(10);
    expect(parentPointsDelta('validate', t('x', 'y'))).toBe(0);
    expect(parentPointsDelta('validate', t(null, null))).toBe(0);
  });
  it('décoche parent : −points seulement si validée (rien pour une tâche pending)', () => {
    expect(parentPointsDelta('toggle-off', t('x', 'y'))).toBe(-10);
    expect(parentPointsDelta('toggle-off', t('x', null))).toBe(0);
  });
});
