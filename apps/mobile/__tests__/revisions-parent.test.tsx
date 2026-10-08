import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import '@/i18n';
import { AttemptDetail } from '@/components/quiz/AttemptDetail';
import { NewQuizSet } from '@/components/quiz/NewQuizSet';
import { ParentRevisions } from '@/components/quiz/ParentRevisions';
import { QuestionEditor } from '@/components/quiz/QuestionEditor';
import { QuizEditor } from '@/components/quiz/QuizEditor';
import NewQuizScreen from '../app/quiz/new';
import QuestionScreen from '../app/quiz/question';
import AttemptScreen from '../app/quiz/attempt/[id]';
import type { ChildRow } from '@/types/models';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
  useLocalSearchParams: () => ({ id: 'a1', set: 's1' }),
  Redirect: (props: { href: string }) => { mockRedirect(props.href); return null; },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
let mockSeq = 0;
jest.mock('@/api/ids', () => ({ newId: () => `id-${++mockSeq}` }));

const minh = { id: 'c-minh', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5' } as ChildRow;
const khang = { id: 'c-khang', name: 'Khang', birth_date: '2013-05-01', color: '#2EC4A6' } as ChildRow;
let mockRole: 'parent' | 'child' = 'parent';
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: { member: { role: mockRole, id: 'm-p' }, family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' }, children: [] } }) }));
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({
    me: { family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' }, member: { id: 'm-p' } },
    viewer: { role: mockRole, memberId: 'm-p', childId: null },
    children: [minh, khang], child: minh, select: jest.fn(),
  }),
}));

