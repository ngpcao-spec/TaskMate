import { PING_MIN_GAP_MS, shouldPing } from './activity-ping';

describe('signalement d’activité (D-102)', () => {
  it('jamais fait : on signale', () => expect(shouldPing(1000, 0)).toBe(true));
  it('moins de 10 minutes après le dernier : on attend', () => {
    expect(shouldPing(1_000_000 + PING_MIN_GAP_MS - 1, 1_000_000)).toBe(false);
  });
  it('10 minutes ou plus : on signale', () => {
    expect(shouldPing(1_000_000 + PING_MIN_GAP_MS, 1_000_000)).toBe(true);
  });
  it('horloge revenue en arrière : on signale plutôt que de se taire', () => {
    expect(shouldPing(500, 1_000_000)).toBe(true);
  });
});
