import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import { AttemptDetail } from '@/components/quiz/AttemptDetail';
import { EvaluationRun } from '@/components/quiz/EvaluationRun';
import { QuizGone } from '@/components/quiz/QuizGone';
import { ResultView } from '@/components/quiz/ResultView';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }), Redirect: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: { member: { role: 'child', id: 'm' }, family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' }, children: [] } }) }));
jest.mock('@/api/ids', () => ({ newId: () => 'id-1' }));
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({
    me: { family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' }, member: { id: 'm' } },
    viewer: { role: 'parent', memberId: 'm', childId: null },
    children: [{ id: 'c1', name: 'Minh', birth_date: '2013-03-01', color: '#1E88F5' }],
    child: { id: 'c1', name: 'Minh', birth_date: '2013-03-01', color: '#1E88F5' }, select: jest.fn(),
  }),
}));

type Q = { data?: unknown; isPending: boolean; isSuccess?: boolean; error?: unknown };
let mockInfos: unknown[] = [];
let mockQuestions: Q = { data: [], isPending: false };
let mockProgress: Q = { data: [], isPending: false };
let mockResult: Q = { data: undefined, isPending: false };
let mockDetail: Q = { data: undefined, isPending: false };
const mockNoop = { mutate: jest.fn(), isPending: false };
jest.mock('@/hooks/useQuizzes', () => ({
  useChildQuizSets: () => ({ data: mockInfos, isPending: false }),
  useChildQuestions: () => mockQuestions,
  useChildProgress: () => mockProgress,
  useChildResult: () => mockResult,
  useAttemptDetail: () => mockDetail,
  useStartQuizEvaluation: () => mockNoop,
  useSubmitQuizEvaluation: () => mockNoop,
  useSaveQuizProgress: () => mockNoop,
  useChildHistory: () => ({ data: [] }),
  useValidateQuizAttempt: () => mockNoop,
}));

const GONE = 'Bài ôn tập này không còn nữa.';
const inProgress = { set_id: 'z1', source: 'catalog', subject_key: 'maths', week_label: 'Tuần 7', title: 'Toán', subject: null, question_count: 2, evaluation_attempt_id: 'a1', evaluation_status: 'in_progress', can_start_evaluation: false, due_on: null, answered_count: 1 };

beforeEach(() => {
  jest.clearAllMocks();
  mockInfos = [inProgress]; mockQuestions = { data: [], isPending: false }; mockProgress = { data: [], isPending: false };
  mockResult = { data: undefined, isPending: false }; mockDetail = { data: undefined, isPending: false };
});

describe('QCM supprimé définitivement (D-091) — écrans ouverts ou notifications anciennes', () => {
  it('message clair et retour à la liste', async () => {
    await render(<QuizGone />);
    expect(screen.getByText(GONE)).toBeTruthy();
    expect(screen.getByText('Bài đã được quản trị viên xóa. Điểm đã cộng (nếu có) vẫn được giữ.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Về danh sách' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('enfant : le quiz a disparu de la liste relue → message, pas d\'écran vide', async () => {
    mockInfos = [];
    await render(<EvaluationRun setId="z1" />);
    expect(screen.getByText(GONE)).toBeTruthy();
  });

  it('enfant : questions de la tentative introuvables (attempt_not_found) → message', async () => {
    mockQuestions = { data: undefined, isPending: false, error: { message: 'attempt_not_found', code: 'P0002' } };
    await render(<EvaluationRun setId="z1" />);
    expect(screen.getByText(GONE)).toBeTruthy();
  });

  it('enfant : progression de la tentative introuvable → message', async () => {
    mockProgress = { data: undefined, isPending: false, error: { message: 'attempt_not_found' } };
    await render(<EvaluationRun setId="z1" />);
    expect(screen.getByText(GONE)).toBeTruthy();
  });

  it('enfant : une panne réseau n\'est PAS prise pour une suppression', async () => {
    mockQuestions = { data: undefined, isPending: false, error: { message: 'Network request failed' } };
    await render(<EvaluationRun setId="z1" />);
    expect(screen.queryByText(GONE)).toBeNull();
  });

  it('enfant : résultat d\'une tentative supprimée → message ; autre erreur → rien (comme avant)', async () => {
    mockResult = { data: undefined, isPending: false, error: { message: 'attempt_not_found' } };
    await render(<ResultView attemptId="a1" />);
    expect(screen.getByText(GONE)).toBeTruthy();
    mockResult = { data: undefined, isPending: false, error: { message: 'boom' } };
    await render(<ResultView attemptId="a1" />);
    expect(screen.queryByText(GONE)).toBeNull();
  });

  it('parent : détail d\'une tentative supprimée (ligne absente ou introuvable) → message', async () => {
    mockDetail = { data: null, isPending: false, isSuccess: true };
    await render(<AttemptDetail attemptId="a1" />);
    expect(screen.getByText(GONE)).toBeTruthy();
    mockDetail = { data: undefined, isPending: false, isSuccess: false, error: { message: 'attempt_not_found' } };
    await render(<AttemptDetail attemptId="a1" />);
    expect(screen.getByText(GONE)).toBeTruthy();
  });

  it('parent : une erreur quelconque n\'est pas présentée comme une suppression', async () => {
    mockDetail = { data: undefined, isPending: false, isSuccess: false, error: { message: 'Network request failed' } };
    await render(<AttemptDetail attemptId="a1" />);
    expect(screen.queryByText(GONE)).toBeNull();
  });
});
