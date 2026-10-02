import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import CalendarScreen from '../app/(tabs)/calendar';
import type { ChildRow, TaskRow } from '@/types/db';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null }));
jest.mock('react-native-gesture-handler', () => {
  const chain: Record<string, unknown> = {};
  const fluent = new Proxy(chain, { get: () => () => fluent });
  return { Gesture: { Pan: () => fluent }, GestureDetector: ({ children }: { children: React.ReactNode }) => children };
});

const minh = { id: 'c-minh', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5' } as ChildRow;
const t1 = { id: 't1', child_id: 'c-minh', title: 'Làm bài tập Toán', category: 'study', date: '2026-07-02', time_kind: 'range', start_time: '08:00:00', end_time: '08:45:00', completed_at: null, created_by: 'm' } as TaskRow;
const t2 = { ...t1, id: 't2', title: 'Tập thể dục', category: 'sport', date: '2026-07-03', start_time: '17:00:00', end_time: '17:30:00' } as TaskRow;

jest.mock('@/hooks/useNow', () => ({ useNow: () => new Date('2026-07-02T03:00:00Z') }));
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({
    me: { family: { timezone: 'Asia/Ho_Chi_Minh' } },
    viewer: { role: 'parent', memberId: 'm', childId: null },
    children: [minh],
    child: minh,
    readOnly: false,
    select: jest.fn(),
  }),
}));
const mockUseTasks = jest.fn();
jest.mock('@/hooks/useTasks', () => ({ useTasks: (...a: unknown[]) => mockUseTasks(...a) }));

describe('CalendarScreen', () => {
  beforeEach(() => mockUseTasks.mockReturnValue({ data: [t1, t2], isPending: false }));

  it('interroge la semaine lundi → dimanche du jour courant (fuseau famille)', async () => {
    await render(<CalendarScreen />);
    expect(mockUseTasks).toHaveBeenCalledWith('c-minh', '2026-06-29', '2026-07-05');
  });

  it('le jour affiché correspond au jour réel : jeudi 2/7 → « Thứ Năm » sous la colonne T5', async () => {
    await render(<CalendarScreen />);
    expect(screen.getByText('Thứ Năm, 2 tháng 7')).toBeTruthy();
    expect(screen.queryByText(/Thứ Tư/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Thứ Năm, 2 tháng 7, hôm nay' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByText('T5')).toBeTruthy();
    expect(screen.getByText('CN')).toBeTruthy();
  });

  it('n’affiche que les tâches du jour sélectionné, puis changer de jour', async () => {
    await render(<CalendarScreen />);
    expect(screen.getByText('Làm bài tập Toán')).toBeTruthy();
    expect(screen.queryByText('Tập thể dục')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Thứ Sáu, 3 tháng 7' }));
    expect(screen.getByText('Tập thể dục')).toBeTruthy();
    expect(screen.queryByText('Làm bài tập Toán')).toBeNull();
  });

  it('« Xem lịch tuần » groupe les tâches par jour', async () => {
    await render(<CalendarScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Xem lịch tuần' }));
    expect(screen.getByText('Làm bài tập Toán')).toBeTruthy();
    expect(screen.getByText('Tập thể dục')).toBeTruthy();
    expect(screen.getByText('Thứ Hai, 29 tháng 6')).toBeTruthy();
  });

  it('semaine suivante via le bouton', async () => {
    await render(<CalendarScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Tuần sau' }));
    expect(mockUseTasks).toHaveBeenLastCalledWith('c-minh', '2026-07-06', '2026-07-12');
  });
});
