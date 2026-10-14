import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import '@/i18n';
import AvatarScreen from '../app/(tabs)/more/avatar';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), canGoBack: () => true, replace: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));

let mockRole: 'child' | 'parent' = 'parent';
const minh = { id: 'c-minh', name: 'Minh', color: '#1E88F5', birth_date: '2009-03-01' };
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({ me: { family: { timezone: 'Asia/Ho_Chi_Minh' } }, viewer: { role: mockRole, memberId: 'm', childId: mockRole === 'child' ? 'c-minh' : null }, children: [minh], child: minh, select: jest.fn() }),
}));

let mockInfo = { allowed: false, uri: null as string | null, version: 0 };
const mockSetAllowed = jest.fn();
const mockGenerate = jest.fn();
const mockConfirm = jest.fn();
const mockDiscard = jest.fn();
const mockRemove = jest.fn();
jest.mock('@/hooks/useAvatars', () => ({
  useAvatar: () => mockInfo,
  useSetAvatarAllowed: () => ({ mutate: mockSetAllowed, isPending: false }),
  useGenerateAvatar: () => ({ mutateAsync: mockGenerate }),
  useConfirmAvatar: () => ({ mutateAsync: mockConfirm, isPending: false }),
  useDiscardAvatarCandidate: () => ({ mutate: mockDiscard }),
  useRemoveAvatar: () => ({ mutate: mockRemove, isPending: false }),
  avatarErrorCode: (e: { code?: string }) => e.code ?? '',
}));

let mockSupported = true;
const mockPick = jest.fn();
jest.mock('@/services/documents', () => ({ get portraitSupported() { return mockSupported; }, pickPortrait: (...args: unknown[]) => mockPick(...args) }));
const mockConfirmDialog = jest.fn();
jest.mock('@/components/confirm', () => ({ confirmDialog: (o: unknown) => mockConfirmDialog(o) }));
const mockShow = jest.fn();
jest.mock('@/store/toast', () => ({ useToastStore: (sel: (s: { show: jest.Mock }) => unknown) => sel({ show: mockShow }) }));

const portrait = { status: 'ok', mediaType: 'image/jpeg', data: 'AAAA', bytes: 1234 };

