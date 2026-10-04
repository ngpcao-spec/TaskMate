import { onlineManager } from '@tanstack/react-query';
import { setupNetworkListeners } from '@/sync/network.web';

describe('réseau web', () => {
  it('suit les événements online/offline du navigateur', () => {
    const listeners = new Map<string, () => void>();
    const win = { addEventListener: (n: string, f: () => void) => listeners.set(n, f), removeEventListener: (n: string) => listeners.delete(n) };
    const doc = { visibilityState: 'visible', addEventListener: jest.fn(), removeEventListener: jest.fn() };
    Object.assign(globalThis, { window: win, document: doc });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
    setupNetworkListeners();
    onlineManager.subscribe(() => undefined); // déclenche l'abonnement
    listeners.get('offline')?.();
    expect(onlineManager.isOnline()).toBe(false);
    listeners.get('online')?.();
    expect(onlineManager.isOnline()).toBe(true);
  });
});
