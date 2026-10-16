import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import { ParentCatalog } from '@/components/quiz/ParentCatalog';
import type { ChildRow } from '@/types/models';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
let mockSeq = 0;
jest.mock('@/api/ids', () => ({ newId: () => `att-${++mockSeq}` }));

const minh = { id: 'c-minh', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5', country: 'VN', grade: '5' } as ChildRow;
const noClass = { ...minh, country: null, grade: null } as ChildRow;
let mockSubjects: { subject: string; week_offset: number }[] = [];
let mockOverview: unknown[] = [];
const mockSetClass = jest.fn();
const mockSetSubject = jest.fn();
const mockShift = jest.fn();
const mockRelaunch = jest.fn();
const ok = (fn: jest.Mock) => ({ mutate: (v: unknown, o?: { onSuccess?: () => void }) => { fn(v); o?.onSuccess?.(); }, isPending: false });
jest.mock('@/hooks/useCatalog', () => ({
  useChildSubjects: () => ({ data: mockSubjects }),
  useParentCatalog: () => ({ data: mockOverview, isPending: false }),
  useSetChildClass: () => ok(mockSetClass),
  useSetChildSubject: () => ok(mockSetSubject),
  useShiftChildSubject: () => ok(mockShift),
  useRelaunchCatalogEvaluation: () => ok(mockRelaunch),
}));

const row = (over: Record<string, unknown> = {}) => ({
  quiz_id: 'z1', subject: 'maths', week_label: 'Tuần 3', title: 'Phân số', question_count: 10, release_on: '2026-09-07', due_on: '2026-09-13', available: true,
  attempt_id: null, attempt_status: null, answered_count: 0, score: null, total: null, ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSeq = 0; mockSubjects = []; mockOverview = [];
});

describe('Catalogue — côté parent (D-080)', () => {
  it('classe : puces à liste FERMÉE du pays ; rien à enregistrer tant que rien ne change', async () => {
    await render(<ParentCatalog child={minh} today="2026-09-08" />);
    expect(screen.queryByRole('button', { name: 'Lưu lớp' })).toBeNull();
    expect(screen.queryByLabelText('Lớp')).toBeNull(); // plus de saisie libre
    expect(screen.getAllByRole('radio', { name: /^Lớp \d+$/ })).toHaveLength(12);
    expect(screen.getByRole('radio', { name: 'Lớp 5' }).props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByRole('radio', { name: 'Lớp 6' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu lớp' }));
    expect(mockSetClass).toHaveBeenCalledWith({ childId: 'c-minh', country: 'VN', grade: '6' });
  });
  it('changer de pays : classes françaises, la classe choisie est effacée (VN ≠ FR) jusqu\'à un nouveau choix', async () => {
    await render(<ParentCatalog child={minh} today="2026-09-08" />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Pháp' }));
    expect(screen.queryByRole('radio', { name: 'Lớp 5' })).toBeNull();
    expect(screen.getAllByRole('radio', { name: /^(CP|CE1|CE2|CM1|CM2|6e|5e|4e|3e|2de|1re|Terminale)$/ })).toHaveLength(12);
    expect(screen.queryByRole('button', { name: 'Lưu lớp' })).toBeNull(); // pas de classe choisie
    await fireEvent.press(screen.getByRole('radio', { name: '5e' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu lớp' }));
    expect(mockSetClass).toHaveBeenCalledWith({ childId: 'c-minh', country: 'FR', grade: '5E' });
  });
  it('sans classe : rien à enregistrer tant qu\'aucune puce n\'est choisie', async () => {
    await render(<ParentCatalog child={noClass} today="2026-09-08" />);
    expect(screen.queryByRole('button', { name: 'Lưu lớp' })).toBeNull();
    expect(screen.getByText(/Hãy chọn quốc gia và lớp/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Lớp 3' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu lớp' }));
    expect(mockSetClass).toHaveBeenCalledWith({ childId: 'c-minh', country: 'VN', grade: '3' });
  });
  it('une ancienne classe hors liste n\'est pas affichée comme choisie : le parent doit en choisir une', async () => {
    await render(<ParentCatalog child={{ ...minh, grade: 'QUINTA' } as ChildRow} today="2026-09-08" />);
    expect(screen.getAllByRole('radio', { name: /^Lớp \d+$/ }).every((c) => c.props.accessibilityState.selected === false)).toBe(true);
    expect(screen.queryByRole('checkbox', { name: 'Toán' })).toBeNull(); // pas de matières tant que la classe n'est pas valide
  });
  it('sans classe : aucune matière proposée (pas de QCM à recevoir)', async () => {
    await render(<ParentCatalog child={noClass} today="2026-09-08" />);
    expect(screen.queryByRole('checkbox', { name: 'Toán' })).toBeNull();
  });
  it('matières : activer / désactiver', async () => {
    mockSubjects = [{ subject: 'maths', week_offset: 0 }];
    await render(<ParentCatalog child={minh} today="2026-09-08" />);
    expect(screen.getByRole('checkbox', { name: 'Toán' }).props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Tiếng Anh' }));
    expect(mockSetSubject).toHaveBeenCalledWith({ childId: 'c-minh', subject: 'anglais', active: true });
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Toán' }));
    expect(mockSetSubject).toHaveBeenCalledWith({ childId: 'c-minh', subject: 'maths', active: false });
  });
  it('décalage d\'UNE semaine par matière activée, borné à ±4', async () => {
    mockSubjects = [{ subject: 'maths', week_offset: 0 }, { subject: 'sciences', week_offset: 4 }, { subject: 'anglais', week_offset: -4 }];
    await render(<ParentCatalog child={minh} today="2026-09-08" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Toán: muộn hơn một tuần' }));
    expect(mockShift).toHaveBeenCalledWith({ childId: 'c-minh', subject: 'maths', delta: 1 });
    await fireEvent.press(screen.getByRole('button', { name: 'Toán: sớm hơn một tuần' }));
    expect(mockShift).toHaveBeenCalledWith({ childId: 'c-minh', subject: 'maths', delta: -1 });
    expect(screen.getByRole('button', { name: 'Khoa học: muộn hơn một tuần' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByRole('button', { name: 'Tiếng Anh: sớm hơn một tuần' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText('Dời +4 tuần: muộn hơn')).toBeTruthy();
    expect(screen.getByText('Dời −4 tuần: sớm hơn')).toBeTruthy();
    expect(screen.getByText('Theo lịch chung')).toBeTruthy();
  });
  it('QCM pas encore ouvert : date de mise à disposition, aucune action', async () => {
    mockSubjects = [{ subject: 'maths', week_offset: 0 }];
    mockOverview = [row({ available: false })];
    await render(<ParentCatalog child={minh} today="2026-09-01" />);
    expect(screen.getByText('Mở vào 07/09/2026')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Phân số/ })).toBeNull();
  });
  it('QCM en cours : progression (n sur N) sans aucune réponse ; en retard après l\'échéance', async () => {
    mockSubjects = [{ subject: 'maths', week_offset: 0 }];
    mockOverview = [row({ attempt_id: 'a1', attempt_status: 'in_progress', answered_count: 4 })];
    const { unmount } = await render(<ParentCatalog child={minh} today="2026-09-10" />);
    expect(screen.getByText('Đang làm (4/10)')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Phân số/ })).toBeNull(); // pas de revue avant l'envoi
    await unmount();
    await render(<ParentCatalog child={minh} today="2026-09-20" />);
    expect(screen.getByText(/Quá hạn/)).toBeTruthy();
  });
  it('QCM envoyé : ouvre l\'écran de validation (où le parent voit les réponses) ; validé : score et relance', async () => {
    mockSubjects = [{ subject: 'maths', week_offset: 0 }];
    mockOverview = [row({ attempt_id: 'a1', attempt_status: 'submitted' })];
    const { unmount } = await render(<ParentCatalog child={minh} today="2026-09-10" />);
    await fireEvent.press(screen.getByRole('button', { name: /Phân số/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quiz/attempt/[id]', params: { id: 'a1' } });
    await unmount();
    mockOverview = [row({ attempt_id: 'a1', attempt_status: 'validated', score: 8, total: 10 })];
    await render(<ParentCatalog child={minh} today="2026-09-10" />);
    expect(screen.getByText('8/10')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cho làm lại bài kiểm tra' }));
    expect(mockRelaunch).toHaveBeenCalledWith({ quizId: 'z1', childId: 'c-minh', attemptId: 'att-1' });
  });
  it('rien ne compare les enfants : aucun classement ni mot de comparaison', async () => {
    mockSubjects = [{ subject: 'maths', week_offset: 0 }];
    mockOverview = [row()];
    await render(<ParentCatalog child={minh} today="2026-09-10" />);
    expect(screen.queryByText(/hạng|rank|classement/i)).toBeNull();
  });
});
