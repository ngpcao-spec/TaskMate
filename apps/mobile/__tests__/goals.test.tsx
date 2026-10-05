import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import GoalsScreen from '../app/(tabs)/more/goals';
import type { ChildRow, GoalRow } from '@/types/models';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));

const minh = { id: 'c-minh', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5' } as ChildRow;
const khang = { id: 'c-khang', name: 'Khang', birth_date: '2013-05-01', color: '#2EC4A6' } as ChildRow;
const g = (over: Partial<GoalRow>) => ({ id: 'g1', child_id: 'c-minh', title: 'Đọc 5 cuốn sách', icon: 'book-open', target: 5, progress: 3, unit: null, ...over }) as GoalRow;

let mockGoals: GoalRow[] = [];
const mockSet = jest.fn();
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({
    me: { family: { timezone: 'Asia/Ho_Chi_Minh', id: 'f' }, member: { id: 'm' } },
    viewer: { role: 'child', memberId: 'm', childId: 'c-minh' },
    children: [minh, khang],
    child: minh,
    select: jest.fn(),
  }),
}));
jest.mock('@/hooks/useGoals', () => ({ useGoals: () => ({ data: mockGoals }), useSetGoalProgress: () => ({ mutate: mockSet }) }));

describe('GoalsScreen', () => {
  beforeEach(() => { jest.clearAllMocks(); mockGoals = [g({}), g({ id: 'g2', title: 'Chạy 12 km', unit: 'km', target: 12, progress: 12 })]; });

  it('affiche « 3/5 », « 12/12 km » et le badge Đã đạt', async () => {
    await render(<GoalsScreen />);
    expect(screen.getByText('3/5')).toBeTruthy();
    expect(screen.getByText('12/12 km')).toBeTruthy();
    expect(screen.getAllByText('Đã đạt')).toHaveLength(1);
  });

  it('+ et − envoient la nouvelle progression absolue ; − désactivé à 0', async () => {
    mockGoals = [g({ progress: 0 })];
    await render(<GoalsScreen />);
    expect(screen.getByRole('button', { name: 'Giảm Đọc 5 cuốn sách' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Tăng Đọc 5 cuốn sách' }));
    expect(mockSet).toHaveBeenCalledWith({ goal: mockGoals[0], progress: 1 });
  });

  it('enfant (D-052) : aucun sélecteur ni aucune trace d\'un autre enfant, même avec une liste polluée', async () => {
    await render(<GoalsScreen />);
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByText(/Khang/)).toBeNull();
    expect(screen.queryByText(/Đang xem lịch/)).toBeNull();
  });

  it('état vide', async () => {
    mockGoals = [];
    await render(<GoalsScreen />);
    expect(screen.getByText('Chưa có mục tiêu nào')).toBeTruthy();
  });
});
