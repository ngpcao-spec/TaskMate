import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import '@/i18n';
import { AdminBulkImport } from '@/components/admin/AdminBulkImport';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
let mockSeq = 0;
jest.mock('@/api/ids', () => ({ newId: () => `id-${++mockSeq}` }));

let mockPick = jest.fn();
jest.mock('@/services/documents', () => ({ documentUploadSupported: true, pickDocuments: (...a: unknown[]) => mockPick(...a) }));
let mockText: { ok: boolean; text?: string; reason?: string } = { ok: true, text: '' };
jest.mock('@/services/documentText', () => ({ extractFileText: async () => mockText }));

const mockLoadExisting = jest.fn();
const mockWrite = jest.fn();
const mockPublish = jest.fn();
jest.mock('@/hooks/useCatalog', () => ({
  useCatalogBulk: () => ({ loadExisting: (...a: unknown[]) => mockLoadExisting(...a), write: (...a: unknown[]) => mockWrite(...a), publish: (...a: unknown[]) => mockPublish(...a) }),
}));

const block = (over: { week?: string; title?: string; grade?: string; country?: string; dates?: boolean; answer?: string } = {}) => `[QUIZ]
Pays: ${over.country ?? 'VN'}
Classe: ${over.grade ?? '5'}
Matière: hist_geo
Semaine: ${over.week ?? 'Tuần 7'}
Titre: ${over.title ?? 'Văn Lang'}
${over.dates === false ? '' : 'Ouverture: 2026-10-16\nÉchéance: 2026-10-25\n'}1. Q1 ?
A. a
B. b
C. c
D. d
Đáp án: ${over.answer ?? 'B'}
Giải thích: ok. Nguồn: Bài 5
2. Q2 ?
A. a
B. b
C. c
D. d
Đáp án: A`;
const file = { name: 'qcm.docx', kind: 'docx' as const, mediaType: 'x', data: 'AAAA', bytes: 4 };
const existing = (over: Record<string, unknown> = {}) => ({ id: 'e1', country: 'VN', grade: '5', subject: 'hist_geo', week_label: 'Tuần 7', status: 'draft', attempts_count: 0, title: 'Ancien QCM', ...over });

const choose = async (text: string) => {
  mockText = { ok: true, text };
  await fireEvent.press(screen.getByRole('button', { name: 'Chọn tệp' }));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSeq = 0;
  mockPick = jest.fn().mockResolvedValue({ status: 'ok', files: [file] });
  mockLoadExisting.mockResolvedValue([]);
  mockWrite.mockImplementation(async (steps: { item: { id: string; quiz: { block: number } }; replace: boolean }[]) => steps.map((s) => ({ block: s.item.quiz.block, id: s.item.id, outcome: s.replace ? 'replaced' : 'created' })));
  mockPublish.mockImplementation(async (items: { block: number; id: string }[]) => items.map((i) => ({ ...i, outcome: 'published' })));
});

