import { render } from '@testing-library/react-native';
import { encodeResume, RESUME_KEY, RESUME_WINDOW_MS } from '@/domain/resume-path';
import { useResumeAfterReload } from '@/hooks/useResumeAfterReload';
import { reloadPendingForTest, takeResume } from '@/services/resumeAfterReload';

const mockReplace = jest.fn();
let mockPath = '/today';
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }), usePathname: () => mockPath }));

const store = new Map<string, string>();
const mockStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
const loadedAt = (pathname: string) => Object.defineProperty(globalThis, 'location', { value: { pathname }, configurable: true });
const savePage = (path: string, at = Date.now()) => store.set(RESUME_KEY, encodeResume(path, at));

function Probe() {
  useResumeAfterReload();
  return null;
}

beforeEach(() => {
  store.clear();
  mockPath = '/today';
  Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, configurable: true });
  loadedAt('/');
  reloadPendingForTest(); // page « neuve » sans mémoire
});
afterEach(() => jest.clearAllMocks());

describe('retour à la page d\'avant le rechargement (D-103)', () => {
  it('page chargée à l\'adresse de départ : rouvre la page mémorisée, une seule fois', async () => {
    savePage('/more/settings');
    reloadPendingForTest();
    expect(store.has(RESUME_KEY)).toBe(false); // lue ET effacée dès le chargement
    const view = await render(<Probe />);
    expect(mockReplace).toHaveBeenCalledWith('/more/settings');
    await view.rerender(<Probe />);
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });
  it('page chargée ailleurs qu\'à l\'adresse de départ (le navigateur est revenu où il fallait, ou assistant en cours) : aucune reprise', async () => {
    loadedAt('/onboarding/setup/language');
    savePage('/onboarding/setup/language');
    reloadPendingForTest();
    expect(store.has(RESUME_KEY)).toBe(false);
    mockPath = '/today'; // plus tard, à la fin de l'assistant
    await render(<Probe />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
  it('déjà sur la bonne page : aucune navigation', async () => {
    mockPath = '/more/settings';
    savePage('/more/settings');
    reloadPendingForTest();
    await render(<Probe />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
  it('page avec paramètres : comparée sans la requête', async () => {
    mockPath = '/admin/family';
    savePage('/admin/family?id=abc');
    reloadPendingForTest();
    await render(<Probe />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
  it('trop tard après le chargement : ignorée (jamais au milieu d\'un parcours)', () => {
    const now = Date.now();
    savePage('/more/settings', now);
    reloadPendingForTest(now);
    expect(takeResume(now + RESUME_WINDOW_MS + 1)).toBeNull();
    savePage('/more/settings', now);
    reloadPendingForTest(now);
    expect(takeResume(now + RESUME_WINDOW_MS)).toBe('/more/settings');
    expect(takeResume(now)).toBeNull(); // une seule fois
  });
  it('mémoire périmée, illisible ou adresse externe : ignorée et effacée', async () => {
    store.set(RESUME_KEY, encodeResume('/more/settings', Date.now() - 10 * 60_000));
    reloadPendingForTest();
    expect(store.has(RESUME_KEY)).toBe(false);
    store.set(RESUME_KEY, 'n\'importe quoi');
    reloadPendingForTest();
    store.set(RESUME_KEY, JSON.stringify({ path: 'https://evil.example', at: Date.now() }));
    reloadPendingForTest();
    await render(<Probe />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
  it('rien en mémoire, ou stockage qui plante : aucune navigation, aucune erreur', async () => {
    await render(<Probe />);
    Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => { throw new Error('bloqué'); } }, configurable: true });
    reloadPendingForTest();
    await render(<Probe />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
