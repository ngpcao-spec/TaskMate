import { render } from '@testing-library/react-native';
import { encodeResume, RESUME_KEY } from '@/domain/resume-path';
import { useResumeAfterReload } from '@/hooks/useResumeAfterReload';

const mockReplace = jest.fn();
let mockPath = '/today';
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }), usePathname: () => mockPath }));

const store = new Map<string, string>();
const mockStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };

function Probe() {
  useResumeAfterReload();
  return null;
}

beforeEach(() => {
  store.clear();
  mockPath = '/today';
  Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, configurable: true });
});
afterEach(() => jest.clearAllMocks());

describe('retour à la page d\'avant le rechargement (D-103)', () => {
  it('reparti de la page de départ : rouvre la page mémorisée, une seule fois', async () => {
    store.set(RESUME_KEY, encodeResume('/more/settings', Date.now()));
    const view = await render(<Probe />);
    expect(mockReplace).toHaveBeenCalledWith('/more/settings');
    expect(store.has(RESUME_KEY)).toBe(false);
    await view.rerender(<Probe />);
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });
  it('déjà sur la bonne page : la mémoire est effacée, aucune navigation', async () => {
    mockPath = '/more/settings';
    store.set(RESUME_KEY, encodeResume('/more/settings', Date.now()));
    await render(<Probe />);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(store.has(RESUME_KEY)).toBe(false);
  });
  it('page avec paramètres : comparée sans la requête', async () => {
    mockPath = '/admin/family';
    store.set(RESUME_KEY, encodeResume('/admin/family?id=abc', Date.now()));
    await render(<Probe />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
  it('mémoire périmée ou illisible : ignorée et effacée', async () => {
    store.set(RESUME_KEY, encodeResume('/more/settings', Date.now() - 10 * 60_000));
    await render(<Probe />);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(store.has(RESUME_KEY)).toBe(false);
    store.set(RESUME_KEY, 'n\'importe quoi');
    await render(<Probe />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
  it('adresse externe mémorisée : jamais suivie', async () => {
    store.set(RESUME_KEY, JSON.stringify({ path: 'https://evil.example', at: Date.now() }));
    await render(<Probe />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
  it('rien en mémoire, ou stockage qui plante : aucune navigation, aucune erreur', async () => {
    await render(<Probe />);
    Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => { throw new Error('bloqué'); } }, configurable: true });
    await render(<Probe />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
