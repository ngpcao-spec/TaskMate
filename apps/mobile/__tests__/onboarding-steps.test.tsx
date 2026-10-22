import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import i18n from '@/i18n';
import { ChildrenStep } from '@/components/onboarding/ChildrenStep';
import { LanguageStep } from '@/components/onboarding/LanguageStep';
import { SubjectsStep } from '@/components/onboarding/SubjectsStep';
import { useSessionStore } from '@/store/session';
import { clearClients, facts, kid, renderWithClient } from '../test-utils/onboardingHarness';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn(), canGoBack: () => true }), Redirect: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
const mockStore = new Map<string, string>();
jest.mock('@/sync/storage', () => ({ kvStorage: { getItem: (k: string) => mockStore.get(k) ?? null, setItem: (k: string, v: string) => void mockStore.set(k, v), removeItem: (k: string) => void mockStore.delete(k) } }));

const mockMe = { member: { id: 'm1', role: 'parent' }, family: { id: 'f1', name: 'Gia đình Nguyễn', timezone: 'Asia/Ho_Chi_Minh' }, children: [] as unknown[] };
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: mockMe }) }));
const mockSetStep = jest.fn();
jest.mock('@/api/onboarding', () => ({ setOnboardingStep: (...a: unknown[]) => mockSetStep(...a), fetchOnboarding: jest.fn(), hideSetupCard: jest.fn(), restartOnboarding: jest.fn() }));
const mockUpdateProfile = jest.fn();
jest.mock('@/api/account', () => ({ ...jest.requireActual('@/api/account'), updateFamilyProfile: (...a: unknown[]) => mockUpdateProfile(...a) }));
jest.mock('@/api/notifications', () => ({ syncPushLocale: jest.fn(async () => undefined) }));
const mockAdd = jest.fn();
const mockAccounts = jest.fn();
jest.mock('@/api/childAccounts', () => ({ ...jest.requireActual('@/api/childAccounts'), addChildWithAccount: (...a: unknown[]) => mockAdd(...a), fetchChildAccounts: () => mockAccounts() }));
const mockClass = jest.fn();
const mockSubject = jest.fn();
jest.mock('@/api/catalog', () => ({ ...jest.requireActual('@/api/catalog'), setChildClass: (...a: unknown[]) => mockClass(...a), setChildSubject: (...a: unknown[]) => mockSubject(...a) }));
const mockCopy = jest.fn();
const mockShare = jest.fn();
jest.mock('@/services/clipboard', () => ({ copyText: (...a: unknown[]) => mockCopy(...a) }));
jest.mock('@/services/share', () => ({ shareText: (...a: unknown[]) => mockShare(...a) }));

beforeEach(async () => {
  jest.clearAllMocks();
  mockStore.clear();
  mockSetStep.mockResolvedValue(undefined);
  mockUpdateProfile.mockResolvedValue(undefined);
  mockAccounts.mockResolvedValue([]);
  mockClass.mockResolvedValue(undefined);
  mockSubject.mockResolvedValue(undefined);
  mockCopy.mockResolvedValue(true);
  mockShare.mockResolvedValue('shared');
  useSessionStore.setState({ session: { user: { email: 'ba@example.com' } } as never });
  await i18n.changeLanguage('vi');
});
afterEach(() => { clearClients(); useSessionStore.setState({ session: null }); });

