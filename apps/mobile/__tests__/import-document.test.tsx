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
  it('affiche la mention : document envoyé à un service d\'IA et non conservé ; « Tạo câu hỏi » inactif sans document', async () => {
    await render(<ImportDocument />);
    expect(screen.getByText(/gửi tới một dịch vụ AI/)).toBeTruthy();
    expect(screen.getByText(/KHÔNG được lưu giữ/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tạo câu hỏi' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText('Chưa chọn tài liệu nào.')).toBeTruthy();
  });

  it('plusieurs photos s\'ajoutent, se retirent ; génération avec enfant, matière, nombre, langue de l\'interface', async () => {
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
    await fireEvent.press(screen.getByRole('button', { name: 'Thêm một câu' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Thêm một câu' }));
    expect(screen.getByText('12 câu')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo câu hỏi' }));
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0]?.[0]).toEqual({
      setId: 'set-1', childId: 'c-khang', title: undefined, subject: 'Sinh học', count: 12, language: 'vi',
      files: [{ name: 'p1.jpg', mediaType: 'image/jpeg', data: 'QUJD' }, { name: 'p3.jpg', mediaType: 'image/jpeg', data: 'QUJD' }],
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

  it('succès : message « brouillon », ouverture de l\'éditeur de relecture', async () => {
    mockPick.mockResolvedValue({ status: 'ok', files: [jpeg('p1.jpg')] });
    mockMutate = jest.fn((_v, o?: Opts) => o?.onSuccess?.({ set_id: 'set-1', title: 'T', count: 9, truncated: false }));
    await render(<ImportDocument />);
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn ảnh' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo câu hỏi' }));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/quiz/[id]', params: { id: 'set-1' } });
  });

  it.each([
    ['ai_not_configured', {}, 'AI chưa được cấu hình. Hãy nhờ người quản trị thêm khóa ANTHROPIC_API_KEY (xem HUMAN_TODO).'],
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
    await expect(gen({ setId: 's', childId: 'c', count: 10, language: 'vi', files: [] })).rejects.toMatchObject({ code: 'quota_exceeded', details: { limit: 20, used: 20 } });
    mockInvoke.mockResolvedValueOnce({ data: null, error: { context: new Response('pas du json', { status: 502 }) } });
    await expect(gen({ setId: 's', childId: 'c', count: 10, language: 'vi', files: [] })).rejects.toMatchObject({ code: 'generic' });
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('Failed to fetch') });
    await expect(gen({ setId: 's', childId: 'c', count: 10, language: 'vi', files: [] })).rejects.toBeInstanceOf(Err);
    mockInvoke.mockResolvedValueOnce({ data: { set_id: 's', title: 'T', count: 3, truncated: false }, error: null });
    await expect(gen({ setId: 's', childId: 'c', count: 10, language: 'vi', files: [] })).resolves.toEqual({ set_id: 's', title: 'T', count: 3, truncated: false });
    expect(mockInvoke).toHaveBeenCalledWith('generate-questions', expect.objectContaining({ method: 'POST' }));
  });
});
