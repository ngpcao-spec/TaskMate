import { supabaseAuthStorage } from '@/api/secureStorage.web';
import { kvStorage } from '@/sync/storage.web';

describe('stockage web', () => {
  const realLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  afterEach(() => {
    if (realLocalStorage) Object.defineProperty(globalThis, 'localStorage', realLocalStorage);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
    kvStorage.removeItem('k');
  });

  it('lit/écrit/supprime via localStorage', () => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
    });
    kvStorage.setItem('k', 'v');
    expect(store.get('k')).toBe('v');
    expect(kvStorage.getItem('k')).toBe('v');
    kvStorage.removeItem('k');
    expect(store.has('k')).toBe(false);
    expect(kvStorage.getItem('k')).toBeNull();
  });

  it('se rabat sur la mémoire si localStorage est refusé (navigation privée, cookies bloqués)', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('SecurityError');
      },
    });
    expect(() => kvStorage.setItem('k', 'mem')).not.toThrow();
    expect(kvStorage.getItem('k')).toBe('mem');
  });

  it('se rabat sur la mémoire si le quota est dépassé', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => undefined },
    });
    kvStorage.setItem('k', 'gros');
    expect(kvStorage.getItem('k')).toBe('gros');
  });

  it('la session Supabase web passe par le même stockage', async () => {
    await supabaseAuthStorage.setItem('sb-session', '{"a":1}');
    expect(await supabaseAuthStorage.getItem('sb-session')).toBe('{"a":1}');
    await supabaseAuthStorage.removeItem('sb-session');
    expect(await supabaseAuthStorage.getItem('sb-session')).toBeNull();
  });
});
