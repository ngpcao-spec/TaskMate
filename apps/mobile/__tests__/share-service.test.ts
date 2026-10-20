const mockCopy = jest.fn();
jest.mock('@/services/clipboard', () => ({ copyText: (...a: unknown[]) => mockCopy(...a) }));

type Nav = { share?: jest.Mock };
const setNavigator = (nav: Nav | undefined) => Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });

describe('partage web (Web Share API, repli copie)', () => {
  beforeEach(() => { jest.resetModules(); mockCopy.mockReset(); mockCopy.mockResolvedValue(true); });
  const load = () => (jest.requireActual('@/services/share.web') as typeof import('@/services/share.web')).shareText;

  it('feuille de partage disponible : « shared », sans copie', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    setNavigator({ share });
    expect(await load()('Titre', 'Texte')).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'Titre', text: 'Texte' });
    expect(mockCopy).not.toHaveBeenCalled();
  });
  it('l’utilisateur ferme la feuille : ce n’est pas un échec et on ne copie pas', async () => {
    setNavigator({ share: jest.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })) });
    expect(await load()('T', 'x')).toBe('shared');
    expect(mockCopy).not.toHaveBeenCalled();
  });
  it('autre erreur de partage : repli sur la copie', async () => {
    setNavigator({ share: jest.fn().mockRejectedValue(new Error('NotAllowedError')) });
    expect(await load()('T', 'x')).toBe('copied');
    expect(mockCopy).toHaveBeenCalledWith('x');
  });
  it('pas de Web Share API : copie ; copie refusée : « failed »', async () => {
    setNavigator({});
    expect(await load()('T', 'x')).toBe('copied');
    mockCopy.mockResolvedValue(false);
    expect(await load()('T', 'x')).toBe('failed');
  });
  it('pas de navigator du tout : copie', async () => {
    setNavigator(undefined);
    expect(await load()('T', 'x')).toBe('copied');
  });
});

describe('partage natif', () => {
  beforeEach(() => { jest.resetModules(); mockCopy.mockReset(); mockCopy.mockResolvedValue(true); });
  it('feuille de partage du système, repli sur la copie en cas d’erreur', async () => {
    const share = jest.fn().mockResolvedValue({ action: 'sharedAction' });
    jest.doMock('react-native', () => ({ Share: { share, dismissedAction: 'dismissedAction' } }));
    const { shareText } = jest.requireActual('@/services/share') as typeof import('@/services/share');
    expect(await shareText('T', 'x')).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'T', message: 'x' });
    share.mockRejectedValueOnce(new Error('boom'));
    expect(await shareText('T', 'x')).toBe('copied');
    expect(mockCopy).toHaveBeenCalledWith('x');
    jest.dontMock('react-native');
  });
});
