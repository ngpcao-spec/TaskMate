import type { AdventureState } from './adventure';
import {
  coverPoint,
  curveDots,
  curvePoint,
  departureBlock,
  noteFontSize,
  easeInOut,
  EMPTY_TRIP_MEMORY,
  MAP_SEQUENCE_MS,
  parseTripMemory,
  rememberEntered,
  rememberOpened,
  returnStep,
  stepProgress,
  tripControl,
  tripView,
  WALK_IN_MS,
  WALK_OUT_MS,
} from './adventure-trip';

const st = (state: AdventureState['state'], over: Partial<AdventureState> = {}) =>
  ({ state, gauge: 0, cost: 60, active: state === 'away' || state === 'back' ? { id: 'adv1', destination: 'ha-long', departedOn: '2026-11-07', returnsOn: '2026-11-08' } : null, ...over }) as AdventureState;

describe('voyage du panda : état d’affichage (D-107)', () => {
  it('filling / ready / away / back selon adventure_state ; ouvert tant que la trouvaille est à l’écran', () => {
    expect(tripView(st('filling'), EMPTY_TRIP_MEMORY, null)).toBe('filling');
    expect(tripView(st('ready_to_go'), EMPTY_TRIP_MEMORY, null)).toBe('ready');
    expect(tripView(st('away'), EMPTY_TRIP_MEMORY, null)).toBe('away');
    expect(tripView(st('back'), EMPTY_TRIP_MEMORY, null)).toBe('back');
    // le serveur a déjà récupéré l'aventure (jauge en cours) : la trouvaille reste affichée jusqu'à « Cất vào sổ »
    expect(tripView(st('filling'), EMPTY_TRIP_MEMORY, 'adv1')).toBe('opened');
    expect(tripView(undefined, EMPTY_TRIP_MEMORY, null)).toBe('filling');
  });
  it('paquet déjà ouvert sur cet appareil (réponse du serveur pas encore relue) : plus jamais « back »', () => {
    expect(tripView(st('back'), rememberOpened(EMPTY_TRIP_MEMORY, 'adv1'), null)).toBe('filling');
  });
  it('retour joué une seule fois : entrée, puis paquet au centre, puis plus rien', () => {
    expect(returnStep('adv1', EMPTY_TRIP_MEMORY)).toBe('enter');
    const entered = rememberEntered(EMPTY_TRIP_MEMORY, 'adv1');
    expect(returnStep('adv1', entered)).toBe('gift');
    expect(returnStep('adv1', rememberOpened(entered, 'adv1'))).toBe('done');
    // une autre aventure repart de zéro
    expect(returnStep('adv2', rememberOpened(entered, 'adv1'))).toBe('enter');
  });
  it('mémoire : lecture sûre, sans doublon, 10 aventures au plus', () => {
    expect(parseTripMemory(null)).toEqual(EMPTY_TRIP_MEMORY);
    expect(parseTripMemory('pas du json')).toEqual(EMPTY_TRIP_MEMORY);
    expect(parseTripMemory('{"entered":["a",3],"opened":"x"}')).toEqual({ entered: ['a'], opened: [] });
    let m = EMPTY_TRIP_MEMORY;
    for (let i = 0; i < 15; i++) m = rememberOpened(m, `a${i}`);
    expect(m.opened).toHaveLength(10);
    expect(m.opened[9]).toBe('a14');
    expect(rememberEntered(m, 'a14')).toBe(m);
    expect(parseTripMemory(JSON.stringify(m))).toEqual(m);
  });
});

