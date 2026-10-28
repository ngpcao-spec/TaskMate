import { fetchAdminFamilies, fetchAdminFamily, fetchAdminHealth, fetchAdminOverview, fetchAdminSeries, fetchAdminUsage } from '@/api/adminStats';
import { touchActivity } from '@/api/activity';

const mockRpc = jest.fn();
jest.mock('@/api/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));

afterEach(() => jest.clearAllMocks());

const counters = { tasks_created: 0, tasks_generated: 0, tasks_completed: 0, tasks_validated: 0, quizzes_submitted: 0, quizzes_validated: 0, reward_requests: 0, ai_calls: 0, ai_failed: 0, avatar_calls: 0, avatar_failed: 0 };
const zero = { parents: 0, children: 0 };

describe('API du suivi des utilisateurs : uniquement des RPC en lecture', () => {
  it('chaque lecture appelle sa RPC et valide la réponse', async () => {
    mockRpc.mockResolvedValueOnce({ data: { families: 1, parents: 1, children: 0, new_families_7d: 0, new_families_30d: 0, active: { today: zero, d7: zero, d30: zero }, families_with_notifications: 0 }, error: null });
    expect((await fetchAdminOverview()).families).toBe(1);
    expect(mockRpc).toHaveBeenLastCalledWith('admin_stats_overview');
    mockRpc.mockResolvedValueOnce({ data: { weeks: [], days: [] }, error: null });
    expect(await fetchAdminSeries()).toEqual({ weeks: [], days: [] });
    expect(mockRpc).toHaveBeenLastCalledWith('admin_stats_series');
    mockRpc.mockResolvedValueOnce({ data: { d7: counters, d30: counters, quiz_by_class: [], ai_by_model: [] }, error: null });
    expect((await fetchAdminUsage()).quizByClass).toEqual([]);
    expect(mockRpc).toHaveBeenLastCalledWith('admin_stats_usage');
    mockRpc.mockResolvedValueOnce({ data: { db_size_bytes: 1, active_devices: 0, cron: null }, error: null });
    expect((await fetchAdminHealth()).dbSizeBytes).toBe(1);
    expect(mockRpc).toHaveBeenLastCalledWith('admin_health');
  });
  it('la liste envoie recherche, tri, sens et page tels quels (la base valide la liste de tris)', async () => {
    mockRpc.mockResolvedValueOnce({ data: { total: 0, page: 2, page_size: 50, rows: [] }, error: null });
    const page = await fetchAdminFamilies('ba@', 'name', 'asc', 2);
    expect(mockRpc).toHaveBeenLastCalledWith('admin_families', { p_search: 'ba@', p_sort: 'name', p_dir: 'asc', p_page: 2 });
    expect(page).toEqual({ total: 0, page: 2, pageSize: 50, rows: [] });
  });
  it('la fiche passe l’identifiant de famille', async () => {
    mockRpc.mockResolvedValueOnce({ data: { family_id: 'f', name: 'A', creator_email: null, countries: [], parents: 1, children: 0, classes: [], created_at: '2026-10-01T00:00:00Z', last_active_at: null, status: 'dormant', notifications: false, active_devices: 0, usage_30d: counters }, error: null });
    expect((await fetchAdminFamily('f')).familyId).toBe('f');
    expect(mockRpc).toHaveBeenLastCalledWith('admin_family_detail', { p_family: 'f' });
  });
  it('une erreur de la base (refus, réseau) remonte telle quelle', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } });
    await expect(fetchAdminOverview()).rejects.toMatchObject({ message: 'forbidden' });
    await expect(fetchAdminSeries()).rejects.toMatchObject({ message: 'forbidden' });
    await expect(fetchAdminUsage()).rejects.toMatchObject({ message: 'forbidden' });
    await expect(fetchAdminHealth()).rejects.toMatchObject({ message: 'forbidden' });
    await expect(fetchAdminFamilies('', 'name', 'asc', 1)).rejects.toMatchObject({ message: 'forbidden' });
    await expect(fetchAdminFamily('f')).rejects.toMatchObject({ message: 'forbidden' });
  });
  it('une réponse invalide est rejetée (jamais affichée à moitié)', async () => {
    mockRpc.mockResolvedValueOnce({ data: { families: 'beaucoup' }, error: null });
    await expect(fetchAdminOverview()).rejects.toThrow('invalid_stats');
  });
  it('touch_activity : appelle la RPC, remonte l’erreur', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    await touchActivity();
    expect(mockRpc).toHaveBeenLastCalledWith('touch_activity');
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
    await expect(touchActivity()).rejects.toMatchObject({ message: 'offline' });
  });
});
