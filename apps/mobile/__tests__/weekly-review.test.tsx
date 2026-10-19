import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createTestQueryClient } from '../test-utils/queryClient';
import '@/i18n';
import { WeeklyReview } from '@/components/quiz/WeeklyReview';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: () => true, replace: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
// Mercredi 21/10/2026, 10 h à Hô Chi Minh : semaine courante = lundi 19/10 → dimanche 25/10.
let mockNow = new Date('2026-10-21T03:00:00Z');
jest.mock('@/hooks/useNow', () => ({ useNow: () => mockNow }));

let mockRole: 'parent' | 'child' = 'child';
const minh = { id: 'c-minh', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5' };
const khang = { id: 'c-khang', name: 'Khang', birth_date: '2013-05-01', color: '#2EC4A6' };
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({
    me: { family: { timezone: 'Asia/Ho_Chi_Minh' } },
    viewer: { role: mockRole, memberId: 'm', childId: mockRole === 'child' ? 'c-minh' : null },
    // liste volontairement polluée : un enfant ne doit jamais lire l'autre
    children: [minh, khang],
    child: minh,
    select: jest.fn(),
  }),
}));

type Row = Record<string, unknown>;
const mockChildRows = jest.fn();
jest.mock('@/api/quizzes', () => ({ ...jest.requireActual('@/api/quizzes'), fetchChildQuizSets: () => mockChildRows() }));
const mockParentRows = jest.fn();
const mockUpcoming = jest.fn(async (_id: string | null): Promise<Row[]> => []);
jest.mock('@/api/catalog', () => ({ ...jest.requireActual('@/api/catalog'), fetchParentCatalog: (id: string) => mockParentRows(id), fetchCatalogUpcoming: (id: string | null) => mockUpcoming(id) }));

const childRow = (over: Row = {}): Row => ({
  source: 'catalog', set_id: 'q1', subject_key: 'maths', title: 'Bài 4', week_label: 'Tuần 8', subject: null, question_count: 16, evaluation_attempt_id: null, evaluation_status: null,
  can_start_evaluation: true, paper_support: false, answer_sheet_only: false, due_on: '2026-10-23', answered_count: 0, release_on: '2026-10-19', score: null, total: null,
  max_points: 8, points_awarded: 0, ...over,
});
const parentRow = (over: Row = {}): Row => ({
  quiz_id: 'q1', subject: 'maths', week_label: 'Tuần 8', title: 'Bài 4', question_count: 16, release_on: '2026-10-19', due_on: '2026-10-23', available: true, attempt_id: null,
  attempt_status: null, answered_count: 0, score: null, total: null, max_points: 8, points_awarded: 0, ...over,
});

const clients: QueryClient[] = [];
async function show(props: { childId?: string | null } = {}) {
  const client = createTestQueryClient();
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <WeeklyReview {...props} />
    </QueryClientProvider>,
  );
}
afterEach(() => { clients.splice(0).forEach((c) => c.clear()); jest.clearAllMocks(); mockRole = 'child'; mockNow = new Date('2026-10-21T03:00:00Z'); });

const fourStates = [
  childRow({ set_id: 'qv', subject_key: 'hist_geo', title: 'Bài 2', evaluation_attempt_id: 'av', evaluation_status: 'validated', score: 12, total: 16, points_awarded: 5, due_on: '2026-10-20' }),
  childRow({ set_id: 'qw', subject_key: 'anglais', title: 'Unit 5', evaluation_attempt_id: 'aw', evaluation_status: 'submitted', due_on: '2026-10-22' }),
  childRow({ set_id: 'qt', subject_key: 'francais', title: 'Bài 3', due_on: '2026-10-25' }),
  childRow({ set_id: 'qp', subject_key: 'maths', title: 'Bài 4', evaluation_attempt_id: 'ap', evaluation_status: 'in_progress', answered_count: 6, due_on: '2026-10-23' }),
];

