import { dayProgress } from './progress';

describe('dayProgress', () => {
  it('compte les tâches faites', () => {
    expect(dayProgress([{ completed_at: 'x' }, { completed_at: null }, { completed_at: null }])).toEqual({
      done: 1,
      total: 3,
      ratio: 1 / 3,
    });
  });
  it('jour vide : ratio 0, pas de NaN', () => {
    expect(dayProgress([])).toEqual({ done: 0, total: 0, ratio: 0 });
  });
});
