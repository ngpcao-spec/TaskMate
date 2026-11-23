import { theme } from './index';
import { v2Colors } from '@/v2/theme';
import type { ThemeColors } from './themes/types';

type Rgba = [number, number, number, number];
const parse = (c: string): Rgba => {
  if (c.startsWith('#')) {
    const h = c.slice(1);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const p = ((c.match(/rgba?\(([^)]*)\)/) as RegExpMatchArray)[1] as string).split(',').map(Number);
  return [p[0] as number, p[1] as number, p[2] as number, p[3] ?? 1];
};
const over = (fg: Rgba, bg: Rgba): [number, number, number] => [0, 1, 2].map((i) => (fg[i] as number) * fg[3] + (bg[i] as number) * (1 - fg[3])) as [number, number, number];
const lum = ([r, g, b]: [number, number, number]) => {
  const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: [number, number, number], b: [number, number, number]) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
/** Couleur d'un jeton telle qu'on la voit : un fond translucide est posé sur le fond d'écran. */
const seen = (c: ThemeColors, key: keyof ThemeColors): [number, number, number] => over(parse(c[key]), [...parse(c.backgroundTop).slice(0, 3), 1] as Rgba);

// [texte, fond] : tout texte courant doit être lisible (WCAG AA, 4,5:1) dans CHAQUE thème.
const READABLE: [keyof ThemeColors, keyof ThemeColors][] = [
  ['text', 'background'], ['text', 'card'], ['text', 'cardStrong'], ['text', 'cardSolid'], ['onTile', 'tileTeal'], ['onTile', 'tileBlue'], ['onTile', 'tileIce'], ['onTile', 'tileViolet'], ['onNavActive', 'navActive'],
  ['textSecondary', 'background'], ['textSecondary', 'card'], ['textSecondary', 'cardSolid'],
  ['onPrimary', 'primary'], ['onSolid', 'danger'], ['onSolid', 'success'], ['onSolid', 'text'],
  ['onNavy', 'navy'], ['onNavy', 'navyLight'], ['onNavy', 'navyDeep'], ['onNavySecondary', 'navy'], ['onNavySecondary', 'navyDeep'], ['onBar', 'barFrom'], ['onBar', 'barTo'],
  ['accent', 'card'], ['accent', 'cardSolid'], ['accent', 'background'],
  ['danger', 'card'], ['danger', 'cardSolid'], ['success', 'cardSolid'], ['warning', 'warningTint'], ['warning', 'cardSolid'],
  ['placeholder', 'inputBg'], ['placeholder', 'cardSolid'],
];

describe('thème unique « v2 » (D-109, D-114)', () => {
  const c = theme.colors;
  it('le thème de l’app est la charte V2 ; toutes les couleurs sont opaques', () => {
    expect(theme.id).toBe('v2');
    for (const [k, v] of Object.entries(c)) expect([k, /^#[0-9A-Fa-f]{6}$/.test(v)]).toEqual([k, true]);
  });
  it('mêmes couleurs que l’interface V2 (fond, carte, texte, vert)', () => {
    expect([c.background, c.card, c.text, c.textSecondary, c.primary, c.danger]).toEqual([v2Colors.background, v2Colors.card, v2Colors.text, v2Colors.textSecondary, v2Colors.primary, v2Colors.danger]);
  });
  it('le texte reste lisible partout (contraste ≥ 4,5:1), y compris sur les couleurs d’enfant (≥ 3:1)', () => {
    const failing = READABLE.map(([fg, bg]) => ({ fg, bg, r: ratio(seen(c, fg), seen(c, bg)) })).filter((x) => x.r < 4.5);
    expect(failing).toEqual([]);
    const on = seen(c, 'onPrimary');
    for (const color of [...theme.childPalette, ...Object.values(theme.childSoft)]) expect([color, ratio(on, parse(color).slice(0, 3) as [number, number, number]) >= 3]).toEqual([color, true]);
    for (const legacy of ['#1E88F5', '#2EC4A6', '#8B5CF6', '#F5A623', '#E5484D']) expect(theme.childSoft[legacy]).toBeTruthy();
    expect(new Set(Object.values(theme.categoryColors)).size).toBe(5);
  });
});