const set = (over: Record<string, unknown> = {}) => ({ id: 's1', family_id: 'f', child_id: 'c-minh', title: 'Fractions', subject: 'Toán', status: 'draft', created_by: 'm-p', created_at: '2026-07-01T00:00:00Z', updated_at: 'x', deleted_at: null, question_count: 2, material_kind: 'course', kind_detected: false, ...over });
const question = (id: string, position: number, prompt: string, over: Record<string, unknown> = {}) => ({ id, set_id: 's1', family_id: 'f', position, prompt, choices: ['a', 'b', 'c'], created_at: 'x', updated_at: 'x', correct_index: 1, explanation: 'parce que', origin_number: null, needs_figure: false, to_verify: false, confirmed: true, ...over });
let mockSets: unknown[] = [];
let mockPending: unknown[] = [];
let mockSet: unknown = set();
let mockQuestions: unknown[] = [question('q1', 0, 'Un plus un ?'), question('q2', 1, 'Deux plus deux ?')];
let mockAttempts: unknown[] = [];
let mockDetail: unknown = null;
const mockUpsert = jest.fn();
const mockStatus = jest.fn();
const mockCopy = jest.fn();
const mockRelaunch = jest.fn();
const mockReorder = jest.fn();
const mockDelQ = jest.fn();
const mockDelSet = jest.fn();
const mockValidate = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockConfirm = jest.fn();
const mockKind = jest.fn();
const ok = (fn: jest.Mock) => ({ mutate: (v: unknown, o?: { onSuccess?: () => void }) => { fn(v); o?.onSuccess?.(); }, isPending: false });
jest.mock('@/hooks/useQuizzes', () => ({
  useQuizSets: () => ({ data: mockSets }),
  usePendingQuizAttempts: () => ({ data: mockPending }),
  useChildAttempts: () => ({ data: [] }),
  useQuizSet: () => ({ data: mockSet, isPending: false }),
  useParentQuestions: () => ({ data: mockQuestions, isPending: false }),
  useSetAttempts: () => ({ data: mockAttempts }),
  useAttemptDetail: () => ({ data: mockDetail, isPending: false }),
  useUpsertQuestion: () => ok(mockUpsert),
  useSetQuizStatus: () => ok(mockStatus),
  useCopyQuizSet: () => ok(mockCopy),
  useRelaunchEvaluation: () => ok(mockRelaunch),
  useReorderQuestions: () => ok(mockReorder),
  useDeleteQuestion: () => ok(mockDelQ),
  useDeleteQuizSet: () => ok(mockDelSet),
  useValidateQuizAttempt: () => ok(mockValidate),
  useCreateQuizSet: () => ok(mockCreate),
  useUpdateQuizSet: () => ok(mockUpdate),
  useConfirmAnswers: () => ok(mockConfirm),
  useSetMaterialKind: () => ok(mockKind),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = 'parent'; mockSets = []; mockPending = []; mockSet = set(); mockAttempts = []; mockDetail = null;
  mockQuestions = [question('q1', 0, 'Un plus un ?'), question('q2', 1, 'Deux plus deux ?')];
});

describe('Révisions — liste du parent', () => {
  it('sélecteur avec les PRÉNOMS, jeux de l\'enfant sélectionné, état et nombre de questions', async () => {
    mockSets = [set(), set({ id: 's2', title: 'Verbes', subject: null, status: 'published', question_count: 5 })];
    await render(<ParentRevisions />);
    expect(screen.getByRole('tab', { name: 'Minh, 17 tuổi' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Khang, 13 tuổi' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fractions, Bản nháp, 2 câu hỏi' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verbes, Đã đăng, 5 câu hỏi' })).toBeTruthy();
    expect(screen.queryByText(/hạng|rank|classement/i)).toBeNull();
  });
  it('liste vide : message et bouton de création', async () => {
    await render(<ParentRevisions />);
    expect(screen.getByText('Chưa có bộ câu hỏi nào cho bạn này.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo bộ câu hỏi' }));
    expect(mockPush).toHaveBeenCalledWith('/quiz/new');
  });
  it('évaluations à valider de l\'enfant : ouvre le détail', async () => {
    mockPending = [{ id: 'a1', child_id: 'c-minh', set_title: 'Fractions' }, { id: 'a2', child_id: 'c-khang', set_title: 'Autre' }];
    await render(<ParentRevisions />);
    expect(screen.queryByRole('button', { name: /Autre/ })).toBeNull(); // seules celles de l'enfant sélectionné
    await fireEvent.press(screen.getByRole('button', { name: 'Fractions, Chờ duyệt' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quiz/attempt/[id]', params: { id: 'a1' } });
  });
});

describe('Révisions — création d\'un jeu', () => {
  it('titre obligatoire ; crée le jeu pour l\'enfant choisi puis ouvre l\'éditeur', async () => {
    await render(<NewQuizSet />);
    expect(screen.getByRole('button', { name: 'Tạo' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.changeText(screen.getByLabelText('Tiêu đề'), 'Fractions');
    await fireEvent.changeText(screen.getByLabelText('Môn học (không bắt buộc)'), 'Toán');
    await fireEvent.press(screen.getByRole('radio', { name: 'Khang' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo' }));
    expect(mockCreate).toHaveBeenCalledWith({ id: 'id-1', familyId: 'f', childId: 'c-khang', memberId: 'm-p', title: 'Fractions', subject: 'Toán' });
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/quiz/[id]', params: { id: 'id-1' } });
  });
});

describe('Révisions — éditeur', () => {
  it('brouillon : questions modifiables, publication, copie pour l\'autre enfant', async () => {
    await render(<QuizEditor setId="s1" />);
    expect(screen.getByText('1. Un plus un ?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thêm câu hỏi' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Chuyển xuống: Un plus un ?' }));
    expect(mockReorder).toHaveBeenCalledWith({ setId: 's1', ids: ['q2', 'q1'] });
    await fireEvent.press(screen.getByRole('button', { name: 'Xóa câu hỏi: Un plus un ?' }));
    expect(mockDelQ).toHaveBeenCalledWith('q1');
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng cho bạn ấy' }));
    expect(mockStatus).toHaveBeenCalledWith({ setId: 's1', status: 'published' });
    await fireEvent.press(screen.getByRole('button', { name: 'Sao chép cho Khang' }));
    expect(mockCopy).toHaveBeenCalledWith({ source: 's1', newSet: expect.any(String), childId: 'c-khang' });
  });
  it('sans question : publication impossible', async () => {
    mockQuestions = [];
    await render(<QuizEditor setId="s1" />);
    expect(screen.getByText('Chưa có câu hỏi. Thêm câu đầu tiên.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đăng cho bạn ấy' }).props.accessibilityState).toMatchObject({ disabled: true });
  });
  it('jeu publié : questions verrouillées, dépublier et relancer l\'évaluation', async () => {
    mockSet = set({ status: 'published' });
    mockAttempts = [{ id: 'a1', status: 'validated', started_at: '2026-07-02T01:00:00Z', score: 2, total: 3 }];
    await render(<QuizEditor setId="s1" />);
    expect(screen.getByText('Bộ câu hỏi đã đăng. Gỡ xuống để sửa.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thêm câu hỏi' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Xóa câu hỏi/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Cho làm lại bài kiểm tra' }));
    expect(mockRelaunch).toHaveBeenCalledWith({ setId: 's1', attemptId: expect.any(String) });
    await fireEvent.press(screen.getByRole('button', { name: 'Gỡ xuống' }));
    expect(mockStatus).toHaveBeenCalledWith({ setId: 's1', status: 'draft' });
    expect(screen.getByRole('button', { name: '02/07/2026, Đã duyệt, 2/3' })).toBeTruthy();
  });
  it('brouillon avec tentatives : verrouillé (copier le jeu)', async () => {
    mockAttempts = [{ id: 'a1', status: 'validated', started_at: '2026-07-02T01:00:00Z', score: 1, total: 2 }];
    await render(<QuizEditor setId="s1" />);
    expect(screen.getByText(/Đã có bài làm nên không sửa được/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thêm câu hỏi' })).toBeNull();
  });
  it('pas de relance tant qu\'une évaluation est en cours', async () => {
    mockSet = set({ status: 'published' });
    mockAttempts = [{ id: 'a1', status: 'in_progress', started_at: '2026-07-02T01:00:00Z', score: null, total: null }];
    await render(<QuizEditor setId="s1" />);
    expect(screen.queryByRole('button', { name: 'Cho làm lại bài kiểm tra' })).toBeNull();
  });
  it('supprimer le jeu', async () => {
    await render(<QuizEditor setId="s1" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Xóa bộ câu hỏi' }));
    expect(mockDelSet).toHaveBeenCalledWith('s1');
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('Révisions — édition d\'une question', () => {
  it('erreurs affichées (énoncé, 3 choix, bonne réponse), rien n\'est envoyé', async () => {
    await render(<QuestionEditor setId="s1" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu câu hỏi' }));
    expect(screen.getByText('Nhập nội dung câu hỏi')).toBeTruthy();
    expect(screen.getByText('Cần 3 hoặc 4 lựa chọn')).toBeTruthy();
    expect(screen.getByText('Chọn đáp án đúng')).toBeTruthy();
    expect(mockUpsert).not.toHaveBeenCalled();
  });
  it('doublons refusés', async () => {
    await render(<QuestionEditor setId="s1" />);
    await fireEvent.changeText(screen.getByLabelText('Nội dung câu hỏi'), 'Q ?');
    await fireEvent.changeText(screen.getByLabelText('Lựa chọn 1'), 'Paris');
    await fireEvent.changeText(screen.getByLabelText('Lựa chọn 2'), ' paris');
    await fireEvent.changeText(screen.getByLabelText('Lựa chọn 3'), 'Rome');
    await fireEvent.press(screen.getByRole('radio', { name: 'Đáp án đúng: lựa chọn 3' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu câu hỏi' }));
    expect(screen.getByText('Các lựa chọn không được trùng nhau')).toBeTruthy();
    expect(mockUpsert).not.toHaveBeenCalled();
  });
  it('question valide : envoyée avec id fixé, position à la suite, bonne réponse recalée', async () => {
    await render(<QuestionEditor setId="s1" />);
    await fireEvent.changeText(screen.getByLabelText('Nội dung câu hỏi'), 'Capitale ?');
    await fireEvent.changeText(screen.getByLabelText('Lựa chọn 2'), 'Paris');
    await fireEvent.changeText(screen.getByLabelText('Lựa chọn 3'), 'Rome');
    await fireEvent.changeText(screen.getByLabelText('Lựa chọn 4'), 'Lima');
    await fireEvent.press(screen.getByRole('radio', { name: 'Đáp án đúng: lựa chọn 3' }));
    await fireEvent.changeText(screen.getByLabelText('Giải thích (không bắt buộc)'), 'Géographie');
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu câu hỏi' }));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(1));
    expect(mockUpsert).toHaveBeenCalledWith({ id: expect.any(String), setId: 's1', position: 2, prompt: 'Capitale ?', choices: ['Paris', 'Rome', 'Lima'], correct: 1, explanation: 'Géographie' });
    expect(mockBack).toHaveBeenCalled();
  });
  it('modification : champs préremplis, même id, même position', async () => {
    await render(<QuestionEditor setId="s1" questionId="q2" />);
    expect(screen.getByLabelText('Nội dung câu hỏi').props.value).toBe('Deux plus deux ?');
    await fireEvent.changeText(screen.getByLabelText('Nội dung câu hỏi'), 'Deux plus trois ?');
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu câu hỏi' }));
    expect(mockUpsert).toHaveBeenCalledWith({ id: 'q2', setId: 's1', position: 1, prompt: 'Deux plus trois ?', choices: ['a', 'b', 'c'], correct: 1, explanation: 'parce que' });
  });
});

describe('Révisions — détail et validation d\'une tentative', () => {
  const detail = (status: string) => ({
    attempt: { id: 'a1', child_id: 'c-minh', status, started_at: '2026-07-02T01:00:00Z', score: 1, total: 2 },
    set: { title: 'Fractions' },
    questions: [
      { ...question('q1', 0, 'Un plus un ?'), choice_index: 1, is_correct: true },
      { ...question('q2', 1, 'Deux plus deux ?'), choice_index: 0, is_correct: false },
    ],
  });
  it('détail par question, score, validation (une tentative soumise)', async () => {
    mockDetail = detail('submitted');
    await render(<AttemptDetail attemptId="a1" />);
    expect(screen.getByText('1/2')).toBeTruthy();
    expect(screen.getByText('Bạn chọn: a')).toBeTruthy();
    expect(screen.getByText('Đáp án đúng: b')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Duyệt kết quả' }));
    expect(mockValidate).toHaveBeenCalledWith({ attemptId: 'a1', showCorrection: false });
    expect(mockBack).toHaveBeenCalled();
  });
  it('« Montrer la correction à l\'enfant » : désactivé par défaut, posé AU MOMENT de valider', async () => {
    mockDetail = detail('submitted');
    await render(<AttemptDetail attemptId="a1" />);
    const toggle = screen.getByLabelText('Hiện đáp án đúng cho con');
    expect(toggle.props.value).toBe(false);
    await fireEvent(toggle, 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Duyệt kết quả' }));
    expect(mockValidate).toHaveBeenCalledWith({ attemptId: 'a1', showCorrection: true });
  });
  it('déjà validée : pas de bouton', async () => {
    mockDetail = detail('validated');
    await render(<AttemptDetail attemptId="a1" />);
    expect(screen.queryByRole('button', { name: 'Duyệt kết quả' })).toBeNull();
    expect(screen.queryByLabelText('Hiện đáp án đúng cho con')).toBeNull();
    expect(screen.getByText('Không hiện đáp án đúng cho con.')).toBeTruthy();
  });
});

describe('Révisions — éditeur : supports multiples (D-061)', () => {
  const exam = [
    question('q1', 0, 'Calculer 1 + 1', { origin_number: 5, confirmed: false }),
    question('q2', 1, 'D\'après la courbe…', { origin_number: 6, needs_figure: true, to_verify: true, confirmed: false }),
  ];
  it('type de support : les 4 types, le type enregistré sélectionné, correction par le parent', async () => {
    mockSet = set({ material_kind: 'exam', kind_detected: true });
    mockQuestions = exam;
    await render(<QuizEditor setId="s1" />);
    expect(screen.getByRole('radio', { name: 'Đề thi giấy' }).props.accessibilityState).toMatchObject({ selected: true });
    for (const name of ['Đề thi kèm đáp án', 'Bài học', 'Danh sách cần học']) expect(screen.getByRole('radio', { name })).toBeTruthy();
    expect(screen.getByText('Do AI phát hiện — bạn có thể sửa.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Bài học' }));
    expect(mockKind).toHaveBeenCalledWith({ setId: 's1', kind: 'course' });
    await fireEvent.press(screen.getByRole('radio', { name: 'Đề thi giấy' })); // déjà sélectionné : aucun appel
    expect(mockKind).toHaveBeenCalledTimes(1);
  });
  it('numéro d\'origine, signalements ; bouton de confirmation seulement sur les réponses « à vérifier »', async () => {
    mockSet = set({ material_kind: 'exam' });
    mockQuestions = exam;
    await render(<QuizEditor setId="s1" />);
    expect(screen.getByText('Câu 5. Calculer 1 + 1')).toBeTruthy();
    expect(screen.getByText('Câu 6. D\'après la courbe…')).toBeTruthy();
    expect(screen.getByText('Phụ thuộc hình / bảng')).toBeTruthy();
    expect(screen.getAllByText('Cần kiểm tra')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Xác nhận đáp án câu 5' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận đáp án câu 6' }));
    expect(mockConfirm).toHaveBeenCalledWith({ setId: 's1', answers: [{ question_id: 'q2', correct: 1 }] });
  });
  it('examen : publication impossible tant qu\'une réponse n\'est pas confirmée (message), grille Đáp án proposée', async () => {
    mockSet = set({ material_kind: 'exam' });
    mockQuestions = exam;
    await render(<QuizEditor setId="s1" />);
    expect(screen.getByRole('button', { name: 'Đăng cho bạn ấy' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText('Còn 1 đáp án cần kiểm tra')).toBeTruthy();
    expect(screen.getByText('Còn 2 đáp án chưa xác nhận')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Mở bảng Đáp án' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quiz/answers', params: { id: 's1' } });
  });
  it('examen entièrement confirmé : publication possible', async () => {
    mockSet = set({ material_kind: 'exam_key' });
    mockQuestions = exam.map((q) => ({ ...(q as object), confirmed: true, to_verify: false }));
    await render(<QuizEditor setId="s1" />);
    expect(screen.getByRole('button', { name: 'Đăng cho bạn ấy' }).props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng cho bạn ấy' }));
    expect(mockStatus).toHaveBeenCalledWith({ setId: 's1', status: 'published' });
  });
  it('un TYPE « cours » ne retire pas le blocage : une réponse « à vérifier » empêche de publier', async () => {
    mockSet = set({ material_kind: 'course', kind_detected: true });
    mockQuestions = [question('q1', 0, 'Q1', { to_verify: true, confirmed: false })];
    await render(<QuizEditor setId="s1" />);
    expect(screen.getByRole('button', { name: 'Đăng cho bạn ấy' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.queryByRole('button', { name: 'Mở bảng Đáp án' })).toBeNull(); // la grille est réservée aux examens
  });
  it('cours sans signalement : publication libre (comportement actuel), aucune obligation de confirmer', async () => {
    mockSet = set({ material_kind: 'course' });
    mockQuestions = [question('q1', 0, 'Q1', { confirmed: false })];
    await render(<QuizEditor setId="s1" />);
    expect(screen.getByRole('button', { name: 'Đăng cho bạn ấy' }).props.accessibilityState).toMatchObject({ disabled: false });
  });
  it('jeu publié : type affiché en lecture seule (pas de sélecteur)', async () => {
    mockSet = set({ material_kind: 'list', status: 'published' });
    await render(<QuizEditor setId="s1" />);
    expect(screen.queryByRole('radio', { name: 'Bài học' })).toBeNull();
    expect(screen.getByText('Danh sách cần học')).toBeTruthy();
  });
});

describe('routes parent : un enfant est redirigé', () => {
  it.each([['quiz/new', NewQuizScreen], ['quiz/question', QuestionScreen], ['quiz/attempt/[id]', AttemptScreen]])('%s', async (_name, Screen) => {
    mockRole = 'child';
    const Component = Screen as () => React.ReactElement | null;
    await render(<Component />);
    expect(mockRedirect).toHaveBeenCalledWith('/');
  });
  it('un parent obtient la création', async () => {
    await render(<NewQuizScreen />);
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(screen.getByText('Bộ câu hỏi mới')).toBeTruthy();
  });
});
