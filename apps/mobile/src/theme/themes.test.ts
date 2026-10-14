import { DEFAULT_THEME, isThemeId, parseThemeId, THEME_IDS, THEMES, type ThemeId } from './index';
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
  ['text', 'background'], ['text', 'card'], ['text', 'cardStrong'], ['text', 'cardSolid'], ['text', 'tileTeal'], ['text', 'tileBlue'], ['text', 'tileIce'], ['text', 'tileViolet'], ['text', 'navActive'],
  ['textSecondary', 'background'], ['textSecondary', 'card'], ['textSecondary', 'cardSolid'],
  ['onPrimary', 'primary'], ['onSolid', 'danger'], ['onSolid', 'success'], ['onSolid', 'text'],
  ['onNavy', 'navy'], ['onNavy', 'navyLight'], ['onNavy', 'navyDeep'], ['onNavySecondary', 'navy'], ['onNavySecondary', 'navyDeep'], ['onBar', 'barFrom'], ['onBar', 'barTo'],
  ['accent', 'card'], ['accent', 'cardSolid'], ['accent', 'background'],
  ['danger', 'card'], ['danger', 'cardSolid'], ['success', 'cardSolid'], ['warning', 'warningTint'], ['warning', 'cardSolid'],
  ['placeholder', 'inputBg'], ['placeholder', 'cardSolid'],
];

describe('thèmes : cohérence', () => {
  it('les thèmes sont listés, uniques, et le défaut existe', () => {
    expect(THEME_IDS).toEqual(['glass', 'kawaii']);
    expect(THEMES[DEFAULT_THEME]).toBeDefined();
    for (const id of THEME_IDS) expect(THEMES[id].id).toBe(id);
  });

  it('tous les thèmes définissent exactement les mêmes jetons (aucun écran ne peut rencontrer un jeton manquant)', () => {
    const base = Object.keys(THEMES.glass.colors).sort();
    for (const id of THEME_IDS) expect(Object.keys(THEMES[id].colors).sort()).toEqual(base);
    const shape = (t: (typeof THEMES)[ThemeId]) => ({ top: Object.keys(t).sort(), radius: Object.keys(t.radius).sort(), cat: Object.keys(t.categoryColors).sort(), reward: Object.keys(t.rewardTints).sort() });
    for (const id of THEME_IDS) expect(shape(THEMES[id])).toEqual(shape(THEMES.glass));
  });

  it('chaque valeur de couleur est une couleur valide (hex ou rgba)', () => {
    for (const id of THEME_IDS) for (const [k, v] of Object.entries(THEMES[id].colors)) expect([id, k, /^#[0-9A-Fa-f]{6}$|^rgba?\([\d.,\s]+\)$/.test(v)]).toEqual([id, k, true]);
  });

  it.each(THEME_IDS)('%s : le texte reste lisible partout (contraste ≥ 4,5:1)', (id) => {
    const c = THEMES[id].colors;
    const failing = READABLE.map(([fg, bg]) => ({ fg, bg, r: ratio(seen(c, fg), seen(c, bg)) })).filter((x) => x.r < 4.5);
    expect(failing).toEqual([]);
  });

  // Initiales en gros caractères gras (≥ 22 pt) : seuil WCAG du grand texte, 3:1.
  it.each(THEME_IDS)('%s : le texte posé sur une couleur d’enfant reste lisible', (id) => {
    const t = THEMES[id];
    const on = seen(t.colors, 'onPrimary');
    for (const color of [...t.childPalette, ...Object.values(t.childSoft)]) expect([color, ratio(on, parse(color).slice(0, 3) as [number, number, number]) >= 3]).toEqual([color, true]);
  });

  it.each(THEME_IDS)('%s : couleurs de catégorie et teintes de récompense distinctes, palette enfant sans doublon', (id) => {
    const t = THEMES[id];
    expect(new Set(Object.values(t.categoryColors)).size).toBe(5);
    expect(new Set(t.childPalette).size).toBe(5);
    expect(t.chartTones.length).toBeGreaterThanOrEqual(7);
    expect(t.lineWidth).toBeGreaterThan(0);
  });

  it('chaque ancienne couleur d’enfant vive est traduite dans chaque thème ; les couleurs « verre givré » aussi dans le thème kawaii', () => {
    for (const id of THEME_IDS) for (const legacy of ['#1E88F5', '#2EC4A6', '#8B5CF6', '#F5A623', '#E5484D']) expect(THEMES[id].childSoft[legacy]).toBeTruthy();
    for (const fromGlass of THEMES.glass.childPalette) expect(THEMES.kawaii.childSoft[fromGlass.toUpperCase()]).toBeTruthy();
  });

  it('seul le thème kawaii porte des décors et des contours épais', () => {
    expect(THEMES.glass.decor).toBe(false);
    expect(THEMES.kawaii.decor).toBe(true);
    expect(THEMES.kawaii.lineWidth).toBeGreaterThan(THEMES.glass.lineWidth);
  });
});

describe('choix du thème', () => {
  it('une valeur absente, inconnue ou altérée donne le thème par défaut, jamais une erreur', () => {
    for (const raw of [null, undefined, '', 'rose', 42, {}, '__proto__', 'constructor', 'toString']) expect(parseThemeId(raw)).toBe(DEFAULT_THEME);
  });
  it('les identifiants valides sont reconnus', () => {
    for (const id of THEME_IDS) {
      expect(isThemeId(id)).toBe(true);
      expect(parseThemeId(id)).toBe(id);
    }
  });
});
