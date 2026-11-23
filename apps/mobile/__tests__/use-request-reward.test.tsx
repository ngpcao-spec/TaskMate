import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import '@/i18n';
import { pointKeys, useRequestReward } from '@/hooks/usePoints';
import { useToastStore } from '@/store/toast';
import { createTestQueryClient } from '../test-utils/queryClient';
import type { RewardRequestRow } from '@/types/models';

const mockRequestReward = jest.fn();
jest.mock('@/api/points', () => ({
  ...jest.requireActual('@/api/points'),
  requestReward: (...args: unknown[]) => mockRequestReward(...args),
  fetchRequests: jest.fn(() => new Promise(() => undefined)),
  fetchBalance: jest.fn(() => new Promise(() => undefined)),
  fetchTransactions: jest.fn(() => new Promise(() => undefined)),
}));

const vars = { rewardId: 'w1', childId: 'c1', title: 'Kem', cost: 40, requestId: 'req-1' };

function setup() {
  const client = createTestQueryClient();
  client.setQueryData(pointKeys.requests('c1'), [] as RewardRequestRow[]);
  client.setQueryData(pointKeys.balance('c1'), { balance: 160, reserved: 0, available: 160, pendingTaskPoints: 0 });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe('useRequestReward (D-111) : la demande apparaît sans recharger', () => {
  beforeEach(() => {
    mockRequestReward.mockReset();
    useToastStore.setState({ toast: null });
  });

  it('ajout immédiat dans « Yêu cầu đổi thưởng » + points réservés, toast « Đã gửi cho bố mẹ »', async () => {
    let resolve: () => void = () => undefined;
    mockRequestReward.mockReturnValue(new Promise<void>((r) => (resolve = r)));
    const { client, wrapper } = setup();
    const { result } = await renderHook(() => useRequestReward(), { wrapper });
    await act(async () => result.current.mutate(vars));
    expect(mockRequestReward).toHaveBeenCalledWith('w1', 'req-1');
    const list = client.getQueryData<RewardRequestRow[]>(pointKeys.requests('c1'));
    expect(list).toEqual([expect.objectContaining({ id: 'req-1', reward_title: 'Kem', cost: 40, status: 'pending', child_id: 'c1' })]);
    expect(client.getQueryData(pointKeys.balance('c1'))).toMatchObject({ reserved: 40, available: 120 });
    await act(async () => resolve());
    expect(useToastStore.getState().toast?.message).toBe('Đã gửi cho bố mẹ');
  });

  it('refus du serveur : la demande et la réservation disparaissent, message d’erreur', async () => {
    mockRequestReward.mockRejectedValue({ message: 'insufficient_balance' });
    const { client, wrapper } = setup();
    const { result } = await renderHook(() => useRequestReward(), { wrapper });
    await act(async () => result.current.mutate(vars));
    expect(client.getQueryData<RewardRequestRow[]>(pointKeys.requests('c1'))).toEqual([]);
    expect(client.getQueryData(pointKeys.balance('c1'))).toMatchObject({ reserved: 0, available: 160 });
    expect(useToastStore.getState().toast?.tone).toBe('error');
  });
});
