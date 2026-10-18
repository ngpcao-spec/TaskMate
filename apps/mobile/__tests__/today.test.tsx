import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import TodayScreen from '../app/(tabs)/today';
import type { WeeklyGroup } from '@/hooks/useWeeklyQuizzes';
import type { WeeklyItem, WeeklyState } from '@/domain/weekly-quiz';
import type { ChildRow, TaskRow } from '@/types/models';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => children }));

const minh = { id: 'c-minh', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5' } as ChildRow;
const khang = { id: 'c-khang', name: 'Khang', birth_date: '2013-05-01', color: '#2EC4A6' } as ChildRow;
const task = (over: Partial<TaskRow>): TaskRow =>
  ({
    id: 't1', child_id: 'c-minh', title: 'Làm bài tập Toán', category: 'study', date: '2026-07-02', time_kind: 'range',
    start_time: '08:00:00', end_time: '08:45:00', points: 10, completed_at: null, validated_at: null, rejection_note: null, created_by: 'm-p', ...over,
  }) as TaskRow;

let mockRole: 'child' | 'parent' = 'child';
let mockTasks: TaskRow[] = [];
let mockCounts = { tasks: 0, requests: 0, total: 0 };
const mockToggle = jest.fn();
const mockSelect = jest.fn();
let mockWeekly: WeeklyGroup[] = [];
const mockValidate = jest.fn();
const mockReject = jest.fn();
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({
    me: { family: { timezone: 'Asia/Ho_Chi_Minh' } },
    viewer: { role: mockRole, memberId: 'm', childId: mockRole === 'child' ? 'c-minh' : null },
    // liste VOLONTAIREMENT polluée (les deux enfants) : un enfant ne doit en voir aucun autre, quelle que soit la source des données
    children: [minh, khang], child: minh, select: mockSelect,
  }),
}));
let mockNow: Date | null = null;
jest.mock('@/hooks/useNow', () => ({ useNow: () => mockNow ?? new Date() }));
jest.mock('@/hooks/useWeeklyQuizzes', () => ({ useWeeklyQuizzes: () => ({ groups: mockWeekly, isPending: false }) }));
jest.mock('@/hooks/useAvatars', () => ({ useAvatar: () => ({ allowed: false, uri: null, version: 0 }) }));
let mockUnread = 0;
jest.mock('@/hooks/useNotifications', () => ({ useUnreadNotifications: () => mockUnread }));
jest.mock('@/hooks/useApprovals', () => ({ useApprovalCounts: () => mockCounts }));
jest.mock('@/hooks/useSyncStatus', () => ({ usePendingTaskIds: () => new Set<string>() }));
jest.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({ data: mockTasks, isPending: false }),
  useToggleTask: () => ({ mutate: mockToggle }),
  useDeleteTask: () => ({ mutate: jest.fn() }),
  useValidateTask: () => ({ mutate: mockValidate }),
  useRejectTask: () => ({ mutate: mockReject }),
  toggleVars: (t: TaskRow, completed: boolean, asParent: boolean) => ({ task: t, completed, txId: 'tx', asParent }),
  validateVars: (t: TaskRow) => ({ task: t, txId: 'vtx' }),
}));

