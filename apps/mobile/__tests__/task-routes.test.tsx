import { render, screen } from '@testing-library/react-native';
import '@/i18n';
import NewTask from '../app/task/new';
import TaskScreen from '../app/task/[id]';
import type { TaskRow } from '@/types/models';

const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ id: 't1' }),
  Redirect: (props: { href: string }) => { mockRedirect(props.href); return null; },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null }));

let mockRole: 'parent' | 'child' = 'child';
const mockTask = { id: 't1', child_id: 'c-minh', title: 'Làm bài tập Toán', category: 'study', date: '2026-07-02', time_kind: 'range', start_time: '08:00:00', end_time: '08:45:00', points: 10, note: 'Chương 3 trang 40', completed_at: null, validated_at: null, rejection_note: null } as TaskRow;
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: { member: { role: mockRole, id: 'm' }, family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' }, children: [] } }) }));
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({ me: { family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' }, member: { id: 'm' } }, viewer: { role: mockRole, memberId: 'm', childId: null }, children: [], child: null, readOnly: false, select: jest.fn() }),
}));
jest.mock('@tanstack/react-query', () => ({ ...jest.requireActual('@tanstack/react-query'), useQuery: () => ({ isPending: false, data: mockTask }) }));
jest.mock('@/hooks/useTasks', () => ({ useCreateTasks: () => ({ mutate: jest.fn() }), useUpdateTask: () => ({ mutate: jest.fn() }), useDeleteTask: () => ({ mutate: jest.fn() }) }));
jest.mock('@/hooks/useRecurrences', () => ({ useCreateRecurrences: () => ({ mutate: jest.fn() }), useUpdateRecurrence: () => ({ mutate: jest.fn() }), useDeleteRecurrence: () => ({ mutate: jest.fn() }) }));


describe('routes de tâche protégées (SPEC v4 §3.4)', () => {
  beforeEach(() => { jest.clearAllMocks(); mockRole = 'child'; });

  it('task/new : un enfant est redirigé, aucun formulaire', async () => {
    await render(<NewTask />);
    expect(mockRedirect).toHaveBeenCalledWith('/');
    expect(screen.queryByLabelText('Tên công việc')).toBeNull();
  });

  it('task/new : le parent obtient le formulaire', async () => {
    mockRole = 'parent';
    await render(<NewTask />);
    expect(screen.getByLabelText('Tên công việc')).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('task/[id] : un enfant voit un détail en LECTURE SEULE (note comprise), sans champ ni bouton Lưu', async () => {
    await render(<TaskScreen />);
    expect(screen.getByText('Làm bài tập Toán')).toBeTruthy();
    expect(screen.getByText('Chương 3 trang 40')).toBeTruthy();
    expect(screen.getByText('Cần làm')).toBeTruthy();
    expect(screen.queryByLabelText('Tên công việc')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lưu' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Nhân bản/ })).toBeNull(); // « Dupliquer / Lặp lại » : parent uniquement (D-054)
  });

  it('task/[id] : le parent obtient le formulaire d’édition', async () => {
    mockRole = 'parent';
    await render(<TaskScreen />);
    expect(screen.getByLabelText('Tên công việc').props.value).toBe('Làm bài tập Toán');
    expect(screen.getByRole('button', { name: 'Nhân bản / Lặp lại' })).toBeTruthy();
  });
});
