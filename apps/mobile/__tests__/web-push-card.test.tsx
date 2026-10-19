import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import '@/i18n';
import { WebPushCard } from '@/components/WebPushCard';

let mockStatus = 'on';
const mockEnable = jest.fn();
const mockDisable = jest.fn();
const mockTest = jest.fn();
jest.mock('@/services/webPush', () => ({
  getWebPushStatus: async () => mockStatus,
  enableWebPush: () => mockEnable(),
  disableWebPush: () => mockDisable(),
  sendTestNotification: () => mockTest(),
}));

describe('WebPushCard (D-088)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus = 'on';
    Platform.OS = 'web';
  });

  it('« bật » seulement quand la base confirme ; bouton de test visible', async () => {
    await render(<WebPushCard />);
    expect(await screen.findByText('Đang bật trên thiết bị này')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gửi thông báo thử' })).toBeTruthy();
  });

  it('abonnement non connu de la base : message clair, bouton « Đăng ký lại thiết bị », pas de bouton de test', async () => {
    mockStatus = 'unsynced';
    await render(<WebPushCard />);
    expect(await screen.findByText(/máy chủ chưa ghi nhận thiết bị này/)).toBeTruthy();
    expect(screen.queryByText('Đang bật trên thiết bị này')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Gửi thông báo thử' })).toBeNull();
    mockEnable.mockResolvedValue({ ok: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng ký lại thiết bị' }));
    await waitFor(() => expect(mockEnable).toHaveBeenCalledTimes(1));
  });

  it('base injoignable : on n’affirme rien et on propose de revérifier', async () => {
    mockStatus = 'unverified';
    await render(<WebPushCard />);
    expect(await screen.findByText(/Không kiểm tra được trạng thái/)).toBeTruthy();
    expect(screen.queryByText('Đang bật trên thiết bị này')).toBeNull();
    expect(screen.getByRole('button', { name: 'Kiểm tra lại' })).toBeTruthy();
  });

  it('échec d’activation : la raison précise est affichée', async () => {
    mockStatus = 'off';
    mockEnable.mockResolvedValue({ ok: false, reason: 'subscribe-failed' });
    await render(<WebPushCard />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Bật thông báo' }));
    expect(await screen.findByText(/không tạo được đăng ký thông báo/)).toBeTruthy();
  });

  it('test : envoyé, aucun appareil, VAPID absente, erreur avec code', async () => {
    await render(<WebPushCard />);
    const press = async () => fireEvent.press(await screen.findByRole('button', { name: 'Gửi thông báo thử' }));
    mockTest.mockResolvedValue({ kind: 'sent' });
    await press();
    expect(await screen.findByText(/Đã gửi thông báo thử/)).toBeTruthy();
    mockTest.mockResolvedValue({ kind: 'no_device' });
    await press();
    expect(await screen.findByText('Chưa có thiết bị nào được đăng ký cho tài khoản này.')).toBeTruthy();
    mockTest.mockResolvedValue({ kind: 'no_vapid' });
    await press();
    expect(await screen.findByText(/VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT/)).toBeTruthy();
    mockTest.mockResolvedValue({ kind: 'error', code: 'gone' });
    await press();
    expect(await screen.findByText('Gửi thông báo thử không thành công (mã gone).')).toBeTruthy();
    mockTest.mockResolvedValue({ kind: 'error', code: null });
    await press();
    expect(await screen.findByText('Gửi thông báo thử không thành công.')).toBeTruthy();
  });

  it('natif : la fiche ne s’affiche pas', async () => {
    Platform.OS = 'ios';
    await render(<WebPushCard />);
    await waitFor(() => expect(screen.queryByText('Thông báo trên trình duyệt')).toBeNull());
  });
});
