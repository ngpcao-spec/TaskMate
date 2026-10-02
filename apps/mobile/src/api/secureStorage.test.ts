import { secureGet, secureRemove, secureSet } from './secureStorage';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void mockStore.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void mockStore.delete(k)),
}));

describe('secureStorage (valeurs > 2 Ko découpées)', () => {
  beforeEach(() => mockStore.clear());

  it('relit une grande valeur à l’identique', async () => {
    const big = 'x'.repeat(5000) + 'é✓';
    await secureSet('s', big);
    expect(mockStore.size).toBeGreaterThan(2);
    expect(await secureGet('s')).toBe(big);
  });
  it('renvoie null si la clé est absente', async () => {
    expect(await secureGet('absent')).toBeNull();
  });
  it('remplace sans laisser de morceaux orphelins', async () => {
    await secureSet('s', 'y'.repeat(5000));
    await secureSet('s', 'court');
    expect(await secureGet('s')).toBe('court');
    expect(mockStore.size).toBe(2);
  });
  it('supprime tous les morceaux', async () => {
    await secureSet('s', 'z'.repeat(4000));
    await secureRemove('s');
    expect(mockStore.size).toBe(0);
  });
});
