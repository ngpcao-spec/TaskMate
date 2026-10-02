import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { useProjectedBalance } from '@/hooks/usePoints';
import { mutationKeys } from '@/sync/mutations';
import type { TaskRow } from '@/types/models';
import { createTestQueryClient } from '../test-utils/queryClient';

jest.mock('@/api/supabase', () => ({ supabase: {} }));
jest.mock('@/api/points', () => ({ ...jest.requireActual('@/api/points'), fetchBalance: jest.fn().mockResolvedValue({ balance: 300, reserved: 100, available: 200, pendingTaskPoints: 30 }) }));

const task = { id: 't1', child_id: 'c1', points: 10, completed_at: null, validated_at: null } as TaskRow;

async function setup(role: 'parent' | 'child', mutations: { key: readonly string[]; variables: unknown }[]) {
  const client = createTestQueryClient({ defaultOptions: { mutations: { networkMode: 'always' } } });
  for (const m of mutations) {
    const built = client.getMutationCache().build(client, { mutationKey: m.key, mutationFn: () => new Promise(() => undefined) });
    void built.execute(m.variables).catch(() => undefined);
  }
  const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = await renderHook(() => useProjectedBalance('c1', role), { wrapper: Wrapper });
  return { client, ...hook };
}

describe('useProjectedBalance (SPEC v4 §5.2)', () => {
  it('ENFANT : le solde ne monte jamais de façon optimiste, même avec une coche et une validation en file', async () => {
    const { result, client } = await setup('child', [{ key: mutationKeys.toggleTask, variables: { task, completed: true, txId: 'x', asParent: false } }]);
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current).toEqual({ balance: 300, reserved: 100, available: 200, pendingTaskPoints: 30 });
    client.clear();
  });

  it('PARENT : la validation en file projette +points ; une coche enfant ne projette rien', async () => {
    const pending = { ...task, completed_at: 'x' } as TaskRow;
    const { result, client } = await setup('parent', [
      { key: mutationKeys.validateTask, variables: { task: pending, txId: 'v' } },
      { key: mutationKeys.toggleTask, variables: { task, completed: true, txId: 'c', asParent: false } },
    ]);
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current).toMatchObject({ balance: 310, available: 210, reserved: 100 });
    client.clear();
  });

  it('PARENT : une coche parent (validée d’office) projette +points, la décoche d’une validée −points', async () => {
    const validated = { ...task, completed_at: 'x', validated_at: 'y' } as TaskRow;
    const { result, client } = await setup('parent', [
      { key: mutationKeys.toggleTask, variables: { task, completed: true, txId: 'a', asParent: true } },
      { key: mutationKeys.toggleTask, variables: { task: validated, completed: false, txId: 'b', asParent: true } },
    ]);
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current).toMatchObject({ balance: 300 }); // +10 −10
    client.clear();
  });
});
