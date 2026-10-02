import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import '@/i18n';
import { TaskForm } from '@/components/TaskForm';
import type { ChildRow, TaskRow } from '@/types/models';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null }));

const minh = { id: 'c-minh', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5' } as ChildRow;
const khang = { id: 'c-khang', name: 'Khang', birth_date: '2013-05-01', color: '#2EC4A6' } as ChildRow;
let mockRole: 'parent' | 'child' = 'parent';
const mockCreate = jest.fn();
const mockSeries = jest.fn();
const mockUpdateSeries = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({
    me: { family: { timezone: 'Asia/Ho_Chi_Minh', id: 'f1' }, member: { id: 'm-p' } },
    viewer: { role: mockRole, memberId: mockRole === 'parent' ? 'm-p' : 'm-minh', childId: mockRole === 'child' ? 'c-minh' : null },
    children: [minh, khang], child: minh, readOnly: false, select: jest.fn(),
  }),
}));
jest.mock('@/hooks/useTasks', () => ({
  useCreateTasks: () => ({ mutate: mockCreate, isPending: false }),
  useUpdateTask: () => ({ mutate: mockUpdate, isPending: false }),
  useDeleteTask: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock('@/hooks/useRecurrences', () => ({
  useCreateRecurrences: () => ({ mutate: mockSeries, isPending: false }),
  useUpdateRecurrence: () => ({ mutate: mockUpdateSeries, isPending: false }),
  useDeleteRecurrence: () => ({ mutate: jest.fn(), isPending: false }),
}));

describe('TaskForm', () => {
  beforeEach(() => { jest.clearAllMocks(); mockRole = 'parent'; });

  it('Lưu désactivé tant que le titre est vide, puis crée la tâche (hors ligne : file optimiste)', async () => {
    await render(<TaskForm />);
    expect(screen.getByRole('button', { name: 'Lưu' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.changeText(screen.getByLabelText('Tên công việc'), 'Làm bài tập Toán');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu' }).props.accessibilityState).toMatchObject({ disabled: false }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const vars = mockCreate.mock.calls[0]?.[0] as { tasks: { title: string; child_id: string; points: number }[] };
    expect(vars.tasks[0]).toMatchObject({ title: 'Làm bài tập Toán', child_id: 'c-minh', points: 10 });
    expect(mockBack).toHaveBeenCalled();
    expect(mockSeries).not.toHaveBeenCalled();
  });

  it('parent : répétition « jours choisis » → une récurrence par enfant, jours triés', async () => {
    await render(<TaskForm />);
    await fireEvent.changeText(screen.getByLabelText('Tên công việc'), 'Dọn phòng');
    await fireEvent.press(screen.getByRole('button', { name: 'Thêm tùy chọn' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Các ngày chọn' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'T5' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'T2' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Khang' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu' }).props.accessibilityState).toMatchObject({ disabled: false }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(mockSeries).toHaveBeenCalledTimes(1));
    const { rows } = mockSeries.mock.calls[0]?.[0] as { rows: { child_id: string; rule: string; weekdays: number[] }[] };
    expect(rows.map((r) => r.child_id).sort()).toEqual(['c-khang', 'c-minh']);
    expect(rows[0]).toMatchObject({ rule: 'weekdays', weekdays: [1, 4] });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('« jours choisis » sans jour : enregistrement impossible', async () => {
    await render(<TaskForm />);
    await fireEvent.changeText(screen.getByLabelText('Tên công việc'), 'X');
    await fireEvent.press(screen.getByRole('button', { name: 'Thêm tùy chọn' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Các ngày chọn' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu' }).props.accessibilityState).toMatchObject({ disabled: true }));
  });

  it('occurrence d’une série : « appliquer à la série » met à jour la récurrence', async () => {
    const task = { id: 't1', child_id: 'c-minh', title: 'Bài tập', category: 'study', note: null, date: '2026-07-02', time_kind: 'anytime', start_time: null, end_time: null, points: 10, recurrence_id: 'rec1', created_by: 'm-p' } as TaskRow;
    await render(<TaskForm task={task} />);
    await fireEvent(screen.getByLabelText('Áp dụng cho các việc sắp tới trong chuỗi'), 'valueChange', true);
    await fireEvent.changeText(screen.getByLabelText('Tên công việc'), 'Bài tập mới');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu' }).props.accessibilityState).toMatchObject({ disabled: false }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(mockUpdateSeries).toHaveBeenCalledTimes(1));
    expect(mockUpdateSeries.mock.calls[0]?.[0]).toMatchObject({ id: 'rec1', patch: { title: 'Bài tập mới' } });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
