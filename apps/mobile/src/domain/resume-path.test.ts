import { decodeResume, encodeResume, isResumablePath, RESUME_MAX_AGE_MS } from './resume-path';

describe('reprise après rechargement (D-103)', () => {
  it('chemins internes seulement', () => {
    expect(isResumablePath('/more/settings')).toBe(true);
    expect(isResumablePath('/admin/family?id=abc')).toBe(true);
    expect(isResumablePath('/')).toBe(false);
    expect(isResumablePath('')).toBe(false);
    expect(isResumablePath('//evil.example')).toBe(false);
    expect(isResumablePath('https://evil.example')).toBe(false);
    expect(isResumablePath('/a?next=https://evil.example')).toBe(false);
    expect(isResumablePath('/a\\b')).toBe(false);
    expect(isResumablePath('/a\nb')).toBe(false);
    expect(isResumablePath('/' + 'x'.repeat(300))).toBe(false);
    expect(isResumablePath(42)).toBe(false);
    expect(isResumablePath(null)).toBe(false);
  });
  it('aller-retour, dans la minute', () => {
    expect(decodeResume(encodeResume('/more/settings', 1_000), 1_000)).toBe('/more/settings');
    expect(decodeResume(encodeResume('/more/settings', 1_000), 1_000 + RESUME_MAX_AGE_MS)).toBe('/more/settings');
  });
  it('périmé, horloge en arrière, illisible ou absent : rien', () => {
    expect(decodeResume(encodeResume('/more/settings', 1_000), 1_000 + RESUME_MAX_AGE_MS + 1)).toBeNull();
    expect(decodeResume(encodeResume('/more/settings', 5_000), 1_000)).toBeNull();
    expect(decodeResume('pas du json', 1)).toBeNull();
    expect(decodeResume(null, 1)).toBeNull();
    expect(decodeResume('', 1)).toBeNull();
    expect(decodeResume(JSON.stringify({ path: '/x' }), 1)).toBeNull();
    expect(decodeResume(JSON.stringify({ path: 'https://evil.example', at: 1 }), 1)).toBeNull();
  });
});
