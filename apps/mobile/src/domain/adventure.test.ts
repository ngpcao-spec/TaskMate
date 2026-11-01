import { todayInTz } from './family-time';
import {
  ADVENTURE_COST,
  addDays,
  adventureErrorKey,
  adventureGauge,
  adventureStateName,
  isUnlocked,
  journalSections,
  parseAdventureState,
  returnsOn,
  unlockedDestinations,
  type CatalogDestination,
} from './adventure';

const CATALOG: CatalogDestination[] = [
  { slug: 'ha-long', minLevel: 1, discoveries: ['ha-long-coquillage', 'ha-long-perle'] },
  { slug: 'hoi-an', minLevel: 2, discoveries: ['hoi-an-lanterne'] },
  { slug: 'mekong', minLevel: 3, discoveries: [] },
  { slug: 'da-lat', minLevel: 4, discoveries: [] },
  { slug: 'sa-pa', minLevel: 5, discoveries: [] },
  { slug: 'phong-nha', minLevel: 6, discoveries: [] },
];

describe('jauge d’aventure', () => {
  it('énergie − marque du dernier départ, bornée à 0..30', () => {
    expect(ADVENTURE_COST).toBe(30);
    expect(adventureGauge(18, null)).toBe(18);
    expect(adventureGauge(18, undefined)).toBe(18);
    expect(adventureGauge(45, null)).toBe(30);
    expect(adventureGauge(65, 35)).toBe(30);
    expect(adventureGauge(35, 35)).toBe(0); // repart de 0 après un départ
    expect(adventureGauge(40, 35)).toBe(5);
    expect(adventureGauge(30, 35)).toBe(0); // décocher après un départ : la jauge baisse, jamais sous 0
    expect(adventureGauge(Number.NaN, 0)).toBe(0);
  });
});

