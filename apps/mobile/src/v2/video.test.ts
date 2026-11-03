import { HOME_VIDEOS, homeVideoForStage } from './video';

describe('table stade → vidéo d’accueil (D-106)', () => {
  it('les 4 stades ont leur vidéo : 1 → home-be, 2 → home-nhi, 3 → home-teen, 4 → home-dong-hanh', () => {
    expect(homeVideoForStage(1)?.key).toBe('home-be');
    expect(homeVideoForStage(2)?.key).toBe('home-nhi');
    expect(homeVideoForStage(3)?.key).toBe('home-teen');
    expect(homeVideoForStage(4)?.key).toBe('home-dong-hanh');
  });
  it('stade hors 1..4 : pas de vidéo → décor fixe + PandaSprite', () => {
    for (const stage of [0, 5, -1, 1.5, Number.NaN]) expect(homeVideoForStage(stage)).toBeNull();
  });
  it('chaque entrée a ses 4 fichiers et une géométrie plausible (720×1280, pousse au-dessus des pieds)', () => {
    const entries = Object.values(HOME_VIDEOS);
    expect(entries.length).toBe(4);
    expect(new Set(entries.map((e) => e!.key)).size).toBe(entries.length);
    for (const e of entries) {
      for (const k of ['webm', 'mp4', 'mp4Small', 'poster'] as const) expect(e!.sources[k]).toBeTruthy();
      expect(e!.geometry).toMatchObject({ width: 720, height: 1280 });
      expect(e!.geometry.headY).toBeGreaterThan(0.3);
      expect(e!.geometry.feetY).toBeGreaterThan(e!.geometry.headY);
      expect(e!.geometry.feetY).toBeLessThan(0.85);
      // couleur du sable au bas visible : hex opaque, claire (le texte des cartes reste lisible dessus)
      expect(e!.groundColor).toMatch(/^#[0-9A-F]{6}$/);
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(e!.groundColor.slice(i, i + 2), 16));
      expect(0.299 * r! + 0.587 * g! + 0.114 * b!).toBeGreaterThan(180);
    }
  });
  it('đồng hành (plan large) : panda entier, pas plus grand que le teen, pieds plus hauts', () => {
    const teen = homeVideoForStage(3)!.geometry;
    const dh = homeVideoForStage(4)!.geometry;
    expect(dh.feetY - dh.headY).toBeLessThanOrEqual(teen.feetY - teen.headY);
    expect(dh.feetY).toBeLessThan(teen.feetY);
  });
  it('nhí : pieds plus bas que le teen (73 % contre 70,7 %) → son propre object-position, calculé', () => {
    const teen = homeVideoForStage(3)!.geometry;
    const nhi = homeVideoForStage(2)!.geometry;
    expect(nhi.feetY).toBeGreaterThan(teen.feetY);
    expect(nhi.headY).toBe(teen.headY);
  });
  it('bé (assis) : tête plus basse que le teen, pieds sur une ligne propre → object-position calculé', () => {
    const be = homeVideoForStage(1)!.geometry;
    const teen = homeVideoForStage(3)!.geometry;
    expect(be.headY).toBeGreaterThan(teen.headY);
    expect(be.feetY).not.toBe(teen.feetY);
  });
});
