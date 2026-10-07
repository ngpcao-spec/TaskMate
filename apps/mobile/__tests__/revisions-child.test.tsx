import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import { ChildRevisions } from '@/components/quiz/ChildRevisions';
import { ChildSetHome } from '@/components/quiz/ChildSetHome';
import { EvaluationRun } from '@/components/quiz/EvaluationRun';
import { ResultView } from '@/components/quiz/ResultView';
import RevisionsScreen from '../app/(tabs)/more/revisions';
import EvaluateScreen from '../app/quiz/evaluate/[id]';
import ResultScreen from '../app/quiz/result/[id]';
import QuizScreen from '../app/quiz/[id]';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
  useLocalSearchParams: () => ({ id: 's1' }),
  Redirect: (props: { href: string }) => { mockRedirect(props.href); return null; },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
let mockSeq = 0;
jest.mock('@/api/ids', () => ({ newId: () => `id-${++mockSeq}` }));

let mockRole: 'parent' | 'child' = 'child';
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: { member: { role: mockRole, id: 'm' }, family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' }, children: [] } }) }));
// liste volontairement polluée : un enfant ne doit en voir aucun autre, quelle que soit la source des données
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({
    me: { family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' }, member: { id: 'm' } },
    viewer: { role: mockRole, memberId: 'm', childId: 'c-minh' },
    children: [{ id: 'c-minh', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5' }, { id: 'c-khang', name: 'Khang', birth_date: '2013-05-01', color: '#2EC4A6' }],
    child: { id: 'c-minh', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5' }, select: jest.fn(),
  }),
}));

type Info = { set_id: string; title: string; subject: string | null; question_count: number; evaluation_attempt_id: string | null; evaluation_status: string | null; can_start_evaluation: boolean };
const info = (over: Partial<Info> = {}): Info => ({ set_id: 's1', title: 'Fractions', subject: 'Toán', question_count: 2, evaluation_attempt_id: null, evaluation_status: null, can_start_evaluation: true, ...over });
const questions = [
  { question_id: 'q1', position: 0, prompt: 'Un plus un ?', choices: ['1', '2', '3'] },
  { question_id: 'q2', position: 1, prompt: 'Deux plus deux ?', choices: ['3', '4', '5', '6'] },
];
let mockInfos: Info[] = [];
let mockQuestions = questions;
let mockResult: unknown = null;
let mockHistory: unknown[] = [];
const mockStartEval = jest.fn();
const mockSubmit = jest.fn();
const run = (fn: jest.Mock) => ({ mutate: (v: unknown, o?: { onSuccess?: (r: unknown) => void }) => { fn(v); o?.onSuccess?.(undefined); }, isPending: false });
jest.mock('@/hooks/useQuizzes', () => ({
  useChildQuizSets: () => ({ data: mockInfos, isPending: false }),
  useChildQuestions: () => ({ data: mockQuestions, isPending: false }),
  useChildResult: () => ({ data: mockResult, isPending: false }),
  useChildHistory: () => ({ data: mockHistory }),
  useStartQuizEvaluation: () => run(mockStartEval),
  useSubmitQuizEvaluation: () => run(mockSubmit),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSeq = 0;
  mockRole = 'child'; mockInfos = [info()]; mockQuestions = questions; mockResult = null; mockHistory = [];
});

describe('Ôn tập — liste de l\'enfant', () => {
  it('ses jeux, jamais de sélecteur d\'enfant ni de trace de l\'autre', async () => {
    mockInfos = [info(), info({ set_id: 's2', title: 'Verbes', subject: null, evaluation_status: 'submitted', evaluation_attempt_id: 'a1', can_start_evaluation: false })];
    await render(<RevisionsScreen />);
    expect(screen.getByRole('button', { name: 'Fractions, 2 câu hỏi' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verbes, 2 câu hỏi, Đã nộp, chờ phụ huynh duyệt' })).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByText(/Khang/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tạo bộ câu hỏi' })).toBeNull();
  });
  it('liste vide : message', async () => {
    mockInfos = [];
    await render(<ChildRevisions />);
    expect(screen.getByText('Chưa có bộ câu hỏi nào để ôn tập.')).toBeTruthy();
  });
});

describe('Ôn tập — accueil d\'un jeu', () => {
  it('à faire : un seul parcours (l\'évaluation), aucun mode entraînement', async () => {
    await render(<ChildSetHome setId="s1" />);
    expect(screen.queryByRole('button', { name: 'Luyện tập' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Làm bài kiểm tra' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quiz/evaluate/[id]', params: { id: 's1' } });
  });
  it('en cours : reprise', async () => {
    mockInfos = [info({ evaluation_status: 'in_progress', evaluation_attempt_id: 'a1', can_start_evaluation: false })];
    await render(<ChildSetHome setId="s1" />);
    expect(screen.getByRole('button', { name: 'Làm tiếp bài kiểm tra' })).toBeTruthy();
  });
  it('soumise : « Đã nộp, chờ phụ huynh duyệt », aucun score, aucun bouton d\'évaluation', async () => {
    mockInfos = [info({ evaluation_status: 'submitted', evaluation_attempt_id: 'a1', can_start_evaluation: false })];
    await render(<ChildSetHome setId="s1" />);
    expect(screen.getByText('Đã nộp, chờ phụ huynh duyệt')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Làm bài kiểm tra' })).toBeNull();
    expect(screen.queryByText(/\d\/\d/)).toBeNull();
  });
  it('validée : voir le résultat + progression (résultats validés seulement)', async () => {
    mockInfos = [info({ evaluation_status: 'validated', evaluation_attempt_id: 'a1', can_start_evaluation: false })];
    mockHistory = [{ attempt_id: 'a1', validated_at: '2026-07-02T03:00:00Z', score: 2, total: 2 }, { attempt_id: 'p1', validated_at: '2026-07-01T03:00:00Z', score: 1, total: 2 }];
    await render(<ChildSetHome setId="s1" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Xem kết quả' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quiz/result/[id]', params: { id: 'a1' } });
    expect(screen.getByText('Tiến triển')).toBeTruthy();
    expect(screen.getByText('+50 điểm % so với lần trước')).toBeTruthy();
  });
  it('jeu inconnu (celui d\'un autre enfant : absent de SES jeux) : rien', async () => {
    mockInfos = [];
    await render(<ChildSetHome setId="s-autre" />);
    expect(screen.queryByText('Luyện tập')).toBeNull();
  });
});

describe('Ôn tập — évaluation', () => {
  it('démarre, ne montre aucun retour, envoie les positions affichées, puis « chờ phụ huynh duyệt »', async () => {
    await render(<EvaluationRun setId="s1" />);
    expect(mockStartEval).toHaveBeenCalledWith({ setId: 's1', attemptId: 'id-1' });
    await fireEvent.press(screen.getByRole('radio', { name: '2' }));
    await fireEvent.press(screen.getByRole('radio', { name: '4' }));
    expect(screen.queryByText('Đúng rồi!')).toBeNull();
    expect(screen.queryByText('Chưa đúng')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Kiểm tra' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Nộp bài' }));
    expect(mockSubmit).toHaveBeenCalledWith({ attemptId: 'id-1', answers: [{ question_id: 'q1', choice: 1 }, { question_id: 'q2', choice: 1 }] });
    expect(screen.getByText('Đã nộp, chờ phụ huynh duyệt')).toBeTruthy();
    expect(screen.queryByText(/Điểm/)).toBeNull();
  });
  it('questions sans réponse : avertissement puis envoi explicite (null)', async () => {
    await render(<EvaluationRun setId="s1" />);
    await fireEvent.press(screen.getByRole('radio', { name: '2' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Nộp bài' }));
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Còn 1 câu chưa trả lời.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Vẫn nộp bài' }));
    expect(mockSubmit).toHaveBeenCalledWith({ attemptId: 'id-1', answers: [{ question_id: 'q1', choice: 1 }, { question_id: 'q2', choice: null }] });
  });
  it('reprise d\'une évaluation en cours : même tentative, pas de nouveau démarrage', async () => {
    mockInfos = [info({ evaluation_status: 'in_progress', evaluation_attempt_id: 'att-9', can_start_evaluation: false })];
    await render(<EvaluationRun setId="s1" />);
    expect(mockStartEval).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('radio', { name: '1' }));
    await fireEvent.press(screen.getByRole('radio', { name: '6' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Nộp bài' }));
    expect(mockSubmit).toHaveBeenCalledWith({ attemptId: 'att-9', answers: expect.any(Array) });
  });
  it('déjà passée : impossible d\'en relancer une (seul le parent peut)', async () => {
    mockInfos = [info({ evaluation_status: 'validated', evaluation_attempt_id: 'a1', can_start_evaluation: false })];
    await render(<EvaluationRun setId="s1" />);
    expect(screen.getByText('Bài kiểm tra đã làm. Phụ huynh có thể cho làm lại.')).toBeTruthy();
    expect(mockStartEval).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Nộp bài' })).toBeNull();
  });
  it('déjà soumise : seulement l\'attente', async () => {
    mockInfos = [info({ evaluation_status: 'submitted', evaluation_attempt_id: 'a1', can_start_evaluation: false })];
    await render(<EvaluationRun setId="s1" />);
    expect(screen.getByText('Đã nộp, chờ phụ huynh duyệt')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nộp bài' })).toBeNull();
  });
});

describe('Ôn tập — résultat', () => {
  it('avant validation : seulement l\'attente (le serveur n\'envoie aucun score)', async () => {
    mockResult = { status: 'submitted', set_id: 's1' };
    await render(<ResultView attemptId="a1" />);
    expect(screen.getByText('Đã nộp, chờ phụ huynh duyệt')).toBeTruthy();
    expect(screen.queryByText(/Điểm/)).toBeNull();
  });
  it('validée, correction désactivée : score + questions ratées (énoncé + sa réponse), ni bonne réponse ni explication', async () => {
    mockResult = {
      status: 'validated', set_id: 's1', score: 1, total: 2, show_correction: false,
      missed: [{ question_id: 'q2', position: 1, prompt: 'Deux plus deux ?', chosen_text: '5' }],
    };
    await render(<ResultView attemptId="a1" />);
    expect(screen.getByText('Điểm: 1/2')).toBeTruthy();
    expect(screen.getByText('Deux plus deux ?')).toBeTruthy();
    expect(screen.getByText('Bạn chọn: 5')).toBeTruthy();
    expect(screen.queryByText(/Đáp án đúng/)).toBeNull();
    expect(screen.queryByText('Deux et deux')).toBeNull();
    expect(screen.getByText('Phụ huynh chưa cho xem đáp án đúng.')).toBeTruthy();
  });
  it('validée, tout juste, correction désactivée : message dédié', async () => {
    mockResult = { status: 'validated', set_id: 's1', score: 2, total: 2, show_correction: false, missed: [] };
    await render(<ResultView attemptId="a1" />);
    expect(screen.getByText('Con trả lời đúng tất cả!')).toBeTruthy();
  });
  it('validée, correction activée : bonne réponse et explication en plus', async () => {
    mockResult = {
      status: 'validated', set_id: 's1', score: 1, total: 2, show_correction: true,
      questions: [
        { question_id: 'q1', position: 0, prompt: 'Un plus un ?', choices: ['1', '2', '3'], choice_index: 1, correct_index: 1, explanation: null, is_correct: true },
        { question_id: 'q2', position: 1, prompt: 'Deux plus deux ?', choices: ['3', '4', '5'], choice_index: 2, correct_index: 1, explanation: 'Deux et deux', is_correct: false },
      ],
    };
    await render(<ResultView attemptId="a1" />);
    expect(screen.getByText('Điểm: 1/2')).toBeTruthy();
    expect(screen.getByText('Bạn chọn: 5')).toBeTruthy();
    expect(screen.getByText('Đáp án đúng: 4')).toBeTruthy();
    expect(screen.getByText('Deux et deux')).toBeTruthy();
  });
});

describe('routes enfant : un parent est redirigé ; l\'écran d\'un jeu suit le rôle', () => {
  it.each([['evaluate', EvaluateScreen], ['result', ResultScreen]])('%s', async (_n, Screen) => {
    mockRole = 'parent';
    const Component = Screen as () => React.ReactElement | null;
    await render(<Component />);
    expect(mockRedirect).toHaveBeenCalledWith('/');
  });
  it('quiz/[id] pour un enfant : accueil de SON jeu', async () => {
    await render(<QuizScreen />);
    expect(screen.getByRole('button', { name: 'Làm bài kiểm tra' })).toBeTruthy();
  });
});
