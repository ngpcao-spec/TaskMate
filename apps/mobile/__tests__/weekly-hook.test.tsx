import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createTestQueryClient } from '../test-utils/queryClient';
import { useWeeklyQuizzes } from '@/hooks/useWeeklyQuizzes';

let mockRole: 'parent' | 'child' = 'child';
const minh = { id: 'c-minh', name: 'Minh' };
const khang = { id: 'c-khang', name: 'Khang' };
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({
    viewer: { role: mockRole },
    // liste volontairement polluée : l'enfant ne doit jamais déclencher la lecture de l'autre
    children: [minh, khang],
    child: minh,
  }),
}));
const mockOwn = jest.fn();
jest.mock('@/hooks/useQuizzes', () => ({ useChildQuizSets: (enabled: boolean) => ({ data: enabled ? mockOwn() : undefined, isPending: false }) }));
const mockParent = jest.fn();
jest.mock('@/api/catalog', () => ({ fetchParentCatalog: (id: string) => mockParent(id) }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));

const own = (o: Record<string, unknown> = {}) => ({
  source: 'catalog', set_id: 'q1', subject_key: 'maths', title: 'Phân số', week_label: 'Tuần 1', question_count: 16, evaluation_attempt_id: null, evaluation_status: null,
  due_on: '2026-10-25', release_on: '2026-10-19', answered_count: 0, score: null, total: null, ...o,
});
const overview = (o: Record<string, unknown> = {}) => ({
  quiz_id: 'q1', subject: 'maths', week_label: 'Tuần 1', title: 'Phân số', question_count: 16, release_on: '2026-10-19', due_on: '2026-10-25', available: true,
  attempt_id: null, attempt_status: null, answered_count: 0, score: null, total: null, ...o,
});

const clients: QueryClient[] = [];
async function setup(today = '2026-10-21', windowed = true) {
  const client = createTestQueryClient();
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useWeeklyQuizzes(today, windowed), { wrapper });
}
afterEach(() => { clients.splice(0).forEach((c) => c.clear()); jest.clearAllMocks(); });

describe('useWeeklyQuizzes (D-083)', () => {
  it('enfant : SON groupe seulement, quiz du catalogue seulement, aucune lecture « parent »', async () => {
    mockRole = 'child';
    mockOwn.mockReturnValue([own(), own({ source: 'family', set_id: 'f1' })]);
    const { result } = await setup();
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0]).toMatchObject({ childId: 'c-minh', childName: 'Minh' });
    expect(result.current.groups[0]?.items.map((i) => i.quizId)).toEqual(['q1']);
    expect(mockParent).not.toHaveBeenCalled();
  });

  it('enfant : un quiz pas encore ouvert ou clos n’apparaît pas', async () => {
    mockRole = 'child';
    mockOwn.mockReturnValue([own({ set_id: 'future', release_on: '2026-10-26', due_on: '2026-11-01' }), own({ set_id: 'old', release_on: '2026-09-01', due_on: '2026-09-06' })]);
    const { result } = await setup();
    expect(result.current.groups[0]?.items).toEqual([]);
  });

  it('parent : un groupe par enfant, dans l’ordre de la liste, chacun avec SON aperçu', async () => {
    mockRole = 'parent';
    mockParent.mockImplementation(async (id: string) => (id === 'c-minh' ? [overview({ attempt_id: 'a1', attempt_status: 'submitted' })] : [overview({ quiz_id: 'q2', title: 'Từ vựng', available: false }), overview({ quiz_id: 'q3', title: 'Unit 3' })]));
    const { result } = await setup();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.groups.map((g) => g.childName)).toEqual(['Minh', 'Khang']);
    expect(result.current.groups[0]?.items[0]).toMatchObject({ quizId: 'q1', state: 'waiting', attemptId: 'a1' });
    expect(result.current.groups[1]?.items.map((i) => i.quizId)).toEqual(['q3']);
    expect(mockParent).toHaveBeenCalledWith('c-minh');
    expect(mockParent).toHaveBeenCalledWith('c-khang');
  });

  it('parent : sans fenêtre d’affichage (calendrier), un quiz clos reste repérable', async () => {
    mockRole = 'parent';
    mockParent.mockResolvedValue([overview()]);
    const { result } = await setup('2026-12-01', false);
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.groups[0]?.items).toHaveLength(1);
  });

  it('parent : une erreur de lecture n’affiche rien et ne casse pas l’écran', async () => {
    mockRole = 'parent';
    mockParent.mockRejectedValue(new Error('réseau'));
    const { result } = await setup();
    await waitFor(() => expect(result.current.groups.length).toBe(2));
    expect(result.current.groups.every((g) => g.items.length === 0)).toBe(true);
  });
});
