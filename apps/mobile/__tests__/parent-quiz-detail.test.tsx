import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createTestQueryClient } from '../test-utils/queryClient';
import '@/i18n';
import { ParentQuizDetail } from '@/components/quiz/ParentQuizDetail';
import QuizDetailScreen from '../app/quiz/detail';

const mockRedirect = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, canGoBack: () => true, replace: jest.fn() }),
  useLocalSearchParams: () => ({ child: 'c-tien', quiz: 'q1', attempt: 'a-notif' }),
  Redirect: (props: { href: unknown }) => { mockRedirect(props.href); return null; },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));

let mockRole: 'parent' | 'child' = 'parent';
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({
    me: { family: { timezone: 'Asia/Ho_Chi_Minh' } },
    viewer: { role: mockRole, memberId: 'm', childId: mockRole === 'child' ? 'c-tien' : null },
    children: [{ id: 'c-tien', name: 'Tien', birth_date: '2013-05-01', color: '#1E88F5' }],
    child: { id: 'c-tien', name: 'Tien' },
    select: jest.fn(),
  }),
}));
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: { member: { role: mockRole } } }) }));

const mockFetch = jest.fn();
jest.mock('@/api/catalog', () => ({ ...jest.requireActual('@/api/catalog'), fetchParentQuizDetail: (...a: unknown[]) => mockFetch(...a) }));
// la validation est la MÊME mutation que « Duyệt » : on vérifie qu'elle est appelée, sans la rejouer ici
const mockValidate = jest.fn();
jest.mock('@/hooks/useQuizzes', () => ({
  ...jest.requireActual('@/hooks/useQuizzes'),
  useValidateQuizAttempt: () => ({ mutate: (vars: unknown, opts?: { onSuccess?: () => void }) => { mockValidate(vars); opts?.onSuccess?.(); }, isPending: false }),
}));

type Q = Record<string, unknown>;
const question = (over: Q = {}): Q => ({
  question_id: 'x', position: 0, number: null, needs_figure: false, prompt: 'Q', choices: ['a', 'b', 'c', 'd'], correct_index: 1, explanation: null, to_verify: false, confirmed: true, choice_index: null, is_correct: null, ...over,
});
const quiz = (over: Q = {}): Q => ({
  id: 'q1', subject: 'anglais', week_label: 'Tuần 8', title: 'Unit 5', release_on: '2026-10-19', due_on: '2026-10-23', material_kind: 'course', paper_support: false, answer_sheet_only: false, question_count: 3, max_points: 8, ...over,
});
const attempt = (over: Q = {}): Q => ({ id: 'a1', status: 'submitted', answered: 3, started_at: '2026-10-20T01:00:00Z', submitted_at: '2026-10-20T02:00:00Z', validated_at: null, show_correction: false, score: 1, total: 3, points_awarded: null, ...over });
const questions3 = (choices: (number | null)[], correct = [1, 2, 0]): Q[] =>
  choices.map((c, i) => question({
    question_id: `k${i}`, position: i, number: i + 1, prompt: `Question ${i + 1}`, choices: [`a${i + 1}`, `b${i + 1}`, `c${i + 1}`, `d${i + 1}`], correct_index: correct[i], choice_index: c,
    is_correct: c === null ? false : c === correct[i], explanation: i === 0 ? 'Vì b1' : null,
  }));
const detail = (over: Q = {}, att: Q | null = attempt(), qs: Q[] = questions3([0, 2, 3])): Q => ({ quiz: quiz(over), attempt: att, questions: qs });

const clients: QueryClient[] = [];
async function show(props: { attemptId?: string | null } = {}) {
  const client = createTestQueryClient();
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <ParentQuizDetail childId="c-tien" quizId="q1" {...props} />
    </QueryClientProvider>,
  );
}
afterEach(() => { clients.splice(0).forEach((c) => c.clear()); jest.clearAllMocks(); mockRole = 'parent'; });

const choice = (label: RegExp) => screen.getByLabelText(label);

