import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import StatsScreen from '../app/(tabs)/stats';
import type { ChildRow, TaskRow } from '@/types/db';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
const minh = { id: 'c-minh', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5' } as ChildRow;
const khang = { id: 'c-khang', name: 'Khang', birth_date: '2013-05-01', color: '#2EC4A6' } as ChildRow;
const task = (id: string, category: string, done: boolean): TaskRow => ({ id, child_id: 'c-minh', category, date: '2026-07-02', completed_at: done ? 'x' : null, deleted_at: null }) as TaskRow;

let mockTasks: TaskRow[] = [];
let mockReadOnly = false;
const mockUseTasks = jest.fn();
jest.mock('@/hooks/useTasks', () => ({ useTasks: (...a: unknown[]) => mockUseTasks(...a) }));
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({
    me: { family: { timezone: 'Asia/Ho_Chi_Minh' } }, viewer: { role: 'child', memberId: 'm', childId: 'c-minh' },
    children: [minh, khang], child: mockReadOnly ? khang : minh, readOnly: mockReadOnly, select: jest.fn(),
  }),
}));

describe('StatsScreen', () => {
  beforeEach(() => { jest.clearAllMocks(); mockReadOnly = false; mockTasks = []; // les tâches tombent toujours dans la période demandée, quelle que soit la date réelle
    mockUseTasks.mockImplementation((_id: string, from: string) => ({ data: mockTasks.map((t) => ({ ...t, date: from })) })); });

  it('période vide : « — » et aucune carte d’encouragement, jamais NaN', async () => {
    await render(<StatsScreen />);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText(/NaN/)).toBeNull();
    expect(screen.queryByText('Xuất sắc!')).toBeNull();
  });

  it('affiche taux, légende et message selon le taux', async () => {
    mockTasks = [task('1', 'study', true), task('2', 'study', true), task('3', 'sport', true), task('4', 'sport', true), task('5', 'chores', false)];
    await render(<StatsScreen />);
    expect(screen.getByText('80%')).toBeTruthy();
    expect(screen.getByLabelText('Hoàn thành: 4')).toBeTruthy();
    expect(screen.getByLabelText('Chưa hoàn thành: 1')).toBeTruthy();
    expect(screen.getByLabelText('Tổng số việc: 5')).toBeTruthy();
    expect(screen.getByLabelText('Học tập: 40%')).toBeTruthy();
    expect(screen.getByText('Xuất sắc!')).toBeTruthy();
  });

  it('message intermédiaire et faible', async () => {
    mockTasks = [task('1', 'study', true), task('2', 'study', false)];
    await render(<StatsScreen />);
    expect(screen.getByText('Làm tốt lắm! Còn cố gắng hơn nữa nhé!')).toBeTruthy();
    mockTasks = [task('1', 'study', true), task('2', 'study', false), task('3', 'study', false)];
    await render(<StatsScreen />);
    expect(screen.getAllByText('Cố lên, mỗi ngày một chút!').length).toBeGreaterThan(0);
  });

  it('bascule Semaine/Tháng : interroge la bonne période', async () => {
    await render(<StatsScreen />);
    expect(mockUseTasks).toHaveBeenLastCalledWith('c-minh', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), expect.any(String));
    const [, weekFrom, weekTo] = mockUseTasks.mock.calls.at(-1) as [string, string, string];
    expect((new Date(weekTo).getTime() - new Date(weekFrom).getTime()) / 86400000).toBe(6); // 7 jours
    await fireEvent.press(screen.getByRole('radio', { name: 'Tháng' }));
    const [, monthFrom, monthTo] = mockUseTasks.mock.calls.at(-1) as [string, string, string];
    expect(monthFrom.endsWith('-01')).toBe(true);
    expect(Number(monthTo.slice(8))).toBeGreaterThanOrEqual(28); // dernier jour du mois
  });

  it('frère : consultation en lecture seule et un seul profil affiché (pas de comparatif)', async () => {
    mockReadOnly = true;
    await render(<StatsScreen />);
    expect(screen.getByText('Đang xem lịch của Khang')).toBeTruthy();
    expect(screen.getAllByText('Hoàn thành')).toHaveLength(1); // une seule légende = un seul profil
  });
});
