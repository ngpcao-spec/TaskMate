import { act, fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import { AdminFamilyDetail } from '@/components/admin/AdminFamilyDetail';
import { UserTracking } from '@/components/admin/UserTracking';

const mockPush = jest.fn();
const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ id: 'fam-1' }),
  Redirect: (props: { href: string }) => { mockRedirect(props.href); return null; },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));

let mockRole: 'parent' | 'child' = 'parent';
let mockAdmin: boolean | undefined = true;
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: { member: { role: mockRole, id: 'm-p' }, family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' }, children: [] } }) }));
jest.mock('@/hooks/useCatalog', () => ({ useIsPlatformAdmin: () => ({ data: mockAdmin, isPending: mockAdmin === undefined }) }));

type Q = { data?: unknown; isPending: boolean; isError: boolean; error?: unknown; refetch: () => unknown };
const mockRefetch = jest.fn();
const mockRefresh = jest.fn();
const ready = (data: unknown): Q => ({ data, isPending: false, isError: false, refetch: mockRefetch });
const loading: Q = { isPending: true, isError: false, refetch: mockRefetch };
const failed: Q = { isPending: false, isError: true, refetch: mockRefetch };
let mockOverview: Q = loading;
let mockSeries: Q = loading;
let mockUsage: Q = loading;
let mockHealth: Q = loading;
let mockFamilies: Q = loading;
let mockFamily: Q = loading;
let mockBusy = false;
const mockFamiliesCall = jest.fn();
jest.mock('@/hooks/useAdminStats', () => ({
  useAdminOverview: () => mockOverview,
  useAdminSeries: () => mockSeries,
  useAdminUsage: () => mockUsage,
  useAdminHealth: () => mockHealth,
  useAdminFamilies: (...args: unknown[]) => { mockFamiliesCall(...args); return mockFamilies; },
  useAdminFamily: () => mockFamily,
  useRefreshAdminStats: () => ({ refresh: mockRefresh, busy: mockBusy }),
}));

const split = (parents: number, children: number) => ({ parents, children });
const overview = { families: 2, parents: 3, children: 4, newFamilies7d: 1, newFamilies30d: 2, active: { today: split(1, 2), d7: split(2, 3), d30: split(3, 4) }, familiesWithNotifications: 1 };
const series = {
  weeks: Array.from({ length: 12 }, (_, i) => ({ weekStart: `2026-08-${String(10 + i).padStart(2, '0')}`, families: i % 3 })),
  days: Array.from({ length: 30 }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, '0')}`, parents: i % 4, children: i % 5 })),
};
const counters = (over: Record<string, number> = {}) => ({ tasksCreated: 5, tasksGenerated: 2, tasksCompleted: 4, tasksValidated: 3, quizzesSubmitted: 2, quizzesValidated: 1, rewardRequests: 1, aiCalls: 3, aiFailed: 1, avatarCalls: 2, avatarFailed: 0, ...over });
const usage = {
  d7: counters(),
  d30: counters({ tasksCreated: 20, aiCalls: 9, aiFailed: 2 }),
  quizByClass: [{ country: 'VN', grade: '7', subject: 'maths', submitted7d: 1, validated7d: 1, submitted30d: 3, validated30d: 2 }],
  aiByModel: [{ kind: 'questions', model: 'gpt-test', calls7d: 2, calls30d: 7, failed30d: 1, inputTokens30d: 1200, outputTokens30d: 300 }, { kind: 'avatar', model: 'gpt-image-2', calls7d: 2, calls30d: 2, failed30d: 0, inputTokens30d: 0, outputTokens30d: 0 }],
};
const row = (over: Record<string, unknown> = {}) => ({
  familyId: 'fam-1', name: 'Gia đình A', creatorEmail: 'ba@example.com', countries: ['VN'], parents: 2, children: 2, classes: [{ country: 'VN', grade: '7' }, { country: 'FR', grade: 'CM1' }],
  createdAt: '2026-10-01T03:00:00Z', lastActiveAt: '2026-10-27T03:00:00Z', status: 'active', notifications: true, ...over,
});
const page = (rows: unknown[], total = rows.length) => ({ total, page: 1, pageSize: 50, rows });
const health = { dbSizeBytes: 12_582_912, activeDevices: 3, cron: [{ jobname: 'push-task-reminders', schedule: '*/5 * * * *', active: true, lastRunAt: '2026-10-27T03:05:00Z', lastStatus: 'succeeded' }, { jobname: 'generate-recurrences', schedule: '5 * * * *', active: true, lastRunAt: '2026-10-27T03:05:00Z', lastStatus: 'failed' }] };

beforeEach(() => {
  mockRole = 'parent';
  mockAdmin = true;
  mockOverview = ready(overview);
  mockSeries = ready(series);
  mockUsage = ready(usage);
  mockHealth = ready(health);
  mockFamilies = ready(page([row(), row({ familyId: 'fam-2', name: 'Famille B', creatorEmail: null, countries: [], children: 0, classes: [], status: 'dormant', lastActiveAt: null, notifications: false })]));
  mockFamily = ready({ ...row(), activeDevices: 1, usage30d: counters() });
  mockBusy = false;
});
afterEach(() => jest.clearAllMocks());

describe('Suivi des utilisateurs : accès', () => {
  it('un parent ordinaire (non administrateur) est renvoyé à l’accueil, rien n’est affiché', async () => {
    mockAdmin = false;
    await render(<UserTracking />);
    expect(mockRedirect).toHaveBeenCalledWith('/');
    expect(screen.queryByText('Theo dõi người dùng')).toBeNull();
  });
  it('un enfant est renvoyé à l’accueil', async () => {
    mockRole = 'child';
    await render(<UserTracking />);
    expect(mockRedirect).toHaveBeenCalledWith('/');
    expect(screen.queryByText('Chỉ số chính')).toBeNull();
  });
  it('la fiche d’une famille a la même garde', async () => {
    mockAdmin = false;
    await render(<AdminFamilyDetail />);
    expect(mockRedirect).toHaveBeenCalledWith('/');
  });
});

describe('Suivi des utilisateurs : états', () => {
  it('chargement : un indicateur par section, aucun chiffre', async () => {
    mockOverview = loading; mockSeries = loading; mockUsage = loading; mockHealth = loading; mockFamilies = loading;
    await render(<UserTracking />);
    expect(screen.getAllByLabelText('Đang tải…').length).toBe(5);
    expect(screen.queryByText('Gia đình A')).toBeNull();
  });
  it('erreur : message et « Thử lại » relance la lecture', async () => {
    mockOverview = failed;
    await render(<UserTracking />);
    expect(screen.getAllByText('Không tải được dữ liệu. Hãy thử lại.').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Thử lại' })[0]!);
    expect(mockRefetch).toHaveBeenCalled();
  });
  it('chargé : indicateurs, graphiques, usage, liste et santé', async () => {
    await render(<UserTracking />);
    expect(screen.getByLabelText('Gia đình: 2, Mới: 1 trong 7 ngày · 2 trong 30 ngày')).toBeTruthy();
    expect(screen.getByLabelText('Phụ huynh: 3')).toBeTruthy();
    expect(screen.getByLabelText('Trẻ em: 4')).toBeTruthy();
    expect(screen.getByLabelText('Phụ huynh hoạt động hôm nay: 1, 7 ngày: 2 · 30 ngày: 3')).toBeTruthy();
    expect(screen.getByLabelText('Trẻ hoạt động hôm nay: 2, 7 ngày: 3 · 30 ngày: 4')).toBeTruthy();
    expect(screen.getByLabelText('Gia đình bật thông báo: 1, trên 2 gia đình')).toBeTruthy();
    // graphiques : une barre lisible par période
    expect(screen.getAllByLabelText(/^Tuần bắt đầu /).length).toBe(12);
    expect(screen.getAllByLabelText(/^2026-10-\d\d: \d phụ huynh, \d trẻ hoạt động$/).length).toBe(30);
    // usage 7 j / 30 j
    expect(screen.getByLabelText('Việc đã tạo: 7 ngày 5, 30 ngày 20')).toBeTruthy();
    expect(screen.getByLabelText('Lượt gọi AI (câu hỏi): 7 ngày 3, 30 ngày 9, trong đó 2 lỗi')).toBeTruthy();
    expect(screen.getByText(/Chi phí ước tính: chưa tính được/)).toBeTruthy();
    expect(screen.getByText('VN Lớp 7 · Toán')).toBeTruthy();
    expect(screen.getByText(/1200 token vào · 300 token ra/)).toBeTruthy();
    // santé
    expect(screen.getByText(/Dung lượng cơ sở dữ liệu : 12 Mo/)).toBeTruthy();
    expect(screen.getByLabelText(/^push-task-reminders, Thành công, Lần chạy gần nhất: 27\/10\/2026 10:05$/)).toBeTruthy();
    expect(screen.getByLabelText(/^generate-recurrences, Lỗi/)).toBeTruthy();
  });
  it('liste : une ligne par famille, sans aucun prénom d’enfant ni contenu', async () => {
    await render(<UserTracking />);
    expect(screen.getByLabelText('Gia đình A, ba@example.com, Hoạt động. Mở hồ sơ gia đình.')).toBeTruthy();
    expect(screen.getByLabelText('Famille B, (không có email), Không hoạt động. Mở hồ sơ gia đình.')).toBeTruthy();
    expect(screen.getByText(/VN · 2 phụ huynh · 2 trẻ \(VN 7, FR CM1\)/)).toBeTruthy();
    expect(screen.getByText('2 gia đình')).toBeTruthy();
    expect(screen.getByText('Thông báo: có')).toBeTruthy();
    expect(screen.getByText('Thông báo: không')).toBeTruthy();
    expect(screen.getByText(/Hoạt động: Chưa từng/)).toBeTruthy();
  });
  it('tâche planifiée illisible (pg_cron) : indiqué sans erreur', async () => {
    mockHealth = ready({ ...health, cron: null });
    await render(<UserTracking />);
    expect(screen.getByText(/pg_cron không khả dụng/)).toBeTruthy();
  });
  it('aucun quiz ni appel IA : messages vides', async () => {
    mockUsage = ready({ ...usage, quizByClass: [], aiByModel: [] });
    await render(<UserTracking />);
    expect(screen.getByText('Chưa có quiz nào được nộp trong 30 ngày.')).toBeTruthy();
    expect(screen.getByText('Chưa có lượt gọi AI trong 30 ngày.')).toBeTruthy();
  });
  it('« Làm mới » relance tout ; occupé : indiqué et désactivé', async () => {
    const { rerender } = await render(<UserTracking />);
    await fireEvent.press(screen.getByRole('button', { name: 'Làm mới' }));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    mockBusy = true;
    await rerender(<UserTracking />);
    expect(screen.getByText('Đang làm mới…')).toBeTruthy();
  });
});

describe('Suivi des utilisateurs : liste des familles', () => {
  it('ouvrir une ligne ouvre la fiche de la famille', async () => {
    await render(<UserTracking />);
    await fireEvent.press(screen.getByLabelText('Gia đình A, ba@example.com, Hoạt động. Mở hồ sơ gia đình.'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/admin/family', params: { id: 'fam-1' } });
  });
  it('aucune famille : message ; avec une recherche : « aucune ne correspond »', async () => {
    mockFamilies = ready(page([]));
    await render(<UserTracking />);
    expect(screen.getByText('Không có gia đình nào.')).toBeTruthy();
  });
  it('recherche : interroge la base une fois la saisie arrêtée, page remise à 1', async () => {
    jest.useFakeTimers();
    mockFamilies = ready(page([]));
    await render(<UserTracking />);
    await fireEvent.changeText(screen.getByLabelText('Tìm theo tên gia đình hoặc email'), '  ba@example.com ');
    expect(mockFamiliesCall).not.toHaveBeenCalledWith('ba@example.com', expect.anything(), expect.anything(), expect.anything());
    await act(async () => { jest.advanceTimersByTime(350); });
    expect(mockFamiliesCall).toHaveBeenLastCalledWith('ba@example.com', 'last_active_at', 'desc', 1);
    expect(screen.getByText('Không có gia đình nào khớp với tìm kiếm.')).toBeTruthy();
    jest.useRealTimers();
  });
  it('tri : première pression = ordre naturel, seconde = sens inversé', async () => {
    await render(<UserTracking />);
    expect(screen.getByRole('radio', { name: 'Hoạt động gần nhất ↓' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Tên' }));
    expect(mockFamiliesCall).toHaveBeenLastCalledWith('', 'name', 'asc', 1);
    await fireEvent.press(screen.getByRole('radio', { name: 'Tên ↑' }));
    expect(mockFamiliesCall).toHaveBeenLastCalledWith('', 'name', 'desc', 1);
  });
  it('pagination côté serveur : 120 familles = 3 pages de 50', async () => {
    mockFamilies = ready(page([row()], 120));
    await render(<UserTracking />);
    expect(screen.getByText('Trang 1 / 3')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Trang sau' }));
    expect(mockFamiliesCall).toHaveBeenLastCalledWith('', 'last_active_at', 'desc', 2);
    await fireEvent.press(screen.getByRole('button', { name: 'Trang trước' }));
    expect(mockFamiliesCall).toHaveBeenLastCalledWith('', 'last_active_at', 'desc', 1);
  });
});

describe('Suivi des utilisateurs : fiche famille', () => {
  it('affiche les champs de la liste et les compteurs 30 j, en lecture seule', async () => {
    await render(<AdminFamilyDetail />);
    expect(screen.getByText('Gia đình A')).toBeTruthy();
    expect(screen.getByLabelText('Email phụ huynh tạo gia đình: ba@example.com')).toBeTruthy();
    expect(screen.getByLabelText('Lớp của các trẻ: VN 7, FR CM1')).toBeTruthy();
    expect(screen.getByLabelText('Thiết bị đang bật thông báo: 1')).toBeTruthy();
    expect(screen.getByLabelText('Việc đã tạo: 5')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Xóa|Sửa|Lưu/ })).toBeNull();
  });
  it('chargement et erreur', async () => {
    mockFamily = loading;
    const { rerender } = await render(<AdminFamilyDetail />);
    expect(screen.getByLabelText('Đang tải…')).toBeTruthy();
    mockFamily = { isPending: false, isError: true, error: { message: 'family_not_found' }, refetch: mockRefetch };
    await rerender(<AdminFamilyDetail />);
    expect(screen.getByText('Không tìm thấy gia đình này.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    expect(mockRefetch).toHaveBeenCalled();
  });
});
