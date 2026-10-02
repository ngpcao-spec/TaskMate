import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import TodayScreen from '../app/(tabs)/today';
import type { ChildRow, TaskRow } from '@/types/db';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

const minh = { id: 'c-minh', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5' } as ChildRow;
const khang = { id: 'c-khang', name: 'Khang', birth_date: '2013-05-01', color: '#2EC4A6' } as ChildRow;
const task = (over: Partial<TaskRow>): TaskRow =>
  ({
    id: 't1', child_id: 'c-minh', title: 'Làm bài tập Toán', category: 'study', date: '2026-07-02',
    time_kind: 'range', start_time: '08:00:00', end_time: '08:45:00', completed_at: null, created_by: 'm-p', ...over,
  }) as TaskRow;

let mockDisplayed: unknown;
let mockTasks: TaskRow[] = [];
const mockToggle = jest.fn();
jest.mock('@/hooks/useDisplayedChild', () => ({ useDisplayedChild: () => mockDisplayed }));
jest.mock('@/hooks/useSyncStatus', () => ({ usePendingTaskIds: () => new Set<string>() }));
jest.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({ data: mockTasks, isPending: false }),
  useToggleTask: () => ({ mutate: mockToggle }),
  useDeleteTask: () => ({ mutate: jest.fn() }),
  toggleVars: (t: TaskRow, completed: boolean) => ({ task: t, completed, txId: 'tx' }),
}));

const displayed = (childId: string, readOnly: boolean) => ({
  me: { family: { timezone: 'Asia/Ho_Chi_Minh' } },
  viewer: { role: 'child', memberId: 'm-minh', childId: 'c-minh' },
  children: [minh, khang],
  child: childId === 'c-minh' ? minh : khang,
  readOnly,
  select: jest.fn(),
});

describe('TodayScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTasks = [task({}), task({ id: 't2', title: 'Dọn phòng', completed_at: '2026-07-02T01:00:00Z', start_time: null, end_time: '21:00:00', time_kind: 'deadline' })];
  });

  it('mode enfant, profil propre : coche une tâche et affiche le bouton +', async () => {
    mockDisplayed = displayed('c-minh', false);
    await render(<TodayScreen />);
    expect(screen.getByText('Chào Minh!')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thêm việc' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Làm bài tập Toán' }));
    expect(mockToggle).toHaveBeenCalledWith(expect.objectContaining({ completed: true, txId: 'tx' }));
  });

  it('affiche la progression 1/2 et l’échéance « Trước 21:00 »', async () => {
    mockDisplayed = displayed('c-minh', false);
    await render(<TodayScreen />);
    expect(screen.getAllByText('Hôm nay 1/2 việc đã hoàn thành').length).toBeGreaterThan(0);
    expect(screen.getByText(/Trước 21:00/)).toBeTruthy();
  });

  it('profil du frère : lecture seule — bandeau, pas de +, cases désactivées', async () => {
    mockDisplayed = displayed('c-khang', true);
    mockTasks = [task({ child_id: 'c-khang', created_by: 'm-khang' })];
    await render(<TodayScreen />);
    expect(screen.getByText('Đang xem lịch của Khang')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thêm việc' })).toBeNull();
    const box = screen.getByRole('checkbox', { name: 'Làm bài tập Toán' });
    expect(box.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(box);
    expect(mockToggle).not.toHaveBeenCalled();
  });

  it('jour vide : message et anneau « — » sans NaN', async () => {
    mockDisplayed = displayed('c-minh', false);
    mockTasks = [];
    await render(<TodayScreen />);
    expect(screen.getByText('Hôm nay chưa có việc nào')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });
});
