import { crashReport, crashText } from '@/domain/crash-report';

const at = new Date('2026-10-21T00:32:00Z');

describe('crashReport (D-094)', () => {
  it('nom, message, début de pile (8 lignes), chemin et heure', () => {
    const error = new Error('Cannot read properties of undefined (reading \'x\')');
    error.stack = ['Error: boom', ...Array.from({ length: 20 }, (_, i) => `    at f${i} (file.js:${i}:1)`)].join('\n');
    const r = crashReport(error, at, '/today');
    expect(r).toMatchObject({ at: '2026-10-21T00:32:00.000Z', path: '/today', name: 'Error', message: 'Cannot read properties of undefined (reading \'x\')' });
    expect(r.stack).toHaveLength(8);
    expect(crashText(r)).toContain('Error: Cannot read properties');
    expect(crashText(r)).toContain('/today · 2026-10-21T00:32:00.000Z');
  });
  it('texte très long : coupé', () => {
    expect(crashReport(new Error('x'.repeat(1000)), at, '/').message.length).toBeLessThanOrEqual(301);
  });
  it.each([[null], [undefined], ['texte brut'], [42], [{}]])('valeur inattendue (%p) : jamais d\'exception', (value) => {
    const r = crashReport(value, at, '');
    expect(r.name).toBe('Error');
    expect(typeof r.message).toBe('string');
    expect(Array.isArray(r.stack)).toBe(true);
  });
  it('une erreur lancée sous forme de chaîne garde son texte', () => {
    expect(crashReport('échec', at, '/').message).toBe('échec');
  });
});