describe('Étape 1 — langue et famille', () => {
  it('barre de progression en 6 segments et « Bước 1/6 » ; pas de retour à la première étape', async () => {
    await renderWithClient(<LanguageStep facts={facts()} />);
    expect(screen.getAllByText('Bước 1/6').length).toBeGreaterThan(0);
    expect(screen.getByRole('progressbar', { name: 'Bước 1/6' }).props.accessibilityValue).toMatchObject({ min: 0, max: 6, now: 1 });
    expect(screen.queryByRole('button', { name: 'Quay lại' })).toBeNull();
  });

  it('le choix de l\'apparence est proposé (5 thèmes, par appareil) ; le choisir l\'enregistre pour cet appareil', async () => {
    await renderWithClient(<LanguageStep facts={facts()} />);
    expect(screen.getByText('Giao diện')).toBeTruthy();
    for (const label of ['Kính mờ', 'Kawaii', 'Vũ trụ', 'Gấu nâu', 'Thỏ bông']) expect(screen.getByRole('radio', { name: label })).toBeTruthy();
    expect(screen.getByText(/lưu riêng cho từng thiết bị/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Vũ trụ' }));
    expect(mockStore.get('taskmate-theme')).toBe('cosmos');
    expect(screen.getByText(/Hãy đóng hẳn ứng dụng rồi mở lại/)).toBeTruthy(); // natif : redémarrage manuel ; sur le web l'app se recharge seule
  });

  it('valeurs préremplies (nom, fuseau de l’appareil) ; « Tiếp tục » enregistre les changements PUIS confirme, puis étape suivante', async () => {
    await renderWithClient(<LanguageStep facts={facts()} />);
    const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(screen.getByLabelText('Múi giờ của gia đình').props.value).toBe(deviceTz);
    await fireEvent.changeText(screen.getByLabelText('Tên gia đình'), ' Nhà Lan ');
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding/setup/children'));
    expect(mockUpdateProfile).toHaveBeenCalledWith('f1', { name: 'Nhà Lan', timezone: deviceTz });
    expect(mockSetStep).toHaveBeenCalledWith('language', 'confirm');
  });

  it('rien à enregistrer côté famille si tout est inchangé : seulement la confirmation', async () => {
    mockMe.family.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await renderWithClient(<LanguageStep facts={facts()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }));
    await waitFor(() => expect(mockSetStep).toHaveBeenCalledWith('language', 'confirm'));
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    mockMe.family.timezone = 'Asia/Ho_Chi_Minh';
  });

  it('fuseau invalide ou nom vide : « Tiếp tục » désactivé, aucune écriture', async () => {
    await renderWithClient(<LanguageStep facts={facts()} />);
    await fireEvent.changeText(screen.getByLabelText('Múi giờ của gia đình'), 'Pas/UnFuseau');
    expect(screen.getByRole('button', { name: 'Tiếp tục' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.changeText(screen.getByLabelText('Múi giờ của gia đình'), 'Europe/Paris');
    await fireEvent.changeText(screen.getByLabelText('Tên gia đình'), '   ');
    expect(screen.getByRole('button', { name: 'Tiếp tục' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(mockSetStep).not.toHaveBeenCalled();
  });

  it('choisir une langue change aussitôt la langue de l’écran', async () => {
    await renderWithClient(<LanguageStep facts={facts()} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Français' }));
    expect(await screen.findByRole('button', { name: 'Continuer' })).toBeTruthy();
  });

  it('« Bỏ qua bước này » passe l’étape côté serveur puis avance ; échec serveur : on reste', async () => {
    await renderWithClient(<LanguageStep facts={facts()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Bỏ qua bước này' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding/setup/children'));
    expect(mockSetStep).toHaveBeenCalledWith('language', 'skip');
    mockReplace.mockClear();
    mockSetStep.mockRejectedValueOnce(new Error('offline'));
    await fireEvent.press(screen.getByRole('button', { name: 'Bỏ qua bước này' }));
    await waitFor(() => expect(mockSetStep).toHaveBeenCalledTimes(2));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('échec de l’enregistrement : message, on reste sur l’étape', async () => {
    mockSetStep.mockRejectedValue(new Error('x'));
    await renderWithClient(<LanguageStep facts={facts()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(await screen.findByText('Đã có lỗi xảy ra. Vui lòng thử lại.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('parent invité : assistant court (Bước 1/2), l’étape suivante est les notifications', async () => {
    await renderWithClient(<LanguageStep facts={facts({ isOwner: false, parents: 2 })} />);
    expect(screen.getAllByText('Bước 1/2').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding/setup/notifications'));
  });
});

const fillChild = async (over: { loginId?: string; password?: string } = {}) => {
  await fireEvent.changeText(screen.getByLabelText('Tên của con'), 'Cam');
  await fireEvent.changeText(screen.getByLabelText('Ngày sinh (YYYY-MM-DD)'), '2016-02-01');
  await fireEvent.changeText(screen.getByLabelText('Tên đăng nhập (chữ, số, . _ -)'), over.loginId ?? 'cam.test');
  await fireEvent.changeText(screen.getByLabelText('Mật khẩu (tối thiểu 6 ký tự)'), over.password ?? 'secret1');
};

describe('Étape 2 — enfants (obligatoire)', () => {
  it('aucun enfant : pas de « Bỏ qua », « Tiếp tục » désactivé, formulaire affiché', async () => {
    await renderWithClient(<ChildrenStep facts={facts({ languageConfirmed: true })} />);
    expect(screen.queryByRole('button', { name: 'Bỏ qua bước này' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Tiếp tục' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByLabelText('Tên của con')).toBeTruthy();
    expect(screen.getAllByText('Bước 2/6').length).toBeGreaterThan(0);
  });

  it('création : profil + compte par la voie existante, classe enregistrée, fiche de connexion avec mot de passe masqué puis « Hiện »', async () => {
    mockAdd.mockResolvedValue({ id: 'c-new', name: 'Cam' });
    await renderWithClient(<ChildrenStep facts={facts()} />);
    await fillChild();
    await fireEvent.press(screen.getByRole('radio', { name: 'Lớp 5' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo hồ sơ và tài khoản cho con' }));
    expect(await screen.findByText('Phiếu đăng nhập của Cam')).toBeTruthy();
    expect(mockAdd).toHaveBeenCalledWith('f1', expect.objectContaining({ name: 'Cam', birthDate: '2016-02-01', sortOrder: 0 }), 'cam.test', 'secret1');
    expect(mockClass).toHaveBeenCalledWith('c-new', 'VN', '5');
    expect(screen.getByText('ba@example.com')).toBeTruthy();
    expect(screen.getByText('cam.test')).toBeTruthy();
    // le mot de passe n'apparaît qu'après « Hiện »
    expect(screen.queryByText('secret1')).toBeNull();
    expect(screen.getByText('••••••••')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Hiện' }));
    expect(screen.getByText('secret1')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ẩn' }));
    expect(screen.queryByText('secret1')).toBeNull();
  });

  it('« Sao chép hướng dẫn » : explication + e-mail + identifiant + mot de passe ; « Chia sẻ » : mêmes informations', async () => {
    mockAdd.mockResolvedValue({ id: 'c-new', name: 'Cam' });
    await renderWithClient(<ChildrenStep facts={facts()} />);
    await fillChild();
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo hồ sơ và tài khoản cho con' }));
    await screen.findByText('Phiếu đăng nhập của Cam');
    await fireEvent.press(screen.getByRole('button', { name: 'Sao chép hướng dẫn' }));
    expect(mockCopy).toHaveBeenCalledTimes(1);
    const text = String(mockCopy.mock.calls[0]?.[0]);
    expect(text).toContain('Trên điện thoại của Cam: mở TaskMate, chọn “Tôi là con”');
    for (const part of ['ba@example.com', 'cam.test', 'secret1']) expect(text).toContain(part);
    expect(await screen.findByText('Đã sao chép')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Chia sẻ' }));
    expect(mockShare).toHaveBeenCalledWith('Đăng nhập TaskMate của Cam', text);
  });

  it('la fiche n’existe plus après avoir quitté l’écran : « Thêm con khác » ne garde ni mot de passe ni fiche', async () => {
    mockAdd.mockResolvedValue({ id: 'c-new', name: 'Cam' });
    await renderWithClient(<ChildrenStep facts={facts()} />);
    await fillChild();
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo hồ sơ và tài khoản cho con' }));
    await screen.findByText('Phiếu đăng nhập của Cam');
    await fireEvent.press(screen.getByRole('button', { name: 'Thêm con khác' }));
    expect(screen.queryByText('Phiếu đăng nhập của Cam')).toBeNull();
    expect(screen.queryByText('secret1')).toBeNull();
    expect(screen.getByLabelText('Mật khẩu (tối thiểu 6 ký tự)').props.value).toBe('');
    expect(screen.getByLabelText('Tên của con').props.value).toBe('');
  });

  it('identifiant déjà pris dans la famille : erreur immédiate, création impossible', async () => {
    mockAccounts.mockResolvedValue([{ child_id: 'c1', login_id: 'minh' }]);
    await renderWithClient(<ChildrenStep facts={facts({ children: [kid()] })} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Thêm con khác' }));
    await fillChild({ loginId: 'Minh' });
    expect(await screen.findByText('Tên đăng nhập này đã có người dùng. Hãy chọn tên khác.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tạo hồ sơ và tài khoản cho con' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('espaces refusés dans l’identifiant ; mot de passe trop court signalé', async () => {
    await renderWithClient(<ChildrenStep facts={facts()} />);
    await fireEvent.changeText(screen.getByLabelText('Tên đăng nhập (chữ, số, . _ -)'), 'a b c');
    expect(screen.getByLabelText('Tên đăng nhập (chữ, số, . _ -)').props.value).toBe('abc');
    await fireEvent.changeText(screen.getByLabelText('Mật khẩu (tối thiểu 6 ký tự)'), '123');
    expect(screen.getByText('Mật khẩu tối thiểu 6 ký tự.')).toBeTruthy();
  });

  it('refus du serveur (identifiant pris) : message, aucune fiche', async () => {
    const { ChildAccountError } = jest.requireActual('@/api/childAccounts');
    mockAdd.mockRejectedValue(new ChildAccountError('identifier_taken'));
    await renderWithClient(<ChildrenStep facts={facts()} />);
    await fillChild();
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo hồ sơ và tài khoản cho con' }));
    expect(await screen.findByText('Tên đăng nhập này đã có người dùng. Hãy chọn tên khác.')).toBeTruthy();
    expect(screen.queryByText('Phiếu đăng nhập của Cam')).toBeNull();
  });

  it('avec au moins un enfant : « Bỏ qua » et « Tiếp tục » sont disponibles ; la liste des enfants est faite de prénoms', async () => {
    await renderWithClient(<ChildrenStep facts={facts({ children: [kid(), kid({ id: 'c2', name: 'Khang' })] })} />);
    expect(screen.getByRole('button', { name: 'Bỏ qua bước này' })).toBeTruthy();
    expect(screen.getByLabelText('Đã thêm Minh')).toBeTruthy();
    expect(screen.getByLabelText('Đã thêm Khang')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(mockReplace).toHaveBeenCalledWith('/onboarding/setup/subjects');
  });

  it('classe non enregistrée : l’enfant est quand même créé, avec un message', async () => {
    mockAdd.mockResolvedValue({ id: 'c-new', name: 'Cam' });
    mockClass.mockRejectedValue(new Error('x'));
    await renderWithClient(<ChildrenStep facts={facts()} />);
    await fillChild();
    await fireEvent.press(screen.getByRole('radio', { name: 'Lớp 5' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo hồ sơ và tài khoản cho con' }));
    expect(await screen.findByText('Phiếu đăng nhập của Cam')).toBeTruthy();
  });
});

describe('Étape 3 — révisions', () => {
  it('interrupteurs en vrais switch ; matières sans contenu grisées « Chưa có nội dung » (désactivées)', async () => {
    mockStore.set('taskmate-onboarding-subjects-defaulted-c1', '1');
    await renderWithClient(<SubjectsStep facts={facts({ children: [kid()] })} />);
    expect(screen.getByRole('switch', { name: 'Toán', checked: true })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Lịch sử và Địa lý', checked: false })).toBeTruthy();
    const off = screen.getByRole('switch', { name: 'Tiếng Anh, Chưa có nội dung' });
    expect(off.props.accessibilityState).toMatchObject({ checked: false, disabled: true });
    expect(off.props['aria-disabled']).toBe(true);
    expect(screen.getAllByText('Chưa có nội dung').length).toBe(5);
    await fireEvent(off, 'valueChange', true);
    expect(mockSubject).not.toHaveBeenCalled();
  });

  it('l\'état de chaque matière est écrit en toutes lettres (« Đang bật » / « Đang tắt »), pas seulement par la position de l\'interrupteur', async () => {
    mockStore.set('taskmate-onboarding-subjects-defaulted-c1', '1');
    await renderWithClient(<SubjectsStep facts={facts({ children: [kid()] })} />);
    expect(screen.getAllByText('Đang bật').length).toBe(1); // Toán
    expect(screen.getAllByText('Đang tắt').length).toBe(1); // Lịch sử và Địa lý : disponible mais désactivée
  });

  it('activer / désactiver = l’écriture existante de child_subjects', async () => {
    mockStore.set('taskmate-onboarding-subjects-defaulted-c1', '1');
    await renderWithClient(<SubjectsStep facts={facts({ children: [kid()] })} />);
    await fireEvent(screen.getByRole('switch', { name: 'Lịch sử và Địa lý' }), 'valueChange', true);
    await waitFor(() => expect(mockSubject).toHaveBeenCalledWith('c1', 'hist_geo', true));
    await fireEvent(screen.getByRole('switch', { name: 'Toán' }), 'valueChange', false);
    await waitFor(() => expect(mockSubject).toHaveBeenCalledWith('c1', 'maths', false));
  });

  it('par défaut tout ce qui est disponible est activé, UNE fois par enfant et par appareil', async () => {
    await renderWithClient(<SubjectsStep facts={facts({ children: [kid({ subjects: [] })] })} />);
    await waitFor(() => expect(mockSubject).toHaveBeenCalledTimes(2));
    expect(mockSubject).toHaveBeenCalledWith('c1', 'maths', true);
    expect(mockSubject).toHaveBeenCalledWith('c1', 'hist_geo', true);
    mockSubject.mockClear();
    clearClients();
    await renderWithClient(<SubjectsStep facts={facts({ children: [kid({ subjects: [] })] })} />);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSubject).not.toHaveBeenCalled(); // l'utilisateur qui a tout désactivé n'est pas ré-activé de force
  });

  it('onglets par enfant (prénoms seulement) ; chaque enfant a ses matières', async () => {
    mockStore.set('taskmate-onboarding-subjects-defaulted-c1', '1');
    mockStore.set('taskmate-onboarding-subjects-defaulted-c2', '1');
    await renderWithClient(<SubjectsStep facts={facts({ children: [kid(), kid({ id: 'c2', name: 'Khang', grade: '5', subjects: [], available: ['sciences'] })] })} />);
    expect(screen.getByRole('tab', { name: 'Minh' }).props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByRole('tab', { name: 'Khang' }));
    expect(screen.getByRole('switch', { name: 'Khoa học', checked: false })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Toán', checked: true })).toBeNull();
  });

  it('enfant sans classe : choix de la classe, pas de matières', async () => {
    await renderWithClient(<SubjectsStep facts={facts({ children: [kid({ country: null, grade: null, subjects: [], available: [] })] })} />);
    expect(screen.getByText('Chọn lớp cho Minh để xem các môn ôn tập')).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Lớp 7' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu lớp' }));
    await waitFor(() => expect(mockClass).toHaveBeenCalledWith('c1', 'VN', '7'));
  });

  it('classe sans aucun contenu : message, tous les interrupteurs grisés', async () => {
    await renderWithClient(<SubjectsStep facts={facts({ children: [kid({ subjects: [], available: [] })] })} />);
    expect(screen.getByText('Chưa có nội dung nào cho lớp này.')).toBeTruthy();
    for (const sw of screen.getAllByRole('switch')) expect(sw.props.accessibilityState.disabled).toBe(true);
  });

  it('passer l’étape : écriture serveur puis étape suivante', async () => {
    mockStore.set('taskmate-onboarding-subjects-defaulted-c1', '1');
    await renderWithClient(<SubjectsStep facts={facts({ children: [kid()] })} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Bỏ qua bước này' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding/setup/notifications'));
    expect(mockSetStep).toHaveBeenCalledWith('subjects', 'skip');
  });
});
