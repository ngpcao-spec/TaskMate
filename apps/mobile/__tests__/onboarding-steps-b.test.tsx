import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import i18n from '@/i18n';
import { ChildSetup } from '@/components/onboarding/ChildSetup';
import { ChildSetupGate } from '@/components/onboarding/ChildSetupGate';
import { ContentStep } from '@/components/onboarding/ContentStep';
import { CoparentStep } from '@/components/onboarding/CoparentStep';
import { NotificationsStep } from '@/components/onboarding/NotificationsStep';
import { clearClients, facts, kid, renderWithClient } from '../test-utils/onboardingHarness';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush, back: mockBack, canGoBack: () => true }), Redirect: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
const mockStore = new Map<string, string>();
jest.mock('@/sync/storage', () => ({ kvStorage: { getItem: (k: string) => mockStore.get(k) ?? null, setItem: (k: string, v: string) => void mockStore.set(k, v), removeItem: (k: string) => void mockStore.delete(k) } }));

let mockRole: 'parent' | 'child' = 'parent';
const mockMe = () => ({ member: { id: 'm1', role: mockRole }, family: { id: 'f1', name: 'Nhà', timezone: 'Asia/Ho_Chi_Minh' }, children: [] });
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: mockMe() }) }));
jest.mock('@/hooks/useDisplayedChild', () => ({ useDisplayedChild: () => ({ me: mockMe(), viewer: { role: mockRole }, children: [], child: { id: 'c1', name: 'Minh' }, select: jest.fn() }) }));
const mockSetStep = jest.fn();
jest.mock('@/api/onboarding', () => ({ setOnboardingStep: (...a: unknown[]) => mockSetStep(...a), fetchOnboarding: jest.fn(), hideSetupCard: jest.fn(), restartOnboarding: jest.fn() }));

// notifications : service Web Push (état lu de la base), préférences
let mockInstall = { ios: false, standalone: true };
const mockStatus = jest.fn();
const mockEnable = jest.fn();
const mockTest = jest.fn();
const mockRegistered = jest.fn();
jest.mock('@/services/webPush', () => ({
  installState: () => mockInstall,
  getWebPushStatus: () => mockStatus(),
  enableWebPush: () => mockEnable(),
  sendTestNotification: () => mockTest(),
  thisDeviceRegistered: () => mockRegistered(),
}));
const mockSavePrefs = jest.fn();
jest.mock('@/hooks/useNotifications', () => ({
  useNotificationPrefs: () => ({ data: { reminderBeforeStartMin: 10, reminderBeforeDeadlineMin: 30, eveningRecap: { enabled: true, time: '20:30' }, activity: {} } }),
  useSavePrefs: () => ({ mutate: (...a: unknown[]) => mockSavePrefs(...a), isPending: false }),
}));

// tâches / récompenses / invitation : appels réseau
const mockSeries = jest.fn();
const mockReward = jest.fn();
jest.mock('@/api/recurrences', () => ({ ...jest.requireActual('@/api/recurrences'), createRecurrences: (...a: unknown[]) => mockSeries(...a) }));
jest.mock('@/api/points', () => ({ ...jest.requireActual('@/api/points'), saveReward: (...a: unknown[]) => mockReward(...a) }));
const mockInvite = jest.fn();
jest.mock('@/api/family', () => ({ ...jest.requireActual('@/api/family'), createParentInvite: () => mockInvite(), fetchActiveParentInvite: async () => null, revokeParentInvite: jest.fn() }));
const mockShare = jest.fn();
jest.mock('@/services/share', () => ({ shareText: (...a: unknown[]) => mockShare(...a) }));
jest.mock('@/services/clipboard', () => ({ copyText: jest.fn(async () => true) }));

beforeEach(async () => {
  jest.clearAllMocks();
  mockStore.clear();
  Platform.OS = 'web';
  mockRole = 'parent';
  mockInstall = { ios: false, standalone: true };
  mockSetStep.mockResolvedValue(undefined);
  mockStatus.mockResolvedValue('off');
  mockEnable.mockResolvedValue({ ok: true });
  mockTest.mockResolvedValue({ kind: 'sent' });
  mockRegistered.mockResolvedValue(false);
  mockSeries.mockResolvedValue(undefined);
  mockReward.mockResolvedValue(undefined);
  mockInvite.mockResolvedValue('ABCDEFGH');
  mockShare.mockResolvedValue('shared');
  await i18n.changeLanguage('vi');
});
afterEach(() => clearClients());

