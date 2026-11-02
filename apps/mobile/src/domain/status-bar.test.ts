import { scrimOpacityAt, STATUS_SCRIM, whiteOnScrimContrast } from './status-bar';

/**
 * Couleur moyenne du ciel sous l'heure (coin gauche) et la batterie (coin droit), mesurée sur les 7 décors V2 tels qu'ils s'affichent à 390 px de large
 * (en-tête 300 pt + marge haute 47 pt, cadrage `cover`) — script de mesure : DECISIONS.md, D-106.
 */
const SKY: Record<string, [string, string]> = {
  home: ['#A9C9A0', '#91C0AA'],
  'ha-long': ['#A3C0CC', '#ACD6FA'],
  'hoi-an': ['#C38780', '#BDDBFB'],
  mekong: ['#9FA783', '#BEDBEC'],
  'da-lat': ['#B1CCE0', '#DFDEF1'],
  'sa-pa': ['#B1B8C4', '#AAC8EC'],
  'phong-nha': ['#93B8BC', '#8E8B80'],
};

describe('voile de la barre d’état (D-106)', () => {
  it('dégradé : 0,6 en haut, 0,3 au bas de la marge, 0 après 16 pt ; rien sans marge haute', () => {
    expect(scrimOpacityAt(0, 47)).toBeCloseTo(STATUS_SCRIM.top);
    expect(scrimOpacityAt(47, 47)).toBeCloseTo(STATUS_SCRIM.insetBottom);
    expect(scrimOpacityAt(23.5, 47)).toBeCloseTo(0.45);
    expect(scrimOpacityAt(55, 47)).toBeCloseTo(0.15);
    expect(scrimOpacityAt(63, 47)).toBe(0);
    expect(scrimOpacityAt(10, 0)).toBe(0);
  });
  it.each(Object.entries(SKY))('décor %s : heure et batterie lisibles (≥ 3:1) à mi-hauteur de la barre', (_scene, colors) => {
    for (const c of colors) expect(whiteOnScrimContrast(c, scrimOpacityAt(23.5, 47))).toBeGreaterThanOrEqual(3);
  });
  it('0,25 → 0 (proposition de départ) ne suffisait pas', () => {
    const worst = Math.min(...Object.values(SKY).flat().map((c) => whiteOnScrimContrast(c, 0.125)));
    expect(worst).toBeLessThan(3);
  });
});
