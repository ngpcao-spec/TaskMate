import { QueryClient } from '@tanstack/react-query';
import { subscribeFamilyRealtime } from '@/sync/realtime';

type Handler = (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => void;
const mockHandlers: Record<string, Handler> = {};
let mockStatusCb: (s: string) => void = () => {};
const mockRemove = jest.fn();
type FakeChannel = { on: jest.Mock; subscribe: jest.Mock };
const mockChannel: FakeChannel = {
  on: jest.fn((_type: string, filter: { table: string; filter: string }, cb: Handler): FakeChannel => {
    mockHandlers[filter.table] = cb;
    return mockChannel;
  }),
  subscribe: jest.fn((cb: (s: string) => void): FakeChannel => {
    mockStatusCb = cb;
    return mockChannel;
  }),
};
jest.mock('@/api/supabase', () => ({
  supabase: { channel: jest.fn(() => mockChannel), removeChannel: (c: unknown) => mockRemove(c) },
}));

describe('subscribeFamilyRealtime', () => {
  let client: QueryClient;
  beforeEach(() => {
    jest.clearAllMocks();
    client = new QueryClient();
    jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
    jest.spyOn(client, 'resumePausedMutations').mockResolvedValue(undefined);
  });
  afterEach(() => client.clear());

  it('filtre chaque table sur la famille', () => {
    subscribeFamilyRealtime(client, 'fam-1');
    const filters = mockChannel.on.mock.calls.map((c: unknown[]) => (c[1] as { filter: string }).filter);
    expect(new Set(filters)).toEqual(new Set(['family_id=eq.fam-1']));
    expect(Object.keys(mockHandlers).sort()).toEqual(
      ['children', 'goals', 'point_transactions', 'reward_requests', 'rewards', 'tasks'],
    );
  });

  it('une tâche cochée par l’enfant invalide la liste de cet enfant chez le parent', () => {
    subscribeFamilyRealtime(client, 'fam-1');
    mockHandlers.tasks?.({ new: { id: 't1', child_id: 'c-minh', completed_at: 'x' }, old: {} });
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tasks', 'c-minh'] });
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['task', 't1'] });
  });

  it('un événement DELETE (new vide) utilise l’ancienne ligne', () => {
    subscribeFamilyRealtime(client, 'fam-1');
    mockHandlers.point_transactions?.({ new: {}, old: { child_id: 'c-minh' } });
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['balance', 'c-minh'] });
  });

  it('à la (re)connexion : relance la file d’écritures, et rattrape après une coupure', () => {
    subscribeFamilyRealtime(client, 'fam-1');
    mockStatusCb('SUBSCRIBED');
    expect(client.resumePausedMutations).toHaveBeenCalledTimes(1);
    expect(client.invalidateQueries).not.toHaveBeenCalled();
    mockStatusCb('CHANNEL_ERROR');
    mockStatusCb('SUBSCRIBED');
    expect(client.invalidateQueries).toHaveBeenCalledWith();
  });

  it('se désabonne proprement', () => {
    const off = subscribeFamilyRealtime(client, 'fam-1');
    off();
    expect(mockRemove).toHaveBeenCalledWith(mockChannel);
  });
});
