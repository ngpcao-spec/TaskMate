import { HOME_ROUTE, parseUiVersion, uiVersionChanged } from './ui-version';

describe('version d’interface (D-106)', () => {
  it('v1 par défaut, v2 seulement si annoncée', () => {
    expect(parseUiVersion('v2')).toBe('v2');
    expect(parseUiVersion('v1')).toBe('v1');
    expect(parseUiVersion(undefined)).toBe('v1');
    expect(parseUiVersion('V2')).toBe('v1');
    expect(parseUiVersion(null)).toBe('v1');
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
    expect(uiVersionChanged('bizarre', 'v1')).toBe(false);
  });
});
