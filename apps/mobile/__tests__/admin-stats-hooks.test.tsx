import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { ADMIN_STATS_STALE_MS, useAdminOverview, useRefreshAdminStats } from '@/hooks/useAdminStats';
import { createTestQueryClient } from '../test-utils/queryClient';

const mockOverview = jest.fn();
jest.mock('@/api/adminStats', () => ({
  fetchAdminOverview: () => mockOverview(),
  fetchAdminSeries: jest.fn(),
  fetchAdminUsage: jest.fn(),
  fetchAdminHealth: jest.fn(),
  fetchAdminFamilies: jest.fn(),
  fetchAdminFamily: jest.fn(),
}));

const raw = (families: number) => ({ families, parents: 0, children: 0, newFamilies7d: 0, newFamilies30d: 0, active: { today: { parents: 0, children: 0 }, d7: { parents: 0, children: 0 }, d30: { parents: 0, children: 0 } }, familiesWithNotifications: 0 });
function Probe() {
  const q = useAdminOverview();
  const r = useRefreshAdminStats();
  return (
    <>
      <Text>{q.isError ? 'erreur' : q.data ? `familles:${q.data.families}` : 'chargement'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="actualiser" onPress={r.refresh}>
        <Text>{r.busy ? 'occupé' : 'libre'}</Text>
      </Pressable>
    </>
  );
}

afterEach(() => jest.clearAllMocks());

describe('lecture mise en cache 5 minutes (D-102)', () => {
  it('la durée de fraîcheur est de 5 minutes', () => {
    expect(ADMIN_STATS_STALE_MS).toBe(300_000);
  });
  it('un second affichage réutilise le cache ; « Actualiser » relit', async () => {
    mockOverview.mockResolvedValueOnce(raw(2)).mockResolvedValueOnce(raw(3));
    const client = createTestQueryClient();
    const tree = (
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>
    );
    const first = await render(tree);
    await waitFor(() => expect(screen.getByText('familles:2')).toBeTruthy());
    await first.unmount();
    await render(tree);
    expect(screen.getByText('familles:2')).toBeTruthy();
    expect(mockOverview).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'actualiser' }));
    await waitFor(() => expect(screen.getByText('familles:3')).toBeTruthy());
    expect(mockOverview).toHaveBeenCalledTimes(2);
    client.clear();
  });
  it('une erreur n’est pas relancée automatiquement (droits refusés)', async () => {
    mockOverview.mockRejectedValue(new Error('forbidden'));
    const client = createTestQueryClient();
    await render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText('erreur')).toBeTruthy());
    expect(mockOverview).toHaveBeenCalledTimes(1);
    client.clear();
  });
});
