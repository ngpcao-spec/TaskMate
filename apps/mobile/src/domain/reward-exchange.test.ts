import { childVoice, exchangePreview, optimisticRequest, REQUEST_EXPIRY_DAYS } from './reward-exchange';

describe('exchangePreview', () => {
  it('solde suffisant : reste = disponible − coût', () => {
    expect(exchangePreview(120, 50)).toEqual({ have: 120, after: 70, missing: 0, affordable: true });
  });
  it('coût exact : reste 0', () => {
    expect(exchangePreview(50, 50)).toEqual({ have: 50, after: 0, missing: 0, affordable: true });
  });
  it('insuffisant : points manquants, reste inchangé', () => {
    expect(exchangePreview(30, 50)).toEqual({ have: 30, after: 30, missing: 20, affordable: false });
  });
  it('disponible négatif ou non entier : borné', () => {
    expect(exchangePreview(-5, 10)).toEqual({ have: 0, after: 0, missing: 10, affordable: false });
    expect(exchangePreview(10.7, 3)).toEqual({ have: 10, after: 7, missing: 0, affordable: true });
  });
});

describe('childVoice', () => {
  it('tớ/cậu jusqu’à 10 ans révolus, mình/bạn ensuite', () => {
    expect(childVoice('2016-11-24', '2026-11-23')).toBe('young'); // 9 ans
    expect(childVoice('2016-11-23', '2026-11-23')).toBe('young'); // 10 ans
    expect(childVoice('2015-11-23', '2026-11-23')).toBe('older'); // 11 ans
    expect(childVoice('2013-01-01', '2026-11-23')).toBe('older');
  });
  it('sans date : mình/bạn', () => {
    expect(childVoice(null, '2026-11-23')).toBe('older');
    expect(childVoice(undefined, '2026-11-23')).toBe('older');
  });
});

describe('optimisticRequest', () => {
  it('demande en attente, échéance à 7 jours', () => {
    const now = new Date('2026-11-23T10:00:00Z');
    const r = optimisticRequest({ id: 'r1', childId: 'c1', rewardId: 'w1', title: 'Kem', cost: 40, now });
    expect(r).toMatchObject({ id: 'r1', child_id: 'c1', reward_id: 'w1', reward_title: 'Kem', cost: 40, status: 'pending', created_at: now.toISOString() });
    expect(new Date(r.expires_at).getTime() - now.getTime()).toBe(REQUEST_EXPIRY_DAYS * 24 * 3600 * 1000);
  });
});
