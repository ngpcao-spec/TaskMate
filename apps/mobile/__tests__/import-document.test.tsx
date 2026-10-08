import { onlineManager } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import { ImportDocument } from '@/components/quiz/ImportDocument';
import ImportScreen from '../app/quiz/import';
import { GenerateError, generateQuestions } from '@/api/generate';
import type { ChildRow } from '@/types/models';

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn() }),
  Redirect: (props: { href: string }) => { mockRedirect(props.href); return null; },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
let mockSeq = 0;
jest.mock('@/api/ids', () => ({ newId: () => `set-${++mockSeq}` }));

const minh = { id: 'c-minh', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5' } as ChildRow;
const khang = { id: 'c-khang', name: 'Khang', birth_date: '2013-05-01', color: '#2EC4A6' } as ChildRow;
let mockRole: 'parent' | 'child' = 'parent';
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: { member: { role: mockRole, id: 'm-p' }, family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' }, children: [] } }) }));
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({ me: { family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' }, member: { id: 'm-p' } }, viewer: { role: 'parent', memberId: 'm-p', childId: null }, children: [minh, khang], child: minh, select: jest.fn() }),
}));

let mockPick = jest.fn();
let mockSupported = true;
jest.mock('@/services/documents', () => ({
  get documentUploadSupported() { return mockSupported; },
  pickDocuments: (...a: unknown[]) => mockPick(...a),
}));

type Opts = { onSuccess?: (r: unknown) => void; onError?: (e: unknown) => void };
let mockMutate = jest.fn();
let mockPending = false;
let mockError: unknown = null;
jest.mock('@/hooks/useQuizzes', () => ({ useGenerateQuestions: () => ({ mutate: (v: unknown, o?: Opts) => mockMutate(v, o), isPending: mockPending, error: mockError }) }));

const jpeg = (name: string) => ({ name, kind: 'image' as const, mediaType: 'image/jpeg', data: 'QUJD', bytes: 1000 });
const pdf = { name: 'cours.pdf', kind: 'pdf' as const, mediaType: 'application/pdf', data: 'QUJD', bytes: 1000 };

beforeEach(() => {
  jest.clearAllMocks();
  mockSeq = 0; mockRole = 'parent'; mockSupported = true; mockPending = false; mockError = null;
  mockMutate = jest.fn();
  mockPick = jest.fn();
  onlineManager.setOnline(true);
});

describe('Créer à partir d\'un document', () => {
  it('affiche la mention : document envoyé à un service d\'IA EXTERNE et non conservé ; « Tạo câu hỏi » inactif sans document', async () => {
    await render(<ImportDocument />);
    expect(screen.getByText(/gửi tới một dịch vụ AI bên ngoài/)).toBeTruthy();
    expect(screen.getByText(/KHÔNG được lưu giữ/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tạo câu hỏi' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText('Chưa chọn tài liệu nào.')).toBeTruthy();
  });

  it('PAR DÉFAUT : type « Auto » et nombre « Auto » sélectionnés d\'office, consigne vide', async () => {
    mockPick.mockResolvedValue({ status: 'ok', files: [jpeg('p1.jpg')] });
    await render(<ImportDocument />);
    expect(screen.getByRole('radio', { name: 'Tự động' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole('radio', { name: 'Số câu tự động' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole('radio', { name: 'Số câu cụ thể' }).props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByLabelText('Ghi chú cho AI (không bắt buộc)').props.value).toBe('');
    expect(screen.queryByLabelText('Số câu hỏi')).toBeNull();
    expect(screen.getByText(/AI chọn số câu theo nội dung/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo câu hỏi' }));
    expect(mockMutate.mock.calls[0]?.[0]).toEqual({
      setId: 'set-1', childId: 'c-minh', title: undefined, subject: undefined, kind: 'auto', count: 'auto', instruction: undefined, retry: false, language: 'vi',
      files: [{ name: 'p1.jpg', mediaType: 'image/jpeg', data: 'QUJD', role: 'exam' }],
    });
  });

  it('le parent peut toujours choisir un type et un nombre précis, et ajouter une consigne', async () => {
    mockPick.mockResolvedValue({ status: 'ok', files: [jpeg('p1.jpg')] });
    await render(<ImportDocument />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Danh sách cần học' }));
    expect(screen.getByText(/Từ vựng, công thức, ngày tháng/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Số câu cụ thể' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Thêm một câu' }));
    await fireEvent.changeText(screen.getByLabelText('Ghi chú cho AI (không bắt buộc)'), '  chỉ chương 2  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo câu hỏi' }));
    expect(mockMutate.mock.calls[0]?.[0]).toMatchObject({ kind: 'list', count: 11, instruction: 'chỉ chương 2', retry: false });
    expect(screen.getByText('12/300')).toBeTruthy();
  });

  it('consigne de plus de 300 caractères : refusée avant l\'envoi', async () => {
    mockPick.mockResolvedValue({ status: 'ok', files: [jpeg('p1.jpg')] });
    await render(<ImportDocument />);
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh' }));
    await fireEvent.changeText(screen.getByLabelText('Ghi chú cho AI (không bắt buộc)'), 'x'.repeat(301));
    expect(screen.getByText('Ghi chú tối đa 300 ký tự')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tạo câu hỏi' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('corrigé : proposé avec Auto et « Examen avec corrigé » seulement ; rôle distinct dans la requête', async () => {
    mockPick.mockResolvedValueOnce({ status: 'ok', files: [pdf] }).mockResolvedValueOnce({ status: 'ok', files: [jpeg('k1.jpg')] }).mockResolvedValueOnce({ status: 'ok', files: [jpeg('k2.jpg')] });
    await render(<ImportDocument />);
    expect(screen.getByText('Phần đáp án')).toBeTruthy(); // Auto : facultatif
    await fireEvent.press(screen.getByRole('radio', { name: 'Bài học / bài giảng' }));
    expect(screen.queryByText('Phần đáp án')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Đề thi kèm đáp án' }));
    expect(screen.getByText('Bắt buộc với loại «Đề thi kèm đáp án».')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn PDF hoặc Word' }));
    expect(screen.getByRole('button', { name: 'Tạo câu hỏi' }).props.accessibilityState).toMatchObject({ disabled: true }); // corrigé obligatoire
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh đáp án' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh đáp án' }));
    expect(screen.getByText('k1.jpg')).toBeTruthy();
    expect(screen.getByText('k2.jpg')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo câu hỏi' }));
    expect(mockMutate.mock.calls[0]?.[0]).toMatchObject({
      kind: 'exam_key',
      files: [{ name: 'cours.pdf', role: 'exam' }, { name: 'k1.jpg', role: 'key' }, { name: 'k2.jpg', role: 'key' }],
    });
  });

  it('revenir à un type sans corrigé retire les fichiers du corrigé (jamais envoyés)', async () => {
    mockPick.mockResolvedValueOnce({ status: 'ok', files: [jpeg('ex.jpg')] }).mockResolvedValueOnce({ status: 'ok', files: [jpeg('k.jpg')] });
    await render(<ImportDocument />);
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh đáp án' }));
    expect(screen.getByText('k.jpg')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Danh sách cần học' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo câu hỏi' }));
    expect(mockMutate.mock.calls[0]?.[0].files).toEqual([{ name: 'ex.jpg', mediaType: 'image/jpeg', data: 'QUJD', role: 'exam' }]);
  });

  it('plusieurs photos s\'ajoutent, se retirent ; génération avec enfant, matière, nombre précis, langue de l\'interface', async () => {
    mockPick.mockResolvedValueOnce({ status: 'ok', files: [jpeg('p1.jpg')] }).mockResolvedValueOnce({ status: 'ok', files: [jpeg('p2.jpg'), jpeg('p3.jpg')] });
    await render(<ImportDocument />);
    await fireEvent.press(screen.getByRole('button', { name: 'Chụp ảnh' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh' }));
    expect(mockPick).toHaveBeenNthCalledWith(1, 'camera');
    expect(mockPick).toHaveBeenNthCalledWith(2, 'gallery');
    expect(screen.getByText('p1.jpg')).toBeTruthy();
    expect(screen.getByText('p3.jpg')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Bỏ p2.jpg' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Khang' }));
    await fireEvent.changeText(screen.getByLabelText('Môn học (không bắt buộc)'), 'Sinh học');
    await fireEvent.press(screen.getByRole('radio', { name: 'Số câu cụ thể' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Thêm một câu' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Thêm một câu' }));
    expect(screen.getByText('12 câu')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo câu hỏi' }));
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0]?.[0]).toEqual({
      setId: 'set-1', childId: 'c-khang', title: undefined, subject: 'Sinh học', kind: 'auto', count: 12, instruction: undefined, retry: false, language: 'vi',
      files: [{ name: 'p1.jpg', mediaType: 'image/jpeg', data: 'QUJD', role: 'exam' }, { name: 'p3.jpg', mediaType: 'image/jpeg', data: 'QUJD', role: 'exam' }],
    });
  });

  it('un PDF remplace la sélection ; mélange refusé avec message', async () => {
    mockPick.mockResolvedValueOnce({ status: 'ok', files: [jpeg('p1.jpg')] }).mockResolvedValueOnce({ status: 'ok', files: [pdf] }).mockResolvedValueOnce({ status: 'ok', files: [jpeg('p2.jpg')] });
    await render(<ImportDocument />);
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn PDF hoặc Word' }));
    expect(screen.queryByText('p1.jpg')).toBeNull();
    expect(screen.getByText('cours.pdf')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh' })); // photo + PDF déjà présent → remplace par la photo (jamais de mélange)
    expect(screen.queryByText('cours.pdf')).toBeNull();
    expect(screen.getByText('p2.jpg')).toBeTruthy();
  });

  it('plus de 5 photos : message clair, sélection inchangée', async () => {
    mockPick.mockResolvedValueOnce({ status: 'ok', files: Array.from({ length: 5 }, (_, i) => jpeg(`a${i}.jpg`)) }).mockResolvedValueOnce({ status: 'ok', files: [jpeg('extra.jpg')] });
    await render(<ImportDocument />);
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh' }));
    expect(screen.getByText('Tối đa 5 tệp.')).toBeTruthy();
    expect(screen.queryByText('extra.jpg')).toBeNull();
  });

  it('annulation : rien ne change ; erreur de lecture : message', async () => {
    mockPick.mockResolvedValueOnce({ status: 'cancelled' }).mockResolvedValueOnce({ status: 'error', code: 'tooLarge' }).mockResolvedValueOnce({ status: 'error', code: 'unsupportedType' });
    await render(<ImportDocument />);
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh' }));
    expect(screen.getByText('Chưa chọn tài liệu nào.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh' }));
    expect(screen.getByText('Tệp quá lớn.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh' }));
    expect(screen.getByText(/Loại tệp không được hỗ trợ/)).toBeTruthy();
  });

  const result = (over: Record<string, unknown> = {}) => ({
    set_id: 'set-1', title: 'T', count: 9, truncated: false, kind: 'course', kind_detected: true, kind_doubt: false, found: 9, capped: false, cap: 30,
    ignored: [], ignored_count: 0, to_verify_count: 0, figure_count: 0, free_retry: false, ...over,
  });
  const generateWith = async (r: Record<string, unknown>) => {
    mockPick.mockResolvedValue({ status: 'ok', files: [jpeg('p1.jpg')] });
    mockMutate = jest.fn((_v, o?: Opts) => o?.onSuccess?.(result(r)));
    await render(<ImportDocument />);
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo câu hỏi' }));
  };

  it('succès (cours) : type détecté affiché au parent, brouillon, ouverture de l\'éditeur de relecture', async () => {
    await generateWith({});
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByRole('header', { name: 'Phát hiện: bài học' })).toBeTruthy();
    expect(screen.getByText('Đã tạo 9 câu hỏi (bản nháp). Hãy xem lại trước khi đăng.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Xem lại câu hỏi' }));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/quiz/[id]', params: { id: 'set-1' } });
  });

  it('succès (examen) : « Détecté : examen papier » et ouverture de la grille Đáp án', async () => {
    await generateWith({ kind: 'exam' });
    expect(screen.getByRole('header', { name: 'Phát hiện: đề thi giấy' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Mở bảng Đáp án' }));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/quiz/answers', params: { id: 'set-1' } });
  });

  it('type choisi par le parent : « Loại tài liệu » (et non « Phát hiện »)', async () => {
    await generateWith({ kind: 'list', kind_detected: false });
    expect(screen.getByRole('header', { name: 'Loại tài liệu: danh sách cần học' })).toBeTruthy();
  });

  it('AVERTISSEMENTS : plafond (jamais de coupe silencieuse), non-QCM ignorés avec numéros, figures, réponses à vérifier, doute, texte tronqué', async () => {
    await generateWith({ kind: 'exam', count: 30, found: 42, capped: true, ignored: ['Câu 13', 'Câu 14', 'Câu 15'], ignored_count: 3, figure_count: 4, to_verify_count: 6, kind_doubt: true, truncated: true });
    expect(screen.getByText('Tìm thấy 42 câu trắc nghiệm, lấy 30 câu: hãy tạo lại để lấy các câu còn lại.')).toBeTruthy();
    expect(screen.getByText('3 câu không phải trắc nghiệm đã bị bỏ qua: Câu 13, Câu 14, Câu 15')).toBeTruthy();
    expect(screen.getByText('4 câu phụ thuộc hình hoặc bảng: hãy đối chiếu với đề giấy.')).toBeTruthy();
    expect(screen.getByText('6 đáp án cần kiểm tra.')).toBeTruthy();
    expect(screen.getByText('AI chưa chắc về loại tài liệu nên chọn «Bài học»; bạn có thể sửa.')).toBeTruthy();
    expect(screen.getByText('Tài liệu dài: chỉ phần đầu được dùng.')).toBeTruthy();
  });

  it('aucun avertissement quand tout a été repris', async () => {
    await generateWith({});
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('corriger le type et relancer : même brouillon (retry), type choisi, fichiers conservés', async () => {
    await generateWith({ kind: 'course' });
    await fireEvent.press(screen.getByRole('button', { name: 'Sửa loại tài liệu và tạo lại' }));
    expect(screen.getByText(/Một lần tạo lại cho mỗi bộ câu hỏi không tốn thêm lượt/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Đề thi / bài tập giấy' }));
    mockMutate = jest.fn((_v, o?: Opts) => o?.onSuccess?.(result({ kind: 'exam', kind_detected: false, free_retry: true })));
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo lại với loại này' }));
    expect(mockMutate.mock.calls[0]?.[0]).toMatchObject({ setId: 'set-1', kind: 'exam', retry: true, files: [{ name: 'p1.jpg', role: 'exam' }] });
    expect(screen.getByRole('header', { name: 'Loại tài liệu: đề thi giấy' })).toBeTruthy();
  });

  it('relance vers « Examen avec corrigé » : le corrigé est exigé avant de relancer', async () => {
    mockPick.mockResolvedValueOnce({ status: 'ok', files: [jpeg('p1.jpg')] }).mockResolvedValueOnce({ status: 'ok', files: [jpeg('k.jpg')] });
    mockMutate = jest.fn((_v, o?: Opts) => o?.onSuccess?.(result({ kind: 'exam' })));
    await render(<ImportDocument />);
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo câu hỏi' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sửa loại tài liệu và tạo lại' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Đề thi kèm đáp án' }));
    expect(screen.getByRole('button', { name: 'Tạo lại với loại này' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh đáp án' }));
    expect(screen.getByRole('button', { name: 'Tạo lại với loại này' }).props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(screen.getByRole('button', { name: 'Không sửa' }));
    expect(screen.getByRole('button', { name: 'Mở bảng Đáp án' })).toBeTruthy();
  });

  it.each([
    ['ai_not_configured', {}, 'AI chưa được cấu hình. Hãy nhờ người quản trị thêm khóa OPENAI_API_KEY (xem HUMAN_TODO).'],
    ['quota_exceeded', { used: 20, limit: 20 }, 'Đã hết lượt tạo hôm nay (20/20). Thử lại vào ngày mai.'],
    ['file_too_large', {}, 'Tệp quá lớn.'],
    ['invalid_output', {}, 'AI không trả về câu hỏi hợp lệ. Hãy thử lại hoặc dùng tài liệu rõ hơn.'],
    ['no_usable_content', {}, 'Không tìm thấy nội dung học tập trong tài liệu.'],
    ['ai_timeout', {}, 'Quá thời gian chờ. Hãy thử lại.'],
    ['boom', {}, 'Không tạo được câu hỏi. Hãy thử lại.'],
  ])('erreur serveur %s → message clair', async (code, details, message) => {
    mockPick.mockResolvedValue({ status: 'ok', files: [jpeg('p1.jpg')] });
    const err = new GenerateError(code, details);
    mockError = err;
    mockMutate = jest.fn((_v, o?: Opts) => o?.onError?.(err));
    await render(<ImportDocument />);
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo câu hỏi' }));
    expect(screen.getByText(message)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
  it.each([
    ['key_required', 'Hãy thêm phần đáp án cho loại «Đề thi kèm đáp án»'],
    ['key_not_allowed', 'Chỉ loại «Tự động» hoặc «Đề thi kèm đáp án» nhận phần đáp án'],
    ['instruction_too_long', 'Ghi chú tối đa 300 ký tự'],
    ['save_failed', 'Không lưu được bản nháp. Hãy thử lại.'],
  ])('erreur serveur %s → message clair (supports multiples)', async (code, message) => {
    mockPick.mockResolvedValue({ status: 'ok', files: [jpeg('p1.jpg')] });
    const err = new GenerateError(code, {});
    mockError = err;
    mockMutate = jest.fn((_v, o?: Opts) => o?.onError?.(err));
    await render(<ImportDocument />);
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo câu hỏi' }));
    expect(screen.getByText(message)).toBeTruthy();
  });

  it('hors ligne : message, aucune génération', async () => {
    mockPick.mockResolvedValue({ status: 'ok', files: [jpeg('p1.jpg')] });
    await render(<ImportDocument />);
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh' }));
    onlineManager.setOnline(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo câu hỏi' }));
    expect(screen.getByText('Cần có mạng để tạo câu hỏi.')).toBeTruthy();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('génération en cours : indicateur de progression, bouton inactif', async () => {
    mockPending = true;
    mockPick.mockResolvedValue({ status: 'ok', files: [jpeg('p1.jpg')] });
    await render(<ImportDocument />);
    expect(screen.getByRole('progressbar', { name: /Đang tạo câu hỏi/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tạo câu hỏi' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('application native : message « uniquement dans l\'application web »', async () => {
    mockSupported = false;
    await render(<ImportDocument />);
    expect(screen.getByText('Chức năng này chỉ có trong ứng dụng web (PWA).')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Chụp ảnh' })).toBeNull();
  });

  it('route réservée au parent : un enfant est redirigé', async () => {
    mockRole = 'child';
    await render(<ImportScreen />);
    expect(mockRedirect).toHaveBeenCalledWith('/');
    expect(screen.queryByText('Tạo câu hỏi từ tài liệu')).toBeNull();
  });
});

describe('api/generate : erreurs de l\'Edge Function', () => {
  const mockInvoke = jest.fn();
  beforeAll(() => {
    jest.resetModules();
  });
  it('transmet le code et les détails du corps de la réponse', async () => {
    jest.doMock('@/api/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => mockInvoke(...a) } } }));
    const { generateQuestions: gen, GenerateError: Err } = jest.requireActual('@/api/generate') as { generateQuestions: typeof generateQuestions; GenerateError: typeof GenerateError };
    mockInvoke.mockResolvedValueOnce({ data: null, error: { context: new Response(JSON.stringify({ error: 'quota_exceeded', limit: 20, used: 20 }), { status: 429 }) } });
    await expect(gen({ setId: 's', childId: 'c', kind: 'auto', count: 'auto', language: 'vi', files: [] })).rejects.toMatchObject({ code: 'quota_exceeded', details: { limit: 20, used: 20 } });
    mockInvoke.mockResolvedValueOnce({ data: null, error: { context: new Response('pas du json', { status: 502 }) } });
    await expect(gen({ setId: 's', childId: 'c', kind: 'auto', count: 'auto', language: 'vi', files: [] })).rejects.toMatchObject({ code: 'generic' });
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('Failed to fetch') });
    await expect(gen({ setId: 's', childId: 'c', kind: 'auto', count: 'auto', language: 'vi', files: [] })).rejects.toBeInstanceOf(Err);
    mockInvoke.mockResolvedValueOnce({ data: { set_id: 's', title: 'T', count: 3, truncated: false, kind: 'exam' }, error: null });
    await expect(gen({ setId: 's', childId: 'c', kind: 'auto', count: 'auto', language: 'vi', files: [] })).resolves.toMatchObject({ set_id: 's', title: 'T', count: 3, kind: 'exam' });
    expect(mockInvoke).toHaveBeenCalledWith('generate-questions', expect.objectContaining({ method: 'POST' }));
  });
});