describe('Écran Ôn tập — enfant (D-084)', () => {
  it('quatre états : chưa làm → Bắt đầu, đang làm → Tiếp tục, đợi duyệt → aucun bouton, đã duyệt → Xem kết quả + points + score', async () => {
    mockChildRows.mockResolvedValue(fourStates);
    await show();
    await screen.findByText('Bài 4');
    expect(screen.getByText('Chưa làm')).toBeTruthy();
    expect(screen.getByText('Đang làm 6/16')).toBeTruthy();
    expect(screen.getByText('Đợi phụ huynh duyệt')).toBeTruthy();
    expect(screen.getByText('Đã duyệt · +5 điểm')).toBeTruthy();
    expect(screen.getByText('Điểm: 12/16')).toBeTruthy();
    // « tối đa N điểm » (N = barème du SERVEUR) seulement sur ce qui reste à faire
    expect(screen.getAllByText(/tối đa 8 điểm/)).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /Bắt đầu/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Tiếp tục/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Xem kết quả/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Duyệt|Xem bài làm/ })).toBeNull();
  });

  it('en-tête : numéro, dates lundi → dimanche, k/n ; tri : à faire par échéance, puis en attente, puis validées', async () => {
    mockChildRows.mockResolvedValue(fourStates);
    await show();
    await screen.findByText('Tuần 8');
    expect(screen.getByText('19/10 – 25/10 · 1/4 môn xong')).toBeTruthy();
    const titles = screen.getAllByText(/^(Bài 4|Bài 3|Unit 5|Bài 2)$/).map((n) => n.props.children);
    expect(titles).toEqual(['Bài 4', 'Bài 3', 'Unit 5', 'Bài 2']);
  });

  it('boutons : Bắt đầu / Tiếp tục → l’évaluation, Xem kết quả → le résultat de SA tentative', async () => {
    mockChildRows.mockResolvedValue(fourStates);
    await show();
    await screen.findByText('Tuần 8');
    await fireEvent.press(screen.getByRole('button', { name: /Bắt đầu/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quiz/evaluate/[id]', params: { id: 'qt' } });
    await fireEvent.press(screen.getByRole('button', { name: /Tiếp tục/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quiz/evaluate/[id]', params: { id: 'qp' } });
    await fireEvent.press(screen.getByRole('button', { name: /Xem kết quả/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quiz/result/[id]', params: { id: 'av' } });
  });

  it('échéance dans 2 jours ou moins : en rouge ; plus loin : couleur normale', async () => {
    mockChildRows.mockResolvedValue([childRow({ set_id: 'a', subject_key: 'maths', due_on: '2026-10-23' }), childRow({ set_id: 'b', subject_key: 'francais', due_on: '2026-10-25' })]);
    await show();
    await screen.findByText('Tuần 8');
    const color = (node: { props: { style?: unknown } }) => Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean)).color;
    const near = screen.getByText(/Hạn .*23\/10 · tối đa 8 điểm/);
    const far = screen.getByText(/Hạn .*25\/10 · tối đa 8 điểm/);
    expect(color(near)).not.toBe(color(far));
  });

  it('navigation : semaine passée = historique (résultats) ; flèches désactivées aux bornes ; retour à la semaine courante', async () => {
    mockChildRows.mockResolvedValue([
      ...fourStates,
      childRow({ set_id: 'old', subject_key: 'maths', title: 'Bài 1', week_label: 'Tuần 7', release_on: '2026-10-12', due_on: '2026-10-16', evaluation_attempt_id: 'ao', evaluation_status: 'validated', score: 14, total: 16, points_awarded: 8 }),
    ]);
    await show();
    await screen.findByText('Tuần 8');
    expect(screen.getByRole('button', { name: 'Không còn tuần sau' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Tuần trước' }));
    expect(screen.getByText('Tuần 7')).toBeTruthy();
    expect(screen.getByText('12/10 – 18/10 · 1/1 môn xong')).toBeTruthy();
    expect(screen.getByText('Đã duyệt · +8 điểm')).toBeTruthy();
    expect(screen.getByText('Điểm: 14/16')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Không còn tuần trước' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.queryByText('Bài 4')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Tuần sau' }));
    expect(screen.getByText('Tuần 8')).toBeTruthy();
  });

  it('semaine future : seulement ce qui est déjà ouvert', async () => {
    mockChildRows.mockResolvedValue([...fourStates, childRow({ set_id: 'next', subject_key: 'sciences', title: 'Bài 9', week_label: 'Tuần 9', release_on: '2026-10-20', due_on: '2026-10-30' })]);
    await show();
    await screen.findByText('Tuần 8');
    await fireEvent.press(screen.getByRole('button', { name: 'Tuần sau' }));
    expect(screen.getByText('Tuần 9')).toBeTruthy();
    expect(screen.getByText('Bài 9')).toBeTruthy();
    expect(screen.queryByText('Bài 4')).toBeNull();
  });

  it('retard dans le délai de grâce : reporté sur la semaine courante, « Quá hạn », sans blocage ; au-delà : disparu', async () => {
    mockChildRows.mockResolvedValue([
      childRow({ set_id: 'late', subject_key: 'maths', title: 'Bài 0', week_label: 'Tuần 7', release_on: '2026-10-12', due_on: '2026-10-16' }),
      childRow({ set_id: 'gone', subject_key: 'francais', title: 'Bài -1', week_label: 'Tuần 6', release_on: '2026-10-05', due_on: '2026-10-09' }),
    ]);
    await show();
    await screen.findByText('Bài 0');
    expect(screen.getByText('Quá hạn')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Bắt đầu/ })).toBeTruthy();
    expect(screen.queryByText('Bài -1')).toBeNull();
  });

  it('semaine vide : message', async () => {
    mockChildRows.mockResolvedValue([]);
    await show();
    expect(await screen.findByText('Tuần này chưa có bài ôn tập')).toBeTruthy();
  });

  it('D-052 : un enfant ignore l’identifiant demandé et ne lit jamais l’aperçu parent', async () => {
    mockChildRows.mockResolvedValue([childRow()]);
    await show({ childId: 'c-khang' });
    await screen.findByText('Bài 4');
    expect(mockParentRows).not.toHaveBeenCalled();
    expect(screen.queryByText(/Khang/)).toBeNull();
    expect(screen.getByText('Ôn tập')).toBeTruthy();
  });

  it('accessibilité : flèches ≥ 44 pt, boutons avec la matière dans le libellé', async () => {
    mockChildRows.mockResolvedValue([childRow()]);
    await show();
    await screen.findByText('Tuần 8');
    const size = (n: { props: { style?: unknown } }) => Object.assign({}, ...[n.props.style].flat(Infinity).filter(Boolean));
    expect(size(screen.getByRole('button', { name: 'Không còn tuần trước' })).width).toBeGreaterThanOrEqual(44);
    expect(size(screen.getByRole('button', { name: 'Không còn tuần sau' })).height).toBeGreaterThanOrEqual(44);
    expect(screen.getByRole('button', { name: /^Bắt đầu: / })).toBeTruthy();
    expect(size(screen.getByRole('button', { name: /^Bắt đầu: / })).minHeight).toBeGreaterThanOrEqual(44);
  });
});

describe('Écran Ôn tập — parent, pour SON enfant (D-084)', () => {
  beforeEach(() => { mockRole = 'parent'; });
  const khangRows = [
    parentRow({ quiz_id: 'qa', subject: 'anglais', title: 'Unit 5', attempt_id: 'a-wait', attempt_status: 'submitted', due_on: '2026-10-22' }),
    parentRow({ quiz_id: 'qb', subject: 'hist_geo', title: 'Bài 2', attempt_id: 'a-val', attempt_status: 'validated', score: 12, total: 16, points_awarded: 5, due_on: '2026-10-20' }),
    parentRow({ quiz_id: 'qc', subject: 'maths', title: 'Bài 4', attempt_id: 'a-run', attempt_status: 'in_progress', answered_count: 6 }),
    parentRow({ quiz_id: 'qd', subject: 'francais', title: 'Bài 3', due_on: '2026-10-25' }),
    parentRow({ quiz_id: 'qf', subject: 'sciences', title: 'Bài 7', available: false, release_on: '2026-10-26', due_on: '2026-10-30' }),
  ];

  it('l’écran de l’enfant demandé : titre avec son prénom ; Duyệt / Xem bài làm vers la validation existante ; aucun bouton de l’enfant', async () => {
    mockParentRows.mockImplementation(async (id: string) => (id === 'c-khang' ? khangRows : []));
    await show({ childId: 'c-khang' });
    await screen.findByText('Unit 5');
    expect(screen.getByText('Ôn tập · Khang')).toBeTruthy();
    expect(screen.getByText('Cần duyệt')).toBeTruthy();
    expect(screen.getByText('Chưa bắt đầu')).toBeTruthy();
    expect(screen.getByText('Đang làm 6/16')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Bắt đầu|Tiếp tục|Xem kết quả/ })).toBeNull();
    expect(screen.queryByText('Bài 7')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Duyệt/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quiz/attempt/[id]', params: { id: 'a-wait' } });
    await fireEvent.press(screen.getByRole('button', { name: /^Xem bài làm/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quiz/attempt/[id]', params: { id: 'a-val' } });
  });

  it('une carte en cours ou à faire n’a pas de bouton (état seul)', async () => {
    mockParentRows.mockImplementation(async (id: string) => (id === 'c-minh' ? [khangRows[2], khangRows[3]] : []));
    await show({ childId: 'c-minh' });
    await screen.findByText('Bài 4');
    expect(screen.queryAllByRole('button', { name: /Duyệt|Xem bài làm|Bắt đầu|Tiếp tục/ })).toHaveLength(0);
  });

  it('D-089 : chaque carte ouverte est un bouton « {matière}, {titre}, {statut} » qui ouvre le détail du quiz de CET enfant (même à faire ou en cours)', async () => {
    mockParentRows.mockImplementation(async (id: string) => (id === 'c-khang' ? khangRows : []));
    await show({ childId: 'c-khang' });
    await screen.findByText('Unit 5');
    for (const [name, quiz] of [['Tiếng Anh, Unit 5, Cần duyệt', 'qa'], ['Lịch sử và Địa lý, Bài 2, Đã duyệt · +5 điểm', 'qb'], ['Toán, Bài 4, Đang làm 6/16', 'qc'], ['francais, Bài 3, Chưa bắt đầu', 'qd']] as const) {
      mockPush.mockClear();
      await fireEvent.press(screen.getByRole('button', { name }));
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/quiz/detail', params: { child: 'c-khang', quiz } });
    }
  });

  it('D-089 : « Duyệt » ne déclenche PAS la navigation du détail (seulement la validation existante)', async () => {
    mockParentRows.mockImplementation(async (id: string) => (id === 'c-khang' ? khangRows : []));
    await show({ childId: 'c-khang' });
    await screen.findByText('Unit 5');
    await fireEvent.press(screen.getByRole('button', { name: /^Duyệt/ }));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quiz/attempt/[id]', params: { id: 'a-wait' } });
    expect(mockPush).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/quiz/detail' }));
    mockPush.mockClear();
    await fireEvent.press(screen.getByRole('button', { name: /^Xem bài làm/ }));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quiz/attempt/[id]', params: { id: 'a-val' } });
  });

  it('D-089 : cibles ≥ 44 pt, et aucune carte « grisée / à venir » n’est cliquable', async () => {
    mockParentRows.mockImplementation(async (id: string) => (id === 'c-khang' ? khangRows : []));
    mockUpcoming.mockResolvedValue([upRow({ quiz_id: 'u9', subject: 'sciences', title: 'Bài 9', release_on: '2026-10-26', due_on: '2026-10-30' })]);
    await show({ childId: 'c-khang' });
    await screen.findByText('Unit 5');
    const card = screen.getByRole('button', { name: 'Tiếng Anh, Unit 5, Cần duyệt' });
    const style = Object.assign({}, ...[card.props.style].flat(Infinity).filter(Boolean));
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    // la semaine suivante : la carte « Sắp mở » est lisible mais n'est pas un bouton
    await fireEvent.press(screen.getByRole('button', { name: 'Tuần sau' }));
    await screen.findByText('Bài 9');
    expect(screen.queryByRole('button', { name: /Bài 9/ })).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('D-089 : un enfant n’a jamais de carte cliquable vers le détail', async () => {
    mockRole = 'child';
    mockChildRows.mockResolvedValue(fourStates);
    await show();
    await screen.findByText('Tuần 8');
    expect(screen.queryByRole('button', { name: /^(Toán|Tiếng Anh|francais|Lịch sử và Địa lý), / })).toBeNull();
    for (const b of screen.getAllByRole('button')) await fireEvent.press(b);
    expect(mockPush).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/quiz/detail' }));
  });

  it('sans identifiant : le premier enfant de la liste', async () => {
    mockParentRows.mockResolvedValue([khangRows[3]]);
    await show();
    await waitFor(() => expect(screen.getByText('Ôn tập · Minh')).toBeTruthy());
  });
});

const upRow = (over: Row = {}): Row => ({ quiz_id: 'u1', subject: 'hist_geo', week_label: 'Tuần 8', title: 'Bài 2', release_on: '2026-10-26', due_on: '2026-11-01', max_points: 8, ...over });

describe('Écran Ôn tập — semaines futures, quiz pas encore ouverts (D-086)', () => {
  const flat = (n: { props: { style?: unknown } }) => Object.assign({}, ...[n.props.style].flat(Infinity).filter(Boolean));
  const childWithUpcoming = async (rows: Row[]) => {
    mockChildRows.mockResolvedValue([childRow()]);
    mockUpcoming.mockResolvedValue(rows);
    await show();
    await screen.findByText('Tuần 8');
  };

  it('enfant : la flèche › mène à la semaine suivante ; carte grisée « Sắp mở », ouverture, échéance, maximum, AUCUN bouton', async () => {
    await childWithUpcoming([upRow()]);
    await fireEvent.press(screen.getByRole('button', { name: 'Tuần sau' }));
    expect(screen.getByText('Bài 2')).toBeTruthy();
    expect(screen.getByText('Sắp mở')).toBeTruthy();
    expect(screen.getByText(/Mở ngày 26\/10 · Hạn .*01\/11 · tối đa 8 điểm/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Bắt đầu|Tiếp tục|Xem kết quả|Duyệt|Xem bài làm/ })).toBeNull();
    const card = screen.getByLabelText(/Bài 2.*Sắp mở.*Mở ngày 26\/10/);
    expect(flat(card).opacity).toBeLessThan(1);
    expect(screen.getByText('26/10 – 01/11 · 0/1 môn xong')).toBeTruthy();
  });

  it('la carte grisée reste lisible aux lecteurs d’écran (libellé complet) et n’apparaît pas dans la semaine courante', async () => {
    await childWithUpcoming([upRow()]);
    expect(screen.queryByText('Sắp mở')).toBeNull();
    expect(screen.queryByText('Bài 2')).toBeNull();
  });

  it('enfant : au-delà de la semaine suivante, › est DÉSACTIVÉE (non cachée), avec un libellé explicite — même si un quiz plus lointain était renvoyé', async () => {
    await childWithUpcoming([upRow(), upRow({ quiz_id: 'u3', title: 'Bài 9', week_label: 'Tuần 10', release_on: '2026-11-09', due_on: '2026-11-15' })]);
    expect(screen.getByRole('button', { name: 'Tuần sau' }).props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(screen.getByRole('button', { name: 'Tuần sau' }));
    const end = screen.getByRole('button', { name: 'Không còn tuần sau' });
    expect(end.props.accessibilityState).toMatchObject({ disabled: true });
    expect(flat(end).width).toBeGreaterThanOrEqual(44);
    expect(flat(end).opacity).toBeLessThan(1); // visiblement atténuée
    expect(flat(screen.getByRole('button', { name: 'Tuần trước' })).opacity).toBeUndefined();
    await fireEvent.press(end);
    expect(screen.queryByText('Bài 9')).toBeNull();
    expect(screen.getByText('Bài 2')).toBeTruthy();
  });

  it('enfant : une seule lecture « à venir », SANS identifiant d’enfant (le serveur déduit le sien, D-052)', async () => {
    await childWithUpcoming([]);
    expect(mockUpcoming).toHaveBeenCalledTimes(1);
    expect(mockUpcoming).toHaveBeenCalledWith(null);
  });

  it('une erreur de lecture des quiz à venir n’empêche pas d’afficher les quiz ouverts', async () => {
    mockChildRows.mockResolvedValue([childRow()]);
    mockUpcoming.mockRejectedValue(new Error('réseau'));
    await show();
    expect(await screen.findByText('Bài 4')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Không còn tuần sau' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('parent : parcourt jusqu’à la dernière semaine publiée, y compris une semaine vide au milieu', async () => {
    mockRole = 'parent';
    mockParentRows.mockResolvedValue([]);
    mockUpcoming.mockImplementation(async (id) =>
      id === 'c-khang'
        ? [upRow(), upRow({ quiz_id: 'u3', title: 'Bài 9', week_label: 'Tuần 10', release_on: '2026-11-09', due_on: '2026-11-15' })]
        : [],
    );
    await show({ childId: 'c-khang' });
    await screen.findByText('Ôn tập · Khang');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tuần sau' }).props.accessibilityState).toMatchObject({ disabled: false }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tuần sau' })); // 26/10 : Bài 2
    expect(screen.getByText('Bài 2')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tuần sau' })); // 2/11 : aucun quiz
    expect(screen.getByText('Tuần này chưa có bài ôn tập')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tuần sau' }).props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(screen.getByRole('button', { name: 'Tuần sau' })); // 9/11 : Bài 9
    expect(screen.getByText('Bài 9')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Không còn tuần sau' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.queryByRole('button', { name: /Bắt đầu|Duyệt/ })).toBeNull();
  });

  it('parent : une lecture « à venir » par enfant de la famille, avec son identifiant', async () => {
    mockRole = 'parent';
    mockParentRows.mockResolvedValue([]);
    mockUpcoming.mockResolvedValue([]);
    await show({ childId: 'c-minh' });
    await screen.findByText('Ôn tập · Minh');
    await waitFor(() => expect(mockUpcoming).toHaveBeenCalledTimes(2));
    expect(mockUpcoming).toHaveBeenCalledWith('c-minh');
    expect(mockUpcoming).toHaveBeenCalledWith('c-khang');
  });

  it('cas réel (dimanche 18/10) : la semaine en cours de l’enfant est celle de ses quiz ouverts (19–25/10) ; il atteint donc la semaine 8 (26/10 – 01/11), pas la 9', async () => {
    mockNow = new Date('2026-10-18T10:00:00Z'); // dimanche 17 h à Hô Chi Minh
    mockChildRows.mockResolvedValue([childRow({ set_id: 'o7', title: 'Bài 1', week_label: 'Tuần 7', release_on: '2026-10-16', due_on: '2026-10-25' })]);
    mockUpcoming.mockResolvedValue([
      upRow({ quiz_id: 'u8', title: 'Bài 2', week_label: 'Tuần 8', release_on: '2026-10-26', due_on: '2026-11-01' }),
      upRow({ quiz_id: 'u9', title: 'Bài 3', week_label: 'Tuần 9', release_on: '2026-11-02', due_on: '2026-11-08' }),
    ]);
    await show();
    await screen.findByText('Bài 1');
    await fireEvent.press(screen.getByRole('button', { name: 'Tuần sau' })); // 19/10 – 25/10
    expect(screen.getByText('Tuần 7')).toBeTruthy();
    expect(screen.getByText('19/10 – 25/10 · 0/1 môn xong')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tuần sau' }).props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(screen.getByRole('button', { name: 'Tuần sau' })); // 26/10 – 01/11
    expect(screen.getByText('Tuần 8')).toBeTruthy();
    expect(screen.getByText('Bài 2')).toBeTruthy();
    expect(screen.getByText('Sắp mở')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Không còn tuần sau' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.queryByText('Bài 3')).toBeNull();
  });

  it('0 quiz : les deux flèches sont désactivées et nommées', async () => {
    mockChildRows.mockResolvedValue([]);
    mockUpcoming.mockResolvedValue([]);
    await show();
    await screen.findByText('Tuần này chưa có bài ôn tập');
    expect(screen.getByRole('button', { name: 'Không còn tuần trước' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByRole('button', { name: 'Không còn tuần sau' }).props.accessibilityState).toMatchObject({ disabled: true });
  });
});
