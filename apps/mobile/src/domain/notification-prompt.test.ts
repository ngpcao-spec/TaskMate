import { parseSnooze, shouldPrompt, SNOOZE_MS } from './notification-prompt';

const now = 1_000_000_000_000;

describe('shouldPrompt', () => {
  it('propose quand les notifications sont possibles mais pas activées (première ouverture)', () => {
    expect(shouldPrompt('off', null, now)).toBe(true);
    expect(shouldPrompt('ready', null, now)).toBe(true);
  });
  it('ne propose jamais si déjà activées, refusées, non supportées, non configurées ou à installer d’abord', () => {
    for (const s of ['on', 'denied', 'unsupported', 'not-configured', 'needs-install'] as const) expect(shouldPrompt(s, null, now)).toBe(false);
  });
  it('« Plus tard » : masquée jusqu’à l’échéance, puis revient', () => {
    expect(shouldPrompt('off', now + SNOOZE_MS, now)).toBe(false);
    expect(shouldPrompt('off', now + 1, now)).toBe(false);
    expect(shouldPrompt('off', now, now)).toBe(true); // échéance atteinte
    expect(shouldPrompt('off', now - 1, now)).toBe(true);
  });
  it('le report n’autorise jamais une invitation inutile', () => {
    expect(shouldPrompt('on', now - 1, now)).toBe(false);
    expect(shouldPrompt('denied', null, now)).toBe(false);
  });
});

describe('parseSnooze', () => {
  it('lit une échéance valide', () => expect(parseSnooze('1234567890')).toBe(1234567890));
  it('absente, illisible, nulle ou négative = aucun report', () => {
    for (const raw of [null, '', 'abc', 'NaN', '0', '-5', 'Infinity']) expect(parseSnooze(raw)).toBeNull();
  });
  it('délai de report : 24 h', () => expect(SNOOZE_MS).toBe(86_400_000));
});
