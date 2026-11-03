import { v2Colors, type V2ColorKey, v2Font, v2Radius, V2_TOUCH } from './theme';

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const lum = ([r, g, b]: [number, number, number]) => {
  const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: V2ColorKey, b: V2ColorKey) => {
  const [hi, lo] = [lum(rgb(v2Colors[a])), lum(rgb(v2Colors[b]))].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

// [texte, fond] : tout texte courant de la V2 est lisible (WCAG AA, 4,5:1)
const READABLE: [V2ColorKey, V2ColorKey][] = [
  ['text', 'background'], ['text', 'card'], ['text', 'cardMuted'], ['text', 'primarySoft'], ['text', 'energySoft'], ['text', 'pendingSoft'],
  ['textSecondary', 'card'], ['textSecondary', 'cardMuted'], ['textSecondary', 'background'],
  ['onPrimary', 'primary'], ['onPrimary', 'primaryPressed'], ['primary', 'card'], ['primary', 'primarySoft'],
  ['energyText', 'card'], ['energyText', 'energySoft'], ['onEnergy', 'energy'],
  ['pending', 'pendingSoft'], ['pending', 'card'], ['danger', 'card'], ['onDanger', 'danger'],
  ['tabActive', 'tabBar'], ['tabInactive', 'tabBar'], ['tabActive', 'tabActiveBg'], ['tabActiveOnScene', 'tabActiveBgOnScene'], ['onBadge', 'badge'], ['onTopButton', 'topButton'],
];

describe('style V2 (D-106)', () => {
  it('couleurs hexadécimales opaques seulement (aucun fond translucide)', () => {
    for (const [k, v] of Object.entries(v2Colors)) expect([k, /^#[0-9A-F]{6}$/i.test(v)]).toEqual([k, true]);
  });
  it.each(READABLE)('%s sur %s : contraste ≥ 4,5:1', (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('éléments non textuels (jauge, case vide) : contraste ≥ 3:1 avec leur fond', () => {
    expect(ratio('primary', 'track')).toBeGreaterThanOrEqual(3);
    expect(ratio('textSecondary', 'track')).toBeGreaterThanOrEqual(3);
  });
  it('cartes rayon 24, cibles ≥ 44 pt, police Nunito', () => {
    expect(v2Radius.card).toBe(24);
    expect(V2_TOUCH).toBeGreaterThanOrEqual(44);
    expect(String(v2Font(800, 20).fontFamily)).toContain('Nunito_800ExtraBold');
    expect(v2Font(600, 14)).toMatchObject({ fontSize: 14, fontWeight: '600' });
  });
});
