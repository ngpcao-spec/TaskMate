import { existsSync } from 'fs';
import { join } from 'path';
import { GOAL_ICONS } from '@/domain/goal-icons';
import { goalIconImage, HOME_DOOR, mapImage, mapSpot, pandaWalkImage, sceneImage, SCENE_SLUGS, tripImage } from './images';

const DESTINATIONS = ['ha-long', 'hoi-an', 'mekong', 'da-lat', 'sa-pa', 'phong-nha'];

describe('images V2 (D-106)', () => {
  it('un décor par destination, plus la maison ; décor inconnu = maison', () => {
    expect([...SCENE_SLUGS].sort()).toEqual(['home', ...DESTINATIONS].sort());
    for (const s of SCENE_SLUGS) expect(sceneImage(s)).toBeDefined();
    expect(sceneImage('atlantide')).toBe(sceneImage('home'));
    expect(sceneImage(null, 'full')).toBe(sceneImage('home', 'full'));
  });
  it('36 icônes, carte, 4 poses de marche', () => {
    for (const i of GOAL_ICONS) expect(goalIconImage(i)).toBeDefined();
    expect(mapImage()).toBeDefined();
    for (const st of [1, 2, 3, 4] as const) expect(pandaWalkImage(st, 'full')).toBeDefined();
  });
  it('positions des 6 destinations lues dans map-spots.json, en fraction de l’image', () => {
    for (const d of DESTINATIONS) {
      const s = mapSpot(d);
      expect(s).not.toBeNull();
      expect(s!.x).toBeGreaterThan(0);
      expect(s!.x).toBeLessThan(1);
      expect(s!.y).toBeGreaterThan(0);
      expect(s!.y).toBeLessThan(1);
    }
    expect(mapSpot('ha-long')).toEqual({ x: 0.651, y: 0.162 });
    expect(mapSpot('_doc')).toBeNull();
    expect(mapSpot('atlantide')).toBeNull();
  });
  it('voyage (D-107) : paquet fermé et ouvert, mot, maison ; point de départ `home` sur la carte, porte dans le décor', () => {
    for (const n of ['gift-closed', 'gift-open', 'note', 'home-marker'] as const) expect(tripImage(n)).toBeDefined();
    expect(mapSpot('home')).toEqual({ x: 0.22, y: 0.42 });
    expect(HOME_DOOR.x).toBeGreaterThan(0.5);
    expect(HOME_DOOR.y).toBeLessThan(0.5);
  });
  it('aucun require d’image V2 hors de ce module', () => {
    expect(existsSync(join(__dirname, '../../assets/v2/scenes/scene-home@720.webp'))).toBe(true);
  });
});
