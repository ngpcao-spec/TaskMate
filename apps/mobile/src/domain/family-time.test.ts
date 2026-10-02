import { defaultTaskSlot, nextHalfHour, timeInTz, todayInTz } from './family-time';

const HCM = 'Asia/Ho_Chi_Minh'; // UTC+7

describe('family time', () => {
  it('le jour est celui de la famille, pas celui de l’UTC', () => {
    const utc = new Date('2026-07-01T20:00:00Z'); // 03:00 le 2 juillet à Hô Chi Minh
    expect(todayInTz(utc, HCM)).toBe('2026-07-02');
    expect(todayInTz(utc, 'UTC')).toBe('2026-07-01');
    expect(timeInTz(utc, HCM)).toBe('03:00');
  });
  it('prochaine demi-heure', () => {
    expect(nextHalfHour(new Date('2026-07-02T03:10:00Z'), HCM)).toEqual({ date: '2026-07-02', time: '10:30' });
    expect(nextHalfHour(new Date('2026-07-02T03:40:00Z'), HCM)).toEqual({ date: '2026-07-02', time: '11:00' });
    expect(nextHalfHour(new Date('2026-07-02T03:30:00Z'), HCM)).toEqual({ date: '2026-07-02', time: '11:00' });
    expect(nextHalfHour(new Date('2026-07-02T03:00:00Z'), HCM)).toEqual({ date: '2026-07-02', time: '10:30' });
  });
  it('passe au jour suivant à minuit', () => {
    expect(nextHalfHour(new Date('2026-07-02T16:50:00Z'), HCM)).toEqual({ date: '2026-07-03', time: '00:00' });
  });
});

describe('defaultTaskSlot', () => {
  it('30 minutes à partir de la prochaine demi-heure', () => {
    expect(defaultTaskSlot(new Date('2026-07-02T03:10:00Z'), HCM)).toEqual({ date: '2026-07-02', start: '10:30', end: '11:00' });
  });
  it('borne la fin à 23:59 avant minuit', () => {
    expect(defaultTaskSlot(new Date('2026-07-02T16:10:00Z'), HCM)).toEqual({ date: '2026-07-02', start: '23:30', end: '23:59' });
  });
});
