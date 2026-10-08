import { fireEvent, render, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import { EvaluationRun } from '@/components/quiz/EvaluationRun';
import { ResultView } from '@/components/quiz/ResultView';
import type { ChildQuizResult, PlayQuestionRow } from '@/api/quizzes';

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 's1' }),
  Redirect: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
let mockSeq = 0;
jest.mock('@/api/ids', () => ({ newId: () => `id-${++mockSeq}` }));
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({
    me: { family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' }, member: { id: 'm' } },
    viewer: { role: 'child', memberId: 'm', childId: 'c-minh' },
    children: [{ id: 'c-minh', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5' }],
    child: { id: 'c-minh', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5' }, select: jest.fn(),
  }),
}));

type Info = { set_id: string; title: string; subject: string | null; question_count: number; evaluation_attempt_id: string | null; evaluation_status: string | null; can_start_evaluation: boolean; paper_support: boolean; answer_sheet_only: boolean };
const info = (over: Partial<Info> = {}): Info => ({ set_id: 's1', title: 'Examen de maths', subject: 'Toán', question_count: 3, evaluation_attempt_id: null, evaluation_status: null, can_start_evaluation: true, paper_support: true, answer_sheet_only: true, ...over });
const sheetQuestions: PlayQuestionRow[] = [
  { question_id: 'q3', position: 0, prompt: '', choices: ['A', 'B', 'C', 'D'], origin_number: 3, needs_figure: true },
  { question_id: 'q5', position: 1, prompt: '', choices: ['A', 'B', 'C'], origin_number: 5, needs_figure: false },
  { question_id: 'q9', position: 2, prompt: '', choices: ['A', 'B', 'C', 'D'], origin_number: null, needs_figure: false },
];
const paperQuestions: PlayQuestionRow[] = [
  { question_id: 'q1', position: 0, prompt: 'Limite de (x+1)/(x−2) en +∞ ?', choices: ['0', '1', '2', '+∞'], origin_number: 1, needs_figure: false },
  { question_id: 'q2', position: 1, prompt: 'Selon la courbe, f est croissante sur ?', choices: ['[0;1]', '[1;2]', '[2;3]'], origin_number: 2, needs_figure: true },
];
let mockInfos: Info[] = [];
let mockQuestions: PlayQuestionRow[] = sheetQuestions;
let mockResult: ChildQuizResult | null = null;
const mockStartEval = jest.fn();
const mockSubmit = jest.fn();
const run = (fn: jest.Mock) => ({ mutate: (v: unknown, o?: { onSuccess?: (r: unknown) => void }) => { fn(v); o?.onSuccess?.(undefined); }, isPending: false });
jest.mock('@/hooks/useQuizzes', () => ({
  useChildQuizSets: () => ({ data: mockInfos, isPending: false }),
  useChildQuestions: () => ({ data: mockQuestions, isPending: false }),
  useChildResult: () => ({ data: mockResult, isPending: false }),
  useStartQuizEvaluation: () => run(mockStartEval),
  useSubmitQuizEvaluation: () => run(mockSubmit),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSeq = 0;
  mockInfos = [info()];
  mockQuestions = sheetQuestions;
  mockResult = null;
});

describe('Phiếu trả lời — feuille de réponses seule', () => {
  it('numéros d\'origine bien visibles, uniquement des lettres, aucun énoncé', async () => {
    await render(<EvaluationRun setId="s1" />);
    expect(screen.getByText('Phiếu trả lời')).toBeTruthy();
    expect(screen.getByText('Câu 3')).toBeTruthy();
    expect(screen.getByText('Câu 5')).toBeTruthy();
    // une question sans numéro d'origine : « #rang », jamais un nombre qui ressemble à un vrai numéro
    expect(screen.getByText('Câu #3')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Câu #3: đáp án B' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Câu 3: đáp án A' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Câu 3: đáp án D' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Câu 5: đáp án D' })).toBeNull();
    expect(screen.getByText('Đã trả lời 0/3 câu')).toBeTruthy();
  });

  it('bandeau « Xem hình / bảng trên đề giấy — Câu N » seulement sur la question qui dépend d\'une figure', async () => {
    await render(<EvaluationRun setId="s1" />);
    expect(screen.getAllByText('Xem hình / bảng trên đề giấy — Câu 3')).toHaveLength(1);
    expect(screen.queryByText(/Xem hình \/ bảng trên đề giấy — Câu 5/)).toBeNull();
  });

  it('envoie les positions choisies (indices d\'origine), sans retour juste/faux', async () => {
    await render(<EvaluationRun setId="s1" />);
    expect(mockStartEval).toHaveBeenCalledWith({ setId: 's1', attemptId: 'id-1' });
    await fireEvent.press(screen.getByRole('radio', { name: 'Câu 3: đáp án A' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Câu 5: đáp án C' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Câu 3: đáp án D' }));
    expect(screen.getByText('Đã trả lời 2/3 câu')).toBeTruthy();
    expect(screen.queryByText('Đúng rồi!')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Nộp bài' }));
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Còn 1 câu chưa trả lời.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Vẫn nộp bài' }));
    expect(mockSubmit).toHaveBeenCalledWith({ attemptId: 'id-1', answers: [{ question_id: 'q3', choice: 3 }, { question_id: 'q5', choice: 2 }, { question_id: 'q9', choice: null }] });
    expect(screen.getByText('Đã nộp, chờ phụ huynh duyệt')).toBeTruthy();
  });

  it('les trois langues ont le bandeau et les libellés', () => {
    expect(i18n.t('revisions.sheet.figure', { n: 7, lng: 'vi' })).toBe('Xem hình / bảng trên đề giấy — Câu 7');
    expect(i18n.t('revisions.sheet.figure', { n: 7, lng: 'fr' })).toBe('Voir la figure / le tableau sur le sujet papier — Question 7');
    expect(i18n.t('revisions.sheet.figure', { n: 7, lng: 'en' })).toBe('See the figure / table on the paper exam — Question 7');
    for (const lng of ['vi', 'fr', 'en']) {
      for (const key of ['title', 'intro', 'question', 'choice', 'progress']) expect(i18n.t(`revisions.sheet.${key}`, { lng, n: 1, letter: 'A', done: 1, total: 2 })).not.toMatch(/revisions\./);
    }
  });
});

describe('Phiếu trả lời — papier avec énoncés', () => {
  beforeEach(() => {
    mockInfos = [info({ answer_sheet_only: false, question_count: 2 })];
    mockQuestions = paperQuestions;
  });

  it('énoncé + choix lettrés, numéro d\'origine, bandeau figure', async () => {
    await render(<EvaluationRun setId="s1" />);
    expect(screen.getByText('Câu 1')).toBeTruthy();
    expect(screen.getByText('Limite de (x+1)/(x−2) en +∞ ?')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'A. 0' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'D. +∞' })).toBeTruthy();
    expect(screen.getAllByText('Xem hình / bảng trên đề giấy — Câu 2')).toHaveLength(1);
  });

  it('répond et envoie dans l\'ordre de la feuille', async () => {
    await render(<EvaluationRun setId="s1" />);
    await fireEvent.press(screen.getByRole('radio', { name: 'B. 1' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'C. [2;3]' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Nộp bài' }));
    expect(mockSubmit).toHaveBeenCalledWith({ attemptId: 'id-1', answers: [{ question_id: 'q1', choice: 1 }, { question_id: 'q2', choice: 2 }] });
  });
});

describe('jeu sans support papier : parcours actuel inchangé', () => {
  it('énoncé + choix, pas de feuille ni de bandeau', async () => {
    mockInfos = [info({ paper_support: false, answer_sheet_only: false, question_count: 1 })];
    mockQuestions = [{ question_id: 'q1', position: 0, prompt: 'Un plus un ?', choices: ['1', '2', '3'], origin_number: null, needs_figure: false }];
    await render(<EvaluationRun setId="s1" />);
    expect(screen.queryByText('Phiếu trả lời')).toBeNull();
    expect(screen.getByText('Un plus un ?')).toBeTruthy();
    expect(screen.getByText('Câu 1/1')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: '2' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Nộp bài' }));
    expect(mockSubmit).toHaveBeenCalledWith({ attemptId: 'id-1', answers: [{ question_id: 'q1', choice: 1 }] });
  });
});

describe('résultat d\'une feuille de réponses', () => {
  it('correction masquée : numéro + sa lettre, jamais de bonne réponse ni de texte du support', async () => {
    mockResult = {
      status: 'validated', set_id: 's1', score: 1, total: 3, show_correction: false, paper_support: true, answer_sheet_only: true,
      missed: [
        { question_id: 'q5', position: 1, number: 5, prompt: '', chosen_text: 'C' },
        { question_id: 'q9', position: 2, number: null, prompt: '', chosen_text: null },
      ],
    };
    await render(<ResultView attemptId="a1" />);
    expect(screen.getByText('Điểm: 1/3')).toBeTruthy();
    expect(screen.getByText('Câu 5')).toBeTruthy();
    expect(screen.getByText('Câu #3')).toBeTruthy(); // sans numéro d'origine : « #rang » (position 2 → 3)
    expect(screen.getByText('Bạn chọn: C')).toBeTruthy();
    expect(screen.queryByText(/Đáp án đúng/)).toBeNull();
  });

  it('correction activée : lettres choisies et lettre juste', async () => {
    mockResult = {
      status: 'validated', set_id: 's1', score: 1, total: 2, show_correction: true, paper_support: true, answer_sheet_only: true,
      questions: [
        { question_id: 'q3', position: 0, number: 3, prompt: '', choices: ['A', 'B', 'C', 'D'], choice_index: 0, correct_index: 0, explanation: null, is_correct: true },
        { question_id: 'q5', position: 1, number: 5, prompt: '', choices: ['A', 'B', 'C'], choice_index: 2, correct_index: 1, explanation: null, is_correct: false },
      ],
    };
    await render(<ResultView attemptId="a1" />);
    expect(screen.getByText('Câu 5')).toBeTruthy();
    expect(screen.getByText('Bạn chọn: C')).toBeTruthy();
    expect(screen.getByText('Đáp án đúng: B')).toBeTruthy();
  });

  it('papier avec énoncés : « Câu N — énoncé »', async () => {
    mockResult = {
      status: 'validated', set_id: 's1', score: 0, total: 1, show_correction: false, paper_support: true, answer_sheet_only: false,
      missed: [{ question_id: 'q2', position: 1, number: 2, prompt: 'Selon la courbe ?', chosen_text: '[0;1]' }],
    };
    await render(<ResultView attemptId="a1" />);
    expect(screen.getByText('Câu 2 — Selon la courbe ?')).toBeTruthy();
  });
});
