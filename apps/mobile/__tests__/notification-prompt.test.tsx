import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import '@/i18n';
import { NotificationPrompt } from '@/components/NotificationPrompt';
import { SNOOZE_KEY } from '@/domain/notification-prompt';

let mockStatus = 'off';
const mockEnable = jest.fn();
jest.mock('@/services/webPush', () => ({ getWebPushStatus: async () => mockStatus, enableWebPush: () => mockEnable() }));
const mockStore = new Map<string, string>();
jest.mock('@/sync/storage', () => ({ kvStorage: { getItem: (k: string) => mockStore.get(k) ?? null, setItem: (k: string, v: string) => void mockStore.set(k, v), removeItem: (k: string) => void mockStore.delete(k) } }));

describe('NotificationPrompt (D-067)', () => {
  beforeEach(() => { jest.clearAllMocks(); mockStatus = 'off'; mockStore.clear(); Platform.OS = 'web'; });

  it('natif : aucune invitation web (les push natifs ont leur propre chemin)', async () => {
    Platform.OS = 'ios';
    await render(<NotificationPrompt />);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Bật thông báo' })).toBeNull());
    expect(mockEnable).not.toHaveBeenCalled();
  });

  it('première ouverture, notifications désactivées : l’invitation s’affiche avec un bouton (geste exigé par iOS)', async () => {
    await render(<NotificationPrompt />);
    expect(await screen.findByRole('button', { name: 'Bật thông báo' })).toBeTruthy();
    expect(mockEnable).not.toHaveBeenCalled(); // aucune demande automatique
  });

  it('rien si déjà activées, refusées ou non supportées', async () => {
    for (const s of ['on', 'denied', 'unsupported', 'not-configured', 'needs-install']) {
      mockStatus = s;
      const { unmount } = await render(<NotificationPrompt />);
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Bật thông báo' })).toBeNull());
      await unmount();
    }
  });

  it('« Để sau » masque 24 h : réouverture le même jour = rien', async () => {
    const first = await render(<NotificationPrompt />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Để sau' }));
    expect(screen.queryByRole('button', { name: 'Bật thông báo' })).toBeNull();
    expect(Number(mockStore.get(SNOOZE_KEY))).toBeGreaterThan(Date.now());
    await first.unmount();
    await render(<NotificationPrompt />);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Bật thông báo' })).toBeNull());
  });

  it('report échu : l’invitation revient', async () => {
    mockStore.set(SNOOZE_KEY, String(Date.now() - 1000));
    await render(<NotificationPrompt />);
    expect(await screen.findByRole('button', { name: 'Bật thông báo' })).toBeTruthy();
  });

  it('activation réussie : l’invitation disparaît', async () => {
    mockEnable.mockResolvedValue('on');
    await render(<NotificationPrompt />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Bật thông báo' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Bật thông báo' })).toBeNull());
    expect(mockEnable).toHaveBeenCalledTimes(1);
  });

  it('permission refusée : explication pour réactiver dans iOS, sans insister', async () => {
    mockEnable.mockResolvedValue('denied');
    await render(<NotificationPrompt />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Bật thông báo' }));
    expect(await screen.findByText(/Cài đặt của iPhone/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Hoàn tất' }));
    expect(screen.queryByText(/Cài đặt của iPhone/)).toBeNull();
  });

  it('échec technique : message d’erreur et l’invitation reste (on peut réessayer)', async () => {
    mockEnable.mockResolvedValue('failed');
    await render(<NotificationPrompt />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Bật thông báo' }));
    expect(await screen.findByText(/Không bật được thông báo/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bật thông báo' })).toBeTruthy();
  });
});
