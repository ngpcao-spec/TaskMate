import { decodeResume, RESUME_KEY } from '@/domain/resume-path';

const store = new Map<string, string>();
const reload = jest.fn();

beforeEach(() => {
  store.clear();
  jest.resetModules();
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) }, configurable: true });
  Object.defineProperty(globalThis, 'location', { value: { pathname: '/more/settings', search: '?x=1', reload }, configurable: true });
});
afterEach(() => jest.clearAllMocks());

describe('rechargement du thème (web) : la page courante est mémorisée (D-103)', () => {
  it('mémorise le chemin puis recharge', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { reloadApp } = require('@/theme/themeStore.web') as typeof import('@/theme/themeStore.web');
    expect(reloadApp()).toBe('reloaded');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(decodeResume(store.get(RESUME_KEY) ?? null, Date.now())).toBe('/more/settings?x=1');
  });
  it('stockage bloqué : recharge quand même', () => {
    Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => null, setItem: () => { throw new Error('bloqué'); } }, configurable: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { reloadApp } = require('@/theme/themeStore.web') as typeof import('@/theme/themeStore.web');
    expect(reloadApp()).toBe('reloaded');
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it('rechargement impossible : « manual »', () => {
    reload.mockImplementationOnce(() => {
      throw new Error('non');
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { reloadApp } = require('@/theme/themeStore.web') as typeof import('@/theme/themeStore.web');
    expect(reloadApp()).toBe('manual');
  });
});
