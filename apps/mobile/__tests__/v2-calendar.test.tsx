import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import type { ChildRow, TaskRow } from '@/types/models';
import V2CalendarPage from '../app/(v2)/v2/calendar';
import V2ParentCalendar from '../app/(v2)/v2/parent/calendar';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: () => true, replace: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/Avatar', () => ({ Avatar: () => null }));
const mockDetectorProps = jest.fn();
jest.mock('react-native-gesture-handler', () => {
  const chain: Record<string, unknown> = {};
  const fluent = new Proxy(chain, { get: () => () => fluent });
  return {
    Gesture: { Pan: () => fluent },
    GestureDetector: (props: { children: React.ReactNode }) => {
      mockDetectorProps(props);
      return props.children;
    },
  };
});

const minh = { id: 'c-minh', name: 'Minh', birth_date: '2015-03-01', color: '#1E88F5' } as ChildRow;
const khang = { id: 'c-khang', name: 'Khang', birth_date: '2013-03-01', color: '#E86A92' } as ChildRow;
const t1 = { id: 't1', child_id: 'c-minh', title: 'Đọc sách', category: 'study', icon: 'lecture', points: 10, date: '2026-07-02', time_kind: 'range', start_time: '10:30:00', end_time: '11:00:00', completed_at: null, validated_at: null, created_by: 'm' } as TaskRow;
const t2 = { ...t1, id: 't2', title: 'Đánh răng', category: 'personal', icon: null, points: 5, time_kind: 'deadline', start_time: null, end_time: '21:30:00', completed_at: '2026-07-02T01:00:00Z', validated_at: '2026-07-02T02:00:00Z' } as TaskRow;
const t3 = { ...t1, id: 't3', title: 'Tập thể dục', category: 'sport', date: '2026-07-03', start_time: '17:00:00', end_time: '17:30:00' } as TaskRow;

let mockRole: 'parent' | 'child' = 'child';
jest.mock('@/hooks/useNow', () => ({ useNow: () => new Date('2026-07-02T03:00:00Z') }));
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({
    me: { family: { timezone: 'Asia/Ho_Chi_Minh' } },
    viewer: mockRole === 'parent' ? { role: 'parent', memberId: 'm', childId: null } : { role: 'child', memberId: 'k', childId: 'c-minh' },
    children: mockRole === 'parent' ? [minh, khang] : [minh],
    child: minh,
    readOnly: false,
    select: jest.fn(),
  }),
}));
let mockWeekly: { childId: string; childName: string; items: Record<string, unknown>[] }[] = [];
jest.mock('@/hooks/useWeeklyQuizzes', () => ({ useWeeklyQuizzes: () => ({ groups: mockWeekly, isPending: false }) }));
const mockUseTasks = jest.fn();
jest.mock('@/hooks/useTasks', () => ({ useTasks: (...a: unknown[]) => mockUseTasks(...a) }));

describe('Lịch V2 (style de Hôm nay)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole = 'child';
    mockWeekly = [];
    mockUseTasks.mockReturnValue({ data: [t1, t2, t3], isPending: false });
  });

  it('enfant : écran V2 avec retour, semaine lundi → dimanche, jour courant, objectifs avec heure et énergie ; aucune case à cocher', async () => {
    await render(<V2CalendarPage />);
    expect(screen.getByRole('header', { name: 'Lịch' })).toBeTruthy();
    expect(screen.getByTestId('v2-week-strip')).toBeTruthy();
    expect(screen.getByTestId('v2-back')).toBeTruthy();
    expect(mockUseTasks).toHaveBeenCalledWith('c-minh', '2026-06-29', '2026-07-05');
    expect(mockDetectorProps).toHaveBeenCalledWith(expect.objectContaining({ touchAction: 'pan-y' }));
    expect(screen.getByText('Thứ Năm, 2 tháng 7')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thứ Năm, 2 tháng 7, hôm nay' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByText('Đọc sách')).toBeTruthy();
    expect(screen.getByText('10:30 - 11:00')).toBeTruthy();
    expect(screen.getByLabelText('10 năng lượng')).toBeTruthy();
    expect(screen.getByText('Trước 21:30')).toBeTruthy();
    expect(screen.getByLabelText('đã xong')).toBeTruthy(); // Đánh răng validée : coche verte
    expect(screen.queryByText('Tập thể dục')).toBeNull();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    // l'enfant ne modifie rien : pas d'ouverture
    expect(screen.queryByRole('button', { name: /Đọc sách/ })).toBeNull();
  });

  it('changer de jour, semaine suivante, « Xem lịch tuần » groupé par jour', async () => {
    await render(<V2CalendarPage />);
    await fireEvent.press(screen.getByRole('button', { name: 'Thứ Sáu, 3 tháng 7' }));
    expect(screen.getByText('Tập thể dục')).toBeTruthy();
    expect(screen.queryByText('Đọc sách')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Xem lịch tuần' }));
    expect(screen.getByText('Đọc sách')).toBeTruthy();
    expect(screen.getByText('Tập thể dục')).toBeTruthy();
    expect(screen.getByText('Thứ Hai, 29 tháng 6')).toBeTruthy();
    expect(screen.getAllByText('Không có việc nào').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Tuần sau' }));
    expect(mockUseTasks).toHaveBeenLastCalledWith('c-minh', '2026-07-06', '2026-07-12');
  });

  it('parent (onglet Lịch) : sans retour, choix de l’enfant, une tâche s’ouvre pour la modifier, « + » ; date limite d’un quiz → validation', async () => {
    mockRole = 'parent';
    mockWeekly = [{ childId: 'c-minh', childName: 'Minh', items: [{ quizId: 'q1', subject: 'maths', title: 'Phân số', weekLabel: 'Tuần 1', dueOn: '2026-07-03', attemptId: 'a1', state: 'waiting', late: false, progress: null, result: null }] }];
    await render(<V2ParentCalendar />);
    expect(screen.queryByTestId('v2-back')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Khang' })).toBeTruthy();
    expect(screen.getByTestId('v2-add-task')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Đọc sách/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/task/[id]', params: { id: 't1' } });
    expect(screen.getByRole('button', { name: 'Thứ Sáu, 3 tháng 7, có bài ôn tập đến hạn' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Thứ Sáu, 3 tháng 7/ }));
    await fireEvent.press(screen.getByRole('button', { name: /Minh · hạn nộp bài ôn tập: Phân số/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quiz/attempt/[id]', params: { id: 'a1' } });
  });
});
