import { render } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { resetActivityPing, useActivityPing } from '@/hooks/useActivityPing';

const mockTouch = jest.fn();
jest.mock('@/api/activity', () => ({ touchActivity: () => mockTouch() }));

let handler: ((s: string) => void) | null = null;
const mockRemove = jest.fn();
beforeEach(() => {
  resetActivityPing();
  mockTouch.mockResolvedValue(undefined);
  handler = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
    handler = h;
    return { remove: mockRemove };
  }) as never);
});
afterEach(() => jest.restoreAllMocks());
afterEach(() => jest.clearAllMocks());

function Probe({ enabled }: { enabled: boolean }) {
  useActivityPing(enabled);
  return null;
}

describe('dernière activité : ouverture et retour au premier plan (D-102)', () => {
  it('à l’ouverture : un appel', async () => {
    await render(<Probe enabled />);
    expect(mockTouch).toHaveBeenCalledTimes(1);
  });
  it('désactivé (pas de membre) : aucun appel, aucun abonnement', async () => {
    await render(<Probe enabled={false} />);
    expect(mockTouch).not.toHaveBeenCalled();
    expect(handler).toBeNull();
  });
  it('retour au premier plan : pas de second appel avant 10 minutes', async () => {
    await render(<Probe enabled />);
    handler?.('background');
    handler?.('active');
    expect(mockTouch).toHaveBeenCalledTimes(1);
  });
  it('retour au premier plan après 10 minutes : nouvel appel', async () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    await render(<Probe enabled />);
    now.mockReturnValue(1_000_000 + 11 * 60_000);
    handler?.('active');
    expect(mockTouch).toHaveBeenCalledTimes(2);
  });
  it('échec (hors ligne) : silencieux, et le prochain retour au premier plan réessaie', async () => {
    mockTouch.mockRejectedValueOnce(new Error('offline'));
    await render(<Probe enabled />);
    await Promise.resolve();
    await Promise.resolve();
    handler?.('active');
    expect(mockTouch).toHaveBeenCalledTimes(2);
  });
  it('démontage : désabonnement', async () => {
    const view = await render(<Probe enabled />);
    await view.unmount();
    expect(mockRemove).toHaveBeenCalled();
  });
});
