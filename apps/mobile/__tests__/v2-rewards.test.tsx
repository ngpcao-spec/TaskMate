import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import '@/i18n';
import V2ChildRewards from '../app/(v2)/v2/child/rewards';
import { useConfirmStore } from '@/store/confirm';
import type { ChildRow, RewardRequestRow, RewardRow } from '@/types/models';
import { V2ConfirmHost } from '@/v2/components/V2ConfirmHost';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/v2/components/V2Screen', () => ({ V2Screen: ({ children }: { children: React.ReactNode }) => children }));

const young = { id: 'c-an', name: 'An', birth_date: '2018-03-01' } as ChildRow; // 8 ans : tớ / cậu
const teen = { id: 'c-tien', name: 'Tiên', birth_date: '2013-05-01' } as ChildRow; // 13 ans : mình / bạn
const reward = (id: string, title: string, cost: number) => ({ id, title, cost, icon: 'gift', child_id: null }) as RewardRow;
const farFuture = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
const pendingReq = (childId: string) =>
  ({ id: 'r1', child_id: childId, reward_title: 'Kem', cost: 40, status: 'pending', created_at: new Date().toISOString(), expires_at: farFuture }) as RewardRequestRow;

let mockDisplayed: unknown;
let mockBalance: unknown;
let mockRequests: RewardRequestRow[] = [];
const mockRequest = jest.fn();
const mockCancel = jest.fn();
jest.mock('@/hooks/useDisplayedChild', () => ({ useDisplayedChild: () => mockDisplayed }));
jest.mock('@/hooks/useSyncStatus', () => ({ useOnline: () => true }));
jest.mock('@/hooks/usePoints', () => ({
  useProjectedBalance: () => mockBalance,
  useRewards: () => ({ data: [reward('w1', 'Kem', 40), reward('w2', 'Xem phim', 300)] }),
  useRequests: () => ({ data: mockRequests }),
  useRequestReward: () => ({ mutate: mockRequest }),
  useCancelRequest: () => ({ mutate: mockCancel }),
}));

const displayed = (child: ChildRow) => ({
  me: { family: { timezone: 'Asia/Ho_Chi_Minh', id: 'f1' } },
  viewer: { role: 'child', memberId: 'm', childId: child.id },
  children: [child],
  child,
  select: jest.fn(),
});

async function renderScreen() {
  await render(
    <>
      <V2ChildRewards />
      <V2ConfirmHost enabled />
    </>,
  );
}

describe('Phần thưởng (V2) : échange par ConfirmSheet (D-111)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDisplayed = displayed(young);
    // disponible = solde − demandes en attente (serveur)
    mockBalance = { balance: 160, reserved: 40, available: 120, pendingTaskPoints: 0 };
    mockRequests = [];
  });
  afterEach(() => act(() => useConfirmStore.setState({ enabled: false, request: null })));

  it('ouvre la feuille : cadeau, titre, récompense + coût, « Hiện có X → Còn lại Y » sur le DISPONIBLE, note ; « Gửi cho bố mẹ » envoie', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    await renderScreen();
    await fireEvent.press(screen.getByTestId('v2-reward-w1'));
    expect(alert).not.toHaveBeenCalled();
    expect(screen.getByText('Đổi phần thưởng này?')).toBeTruthy();
    expect(screen.getByTestId('reward-confirm-balance').props.children).toBe('Hiện có 120 → Còn lại 80');
    expect(screen.getByText('Bố mẹ sẽ duyệt yêu cầu này')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Để sau' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi cho bố mẹ' }));
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ rewardId: 'w1', childId: 'c-an', title: 'Kem', cost: 40 }));
    expect(screen.queryByTestId('reward-confirm')).toBeNull();
  });

  it('le grand nombre est le solde DISPONIBLE : une demande en attente en est retirée, la réserve est dite à part (D-112)', async () => {
    await renderScreen();
    expect(screen.getByTestId('v2-rewards-available').props.accessibilityLabel).toBe('120 điểm');
    expect(screen.getByText('Điểm có thể dùng')).toBeTruthy();
    expect(screen.getByText('40 điểm đang chờ bố mẹ duyệt đổi thưởng')).toBeTruthy();
  });

  it('rien en attente : pas de ligne de réserve', async () => {
    mockBalance = { balance: 160, reserved: 0, available: 160, pendingTaskPoints: 0 };
    await renderScreen();
    expect(screen.getByTestId('v2-rewards-available').props.accessibilityLabel).toBe('160 điểm');
    expect(screen.queryByText(/đang chờ bố mẹ duyệt đổi thưởng/)).toBeNull();
  });

  it('« Để sau » ferme sans rien envoyer', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByTestId('v2-reward-w1'));
    await fireEvent.press(screen.getByRole('button', { name: 'Để sau' }));
    expect(mockRequest).not.toHaveBeenCalled();
    expect(screen.queryByTestId('reward-confirm')).toBeNull();
  });

  it('points insuffisants : « còn thiếu N điểm » et un seul bouton « Đóng »', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByTestId('v2-reward-w2'));
    expect(screen.getByText('Chưa đủ điểm — còn thiếu 180 điểm')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gửi cho bố mẹ' })).toBeNull();
    expect(screen.queryByTestId('reward-confirm-balance')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByTestId('reward-confirm')).toBeNull();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('« Hủy yêu cầu » demande confirmation dans la feuille, avec tớ/cậu pour un petit', async () => {
    mockRequests = [pendingReq('c-an')];
    await renderScreen();
    await fireEvent.press(screen.getByTestId('v2-cancel-request-r1'));
    expect(screen.getByText('Hủy yêu cầu này?')).toBeTruthy();
    expect(screen.getByText('Cậu muốn hủy yêu cầu đổi “Kem”? 40 điểm sẽ trở lại với cậu nhé.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Giữ lại' }));
    expect(mockCancel).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('v2-cancel-request-r1'));
    await act(async () => fireEvent.press(screen.getByTestId('v2-confirm-ok')));
    expect(mockCancel).toHaveBeenCalledWith('r1');
  });

  it('mình/bạn pour un grand', async () => {
    mockDisplayed = displayed(teen);
    mockRequests = [pendingReq('c-tien')];
    await renderScreen();
    await fireEvent.press(screen.getByTestId('v2-cancel-request-r1'));
    expect(screen.getByText('Bạn muốn hủy yêu cầu đổi “Kem”? 40 điểm sẽ trở lại với bạn.')).toBeTruthy();
  });
});
