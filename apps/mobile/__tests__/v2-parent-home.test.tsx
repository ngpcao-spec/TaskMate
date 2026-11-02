import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import type { CompanionState } from '@/domain/panda';
import type { WeeklyGroup } from '@/hooks/useWeeklyQuizzes';
import type { ChildRow, TaskRow } from '@/types/models';
import V2ParentHome from '../app/(v2)/v2/parent/home';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const minh = { id: 'c-minh', name: 'Minh', birth_date: '2015-03-01', color: '#1E88F5' } as ChildRow;
const khang = { id: 'c-khang', name: 'Khang', birth_date: '2013-05-01', color: '#2EC4A6' } as ChildRow;
const task = (over: Partial<TaskRow>): TaskRow =>
  ({ id: 't1', child_id: 'c-minh', title: 'Đánh răng', category: 'personal', icon: null, date: '2026-11-02', time_kind: 'anytime', start_time: null, end_time: null, points: 10, completed_at: null, validated_at: null, created_by: 'm-p', ...over }) as TaskRow;
let mockSelected = minh;
const mockSelect = jest.fn();
let mockTasks: TaskRow[] = [];
let mockPending: TaskRow[] = [];
let mockWeekly: WeeklyGroup[] = [];
const mockToggle = jest.fn();
const mockValidate = jest.fn();
const mockReject = jest.fn();
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({ me: { family: { timezone: 'Asia/Ho_Chi_Minh' } }, viewer: { role: 'parent', memberId: 'm-p', childId: null }, children: [minh, khang], child: mockSelected, select: mockSelect }),
}));
jest.mock('@/components/onboarding/SetupCard', () => ({ SetupCard: () => null }));
jest.mock('@/components/quiz/ValidateAttemptBar', () => ({ ValidateAttemptBar: ({ attemptId }: { attemptId: string }) => { const { Text } = jest.requireActual('react-native'); return <Text>{`validate-bar:${attemptId}`}</Text>; } }));
jest.mock('@/hooks/useAvatars', () => ({ useAvatar: () => ({ allowed: false, uri: null, version: 0 }) }));
const panda: CompanionState = { hasCompanion: true, name: 'Bambou', trait: 'kind', variant: 'boy', stage: 2, stageOffset: 0, energyTotal: 250, level: 2, nextLevelAt: 300 };
jest.mock('@/hooks/useCompanion', () => ({ useCompanion: () => ({ data: panda }) }));
jest.mock('@/hooks/useNow', () => ({ useNow: () => new Date('2026-11-02T03:00:00Z') }));
jest.mock('@/hooks/useWeeklyQuizzes', () => ({ useWeeklyQuizzes: () => ({ groups: mockWeekly, isPending: false }) }));
jest.mock('@/hooks/useNotifications', () => ({ useUnreadNotifications: () => 0 }));
jest.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({ data: mockTasks, isPending: false }),
  usePendingTasks: () => ({ data: mockPending }),
  useToggleTask: () => ({ mutate: mockToggle }),
  useValidateTask: () => ({ mutate: mockValidate }),
  useRejectTask: () => ({ mutate: mockReject }),
  toggleVars: (t: TaskRow, completed: boolean, asParent: boolean) => ({ task: t, completed, txId: 'tx', asParent }),
  validateVars: (t: TaskRow) => ({ task: t, txId: 'vtx' }),
}));

describe('V2 : Hôm nay du parent (D-106)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelected = minh;
    mockTasks = [task({}), task({ id: 't2', title: 'Làm toán', time_kind: 'range', start_time: '19:00:00', end_time: '20:00:00' })];
    mockPending = [task({ id: 'p1', title: 'Tưới cây', completed_at: 'x' }), task({ id: 'p2', child_id: 'c-khang', title: 'Việc của Khang', completed_at: 'x' })];
    mockWeekly = [];
  });

  it('un enfant à la fois : sélecteur, panda sans chiffre d’énergie, sa journée par moments', async () => {
    await render(<V2ParentHome />);
    expect(screen.getByRole('radio', { name: 'Minh' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('Panda Bambou của Minh')).toBeTruthy();
    expect(screen.queryByText(/250/)).toBeNull(); // aucun chiffre d'énergie côté parent
    expect(screen.getByRole('button', { name: 'Buổi tối, 1 việc' })).toBeTruthy();
    expect(screen.queryByText('Việc của Khang')).toBeNull(); // jamais deux enfants côte à côte
    await fireEvent.press(screen.getByRole('radio', { name: 'Khang' }));
    expect(mockSelect).toHaveBeenCalledWith('c-khang');
  });

  it('« Cần duyệt » d’abord : valider ou refuser une tâche cochée de CET enfant', async () => {
    await render(<V2ParentHome />);
    expect(screen.getByText('Tưới cây')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Duyệt' }));
    expect(mockValidate).toHaveBeenCalledWith({ task: expect.objectContaining({ id: 'p1' }), txId: 'vtx' });
    await fireEvent.press(screen.getByRole('button', { name: 'Từ chối' }));
    expect(mockReject).toHaveBeenCalledWith({ task: expect.objectContaining({ id: 'p1' }) });
  });

  it('quiz envoyé : barre de validation partagée (ValidateAttemptBar) et détail du quiz', async () => {
    mockPending = [];
    mockWeekly = [{ childId: 'c-minh', childName: 'Minh', items: [{ quizId: 'q1', subject: 'maths', title: 'Toán tuần 1', weekLabel: 'Tuần 1', releaseOn: '2026-11-02', dueOn: '2026-11-08', attemptId: 'att1', state: 'waiting', late: false, progress: null, result: { score: 7, total: 10 }, maxPoints: 8, pointsAwarded: 0 }] }];
    await render(<V2ParentHome />);
    expect(screen.getByText('validate-bar:att1')).toBeTruthy();
    expect(screen.getByText('Đúng 7/10')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Xem bài ôn: Toán tuần 1' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quiz/detail', params: { child: 'c-minh', quiz: 'q1' } });
  });

  it('rien à valider : message ; cocher en parent = validation directe (comme la V1)', async () => {
    mockPending = [];
    await render(<V2ParentHome />);
    expect(screen.getByText('Không có gì chờ duyệt.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Đánh răng' }));
    expect(mockToggle).toHaveBeenCalledWith(expect.objectContaining({ completed: true, asParent: true }));
  });
});
