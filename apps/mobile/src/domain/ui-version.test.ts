import { HOME_ROUTE, isV1TabRoot, parseUiVersion, themeMatchesUi, uiVersionChanged } from './ui-version';

describe('version d’interface (D-106)', () => {
  it('v2 par défaut (D-114), v1 seulement si annoncée', () => {
    expect(parseUiVersion('v2')).toBe('v2');
    expect(parseUiVersion('v1')).toBe('v1');
    expect(parseUiVersion(undefined)).toBe('v2');
    expect(parseUiVersion('V1')).toBe('v2');
    expect(parseUiVersion(null)).toBe('v2');
  });
  it('accueil de chaque interface', () => {
    expect(HOME_ROUTE.v1).toBe('/(tabs)/today');
    expect(HOME_ROUTE.v2).toBe('/v2');
  });
  it('purge seulement quand la version mémorisée change', () => {
    expect(uiVersionChanged(null, 'v2')).toBe(false);
    expect(uiVersionChanged('v1', 'v1')).toBe(false);
    expect(uiVersionChanged('v1', 'v2')).toBe(true);
    expect(uiVersionChanged('v2', 'v1')).toBe(true);
    expect(uiVersionChanged('bizarre', 'v2')).toBe(false);
  });
});

describe('racines V1 (D-106)', () => {
  it('les racines d’onglets V1 renvoient une famille V2 ; les sous-écrans restent ouverts', () => {
    for (const p of ['/today', '/calendar', '/stats', '/more', '/more/', '/']) expect(isV1TabRoot(p)).toBe(true);
    for (const p of ['/more/children', '/more/settings', '/more/revisions', '/more/points']) expect(isV1TabRoot(p)).toBe(false);
  });
});

describe('thème du chargement et interface de la famille (D-109)', () => {
  it('famille V2 ↔ thème v2 ; famille V1 ↔ un thème au choix', () => {
    expect(themeMatchesUi('v2', 'v2')).toBe(true);
    expect(themeMatchesUi('glass', 'v1')).toBe(true);
    expect(themeMatchesUi('kawaii', 'v1')).toBe(true);
    expect(themeMatchesUi('glass', 'v2')).toBe(false);
    expect(themeMatchesUi('v2', 'v1')).toBe(false);
  });
});