describe('Import d\'administration « un seul fichier » (D-081)', () => {
  it('écran de départ : un bouton, aucun champ', async () => {
    await render(<AdminBulkImport onUseAi={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Chọn tệp' })).toBeTruthy();
    expect(screen.queryByLabelText('Tuần')).toBeNull();
    expect(screen.queryByLabelText('Lớp')).toBeNull();
  });

  it('fichier non structuré : message clair et repli sur l\'IA', async () => {
    const onUseAi = jest.fn();
    await render(<AdminBulkImport onUseAi={onUseAi} />);
    await choose('Un cours libre sans bloc QUIZ');
    expect(await screen.findByText('Tệp không có cấu trúc')).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Tài liệu tự do hoặc ảnh (AI)' })[0] as never);
    expect(onUseAi).toHaveBeenCalled();
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('erreurs : bloc et ligne fautifs affichés, RIEN n\'est écrit', async () => {
    await render(<AdminBulkImport onUseAi={jest.fn()} />);
    await choose(`${block()}\n${block({ week: 'Tuần 8', grade: '13' })}`);
    expect(await screen.findByText('Cần sửa tệp')).toBeTruthy();
    expect(screen.getByText(/Khối 2 · dòng \d+/)).toBeTruthy();
    expect(screen.getByText(/Lớp “13” không có ở quốc gia này \(VN\)/)).toBeTruthy();
    expect(mockLoadExisting).not.toHaveBeenCalled();
    expect(mockWrite).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn tệp khác' }));
    expect(screen.getByRole('button', { name: 'Chọn tệp' })).toBeTruthy();
  });

  it('fichier illisible ou sans texte : message, rien d\'écrit', async () => {
    await render(<AdminBulkImport onUseAi={jest.fn()} />);
    mockText = { ok: false, reason: 'no_text' };
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn tệp' }));
    expect(await screen.findByText(/không có chữ đọc được/)).toBeTruthy();
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('flux nominal : bilan → brouillons (ids fixés) → « Publier tout »', async () => {
    await render(<AdminBulkImport onUseAi={jest.fn()} />);
    await choose(`${block()}\n${block({ week: 'Tuần 8', title: 'Âu Lạc' })}`);
    expect(await screen.findByText('Tìm thấy 2 bài, 4 câu hỏi')).toBeTruthy();
    expect(screen.getByText('Văn Lang')).toBeTruthy();
    expect(screen.getAllByText(/Việt Nam · Lớp 5 · Lịch sử và Địa lý · Tuần \d/)).toHaveLength(2);
    expect(screen.getAllByText('Từ 16/10/2026 đến 25/10/2026')).toHaveLength(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu 2 bản nháp' }));
    await waitFor(() => expect(mockWrite).toHaveBeenCalledTimes(1));
    const steps = mockWrite.mock.calls[0]?.[0] as { item: { id: string; quiz: { week: string; grade: string } }; replace: boolean }[];
    expect(steps.map((s) => [s.item.id, s.item.quiz.week, s.item.quiz.grade, s.replace])).toEqual([['id-1', 'Tuần 7', '5', false], ['id-2', 'Tuần 8', '5', false]]);
    expect(await screen.findByText('2 đã tạo, 0 đã thay, 0 bỏ qua, 0 lỗi')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Xuất bản tất cả (2)' }));
    await waitFor(() => expect(mockPublish).toHaveBeenCalledWith([expect.objectContaining({ block: 1, id: 'id-1' }), expect.objectContaining({ block: 2, id: 'id-2' })], expect.any(Function)));
    expect((await screen.findAllByText('Đã xuất bản')).length).toBe(2);
    expect(screen.queryByRole('button', { name: /Xuất bản tất cả/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Về danh mục' }));
    expect(mockReplace).toHaveBeenCalledWith('/admin');
  });

  it('« Publier tout » : ceux qui ne passent pas restent en brouillon avec la raison affichée', async () => {
    mockPublish.mockImplementation(async (items: { block: number; id: string }[]) => items.map((i) => (i.block === 2 ? { ...i, outcome: 'draft', error: 'dates_required' } : { ...i, outcome: 'published' })));
    await render(<AdminBulkImport onUseAi={jest.fn()} />);
    await choose(`${block()}\n${block({ week: 'Tuần 8', dates: false })}`);
    expect(await screen.findByText('Chưa đặt ngày')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu 2 bản nháp' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Xuất bản tất cả (2)' }));
    expect(await screen.findByText('Vẫn là bản nháp')).toBeTruthy();
    expect(screen.getByText('Bài đã xuất bản phải có đủ hai ngày.')).toBeTruthy();
    // un seul reste à publier, après correction des dates dans l'éditeur
    expect(screen.getByRole('button', { name: 'Xuất bản tất cả (1)' })).toBeTruthy();
  });

  it('case occupée par un brouillon sans tentative : IGNORÉ par défaut, « Remplacer » sur demande, jamais en silence', async () => {
    mockLoadExisting.mockResolvedValue([existing()]);
    await render(<AdminBulkImport onUseAi={jest.fn()} />);
    await choose(`${block()}\n${block({ week: 'Tuần 8' })}`);
    expect(await screen.findByText(/Ô này đã có một bài: “Ancien QCM”/)).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Bỏ qua' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole('button', { name: 'Lưu 1 bản nháp' })).toBeTruthy(); // seul le QCM de la case libre est écrit
    await fireEvent.press(screen.getByRole('radio', { name: 'Thay thế' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu 2 bản nháp' }));
    await waitFor(() => expect(mockWrite).toHaveBeenCalled());
    const steps = mockWrite.mock.calls[0]?.[0] as { item: { id: string }; replace: boolean }[];
    expect(steps.map((s) => [s.item.id, s.replace])).toEqual([['e1', true], ['id-1', false]]);
    expect(await screen.findByText('1 đã tạo, 1 đã thay, 0 bỏ qua, 0 lỗi')).toBeTruthy();
  });

  it.each([
    ['publié', { status: 'published' }, /đã xuất bản: không thể thay thế/],
    ['avec des tentatives', { attempts_count: 3 }, /Các bé đã làm bài này: không thể thay thế/],
  ])('case occupée par un QCM %s : remplacement refusé et expliqué, rien n\'est écrit', async (_n, over, message) => {
    mockLoadExisting.mockResolvedValue([existing(over)]);
    await render(<AdminBulkImport onUseAi={jest.fn()} />);
    await choose(block());
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Thay thế' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Lưu 0 bản nháp' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('échec d\'un QCM : raison affichée, les autres sont enregistrés, « Réessayer » rejoue avec le MÊME id', async () => {
    mockWrite.mockImplementationOnce(async (steps: { item: { id: string; quiz: { block: number } } }[]) => steps.map((s) => (s.item.quiz.block === 2 ? { block: 2, id: s.item.id, outcome: 'failed', error: 'catalog_slot_taken' } : { block: 1, id: s.item.id, outcome: 'created' })));
    await render(<AdminBulkImport onUseAi={jest.fn()} />);
    await choose(`${block()}\n${block({ week: 'Tuần 8' })}`);
    await fireEvent.press(await screen.findByRole('button', { name: 'Lưu 2 bản nháp' }));
    expect(await screen.findByText('1 đã tạo, 0 đã thay, 0 bỏ qua, 1 lỗi')).toBeTruthy();
    expect(screen.getByText('Ô này (quốc gia, lớp, môn, tuần) đã có một bài trắc nghiệm.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại 1 bài lỗi' }));
    await waitFor(() => expect(mockWrite).toHaveBeenCalledTimes(2));
    const retry = mockWrite.mock.calls[1]?.[0] as { item: { id: string } }[];
    expect(retry.map((s) => s.item.id)).toEqual(['id-2']);
    expect(await screen.findByText('2 đã tạo, 0 đã thay, 0 bỏ qua, 0 lỗi')).toBeTruthy();
  });

  it('hors ligne : rien n\'est lu côté serveur ni écrit', async () => {
    const { onlineManager } = jest.requireActual('@tanstack/react-query') as typeof import('@tanstack/react-query');
    onlineManager.setOnline(false);
    try {
      await render(<AdminBulkImport onUseAi={jest.fn()} />);
      await choose(block());
      expect(await screen.findByText(/Cần có mạng/)).toBeTruthy();
      expect(mockLoadExisting).not.toHaveBeenCalled();
    } finally {
      onlineManager.setOnline(true);
    }
  });
});