describe('« Lên đường! » (D-107)', () => {
  it('actif seulement jauge pleine, sans écriture en attente ni voyage en cours', () => {
    expect(departureBlock(st('ready_to_go', { gauge: 60 }), false)).toBeNull();
    expect(departureBlock(st('filling', { gauge: 42 }), false)).toEqual({ kind: 'missing', energy: 18 });
    expect(departureBlock(st('filling', { gauge: 60 }), false)).toEqual({ kind: 'missing', energy: 1 });
    expect(departureBlock(st('ready_to_go', { gauge: 60 }), true)).toEqual({ kind: 'pending' });
    expect(departureBlock(st('away'), false)).toEqual({ kind: 'busy' });
    expect(departureBlock(st('back'), false)).toEqual({ kind: 'busy' });
  });
});

describe('séquences animées (D-107)', () => {
  it('≈ 4 s au départ (carte ≈ 1,8 s + maison 2 s), entrée 1,5 s', () => {
    expect(MAP_SEQUENCE_MS).toBe(1800);
    expect(WALK_OUT_MS).toBe(2000);
    expect(WALK_IN_MS).toBe(1500);
  });
  it('avancée bornée ; « réduire les animations » : directement la fin', () => {
    expect(stepProgress(0, 1000)).toBe(0);
    expect(stepProgress(500, 1000)).toBe(0.5);
    expect(stepProgress(5000, 1000)).toBe(1);
    expect(stepProgress(-10, 1000)).toBe(0);
    expect(stepProgress(0, 1000, true)).toBe(1);
    expect(stepProgress(Number.NaN, 1000)).toBe(1);
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
  });
});

describe('trajet sur la carte (D-107)', () => {
  const home = { x: 66, y: 168 };
  const halong = { x: 195, y: 65 };
  it('courbe douce de la maison à la clairière, arrondie vers le haut', () => {
    expect(curvePoint(home, halong, 0)).toEqual(home);
    const end = curvePoint(home, halong, 1);
    expect(end.x).toBeCloseTo(halong.x);
    expect(end.y).toBeCloseTo(halong.y);
    const c = tripControl(home, halong);
    const mid = { x: (home.x + halong.x) / 2, y: (home.y + halong.y) / 2 };
    expect(c.y).toBeLessThan(mid.y);
    // vers le bas de la carte aussi : le contrôle reste du côté du haut
    expect(tripControl(home, { x: 129, y: 333 }).y).toBeLessThan((home.y + 333) / 2);
    expect(tripControl(home, home)).toEqual(home);
  });
  it('pointillé : n points de la maison à la clairière', () => {
    const dots = curveDots(home, halong, 12);
    expect(dots).toHaveLength(12);
    expect(dots[0]).toEqual(home);
    expect(dots[11]!.x).toBeCloseTo(halong.x);
    expect(curveDots(home, halong, 0)).toHaveLength(2);
  });
  it('porte de la maison dans un décor en `cover`', () => {
    // décor 3:4 dans une boîte plus large : coupé en haut et en bas
    const p = coverPoint({ width: 390, height: 347 }, 1448 / 1086, { x: 0.75, y: 0.39 });
    expect(p.x).toBeCloseTo(292.5);
    expect(p.y).toBeCloseTo(0.39 * 520 - (520 - 347) / 2, 0);
    // boîte plus haute que l'image : coupée sur les côtés
    const q = coverPoint({ width: 100, height: 400 }, 1, { x: 0.5, y: 0.5 });
    expect(q).toEqual({ x: 50, y: 200 });
  });
});

describe('mot épinglé (D-107)', () => {
  it('le message tient en 2 lignes, taille bornée', () => {
    expect(noteFontSize('Tớ đi Sa Pa, sáng mai về nhé!', 62)).toBeGreaterThan(8);
    const long = noteFontSize('Tớ đi Miền Tây sông nước, sáng mai về nhé!', 62);
    expect(long).toBeLessThan(noteFontSize('Tớ đi Sa Pa, sáng mai về nhé!', 62));
    expect(long).toBeGreaterThanOrEqual(6);
    expect(noteFontSize('', 62)).toBe(11);
    expect(noteFontSize('x'.repeat(400), 62)).toBe(6);
  });
});