describe('dates locales', () => {
  it('retour = lendemain, fin de mois et d’année, février bissextile', () => {
    expect(returnsOn('2026-11-01')).toBe('2026-11-02');
    expect(returnsOn('2026-10-31')).toBe('2026-11-01');
    expect(returnsOn('2026-12-31')).toBe('2027-01-01');
    expect(returnsOn('2028-02-28')).toBe('2028-02-29');
    expect(returnsOn('2027-02-28')).toBe('2027-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('autour de minuit : le jour du départ est le jour LOCAL de la famille, pas l’UTC', () => {
    // 23:30 à Hô Chi Minh le 31 octobre = 16:30 UTC ; 00:30 le 1er novembre = 17:30 UTC le 31
    const before = todayInTz(new Date('2026-10-31T16:30:00Z'), 'Asia/Ho_Chi_Minh');
    const after = todayInTz(new Date('2026-10-31T17:30:00Z'), 'Asia/Ho_Chi_Minh');
    expect(before).toBe('2026-10-31');
    expect(after).toBe('2026-11-01');
    expect(returnsOn(before)).toBe('2026-11-01');
    expect(adventureStateName({ id: 'a', destination: 'ha-long', departedOn: before, returnsOn: returnsOn(before) }, after, 0)).toBe('back');
    expect(adventureStateName({ id: 'a', destination: 'ha-long', departedOn: before, returnsOn: returnsOn(before) }, before, 0)).toBe('away');
  });
  it('Paris, changement d’heure : toujours un jour de calendrier', () => {
    expect(returnsOn(todayInTz(new Date('2026-10-24T22:30:00Z'), 'Europe/Paris'))).toBe('2026-10-26');
  });
});

describe('états', () => {
  const active = { id: 'a', destination: 'ha-long', departedOn: '2026-11-01', returnsOn: '2026-11-02' };
  it('filling, ready_to_go, away, back', () => {
    expect(adventureStateName(null, '2026-11-01', 18)).toBe('filling');
    expect(adventureStateName(null, '2026-11-01', 30)).toBe('ready_to_go');
    expect(adventureStateName(active, '2026-11-01', 30)).toBe('away');
    expect(adventureStateName(active, '2026-11-02', 0)).toBe('back');
    expect(adventureStateName(active, '2026-11-09', 0)).toBe('back'); // rien ne se perd : récupérable n’importe quand ensuite
  });
});

describe('déblocage', () => {
  it('par le niveau d’amitié, dans l’ordre du catalogue', () => {
    expect(unlockedDestinations(CATALOG, 1)).toEqual(['ha-long']);
    expect(unlockedDestinations(CATALOG, 3)).toEqual(['ha-long', 'hoi-an', 'mekong']);
    expect(unlockedDestinations(CATALOG, 9)).toHaveLength(6);
    expect(isUnlocked(CATALOG[1]!, 1)).toBe(false);
    expect(isUnlocked(CATALOG[1]!, 2)).toBe(true);
  });
});

describe('carnet', () => {
  it('chaque trouvaille de chaque destination, avec ×N', () => {
    expect(journalSections({ destinations: CATALOG.slice(0, 2), found: [{ slug: 'ha-long-perle', timesFound: 2 }] })).toEqual([
      { destination: 'ha-long', items: [{ slug: 'ha-long-coquillage', timesFound: 0 }, { slug: 'ha-long-perle', timesFound: 2 }] },
      { destination: 'hoi-an', items: [{ slug: 'hoi-an-lanterne', timesFound: 0 }] },
    ]);
  });
});

describe('lecture de adventure_state', () => {
  it('réponse complète', () => {
    const s = parseAdventureState({
      gauge: 18,
      cost: 30,
      state: 'away',
      level: 2,
      today: '2026-11-01',
      active: { id: 'a1', destination: 'ha-long', departed_on: '2026-11-01', returns_on: '2026-11-02' },
      last: { id: 'a0', destination: 'ha-long', discovery_slug: 'ha-long-perle', duplicate: true },
      unlocked: ['ha-long', 'hoi-an'],
      destinations: [{ slug: 'ha-long', min_level: 1, discoveries: ['ha-long-perle'] }],
      found: [{ slug: 'ha-long-perle', times_found: 2 }],
      found_count: 1,
      total_count: 30,
    });
    expect(s).toEqual({
      gauge: 18,
      cost: 30,
      state: 'away',
      level: 2,
      today: '2026-11-01',
      active: { id: 'a1', destination: 'ha-long', departedOn: '2026-11-01', returnsOn: '2026-11-02' },
      last: { id: 'a0', destination: 'ha-long', discoverySlug: 'ha-long-perle', duplicate: true },
      unlocked: ['ha-long', 'hoi-an'],
      destinations: [{ slug: 'ha-long', minLevel: 1, discoveries: ['ha-long-perle'] }],
      found: [{ slug: 'ha-long-perle', timesFound: 2 }],
      foundCount: 1,
      totalCount: 30,
    });
  });
  it('valeurs absentes ou invalides : valeurs sûres, état recalculé', () => {
    const s = parseAdventureState({ gauge: 99, state: 'perdu', destinations: [null, { slug: 'ha-long', min_level: 0, discoveries: ['x', 3] }], found: [{ times_found: 1 }], active: { id: 'a' } });
    expect(s).toMatchObject({ gauge: 30, cost: 30, state: 'ready_to_go', level: 1, today: null, active: null, last: null, unlocked: [], found: [], foundCount: 0, totalCount: 1 });
    expect(s.destinations).toEqual([{ slug: 'ha-long', minLevel: 1, discoveries: ['x'] }]);
    expect(parseAdventureState(null)).toMatchObject({ gauge: 0, state: 'filling', destinations: [], totalCount: 0 });
  });
});

describe('écritures refusées', () => {
  it('message doux, ou rien pour un double appui', () => {
    expect(adventureErrorKey('adventure_in_progress')).toBeNull();
    expect(adventureErrorKey('gauge_not_full')).toBe('adventure.errors.gauge_not_full');
    expect(adventureErrorKey('destination_locked')).toBe('adventure.errors.destination_locked');
    expect(adventureErrorKey('not_back_yet')).toBe('adventure.errors.not_back_yet');
    expect(adventureErrorKey('boom')).toBe('adventure.errors.generic');
  });
});