describe('Détail d’un quiz — parent (D-089)', () => {
  it('titre = matière + titre ; rappel enfant, semaine, échéance, statut ; questions numérotées avec 4 choix', async () => {
    mockFetch.mockResolvedValue(detail({}, null, questions3([null, null, null])));
    await show();
    expect(await screen.findByText('Tiếng Anh · Unit 5')).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledWith('c-tien', 'q1');
    expect(screen.getByText(/Tien · Tuần 8 · Hạn/)).toBeTruthy();
    expect(screen.getByText('Chưa làm')).toBeTruthy();
    expect(screen.getByText('Câu 1')).toBeTruthy();
    expect(screen.getByText('Câu 3')).toBeTruthy();
    expect(screen.getByText('Question 2')).toBeTruthy();
    for (const letter of ['a1', 'b1', 'c1', 'd1']) expect(screen.getByText(letter)).toBeTruthy();
  });

  it('pas commencé : aperçu, bonnes réponses marquées, explication, aucune réponse d’enfant, aucun bouton de validation', async () => {
    mockFetch.mockResolvedValue(detail({}, null, questions3([null, null, null])));
    await show();
    await screen.findByText('Câu 1');
    expect(screen.getByText(/Xem trước/)).toBeTruthy();
    expect(choice(/^B\. b1 — Đáp án đúng$/)).toBeTruthy();
    expect(screen.getByText('Giải thích: Vì b1')).toBeTruthy();
    expect(screen.queryByText(/Con chọn/)).toBeNull();
    expect(screen.queryByText('Con chưa trả lời')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Duyệt kết quả' })).toBeNull();
  });

  it('en cours : « đã trả lời N/total » + réponses enregistrées ; question sans réponse signalée ; aucun bouton', async () => {
    mockFetch.mockResolvedValue(detail({}, attempt({ status: 'in_progress', answered: 2, score: null, total: null, submitted_at: null }), questions3([1, null, 3])));
    await show();
    await screen.findByText('Câu 1');
    expect(screen.getByText('Đang làm')).toBeTruthy();
    expect(screen.getByText('Đã trả lời 2/3')).toBeTruthy();
    expect(choice(/^B\. b1 — Đáp án đúng, Con chọn \(đúng\)$/)).toBeTruthy();
    expect(choice(/^D\. d3 — Con chọn \(sai\)$/)).toBeTruthy();
    expect(screen.getAllByText('Con chưa trả lời')).toHaveLength(1);
    expect(screen.queryByText(/^Điểm:/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Duyệt kết quả' })).toBeNull();
  });

  it('à valider : réponses complètes, score X/Y, bonne réponse ET choix faux marqués ; le flux de validation existant est proposé', async () => {
    mockFetch.mockResolvedValue(detail());
    await show();
    await screen.findByText('Câu 1');
    expect(screen.getByText('Cần duyệt')).toBeTruthy();
    expect(screen.getByText('Điểm: 1/3')).toBeTruthy();
    // Q1 : choisi a1 (faux), bonne b1 ; Q2 : choisi c2 (juste) ; Q3 : choisi d3 (faux), bonne a3
    expect(choice(/^A\. a1 — Con chọn \(sai\)$/)).toBeTruthy();
    expect(choice(/^B\. b1 — Đáp án đúng$/)).toBeTruthy();
    expect(choice(/^C\. c2 — Đáp án đúng, Con chọn \(đúng\)$/)).toBeTruthy();
    expect(choice(/^D\. d3 — Con chọn \(sai\)$/)).toBeTruthy();
    expect(choice(/^A\. a3 — Đáp án đúng$/)).toBeTruthy();
    const toggle = screen.getByLabelText('Hiện đáp án đúng cho con');
    expect(toggle.props.value).toBe(false);
    await fireEvent(toggle, 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Duyệt kết quả' }));
    expect(mockValidate).toHaveBeenCalledTimes(1);
    expect(mockValidate).toHaveBeenCalledWith({ attemptId: 'a1', showCorrection: true });
  });

  it('validé : score, « +N điểm », aucune validation possible', async () => {
    mockFetch.mockResolvedValue(detail({}, attempt({ status: 'validated', score: 3, total: 3, points_awarded: 8, validated_at: '2026-10-21T01:00:00Z' }), questions3([1, 2, 0])));
    await show();
    await screen.findByText('Câu 1');
    expect(screen.getByText('Đã duyệt')).toBeTruthy();
    expect(screen.getByText('Điểm: 3/3')).toBeTruthy();
    expect(screen.getByText('+8 điểm')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Duyệt kết quả' })).toBeNull();
    expect(screen.queryByLabelText('Hiện đáp án đúng cho con')).toBeNull();
  });

  it('validé sans point (score faible) : le dit', async () => {
    mockFetch.mockResolvedValue(detail({}, attempt({ status: 'validated', score: 1, total: 3, points_awarded: null }), questions3([0, 0, 0])));
    await show();
    await screen.findByText('Câu 1');
    expect(screen.getByText('Không được cộng điểm')).toBeTruthy();
  });

  it('D-089 mélange : la réponse de l’enfant est lue en indice d’ORIGINE — la bonne réponse choisie à l’écran n’est jamais présentée comme fausse', async () => {
    // Le serveur renvoie les choix dans l'ordre d'origine et choice_index déjà converti : choix « c » (indice 2) ≠ position affichée.
    const q = question({ question_id: 'm1', position: 0, number: 1, prompt: 'Mélangé', choices: ['a', 'b', 'c', 'd'], correct_index: 2, choice_index: 2, is_correct: true });
    mockFetch.mockResolvedValue(detail({ question_count: 1 }, attempt({ score: 1, total: 1 }), [q]));
    await show();
    await screen.findByText('Mélangé');
    expect(choice(/^C\. c — Đáp án đúng, Con chọn \(đúng\)$/)).toBeTruthy();
    expect(screen.queryByLabelText(/Con chọn \(sai\)/)).toBeNull();
    // les choix restent dans l'ordre d'origine du catalogue
    const letters = screen.getAllByText(/^[ABCD]$/).map((n) => n.props.children);
    expect(letters).toEqual(['A', 'B', 'C', 'D']);
  });

  it('question avec figure : indication « Cần hình » sans casser la liste ; question à vérifier : badge « Cần kiểm tra »', async () => {
    const qs = [
      question({ question_id: 'f', position: 0, number: 1, prompt: 'Voir la figure', needs_figure: true }),
      question({ question_id: 'v', position: 1, number: 2, prompt: 'Réponse douteuse', to_verify: true, confirmed: false }),
      question({ question_id: 'n', position: 2, number: 3, prompt: 'Normale' }),
    ];
    mockFetch.mockResolvedValue(detail({}, null, qs));
    await show();
    await screen.findByText('Voir la figure');
    expect(screen.getAllByText('Cần hình')).toHaveLength(1);
    expect(screen.getAllByText('Cần kiểm tra')).toHaveLength(1);
    expect(screen.getByLabelText('Câu này cần xem hình trong đề')).toBeTruthy();
    expect(screen.getByLabelText('Đáp án cần kiểm tra lại')).toBeTruthy();
    expect(screen.getByText('Normale')).toBeTruthy();
    expect(screen.getByText('Câu 3')).toBeTruthy();
  });

  it('examen : une réponse jamais confirmée est signalée, même sans « à vérifier »', async () => {
    mockFetch.mockResolvedValue(detail({ material_kind: 'exam' }, null, [question({ question_id: 'e', number: 1, prompt: 'Examen', confirmed: false })]));
    await show();
    await screen.findByText('Examen');
    expect(screen.getAllByText('Cần kiểm tra')).toHaveLength(1);
  });

  it('accessibilité : résumé lisible, retour disponible, choix avec libellé complet', async () => {
    mockFetch.mockResolvedValue(detail());
    await show();
    await screen.findByText('Câu 1');
    expect(screen.getByLabelText('Quay lại')).toBeTruthy();
    expect(screen.getByLabelText('Tiếng Anh, Unit 5, Cần duyệt, Tien · Tuần 8')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Quay lại'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('refus du serveur : message clair, jamais le contenu', async () => {
    mockFetch.mockRejectedValue({ code: '42501', message: 'forbidden' });
    await show();
    expect(await screen.findByText('Bài ôn tập này không dành cho bạn ấy.')).toBeTruthy();
    expect(screen.queryByText('Câu 1')).toBeNull();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('refus + tentative connue (lien de notification d’un jeu de famille) : redirection vers la validation existante', async () => {
    mockFetch.mockRejectedValue({ code: '42501', message: 'forbidden' });
    await show({ attemptId: 'a-notif' });
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith({ pathname: '/quiz/attempt/[id]', params: { id: 'a-notif' } }));
  });

  it('erreur réseau : message et bouton « Thử lại » qui relit', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network')).mockResolvedValue(detail());
    await show();
    expect(await screen.findByText('Không mở được bài ôn tập này.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Câu 1')).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('un enfant ne voit jamais cet écran : rien n’est rendu et aucune lecture n’est faite', async () => {
    mockRole = 'child';
    await show();
    expect(screen.queryByText('Câu 1')).toBeNull();
    expect(screen.queryByText(/Đáp án đúng/)).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('Route /quiz/detail (D-089)', () => {
  it('parent : affiche le détail ; enfant : redirigé, aucune lecture', async () => {
    mockFetch.mockResolvedValue(detail());
    const client = createTestQueryClient();
    clients.push(client);
    await render(<QueryClientProvider client={client}><QuizDetailScreen /></QueryClientProvider>);
    expect(await screen.findByText('Câu 1')).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledWith('c-tien', 'q1');
  });

  it('enfant : redirection vers l’accueil', async () => {
    mockRole = 'child';
    const client = createTestQueryClient();
    clients.push(client);
    await render(<QueryClientProvider client={client}><QuizDetailScreen /></QueryClientProvider>);
    expect(mockRedirect).toHaveBeenCalledWith('/');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
