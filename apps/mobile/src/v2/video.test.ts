import { HOME_VIDEOS, homeVideoForStage } from './video';

describe('table stade → vidéo d’accueil (D-106)', () => {
  it('stade 3 → home-teen, stade 4 → home-dong-hanh', () => {
    expect(homeVideoForStage(3)?.key).toBe('home-teen');
    expect(homeVideoForStage(4)?.key).toBe('home-dong-hanh');
  });
  it('stades 1 et 2 (et tout autre) : pas de vidéo → décor fixe + PandaSprite', () => {
    for (const stage of [0, 1, 2, 5, Number.NaN]) expect(homeVideoForStage(stage)).toBeNull();
  });
  it('chaque entrée a ses 4 fichiers et une géométrie plausible (720×1280, pousse au-dessus des pieds)', () => {
    const entries = Object.values(HOME_VIDEOS);
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(new Set(entries.map((e) => e!.key)).size).toBe(entries.length);
    for (const e of entries) {
      for (const k of ['webm', 'mp4', 'mp4Small', 'poster'] as const) expect(e!.sources[k]).toBeTruthy();
      expect(e!.geometry).toMatchObject({ width: 720, height: 1280 });
      expect(e!.geometry.headY).toBeGreaterThan(0.3);
      expect(e!.geometry.feetY).toBeGreaterThan(e!.geometry.headY);
      expect(e!.geometry.feetY).toBeLessThan(0.85);
    }
  });
  it('đồng hành : panda plus grand que le teen, pieds plus bas', () => {
    const teen = homeVideoForStage(3)!.geometry;
    const dh = homeVideoForStage(4)!.geometry;
    expect(dh.feetY - dh.headY).toBeGreaterThan(teen.feetY - teen.headY);
    expect(dh.feetY).toBeGreaterThan(teen.feetY);
  });
});
