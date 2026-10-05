import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import '@/i18n';
import PointsScreen from '../app/(tabs)/more/points';
import type { ChildRow, RewardRequestRow, RewardRow } from '@/types/models';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));

const minh = { id: 'c-minh', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5' } as ChildRow;
const khang = { id: 'c-khang', name: 'Khang', birth_date: '2013-05-01', color: '#2EC4A6' } as ChildRow;
const reward = (id: string, title: string, cost: number) => ({ id, title, cost, icon: 'gift', child_id: null }) as RewardRow;
const farFuture = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
const pendingReq = { id: 'r1', child_id: 'c-minh', reward_title: 'Chơi game 1 tiếng', cost: 100, status: 'pending', created_at: new Date().toISOString(), expires_at: farFuture } as RewardRequestRow;

let mockDisplayed: unknown;
let mockBalance: unknown = { balance: 320, reserved: 100, available: 220, pendingTaskPoints: 30 };
let mockCounts = { tasks: 0, requests: 0, total: 0 };
let mockRequests: RewardRequestRow[] = [];
let mockOnline = true;
const mockRequest = jest.fn();
const mockApprove = jest.fn();
const mockReject = jest.fn();
jest.mock('@/hooks/useDisplayedChild', () => ({ useDisplayedChild: () => mockDisplayed }));
jest.mock('@/hooks/useApprovals', () => ({ useApprovalCounts: () => mockCounts }));
jest.mock('@/hooks/useSyncStatus', () => ({ useOnline: () => mockOnline }));
jest.mock('@/hooks/usePoints', () => ({
  useProjectedBalance: () => mockBalance,
  useRewards: () => ({ data: [reward('w1', 'Chơi game 1 tiếng', 100), reward('w2', 'Dùng điện thoại thêm 30 phút', 300)] }),
  useRequests: () => ({ data: mockRequests }),
  useRequestReward: () => ({ mutate: mockRequest }),
  useCancelRequest: () => ({ mutate: jest.fn() }),
  useApproveRequest: () => ({ mutate: mockApprove, isPending: false }),
  useRejectRequest: () => ({ mutate: mockReject }),
}));

const displayed = (role: 'child' | 'parent', child = minh) => ({
  me: { family: { timezone: 'Asia/Ho_Chi_Minh', id: 'f1' } },
  viewer: { role, memberId: 'm', childId: role === 'child' ? 'c-minh' : null },
  children: [minh, khang], child, select: jest.fn(),
});

describe('PointsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBalance = { balance: 320, reserved: 100, available: 220, pendingTaskPoints: 30 };
    mockCounts = { tasks: 0, requests: 0, total: 0 };
    mockRequests = [];
    mockOnline = true;
  });

  it('affiche le solde, le réservé et grise la récompense au-dessus du disponible', async () => {
    mockDisplayed = displayed('child');
    await render(<PointsScreen />);
    expect(screen.getByText(/320/)).toBeTruthy();
    expect(screen.getByText('trong đó 100 điểm đang chờ duyệt')).toBeTruthy();
    const ok = screen.getByRole('button', { name: 'Chơi game 1 tiếng, 100 điểm' });
    const ko = screen.getByRole('button', { name: /Dùng điện thoại thêm 30 phút, 300 điểm, chưa đủ điểm/ });
    expect(ok.props.accessibilityState).toMatchObject({ disabled: false });
    expect(ko.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('affiche « +30 điểm chờ duyệt » (tâches cochées non validées) en plus du réservé, hors du solde', async () => {
    mockDisplayed = displayed('child');
    await render(<PointsScreen />);
    expect(screen.getByText('+30 điểm chờ duyệt')).toBeTruthy();
    expect(screen.getByText('trong đó 100 điểm đang chờ duyệt')).toBeTruthy();
  });

  it('aucune ligne « chờ duyệt » quand rien n’est en attente', async () => {
    mockDisplayed = displayed('child');
    mockBalance = { balance: 320, reserved: 0, available: 320, pendingTaskPoints: 0 };
    await render(<PointsScreen />);
    expect(screen.queryByText(/chờ duyệt/)).toBeNull();
  });

  it('parent : accès à la file « Cần duyệt » avec le total', async () => {
    mockDisplayed = displayed('parent');
    mockCounts = { tasks: 2, requests: 1, total: 3 };
    await render(<PointsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Cần duyệt (3)' }));
    expect(mockPush).toHaveBeenCalledWith('/approvals');
  });

  it('l’enfant confirme puis envoie une demande (pas de débit côté client)', async () => {
    mockDisplayed = displayed('child');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
    await render(<PointsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Chơi game 1 tiếng, 100 điểm' }));
    expect(alert).toHaveBeenCalled();
    expect(mockRequest).toHaveBeenCalledWith('w1');
  });

  it('hors ligne : échange désactivé avec message', async () => {
    mockDisplayed = displayed('child');
    mockOnline = false;
    await render(<PointsScreen />);
    expect(screen.getByText('Cần kết nối mạng để đổi điểm')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chơi game 1 tiếng, 100 điểm' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('enfant (D-052) : aucun sélecteur ni nom d\'un autre enfant, même avec une liste polluée', async () => {
    await render(<PointsScreen />);
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByText(/Khang/)).toBeNull();
  });

  it('parent : sélecteur avec les prénoms des enfants', async () => {
    mockDisplayed = displayed('parent');
    await render(<PointsScreen />);
    expect(screen.getByRole('tab', { name: 'Minh, 17 tuổi' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Khang, 13 tuổi' })).toBeTruthy();
  });

  it('parent : file « Cần duyệt », approuve et refuse avec motif', async () => {
    mockDisplayed = displayed('parent');
    mockRequests = [pendingReq];
    await render(<PointsScreen />);
    expect(screen.getByText('Cần duyệt (1)')).toBeTruthy();
    expect(screen.getByText('Minh muốn đổi: Chơi game 1 tiếng (100 điểm)')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Lý do (tùy chọn)'), 'pas ce soir');
    await fireEvent.press(screen.getByRole('button', { name: 'Từ chối' }));
    expect(mockReject).toHaveBeenCalledWith({ id: 'r1', note: 'pas ce soir' });
    await fireEvent.press(screen.getByRole('button', { name: 'Duyệt' }));
    expect(mockApprove).toHaveBeenCalledWith('r1');
    expect(screen.getByRole('button', { name: 'Điều chỉnh điểm' })).toBeTruthy();
  });

  it('enfant : pas de file d’approbation ni d’ajustement', async () => {
    mockDisplayed = displayed('child');
    mockRequests = [pendingReq];
    await render(<PointsScreen />);
    expect(screen.queryByText(/Cần duyệt/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Điều chỉnh điểm' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Hủy yêu cầu' })).toBeTruthy();
  });
});
