import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import { AnswerGrid } from '@/components/quiz/AnswerGrid';
import AnswersScreen from '../app/quiz/answers';
import type { ChildRow } from '@/types/models';

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

const minh = { id: 'c-minh', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5' } as ChildRow;
let mockRole: 'parent' | 'child' = 'parent';
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: { member: { role: mockRole, id: 'm-p' }, family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' }, children: [] } }) }));
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({ me: { family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' }, member: { id: 'm-p' } }, viewer: { role: 'parent', memberId: 'm-p', childId: null }, children: [minh], child: minh, select: jest.fn() }),
}));

const set = (over: Record<string, unknown> = {}) => ({ id: 's1', child_id: 'c-minh', title: 'Examen', status: 'draft', material_kind: 'exam', kind_detected: true, ...over });
const q = (id: string, position: number, over: Record<string, unknown> = {}) => ({
  id, set_id: 's1', position, prompt: `Énoncé ${id}`, choices: ['x', 'y', 'z', 'w'], correct_index: 1, explanation: null,
  origin_number: null, needs_figure: false, to_verify: false, confirmed: false, ...over,
});
let mockSet: unknown = set();
let mockQuestions: unknown[] = [];
const mockConfirm = jest.fn();
const mockStatus = jest.fn();
const run = (fn: jest.Mock) => ({ mutate: (v: unknown, o?: { onSuccess?: () => void }) => { fn(v); o?.onSuccess?.(); }, isPending: false });
jest.mock('@/hooks/useQuizzes', () => ({
  useQuizSet: () => ({ data: mockSet, isPending: false }),
  useParentQuestions: () => ({ data: mockQuestions, isPending: false }),
  useConfirmAnswers: () => run(mockConfirm),
  useSetQuizStatus: () => run(mockStatus),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = 'parent';
  mockSet = set();
  mockQuestions = [
    q('q7', 2, { origin_number: 7 }),
    q('q5', 0, { origin_number: 5 }),
    q('q6', 1, { origin_number: 6, needs_figure: true, to_verify: true }),
    q('qx', 3),
  ];
});

describe('Grille Đáp án (parent, types examen)', () => {
  it('une ligne par question, dans l\'ordre des NUMÉROS D\'ORIGINE, sans numéro à la suite', async () => {
    await render(<AnswerGrid setId="s1" />);
    const headers = screen.getAllByRole('header').map((h) => h.props.children).flat().filter((c: unknown) => typeof c === 'string' && /^Câu/.test(c as string));
    expect(headers).toEqual(['Câu 5', 'Câu 6', 'Câu 7', 'Câu #4']);
    expect(screen.getByText('Énoncé q5')).toBeTruthy();
  });

  it('choix A à D en pastilles accessibles, réponse proposée pré-sélectionnée mais NON confirmée', async () => {
    await render(<AnswerGrid setId="s1" />);
    for (const letter of ['A', 'B', 'C', 'D']) expect(screen.getByRole('radio', { name: `Câu 5: đáp án ${letter}` })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Câu 5: đáp án B' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole('radio', { name: 'Câu 5: đáp án A' }).props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.queryByText('Đã xác nhận')).toBeNull();
    expect(screen.getByText('Còn 4 đáp án chưa xác nhận')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đăng cho bạn ấy' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('questions « à vérifier » / « dépend d\'une figure » mises en évidence', async () => {
    await render(<AnswerGrid setId="s1" />);
    expect(screen.getByText('Có hình / bảng trên đề giấy')).toBeTruthy();
    expect(screen.getByText('Cần kiểm tra')).toBeTruthy();
  });

  it('toucher une pastille CONFIRME la réponse (même la réponse proposée) ; enregistrement atomique des seules lignes confirmées', async () => {
    await render(<AnswerGrid setId="s1" />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Câu 5: đáp án B' })); // confirme la suggestion
    await fireEvent.press(screen.getByRole('radio', { name: 'Câu 6: đáp án D' })); // change et confirme
    expect(screen.getByText('Có thay đổi chưa lưu')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu xác nhận' }));
    expect(mockConfirm).toHaveBeenCalledWith({ setId: 's1', answers: [{ question_id: 'q5', correct: 1 }, { question_id: 'q6', correct: 3 }] });
    expect(screen.queryByText('Có thay đổi chưa lưu')).toBeNull();
  });

  it('« Confirmer les réponses non signalées » ne touche JAMAIS une question signalée', async () => {
    await render(<AnswerGrid setId="s1" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận các câu không bị đánh dấu' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu xác nhận' }));
    expect(mockConfirm).toHaveBeenCalledWith({ setId: 's1', answers: [{ question_id: 'q5', correct: 1 }, { question_id: 'q7', correct: 1 }, { question_id: 'qx', correct: 1 }] });
  });

  it('publication : désactivée tant que tout n\'est pas confirmé ET enregistré ; puis ouvre l\'éditeur', async () => {
    mockQuestions = [q('q5', 0, { origin_number: 5, confirmed: true }), q('q6', 1, { origin_number: 6, confirmed: true })];
    await render(<AnswerGrid setId="s1" />);
    expect(screen.getByText('Tất cả đáp án đã được xác nhận')).toBeTruthy();
    expect(screen.getAllByText('Đã xác nhận')).toHaveLength(2);
    const publish = screen.getByRole('button', { name: 'Đăng cho bạn ấy' });
    expect(publish.props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(publish);
    expect(mockStatus).toHaveBeenCalledWith({ setId: 's1', status: 'published' });
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/quiz/[id]', params: { id: 's1' } });
  });

  it('une modification non enregistrée bloque la publication', async () => {
    mockQuestions = [q('q5', 0, { origin_number: 5, confirmed: true })];
    await render(<AnswerGrid setId="s1" />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Câu 5: đáp án C' }));
    expect(screen.getByRole('button', { name: 'Đăng cho bạn ấy' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('une réponse encore « à vérifier » côté serveur bloque la publication même localement confirmée', async () => {
    mockQuestions = [q('q5', 0, { origin_number: 5, confirmed: true, to_verify: true })];
    await render(<AnswerGrid setId="s1" />);
    expect(screen.getByText('Còn 1 đáp án cần kiểm tra')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đăng cho bạn ấy' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('modifier l\'énoncé : ouvre l\'éditeur de la question', async () => {
    await render(<AnswerGrid setId="s1" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sửa câu hỏi 5' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quiz/question', params: { set: 's1', id: 'q5' } });
  });

  it('jeu publié : lecture seule (pastilles inactives, aucun bouton de publication)', async () => {
    mockSet = set({ status: 'published' });
    mockQuestions = [q('q5', 0, { origin_number: 5, confirmed: true })];
    await render(<AnswerGrid setId="s1" />);
    expect(screen.getByRole('radio', { name: 'Câu 5: đáp án A' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.queryByRole('button', { name: 'Đăng cho bạn ấy' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sửa câu hỏi 5' })).toBeNull();
  });

  it('type détecté par l\'IA signalé ; jeu vide : message', async () => {
    mockQuestions = [];
    await render(<AnswerGrid setId="s1" />);
    expect(screen.getByText('Do AI phát hiện — bạn có thể sửa.')).toBeTruthy();
    expect(screen.getByText('Bộ câu hỏi chưa có câu nào.')).toBeTruthy();
  });

  it('route réservée au parent : un enfant est redirigé', async () => {
    mockRole = 'child';
    await render(<AnswersScreen />);
    expect(mockRedirect).toHaveBeenCalledWith('/');
    expect(screen.queryByText('Đáp án')).toBeNull();
  });
});
