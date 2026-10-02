import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import '@/i18n';
import ApprovalsScreen from '../app/approvals';
import type { ChildRow, RewardRequestRow, TaskRow } from '@/types/models';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));

const minh = { id: 'c-minh', name: 'Minh', birth_date: '2009-03-01' } as ChildRow;
const khang = { id: 'c-khang', name: 'Khang', birth_date: '2013-05-01' } as ChildRow;
const task = (id: string, child: string, title: string, date: string, points = 10): TaskRow =>
  ({ id, child_id: child, title, date, points, completed_at: `${date}T09:30:00Z`, validated_at: null }) as TaskRow;
const request = { id: 'r1', child_id: 'c-khang', reward_title: 'Chơi game 1 tiếng', cost: 100, status: 'pending', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 5 * 864e5).toISOString() } as RewardRequestRow;

let mockRole: 'parent' | 'child' = 'parent';
let mockPending: TaskRow[] = [];
let mockRequests: RewardRequestRow[] = [];
const mockValidate = jest.fn();
const mockReject = jest.fn();
const mockApprove = jest.fn();
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({
    me: { family: { timezone: 'Asia/Ho_Chi_Minh' } }, viewer: { role: mockRole }, children: [minh, khang], child: minh, readOnly: false, select: jest.fn(),
  }),
}));
jest.mock('@/hooks/useApprovals', () => ({ useApprovalCounts: () => ({ tasks: mockPending.length, requests: mockRequests.length, total: mockPending.length + mockRequests.length }) }));
jest.mock('@/hooks/useSyncStatus', () => ({ useOnline: () => true }));
jest.mock('@/hooks/usePoints', () => ({
  useRequests: () => ({ data: mockRequests }),
  useApproveRequest: () => ({ mutate: mockApprove, isPending: false }),
  useRejectRequest: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/hooks/useTasks', () => ({
  usePendingTasks: () => ({ data: mockPending }),
  useValidateTask: () => ({ mutate: mockValidate }),
  useRejectTask: () => ({ mutate: mockReject }),
  validateVars: (t: TaskRow) => ({ task: t, txId: 'tx-' + t.id }),
}));

describe('ApprovalsScreen — file « Cần duyệt » (§3.10)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole = 'parent';
    mockRequests = [];
    mockPending = [task('a', 'c-khang', 'Dọn phòng', '2026-07-02', 5), task('b', 'c-minh', 'Học Toán', '2026-07-02'), task('c', 'c-minh', 'Đọc sách', '2026-06-30', 20)];
  });

  it('onglets avec compteurs ; tâches groupées par enfant puis par jour (plus anciennes d’abord)', async () => {
    await render(<ApprovalsScreen />);
    expect(screen.getByRole('radio', { name: 'Việc (3)' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Phần thưởng (0)' })).toBeTruthy();
    const headers = screen.getAllByRole('header').map((h) => h.props.children).flat().join('|');
    expect(headers).toContain('Minh');
    expect(headers.indexOf('Minh')).toBeLessThan(headers.indexOf('Khang'));
    const titles = screen.getAllByText(/Đọc sách|Học Toán|Dọn phòng/).map((n) => n.props.children);
    expect(titles).toEqual(['Đọc sách', 'Học Toán', 'Dọn phòng']); // Minh (30/6 puis 2/7), puis Khang
  });

  it('Duyệt valide une tâche avec un tx_id propre à l’action', async () => {
    await render(<ApprovalsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Duyệt Học Toán' }));
    expect(mockValidate).toHaveBeenCalledWith({ task: expect.objectContaining({ id: 'b' }), txId: 'tx-b' });
  });

  it('Từ chối envoie le motif saisi', async () => {
    await render(<ApprovalsScreen />);
    await fireEvent.changeText(screen.getByLabelText('Lý do (tùy chọn) — Học Toán'), 'pas fait');
    await fireEvent.press(screen.getByRole('button', { name: 'Từ chối Học Toán' }));
    expect(mockReject).toHaveBeenCalledWith({ task: expect.objectContaining({ id: 'b' }), note: 'pas fait' });
  });

  it('« Duyệt tất cả » : une confirmation, puis valide toutes les tâches de CET enfant uniquement', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => void buttons?.[1]?.onPress?.());
    await render(<ApprovalsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Duyệt tất cả Minh' }));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0]?.[1]).toBe('Duyệt 2 việc của Minh (+30 điểm)?');
    expect(mockValidate.mock.calls.map((c) => (c[0] as { task: TaskRow }).task.id).sort()).toEqual(['b', 'c']);
  });

  it('annuler la confirmation ne valide rien', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<ApprovalsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Duyệt tất cả Khang' }));
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it('onglet Récompenses : demandes d’échange en attente, approbation', async () => {
    mockRequests = [request];
    await render(<ApprovalsScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Phần thưởng (1)' }));
    expect(screen.getByText('Khang muốn đổi: Chơi game 1 tiếng (100 điểm)')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Duyệt' }));
    expect(mockApprove).toHaveBeenCalledWith('r1');
  });

  it('états vides', async () => {
    mockPending = [];
    await render(<ApprovalsScreen />);
    expect(screen.getByText('Không có việc nào chờ duyệt')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Phần thưởng (0)' }));
    expect(screen.getByText('Không có yêu cầu đổi thưởng nào')).toBeTruthy();
  });

  it('inaccessible à un enfant', async () => {
    mockRole = 'child';
    await render(<ApprovalsScreen />);
    expect(screen.queryByText('Cần duyệt')).toBeNull();
  });
});
