import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import { AdminCatalog } from '@/components/admin/AdminCatalog';
import { AdminImport } from '@/components/admin/AdminImport';
import { AdminQuizEditor } from '@/components/admin/AdminQuizEditor';
import { AdminNewQuiz } from '@/components/admin/AdminNewQuiz';
import AdminQuestionScreen from '../app/admin/question';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }),
  useLocalSearchParams: () => ({ quiz: 'z1' }),
  Redirect: (props: { href: string }) => { mockRedirect(props.href); return null; },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null }));
let mockSeq = 0;
jest.mock('@/api/ids', () => ({ newId: () => `id-${++mockSeq}` }));
jest.mock('@/components/confirm', () => ({ confirmDialog: (o: { onConfirm: () => void }) => o.onConfirm() }));

let mockRole: 'parent' | 'child' = 'parent';
let mockAdmin: boolean | undefined = true;
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: { member: { role: mockRole, id: 'm-p' }, family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' }, children: [] } }) }));

const quiz = (over: Record<string, unknown> = {}) => ({
  id: 'z1', country: 'VN', grade: '5', subject: 'hist_geo', week_label: 'Tuần 3', title: 'Lịch sử', status: 'draft', release_on: '2026-09-07', due_on: '2026-09-13',
  material_kind: 'course', kind_detected: false, paper_support: false, answer_sheet_only: false, attempts_count: 0, ...over,
});
const listRow = (over: Record<string, unknown> = {}) => ({ ...quiz(), question_count: 3, to_verify_count: 0, ...over });
const q = (id: string, position: number, over: Record<string, unknown> = {}) => ({
  id, position, prompt: `Câu ${position + 1}`, choices: ['A1', 'B1', 'C1'], origin_number: null, needs_figure: false, source: null, correct_index: 0, explanation: null, to_verify: false, confirmed: true, ...over,
});
let mockList: unknown[] = [];
let mockQuiz: unknown = quiz();
let mockQuestions: unknown[] = [];
const mockConfirm = jest.fn();
const mockStatus = jest.fn();
const mockDates = jest.fn();
const mockKind = jest.fn();
const mockCreate = jest.fn();
const mockDelete = jest.fn();
const mockDelQ = jest.fn();
const mockPurge = jest.fn();
const impact = (over: Record<string, unknown> = {}) => ({ quiz_id: 'z1', title: 'Lịch sử', subject: 'hist_geo', country: 'VN', grade: '5', week_label: 'Tuần 3', status: 'published', families: 1, children: 2, attempts: 3, in_progress: 1, submitted: 1, validated: 1, points: 8, questions: 3, answers: 6, ...over });
const ok = (fn: jest.Mock) => ({ mutate: (v: unknown, o?: { onSuccess?: () => void }) => { fn(v); o?.onSuccess?.(); }, isPending: false });
jest.mock('@/hooks/useCatalog', () => ({
  useIsPlatformAdmin: () => ({ data: mockAdmin, isPending: mockAdmin === undefined }),
  useCatalogList: () => ({ data: mockList, isPending: false }),
  useCatalogQuiz: () => ({ data: mockQuiz, isPending: false }),
  useCatalogQuestions: () => ({ data: mockQuestions, isPending: false }),
  useUpsertCatalogQuestion: () => ok(jest.fn()),
  useConfirmCatalogAnswers: () => ok(mockConfirm),
  useSetCatalogStatus: () => ok(mockStatus),
  useSetCatalogDates: () => ({ mutateAsync: async (v: unknown) => { mockDates(v); }, isPending: false }),
  useSetCatalogKind: () => ok(mockKind),
  useSetCatalogPaper: () => ok(jest.fn()),
  useUpdateCatalogInfo: () => ok(jest.fn()),
  useDeleteCatalogQuestion: () => ok(mockDelQ),
  useDeleteCatalogQuiz: () => ok(mockDelete),
  useReorderCatalogQuestions: () => ok(jest.fn()),
  useCreateCatalogQuiz: () => ok(mockCreate),
  useCatalogQuizImpact: () => ({ data: impact(), isPending: false, isFetching: false, isError: false, refetch: jest.fn() }),
  usePurgeCatalogQuiz: () => ({ isPending: false, mutate: (v: unknown, o?: { onSuccess?: (r: unknown) => void }) => { mockPurge(v); o?.onSuccess?.({ purged: true, title: 'Lịch sử', counts: { families: 1, children: 2, attempts: 3, validated: 1, points: 8, questions: 3 } }); } }),
  useCatalogBulk: () => ({ loadExisting: async () => [], write: async () => [], publish: async () => [] }),
}));
jest.mock('@/services/documentText', () => ({ extractFileText: jest.fn() }));
jest.mock('@/hooks/useQuizzes', () => ({ useParentQuestions: () => ({ data: [], isPending: false }), useUpsertQuestion: () => ok(jest.fn()), useGenerateQuestions: () => ({ mutate: jest.fn(), isPending: false, error: null }) }));
jest.mock('@/hooks/useDisplayedChild', () => ({ useDisplayedChild: () => ({ me: { family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' } }, viewer: { role: 'parent' }, children: [], child: null, select: jest.fn() }) }));
jest.mock('@/services/documents', () => ({ documentUploadSupported: true, pickDocuments: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  mockSeq = 0; mockRole = 'parent'; mockAdmin = true; mockList = []; mockQuiz = quiz(); mockQuestions = [];
});

describe('Administration — accès (D-080)', () => {
  it.each([
    ['un parent ordinaire (non admin)', 'parent', false],
    ['un enfant', 'child', true],
  ] as const)('%s est renvoyé à l\'accueil, sans rien voir', async (_n, role, admin) => {
    mockRole = role; mockAdmin = admin;
    mockList = [listRow()];
    await render(<AdminCatalog />);
    expect(mockRedirect).toHaveBeenCalledWith('/');
    expect(screen.queryByText('Lịch sử')).toBeNull();
  });
  it('l\'éditeur, l\'import et l\'édition de question ont la MÊME garde', async () => {
    mockAdmin = false;
    await render(<AdminQuizEditor quizId="z1" />);
    await render(<AdminImport />);
    await render(<AdminQuestionScreen />);
    await render(<AdminNewQuiz />);
    expect(mockRedirect).toHaveBeenCalledTimes(4);
  });
});

describe('Administration — catalogue', () => {
  it('liste : semaine, titre, pays/classe/matière, état, dates et questions ; filtres pays / classe / matière', async () => {
    mockList = [
      listRow(),
      listRow({ id: 'z2', country: 'FR', grade: '6E', subject: 'maths', week_label: 'Semaine 1', title: 'Fractions', status: 'published', release_on: '2026-01-05', due_on: '2026-01-11' }),
    ];
    await render(<AdminCatalog />);
    expect(screen.getByText('Tuần 3 — Lịch sử')).toBeTruthy();
    expect(screen.getByText('Semaine 1 — Fractions')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Pháp' }));
    expect(screen.queryByText('Tuần 3 — Lịch sử')).toBeNull();
    expect(screen.getByText('Semaine 1 — Fractions')).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('radio', { name: 'Tất cả' })[0] as never);
    expect(screen.getByText('Tuần 3 — Lịch sử')).toBeTruthy();
  });
  it('filtre de classe : TOUTES les classes du pays, même sans QCM (liste fermée)', async () => {
    mockList = [listRow()];
    await render(<AdminCatalog />);
    expect(screen.queryByRole('radio', { name: 'Lớp 7' })).toBeNull(); // aucun pays choisi
    await fireEvent.press(screen.getByRole('radio', { name: 'Việt Nam' }));
    expect(screen.getAllByRole('radio', { name: /^Lớp \d+$/ })).toHaveLength(12);
    await fireEvent.press(screen.getByRole('radio', { name: 'Pháp' }));
    expect(screen.getAllByRole('radio', { name: /^(CP|CE1|CE2|CM1|CM2|6e|5e|4e|3e|2de|1re|Terminale)$/ })).toHaveLength(12);
  });
  it('ouvrir un QCM et importer', async () => {
    mockList = [listRow()];
    await render(<AdminCatalog />);
    await fireEvent.press(screen.getByRole('button', { name: /Tuần 3 — Lịch sử/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/admin/[id]', params: { id: 'z1' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Nhập bài trắc nghiệm' }));
    expect(mockPush).toHaveBeenCalledWith('/admin/import');
  });
  it('QCM à vérifier signalé dans la liste', async () => {
    mockList = [listRow({ to_verify_count: 2 })];
    await render(<AdminCatalog />);
    expect(screen.getByText(/2 đáp án cần kiểm tra/)).toBeTruthy();
  });
});

describe('Administration — suppression définitive (D-091)', () => {
  it('liste : une action « Xóa vĩnh viễn » par QCM (publié ou non), nommée par son titre, à côté de la carte et jamais dedans', async () => {
    mockList = [listRow(), listRow({ id: 'z2', title: 'Phân số', status: 'published' })];
    await render(<AdminCatalog />);
    expect(screen.getByRole('button', { name: 'Xóa vĩnh viễn: Lịch sử' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Xóa vĩnh viễn: Phân số' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Xóa vĩnh viễn: Phân số' }));
    expect(mockPush).not.toHaveBeenCalled(); // elle n'ouvre pas l'éditeur
  });
  it('liste : impact en clair, puis le titre exact à retaper avant que le bouton rouge ne s\'active', async () => {
    mockList = [listRow({ status: 'published' })];
    await render(<AdminCatalog />);
    await fireEvent.press(screen.getByRole('button', { name: 'Xóa vĩnh viễn: Lịch sử' }));
    expect(screen.getByText('2 bé, 3 lượt làm trong đó 1 đã duyệt, 8 điểm đã cộng (được giữ nguyên).')).toBeTruthy();
    const confirm = () => screen.getByRole('button', { name: 'Xóa vĩnh viễn «Lịch sử»' });
    expect(confirm().props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.changeText(screen.getByLabelText('Gõ đúng tiêu đề «Lịch sử» để xác nhận'), 'lịch sử');
    expect(confirm().props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.changeText(screen.getByLabelText('Gõ đúng tiêu đề «Lịch sử» để xác nhận'), 'Lịch sử');
    await fireEvent.press(confirm());
    expect(mockPurge).toHaveBeenCalledWith({ quizId: 'z1', confirm: 'Lịch sử' });
    expect(screen.queryByText('Xóa vĩnh viễn bài này?')).toBeNull(); // fermée après succès ; la liste est relue par la mutation
  });
  it('éditeur : un QCM PUBLIÉ avec tentatives reste verrouillé, mais se supprime définitivement ; retour à la liste ensuite', async () => {
    mockQuiz = quiz({ status: 'published', attempts_count: 3 });
    await render(<AdminQuizEditor quizId="z1" />);
    expect(screen.queryByRole('button', { name: 'Xóa bản nháp' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Xóa vĩnh viễn: Lịch sử' }));
    await fireEvent.changeText(screen.getByLabelText('Gõ đúng tiêu đề «Lịch sử» để xác nhận'), 'Lịch sử');
    await fireEvent.press(screen.getByRole('button', { name: 'Xóa vĩnh viễn «Lịch sử»' }));
    expect(mockPurge).toHaveBeenCalledWith({ quizId: 'z1', confirm: 'Lịch sử' });
    expect(mockBack).toHaveBeenCalled();
  });
  it('éditeur : le brouillon garde aussi sa suppression simple, sans effacer ce garde-fou', async () => {
    mockQuiz = quiz();
    await render(<AdminQuizEditor quizId="z1" />);
    expect(screen.getByRole('button', { name: 'Xóa bản nháp' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Xóa vĩnh viễn: Lịch sử' })).toBeTruthy();
  });
  it('un parent ordinaire ou un enfant ne voit jamais l\'action (garde de l\'écran, la base refuse de toute façon)', async () => {
    mockRole = 'child'; mockAdmin = false;
    mockList = [listRow()];
    await render(<AdminCatalog />);
    expect(screen.queryByRole('button', { name: /Xóa vĩnh viễn/ })).toBeNull();
  });
});

describe('Administration — éditeur', () => {
  it('toucher une lettre confirme CETTE réponse (la clé n\'est jamais écrite autrement)', async () => {
    mockQuestions = [q('q1', 0)];
    await render(<AdminQuizEditor quizId="z1" />);
    await fireEvent.press(screen.getByRole('button', { name: /B: B1/ }));
    expect(mockConfirm).toHaveBeenCalledWith({ quizId: 'z1', answers: [{ question_id: 'q1', correct: 1 }] });
  });
  it('publication refusée tant qu\'une réponse est « à vérifier » ; autorisée une fois confirmée avec les deux dates', async () => {
    mockQuestions = [q('q1', 0, { to_verify: true, confirmed: false })];
    const { unmount } = await render(<AdminQuizEditor quizId="z1" />);
    expect(screen.getByRole('button', { name: 'Đăng cho bạn ấy' }).props.accessibilityState).toMatchObject({ disabled: true });
    await unmount();
    mockQuestions = [q('q1', 0)];
    await render(<AdminQuizEditor quizId="z1" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng cho bạn ấy' }));
    expect(mockStatus).toHaveBeenCalledWith({ quizId: 'z1', status: 'published' });
  });
  it('sans dates : publication impossible', async () => {
    mockQuiz = quiz({ release_on: null, due_on: null });
    mockQuestions = [q('q1', 0)];
    await render(<AdminQuizEditor quizId="z1" />);
    expect(screen.getByRole('button', { name: 'Đăng cho bạn ấy' }).props.accessibilityState).toMatchObject({ disabled: true });
  });
  it('examen : toutes les réponses doivent être confirmées avant publication', async () => {
    mockQuiz = quiz({ material_kind: 'exam' });
    mockQuestions = [q('q1', 0, { confirmed: false })];
    await render(<AdminQuizEditor quizId="z1" />);
    expect(screen.getByRole('button', { name: 'Đăng cho bạn ấy' }).props.accessibilityState).toMatchObject({ disabled: true });
  });
  it('publié : plus modifiable (aucune édition de question) mais dépubliable ; les dates restent modifiables', async () => {
    mockQuiz = quiz({ status: 'published' });
    mockQuestions = [q('q1', 0)];
    await render(<AdminQuizEditor quizId="z1" />);
    expect(screen.queryByRole('button', { name: /Sửa câu hỏi/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Thêm câu hỏi' })).toBeNull();
    expect(screen.getByRole('button', { name: /B: B1/ }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText('Ngày mở')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Gỡ xuống' }));
    expect(mockStatus).toHaveBeenCalledWith({ quizId: 'z1', status: 'draft' });
  });
  it('des tentatives existent : verrouillé, jamais supprimable', async () => {
    mockQuiz = quiz({ attempts_count: 2 });
    mockQuestions = [q('q1', 0)];
    await render(<AdminQuizEditor quizId="z1" />);
    expect(screen.queryByRole('button', { name: 'Xóa bản nháp' })).toBeNull();
    expect(screen.getByText(/2 lượt làm/)).toBeTruthy();
  });
  it('brouillon vide sans tentative : supprimable', async () => {
    await render(<AdminQuizEditor quizId="z1" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Xóa bản nháp' }));
    expect(mockDelete).toHaveBeenCalledWith('z1');
  });
});

describe('Administration — import', () => {
  it('UN seul geste : choisir le fichier ; aucun formulaire (ni pays, ni classe, ni matière, ni semaine) avant le dépôt', async () => {
    await render(<AdminImport />);
    expect(screen.getByRole('button', { name: 'Chọn tệp' })).toBeTruthy();
    expect(screen.queryByLabelText('Tuần')).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Pháp' })).toBeNull();
  });
  it('repli sur l\'IA : la case se choisit par puces à liste FERMÉE (classes du pays), semaine obligatoire', async () => {
    await render(<AdminImport />);
    await fireEvent.press(screen.getByRole('button', { name: 'Tài liệu tự do hoặc ảnh (AI)' }));
    expect(screen.getByRole('button', { name: 'Tiếp tục nhập' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getAllByRole('radio', { name: /^Lớp \d+$/ })).toHaveLength(12);
    expect(screen.queryByLabelText('Lớp')).toBeNull(); // plus de saisie libre
    await fireEvent.press(screen.getByRole('radio', { name: 'Lớp 5' }));
    await fireEvent.changeText(screen.getByLabelText('Tuần'), 'Tuần 3');
    expect(screen.getByRole('button', { name: 'Tiếp tục nhập' }).props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(screen.getByRole('radio', { name: 'Pháp' }));
    expect(screen.getByRole('button', { name: 'Tiếp tục nhập' }).props.accessibilityState).toMatchObject({ disabled: true }); // changer de pays efface la classe
    expect(screen.getByRole('radio', { name: 'Terminale' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Lớp 5' })).toBeNull();
  });
  it('QCM vide depuis le catalogue : crée dans la case avec un id fixé, puis ouvre l\'éditeur', async () => {
    await render(<AdminNewQuiz />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Pháp' }));
    await fireEvent.press(screen.getByRole('radio', { name: '5e' }));
    await fireEvent.changeText(screen.getByLabelText('Tuần'), 'Semaine 1');
    await fireEvent.changeText(screen.getByLabelText('Tiêu đề'), 'Fractions');
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo bài trống' }));
    expect(mockCreate).toHaveBeenCalledWith({ id: 'id-1', country: 'FR', grade: '5E', subject: 'hist_geo', week: 'Semaine 1', title: 'Fractions' });
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/admin/[id]', params: { id: 'id-1' } });
  });
  it('le catalogue propose la création d\'un QCM vide', async () => {
    await render(<AdminCatalog />);
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo bài trống' }));
    expect(mockPush).toHaveBeenCalledWith('/admin/new');
  });
});