describe('écran Ảnh đại diện (D-071)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole = 'parent';
    mockSupported = true;
    mockInfo = { allowed: true, uri: null, version: 0 };
    mockGenerate.mockResolvedValue({ candidate: 'UklGRg==', child_id: 'c-minh', remaining: 2 });
    mockConfirm.mockResolvedValue(undefined);
  });

  it('parent : texte de consentement clair (photo envoyée à OpenAI, jamais conservée) et interrupteur par enfant', async () => {
    mockInfo = { allowed: false, uri: null, version: 0 };
    await render(<AvatarScreen />);
    expect(screen.getByText(/OpenAI/)).toBeTruthy();
    expect(screen.getByText(/không lưu ảnh gốc/)).toBeTruthy();
    const sw = screen.getByLabelText('Cho phép Minh tạo ảnh đại diện bằng AI');
    expect(sw.props.value).toBe(false);
    await fireEvent(sw, 'valueChange', true);
    expect(mockSetAllowed).toHaveBeenCalledWith({ childId: 'c-minh', allowed: true });
    // sans consentement : aucun bouton de création
    expect(screen.queryByRole('button', { name: 'Chọn ảnh chân dung' })).toBeNull();
  });

  it('enfant sans consentement du parent : message, ni interrupteur ni bouton de création', async () => {
    mockRole = 'child';
    mockInfo = { allowed: false, uri: null, version: 0 };
    await render(<AvatarScreen />);
    expect(screen.getByText('Hãy nhờ ba mẹ bật tính năng này trước.')).toBeTruthy();
    expect(screen.queryByLabelText('Cho phép Minh tạo ảnh đại diện bằng AI')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Chọn ảnh chân dung' })).toBeNull();
  });

  it('enfant avec consentement : crée son avatar SANS envoyer d’identifiant (le serveur le déduit du jeton)', async () => {
    mockRole = 'child';
    mockPick.mockResolvedValue(portrait);
    await render(<AvatarScreen />);
    expect(screen.queryByLabelText('Cho phép Minh tạo ảnh đại diện bằng AI')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh chân dung' }));
    await waitFor(() => expect(mockGenerate).toHaveBeenCalledWith({ image: 'AAAA', childId: null }));
    expect(mockPick).toHaveBeenCalledWith('gallery');
  });

  it('parent : choisit un portrait, voit l’aperçu, valide (le portrait part avec l’identifiant de l’enfant)', async () => {
    mockPick.mockResolvedValue(portrait);
    await render(<AvatarScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Chụp ảnh chân dung' }));
    expect(mockPick).toHaveBeenCalledWith('camera');
    await waitFor(() => expect(mockGenerate).toHaveBeenCalledWith({ image: 'AAAA', childId: 'c-minh' }));
    expect(await screen.findByTestId('avatar-preview')).toBeTruthy();
    expect(screen.getByText('Hình hoạt hình đã vẽ xong. Dùng ảnh này?')).toBeTruthy();
    expect(screen.getByText('Còn 2 lần tạo hôm nay.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Dùng ảnh này' }));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith('c-minh'));
    await waitFor(() => expect(mockShow).toHaveBeenCalledWith('Đã lưu ảnh đại diện.'));
    expect(screen.queryByTestId('avatar-preview')).toBeNull();
  });

  it('« Thử lại » et « Hủy » abandonnent le candidat côté serveur', async () => {
    mockPick.mockResolvedValue(portrait);
    await render(<AvatarScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh chân dung' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Thử lại' }));
    expect(mockDiscard).toHaveBeenCalledWith('c-minh');
    expect(screen.queryByTestId('avatar-preview')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh chân dung' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Hủy' }));
    expect(mockDiscard).toHaveBeenCalledTimes(2);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it.each([
    ['quota_exceeded', 'Hôm nay đã tạo đủ số lần. Hãy thử lại vào ngày mai.'],
    ['ai_refused', 'AI không vẽ được ảnh này. Hãy thử một ảnh khác.'],
    ['ai_timeout', 'AI trả lời quá lâu. Hãy thử lại.'],
    ['network', 'Không có kết nối mạng. Hãy thử lại khi có mạng.'],
    ['avatar_not_allowed', 'Chưa được phép tạo ảnh đại diện bằng AI.'],
  ])('échec « %s » : message clair, retour à l’état de départ', async (code, message) => {
    mockPick.mockResolvedValue(portrait);
    mockGenerate.mockRejectedValue({ code });
    await render(<AvatarScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh chân dung' }));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chọn ảnh chân dung' })).toBeTruthy();
    expect(screen.queryByTestId('avatar-preview')).toBeNull();
  });

  it('photo annulée : rien ne part ; photo illisible ou trop lourde : message, rien ne part', async () => {
    mockPick.mockResolvedValueOnce({ status: 'cancelled' });
    await render(<AvatarScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh chân dung' }));
    expect(mockGenerate).not.toHaveBeenCalled();
    mockPick.mockResolvedValueOnce({ status: 'error', code: 'tooLarge' });
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh chân dung' }));
    expect(await screen.findByText('Ảnh quá lớn.')).toBeTruthy();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('avec un avatar : suppression après confirmation', async () => {
    mockInfo = { allowed: true, uri: 'data:image/webp;base64,UklGRg==', version: 1 };
    await render(<AvatarScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Xóa ảnh đại diện' }));
    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockConfirmDialog).toHaveBeenCalledWith(expect.objectContaining({ title: 'Xóa ảnh đại diện?', destructive: true }));
    (mockConfirmDialog.mock.calls[0][0] as { onConfirm: () => void }).onConfirm();
    expect(mockRemove).toHaveBeenCalledWith('c-minh', expect.any(Object));
  });

  it('sans avatar : pas de bouton de suppression', async () => {
    await render(<AvatarScreen />);
    expect(screen.queryByRole('button', { name: 'Xóa ảnh đại diện' })).toBeNull();
    expect(screen.getByText('Chưa có ảnh đại diện: đang dùng chữ cái đầu của tên.')).toBeTruthy();
  });

  it('application native : la fonction n’est pas proposée (web seulement), message explicite', async () => {
    mockSupported = false;
    await render(<AvatarScreen />);
    expect(screen.getByText('Chức năng này dùng được trên ứng dụng web (PWA).')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Chọn ảnh chân dung' })).toBeNull();
  });
});