describe('Étape 4 — installer et notifier', () => {
  it('iOS hors PWA : instruction « Chia sẻ → Thêm vào Màn hình chính », sous-étapes VERROUILLÉES, aucun bouton d’activation', async () => {
    mockInstall = { ios: true, standalone: false };
    await renderWithClient(<NotificationsStep facts={facts()} />);
    expect(screen.getByText(/Chia sẻ.*Thêm vào Màn hình chính/)).toBeTruthy();
    expect(screen.getAllByText('Cần làm bước 1 trước')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Bật thông báo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Gửi thông báo thử' })).toBeNull();
    expect(mockStatus).not.toHaveBeenCalled();
  });

  it('« Tôi đã thêm xong » sans mode standalone : rappel d’ouvrir depuis l’icône, toujours verrouillé', async () => {
    mockInstall = { ios: true, standalone: false };
    await renderWithClient(<NotificationsStep facts={facts()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Tôi đã thêm xong' }));
    expect(await screen.findByText(/Hãy mở TaskMate từ biểu tượng trên Màn hình chính/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bật thông báo' })).toBeNull();
  });

  it('une fois ouverte en standalone : le verrou tombe', async () => {
    mockInstall = { ios: true, standalone: false };
    await renderWithClient(<NotificationsStep facts={facts()} />);
    mockInstall = { ios: true, standalone: true };
    await fireEvent.press(screen.getByRole('button', { name: 'Tôi đã thêm xong' }));
    expect(await screen.findByRole('button', { name: 'Bật thông báo' })).toBeTruthy();
    expect(screen.queryByText('Cần làm bước 1 trước')).toBeNull();
  });

  it('Android / ordinateur : aucune sous-étape d’installation', async () => {
    await renderWithClient(<NotificationsStep facts={facts()} />);
    expect(await screen.findByRole('button', { name: 'Bật thông báo' })).toBeTruthy();
    expect(screen.queryByText('Thêm vào Màn hình chính')).toBeNull();
  });

  it('activation (geste), état relu de la base, puis test avec résultat clair', async () => {
    await renderWithClient(<NotificationsStep facts={facts()} />);
    expect(screen.getByText('Bật thông báo trước')).toBeTruthy(); // le test attend l'activation
    mockStatus.mockResolvedValue('on');
    await fireEvent.press(await screen.findByRole('button', { name: 'Bật thông báo' }));
    expect(mockEnable).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Đã bật trên thiết bị này')).toBeTruthy();
    await fireEvent.press(await screen.findByRole('button', { name: 'Gửi thông báo thử' }));
    expect(await screen.findByText(/Đã gửi thông báo thử/)).toBeTruthy();
    expect(mockTest).toHaveBeenCalledTimes(1);
  });

  it('« bật » seulement quand la base le confirme : activation sans ligne → pas de test proposé', async () => {
    mockEnable.mockResolvedValue({ ok: false, reason: 'server-failed' });
    await renderWithClient(<NotificationsStep facts={facts()} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Bật thông báo' }));
    expect(await screen.findByText(/Máy chủ chưa ghi nhận thiết bị này/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gửi thông báo thử' })).toBeNull();
    expect(screen.queryByText('Đã bật trên thiết bị này')).toBeNull();
  });

  it('abonnement non connu de la base : message « unsynced »', async () => {
    mockStatus.mockResolvedValue('unsynced');
    await renderWithClient(<NotificationsStep facts={facts()} />);
    expect(await screen.findByText(/máy chủ chưa ghi nhận thiết bị này/)).toBeTruthy();
  });

  it('résultats du test : aucun appareil, VAPID absente, erreur avec code', async () => {
    mockStatus.mockResolvedValue('on');
    await renderWithClient(<NotificationsStep facts={facts()} />);
    const press = async () => fireEvent.press(await screen.findByRole('button', { name: 'Gửi thông báo thử' }));
    mockTest.mockResolvedValue({ kind: 'no_device' });
    await press();
    expect(await screen.findByText('Chưa có thiết bị nào được đăng ký cho tài khoản này.')).toBeTruthy();
    mockTest.mockResolvedValue({ kind: 'no_vapid' });
    await press();
    expect(await screen.findByText(/VAPID_PUBLIC_KEY/)).toBeTruthy();
    mockTest.mockResolvedValue({ kind: 'error', code: 'gone' });
    await press();
    expect(await screen.findByText('Gửi thông báo thử không thành công (mã gone).')).toBeTruthy();
  });

  it('heure du récap : défaut 20:30, enregistrée avec « Tiếp tục » si modifiée et valide ; invalide = bloqué', async () => {
    await renderWithClient(<NotificationsStep facts={facts()} />);
    expect(screen.getByLabelText('Giờ tổng kết').props.value).toBe('20:30');
    await fireEvent.changeText(screen.getByLabelText('Giờ tổng kết'), '25:99');
    expect(screen.getByRole('button', { name: 'Tiếp tục' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.changeText(screen.getByLabelText('Giờ tổng kết'), '21:00');
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(mockSavePrefs).toHaveBeenCalledWith(expect.objectContaining({ eveningRecap: { enabled: true, time: '21:00' } }));
    expect(mockReplace).toHaveBeenCalledWith('/onboarding/setup/content');
  });

  it('heure inchangée : aucune écriture ; passer l’étape est possible', async () => {
    await renderWithClient(<NotificationsStep facts={facts({ children: [kid()] })} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Bỏ qua bước này' }));
    await waitFor(() => expect(mockSetStep).toHaveBeenCalledWith('notifications', 'skip'));
    expect(mockSavePrefs).not.toHaveBeenCalled();
  });

  it('parent invité : dernière étape = « Hoàn tất » vers Hôm nay', async () => {
    await renderWithClient(<NotificationsStep facts={facts({ isOwner: false, parents: 2 })} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Hoàn tất' }));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/today');
  });
});

describe('Étape 5 — tâches et récompenses', () => {
  const two = facts({ children: [kid(), kid({ id: 'c2', name: 'Khang' })] });

  it('modèles à cocher, points préremplis et modifiables ; « Tiếp tục » crée des séries SANS heure et des récompenses COMMUNES', async () => {
    await renderWithClient(<ContentStep facts={facts({ children: [kid()] })} />);
    expect(screen.getByRole('switch', { name: 'Đánh răng', checked: false })).toBeTruthy();
    await fireEvent(screen.getByRole('switch', { name: 'Đánh răng' }), 'valueChange', true);
    expect(screen.getByLabelText('Điểm cho Đánh răng').props.value).toBe('5');
    await fireEvent.changeText(screen.getByLabelText('Điểm cho Đánh răng'), '7');
    await fireEvent(screen.getByRole('switch', { name: 'Làm bài tập' }), 'valueChange', true);
    await fireEvent(screen.getByRole('switch', { name: 'Xem phim cả nhà' }), 'valueChange', true);
    expect(screen.getByLabelText('Giá của Xem phim cả nhà').props.value).toBe('100');
    await fireEvent.changeText(screen.getByLabelText('Giá của Xem phim cả nhà'), '90');
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding/setup/coparent'));
    expect(mockSeries).toHaveBeenCalledTimes(1);
    const [familyId, memberId, rows] = mockSeries.mock.calls[0] as [string, string, Record<string, unknown>[]];
    expect([familyId, memberId]).toEqual(['f1', 'm1']);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.title === 'Đánh răng')).toMatchObject({ child_id: 'c1', points: 7, rule: 'daily', time_kind: 'anytime', start_time: null, end_time: null, category: 'personal' });
    expect(rows.find((r) => r.title === 'Làm bài tập')).toMatchObject({ points: 15, rule: 'weekdays', weekdays: [1, 2, 3, 4, 5], category: 'study' });
    expect(mockReward).toHaveBeenCalledTimes(1);
    expect(mockReward).toHaveBeenCalledWith('f1', { title: 'Xem phim cả nhà', icon: 'popcorn', cost: 90, childId: null }, undefined);
  });

  it('rien de coché : aucune création, simple passage à l’étape suivante', async () => {
    await renderWithClient(<ContentStep facts={facts({ children: [kid()] })} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(mockReplace).toHaveBeenCalledWith('/onboarding/setup/coparent');
    expect(mockSeries).not.toHaveBeenCalled();
    expect(mockReward).not.toHaveBeenCalled();
  });

  it('plusieurs enfants : une sélection PAR enfant (séries séparées, jamais mélangées)', async () => {
    await renderWithClient(<ContentStep facts={two} />);
    await fireEvent(screen.getByRole('switch', { name: 'Đánh răng' }), 'valueChange', true);
    await fireEvent.press(screen.getByRole('tab', { name: 'Khang' }));
    expect(screen.getByRole('switch', { name: 'Đánh răng', checked: false })).toBeTruthy();
    await fireEvent(screen.getByRole('switch', { name: 'Đọc sách 20 phút' }), 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }));
    await waitFor(() => expect(mockSeries).toHaveBeenCalled());
    const rows = mockSeries.mock.calls[0]?.[2] as { child_id: string; title: string }[];
    expect(rows.map((r) => `${r.child_id}:${r.title}`).sort()).toEqual(['c1:Đánh răng', 'c2:Đọc sách 20 phút']);
  });

  it('échec de création : message, on reste sur l’étape, rien n’est perdu', async () => {
    mockSeries.mockRejectedValue(new Error('offline'));
    await renderWithClient(<ContentStep facts={facts({ children: [kid()] })} />);
    await fireEvent(screen.getByRole('switch', { name: 'Đánh răng' }), 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(await screen.findByText('Không tạo được. Hãy thử lại.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: 'Đánh răng', checked: true })).toBeTruthy();
  });

  it('points saisis hors bornes : ramenés aux bornes de la base', async () => {
    await renderWithClient(<ContentStep facts={facts({ children: [kid()] })} />);
    await fireEvent(screen.getByRole('switch', { name: 'Dọn bàn ăn' }), 'valueChange', true);
    await fireEvent.changeText(screen.getByLabelText('Điểm cho Dọn bàn ăn'), '99999');
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }));
    await waitFor(() => expect(mockSeries).toHaveBeenCalled());
    expect((mockSeries.mock.calls[0]?.[2] as { points: number }[])[0]?.points).toBe(1000);
  });

  it('titres traduits (fr) et passage de l’étape', async () => {
    await i18n.changeLanguage('fr');
    await renderWithClient(<ContentStep facts={facts({ children: [kid()] })} />);
    expect(screen.getByRole('switch', { name: 'Se brosser les dents' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Film en famille' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Passer cette étape' }));
    await waitFor(() => expect(mockSetStep).toHaveBeenCalledWith('content', 'skip'));
  });
});

describe('Étape 6 — deuxième parent', () => {
  it('code d’invitation existant : génération, copie, partage ; dernière étape = « Hoàn tất » vers Hôm nay', async () => {
    await renderWithClient(<CoparentStep facts={facts({ children: [kid()] })} />);
    expect(screen.getAllByText('Bước 6/6').length).toBeGreaterThan(0);
    await fireEvent.press(await screen.findByRole('button', { name: 'Tạo mã' }));
    expect(await screen.findByText('ABCD-EFGH')).toBeTruthy();
    expect(mockInvite).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Chia sẻ mã mời' }));
    expect(mockShare).toHaveBeenCalledWith('Mời tham gia TaskMate', expect.stringContaining('ABCD-EFGH'));
    await fireEvent.press(screen.getByRole('button', { name: 'Hoàn tất' }));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/today');
  });

  it('étape passable', async () => {
    await renderWithClient(<CoparentStep facts={facts({ children: [kid()] })} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Bỏ qua bước này' }));
    await waitFor(() => expect(mockSetStep).toHaveBeenCalledWith('coparent', 'skip'));
  });
});

describe('Parcours enfant (1 écran, 2 gestes)', () => {
  beforeEach(() => { mockRole = 'child'; });

  it('« Chào {prénom}! Cài đặt nhanh, chỉ 2 bước », exemple de notification, « Để sau » ferme sans rien faire', async () => {
    await renderWithClient(<ChildSetup />);
    expect(screen.getByText('Chào Minh! Cài đặt nhanh, chỉ 2 bước')).toBeTruthy();
    expect(screen.getByText('Bài ôn tập đã được duyệt · +5 điểm')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Bật thông báo' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Để sau' }));
    expect(mockBack).toHaveBeenCalled();
    expect(mockEnable).not.toHaveBeenCalled();
  });

  it('iOS hors PWA : l’instruction d’installation passe avant l’activation', async () => {
    mockInstall = { ios: true, standalone: false };
    await renderWithClient(<ChildSetup />);
    expect(screen.getByText(/Chia sẻ.*Thêm vào Màn hình chính/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bật thông báo' })).toBeNull();
  });

  it('un parent n’y voit rien', async () => {
    mockRole = 'parent';
    await renderWithClient(<ChildSetup />);
    expect(screen.queryByText(/Cài đặt nhanh/)).toBeNull();
  });

  it('porte : proposé UNE fois à un enfant sans appareil actif, marqué « vu » aussitôt', async () => {
    await renderWithClient(<ChildSetupGate />);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/onboarding/child-setup'));
    expect(mockStore.get('taskmate-child-setup-seen-m1')).toBe('1');
    mockPush.mockClear();
    clearClients();
    await renderWithClient(<ChildSetupGate />);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockPush).not.toHaveBeenCalled(); // ne revient pas tout seul
  });

  it('porte : appareil déjà actif → rien, mais marqué « vu »', async () => {
    mockRegistered.mockResolvedValue(true);
    await renderWithClient(<ChildSetupGate />);
    await waitFor(() => expect(mockStore.get('taskmate-child-setup-seen-m1')).toBe('1'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('porte : état illisible (hors ligne) → ni écran, ni marque (on réessaiera)', async () => {
    mockRegistered.mockRejectedValue(new Error('offline'));
    await renderWithClient(<ChildSetupGate />);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockStore.get('taskmate-child-setup-seen-m1')).toBeUndefined();
  });

  it('porte : jamais pour un parent', async () => {
    mockRole = 'parent';
    await renderWithClient(<ChildSetupGate />);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockRegistered).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