describe('TodayScreen (SPEC v4)', () => {
  beforeEach(() => { jest.clearAllMocks(); mockRole = 'child'; mockCounts = { tasks: 0, requests: 0, total: 0 }; mockTasks = [task({})]; mockWeekly = []; });

  it('enfant : pas de bouton +, coche → demande de coche en tant qu’enfant (asParent=false)', async () => {
    await render(<TodayScreen />);
    expect(screen.getByText('Chào Minh!')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thêm việc' })).toBeNull();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Làm bài tập Toán' }));
    expect(mockToggle).toHaveBeenCalledWith(expect.objectContaining({ completed: true, asParent: false }));
  });

  it('enfant : une tâche cochée en attente affiche « Chờ duyệt » et reste décochable', async () => {
    mockTasks = [task({ completed_at: '2026-07-02T01:00:00Z' })];
    await render(<TodayScreen />);
    expect(screen.getByText('Chờ duyệt')).toBeTruthy();
    expect(screen.queryByText(/\+10 điểm/)).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Làm bài tập Toán' }).props.accessibilityState).toMatchObject({ checked: true, disabled: false });
  });

  it('enfant : une tâche validée affiche « +10 điểm » et n’est plus décochable', async () => {
    mockTasks = [task({ completed_at: '2026-07-02T01:00:00Z', validated_at: '2026-07-02T02:00:00Z' })];
    await render(<TodayScreen />);
    expect(screen.getByText('+10 điểm')).toBeTruthy();
    const box = screen.getByRole('checkbox', { name: 'Làm bài tập Toán' });
    expect(box.props.accessibilityState).toMatchObject({ checked: true, disabled: true });
    await fireEvent.press(box);
    expect(mockToggle).not.toHaveBeenCalled();
  });

  it('enfant : tâche refusée → à faire, motif du parent affiché', async () => {
    mockTasks = [task({ rejection_note: 'à refaire proprement' })];
    await render(<TodayScreen />);
    expect(screen.getByText('Phụ huynh từ chối: à refaire proprement')).toBeTruthy();
    expect(screen.queryByText('Chờ duyệt')).toBeNull();
  });

  it('enfant : tap sur la ligne ouvre le détail en lecture seule (pas de swipe-suppression)', async () => {
    await render(<TodayScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /Làm bài tập Toán, 08:00/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/task/[id]', params: { id: 't1' } });
    expect(screen.queryByRole('button', { name: 'Xóa việc' })).toBeNull();
  });

  it('parent : FAB visible ; tâche en attente → boutons Duyệt / Từ chối sur la ligne', async () => {
    mockRole = 'parent';
    mockTasks = [task({ completed_at: '2026-07-02T01:00:00Z' })];
    await render(<TodayScreen />);
    expect(screen.getByRole('button', { name: 'Thêm việc' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Duyệt Làm bài tập Toán' }));
    expect(mockValidate).toHaveBeenCalledWith({ task: mockTasks[0], txId: 'vtx' });
    await fireEvent.press(screen.getByRole('button', { name: 'Từ chối Làm bài tập Toán' }));
    expect(mockReject).toHaveBeenCalledWith({ task: mockTasks[0] });
  });

  it('parent : une coche valide d’office (asParent=true) ; pas de boutons Duyệt sur une tâche à faire', async () => {
    mockRole = 'parent';
    await render(<TodayScreen />);
    expect(screen.queryByRole('button', { name: /^Duyệt/ })).toBeNull();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Làm bài tập Toán' }));
    expect(mockToggle).toHaveBeenCalledWith(expect.objectContaining({ completed: true, asParent: true }));
  });

  it('parent : bannières « việc chờ duyệt » et « demandes à approuver » vers la file', async () => {
    mockRole = 'parent';
    mockCounts = { tasks: 3, requests: 2, total: 5 };
    await render(<TodayScreen />);
    await fireEvent.press(screen.getByRole('button', { name: '3 việc chờ duyệt' }));
    expect(mockPush).toHaveBeenCalledWith('/approvals');
    expect(screen.getByRole('button', { name: '2 yêu cầu cần duyệt' })).toBeTruthy();
  });

  it('enfant : aucune bannière de validation', async () => {
    mockCounts = { tasks: 3, requests: 2, total: 5 };
    await render(<TodayScreen />);
    expect(screen.queryByText(/chờ duyệt$/)).toBeNull();
  });

  it('progression : tâches cochées (validées ou non) / total', async () => {
    mockTasks = [task({ id: 'a', completed_at: 'x' }), task({ id: 'b', completed_at: 'x', validated_at: 'y' }), task({ id: 'c' })];
    await render(<TodayScreen />);
    expect(screen.getAllByLabelText('Hôm nay 2/3 việc đã hoàn thành').length).toBeGreaterThan(0);
  });

  it('enfant (D-052) : aucun sélecteur d\'enfant ni aucune trace d\'un autre enfant, même avec une liste d\'enfants polluée', async () => {
    mockRole = 'child';
    mockTasks = [task({})];
    await render(<TodayScreen />);
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByText(/Khang/)).toBeNull();
    expect(screen.queryByText(/13 tuổi/)).toBeNull();
    expect(screen.queryByText(/Đang xem lịch/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Thêm việc' })).toBeNull();
    expect(screen.getByText(/Minh/)).toBeTruthy();
  });

  it('parent : sélecteur avec le PRÉNOM de chaque enfant (âge en second texte), aucun classement', async () => {
    mockRole = 'parent';
    mockTasks = [task({})];
    await render(<TodayScreen />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Minh, 17 tuổi' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Khang, 13 tuổi' })).toBeTruthy();
    expect(screen.getByText('Minh')).toBeTruthy();
    expect(screen.getByText('Khang')).toBeTruthy();
    expect(screen.queryByText(/hạng|rank|classement/i)).toBeNull();
  });

  it('cloche : compteur de notifications non lues dans le libellé et le badge', async () => {
    mockUnread = 3;
    mockTasks = [task({ id: 'a' })];
    await render(<TodayScreen />);
    expect(screen.getByRole('button', { name: /Thông báo.*3 chưa đọc/ })).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    mockUnread = 0;
  });

  it('jour vide : message et anneau « — » sans NaN', async () => {
    mockTasks = [];
    await render(<TodayScreen />);
    expect(screen.getByText('Hôm nay chưa có việc nào')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });
});

// Mercredi 21/10/2026, 10 h à Hô Chi Minh : semaine courante = lundi 19/10 → dimanche 25/10.
const item = (state: WeeklyState, over: Partial<WeeklyItem> = {}): WeeklyItem => ({
  quizId: `q-${state}-${over.subject ?? 'maths'}`, subject: 'maths', title: 'Bài 4', weekLabel: 'Tuần 8', releaseOn: '2026-10-19', dueOn: '2026-10-23', attemptId: null, state,
  late: false, progress: null, result: null, maxPoints: 8, pointsAwarded: 0, ...over,
});
const group = (items: WeeklyItem[], over: Partial<WeeklyGroup> = {}): WeeklyGroup => ({ childId: 'c-minh', childName: 'Minh', items, ...over });

describe('TodayScreen : bandeau « Ôn tập » (D-084)', () => {
  beforeEach(() => { jest.clearAllMocks(); mockRole = 'child'; mockCounts = { tasks: 0, requests: 0, total: 0 }; mockTasks = [task({})]; mockWeekly = []; mockNow = new Date('2026-10-21T03:00:00Z'); });
  afterEach(() => { mockNow = null; });

  it('masqué : aucun quiz', async () => {
    await render(<TodayScreen />);
    expect(screen.queryByText(/Ôn tập tuần/)).toBeNull();
  });

  it('masqué : quiz d’une autre semaine seulement', async () => {
    mockWeekly = [group([item('todo', { releaseOn: '2026-10-20', dueOn: '2026-10-30' })])];
    await render(<TodayScreen />);
    expect(screen.queryByText(/Ôn tập tuần/)).toBeNull();
  });

  it('en cours : titre k/n, échéance la plus proche, UN seul bandeau (plus de ligne par quiz)', async () => {
    mockWeekly = [group([
      item('validated', { subject: 'hist_geo', dueOn: '2026-10-22' }),
      item('in_progress', { subject: 'maths', dueOn: '2026-10-23', progress: { answered: 6, total: 16 } }),
      item('todo', { subject: 'francais', dueOn: '2026-10-25' }),
      item('waiting', { subject: 'anglais', dueOn: '2026-10-24' }),
    ])];
    await render(<TodayScreen />);
    expect(screen.getByText('Ôn tập tuần 8 · 1/4 môn')).toBeTruthy();
    expect(screen.getAllByText(/Gần nhất/)).toHaveLength(1);
    expect(screen.queryByText(/Ôn tập: /)).toBeNull();
  });

  it('un appui sur tout le bandeau ouvre l’écran Ôn tập ; cible ≥ 44 pt ; libellé complet', async () => {
    mockWeekly = [group([item('todo')])];
    await render(<TodayScreen />);
    const banner = screen.getByRole('button', { name: /Ôn tập tuần 8 · 0\/1 môn, Gần nhất/ });
    const flat = Object.assign({}, ...[banner.props.style].flat(Infinity).filter(Boolean));
    expect(flat.minHeight).toBeGreaterThanOrEqual(44);
    await fireEvent.press(banner);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/weekly' });
  });

  it('échéance dans 2 jours ou moins, ou en retard : en rouge (jeton danger) ; plus loin : couleur normale', async () => {
    mockWeekly = [group([item('todo', { dueOn: '2026-10-23' })])];
    const { unmount } = await render(<TodayScreen />);
    const near = screen.getByText(/Gần nhất/);
    const nearStyle = Object.assign({}, ...[near.props.style].flat(Infinity).filter(Boolean));
    await unmount();
    mockWeekly = [group([item('todo', { dueOn: '2026-10-25' })])];
    await render(<TodayScreen />);
    const far = screen.getByText(/Gần nhất/);
    const farStyle = Object.assign({}, ...[far.props.style].flat(Infinity).filter(Boolean));
    expect(nearStyle.color).not.toBe(farStyle.color);
  });

  it('en retard dans le délai de grâce : le bandeau reste (retard signalé, sans pénalité)', async () => {
    mockWeekly = [group([item('todo', { releaseOn: '2026-10-12', dueOn: '2026-10-16', weekLabel: 'Tuần 7', late: true })])];
    await render(<TodayScreen />);
    expect(screen.getByText('Ôn tập tuần 7 · 0/1 môn')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Quá hạn/ })).toBeTruthy();
  });

  it('en attente de validation (pas tous validés) : le bandeau reste, sans échéance', async () => {
    mockWeekly = [group([item('waiting', { subject: 'anglais' }), item('validated', { subject: 'maths' })])];
    await render(<TodayScreen />);
    expect(screen.getByText('Ôn tập tuần 8 · 1/2 môn')).toBeTruthy();
    expect(screen.getByText('1 bài đợi phụ huynh duyệt')).toBeTruthy();
    expect(screen.queryByText(/Gần nhất/)).toBeNull();
  });

  it('tout validé : « xong », discret (pas de barre ni d’échéance)', async () => {
    mockWeekly = [group([item('validated', { subject: 'maths' }), item('validated', { subject: 'anglais' })])];
    await render(<TodayScreen />);
    expect(screen.getByText('Ôn tập tuần 8 · xong')).toBeTruthy();
    expect(screen.queryByText(/Gần nhất/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Ôn tập tuần 8 · xong' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/weekly' });
  });

  it('enfant (D-052) : jamais le prénom d’un autre enfant ni de préfixe', async () => {
    mockWeekly = [group([item('todo')])];
    await render(<TodayScreen />);
    expect(screen.queryByText(/Khang/)).toBeNull();
    expect(screen.queryByText(/^Minh ·/)).toBeNull();
  });

  it('parent : un bandeau PAR enfant avec son prénom ; « Cần duyệt (n) » en priorité ; appui = l’écran de CET enfant', async () => {
    mockRole = 'parent';
    mockWeekly = [
      group([item('waiting', { attemptId: 'a1' }), item('todo', { subject: 'anglais' })]),
      group([item('todo', { subject: 'maths', dueOn: '2026-10-25' })], { childId: 'c-khang', childName: 'Khang' }),
    ];
    await render(<TodayScreen />);
    expect(screen.getByText('Minh · Ôn tập tuần 8 · 0/2 môn')).toBeTruthy();
    expect(screen.getByText('Khang · Ôn tập tuần 8 · 0/1 môn')).toBeTruthy();
    expect(screen.getByText('Cần duyệt (1)')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Khang · Ôn tập tuần 8/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/weekly', params: { child: 'c-khang' } });
    await fireEvent.press(screen.getByRole('button', { name: /Minh · Ôn tập tuần 8/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/weekly', params: { child: 'c-minh' } });
    expect(screen.queryByText(/hạng|rank|classement/i)).toBeNull();
  });

  it('parent : un enfant sans rien à montrer n’a pas de bandeau', async () => {
    mockRole = 'parent';
    mockWeekly = [group([]), group([item('todo')], { childId: 'c-khang', childName: 'Khang' })];
    await render(<TodayScreen />);
    expect(screen.queryByText(/^Minh · /)).toBeNull();
    expect(screen.getByText(/^Khang · Ôn tập tuần 8/)).toBeTruthy();
  });
});
