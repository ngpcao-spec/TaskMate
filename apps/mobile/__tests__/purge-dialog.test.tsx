import { fireEvent, render, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import { PurgeQuizDialog } from '@/components/admin/PurgeQuizDialog';

const TITLE = 'Ngữ văn 7 · Ôn tập chung (bản thử)';
const impact = (over: Record<string, unknown> = {}) => ({
  quiz_id: 'z1', title: TITLE, subject: 'langue_nationale', country: 'VN', grade: '7', week_label: 'Tuần 7', status: 'published',
  families: 2, children: 2, attempts: 3, in_progress: 1, submitted: 1, validated: 1, points: 8, questions: 12, answers: 20, ...over,
});

let mockImpact: { data?: ReturnType<typeof impact>; isPending: boolean; isFetching: boolean; isError: boolean } = { data: impact(), isPending: false, isFetching: false, isError: false };
const mockRefetch = jest.fn();
const mockPurge = jest.fn();
let mockPurgeResult: unknown = { purged: true, title: TITLE, counts: { families: 2, children: 2, attempts: 3, validated: 1, points: 8, questions: 12 } };
let mockPurgePending = false;
jest.mock('@/hooks/useCatalog', () => ({
  useCatalogQuizImpact: () => ({ ...mockImpact, refetch: mockRefetch }),
  usePurgeCatalogQuiz: () => ({ isPending: mockPurgePending, mutate: (v: unknown, o?: { onSuccess?: (r: unknown) => void }) => { mockPurge(v); o?.onSuccess?.(mockPurgeResult); } }),
}));
const mockShow = jest.fn();
jest.mock('@/store/toast', () => ({ useToastStore: (sel: (s: { show: jest.Mock }) => unknown) => sel({ show: mockShow }) }));

const onClose = jest.fn();
const onPurged = jest.fn();
const renderDialog = (visible = true) => render(<PurgeQuizDialog quizId="z1" visible={visible} onClose={onClose} onPurged={onPurged} />);
const confirmButton = () => screen.getByRole('button', { name: `Xóa vĩnh viễn «${TITLE}»` });
const titleField = () => screen.getByLabelText(`Gõ đúng tiêu đề «${TITLE}» để xác nhận`);

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('vi');
  mockImpact = { data: impact(), isPending: false, isFetching: false, isError: false };
  mockPurgePending = false;
  mockPurgeResult = { purged: true, title: TITLE, counts: { families: 2, children: 2, attempts: 3, validated: 1, points: 8, questions: 12 } };
});

describe('Suppression définitive d\'un QCM — confirmation (D-091)', () => {
  it('affiche l\'impact en clair : enfants, tentatives dont validées, points déjà attribués (conservés)', async () => {
    await renderDialog();
    expect(screen.getByText(TITLE)).toBeTruthy();
    expect(screen.getByText('2 bé, 3 lượt làm trong đó 1 đã duyệt, 8 điểm đã cộng (được giữ nguyên).')).toBeTruthy();
    expect(screen.getByText('2 gia đình · 1 đang làm · 1 chờ duyệt · 1 đã duyệt')).toBeTruthy();
    expect(screen.getByText(/Không thể hoàn tác/)).toBeTruthy();
  });

  it.each([
    ['fr', '2 enfant(s), 3 tentative(s) dont 1 validée(s), 8 point(s) déjà attribué(s) (conservés).'],
    ['en', '2 child(ren), 3 attempt(s) of which 1 validated, 8 point(s) already awarded (kept).'],
  ])('même impact en %s', async (lang, sentence) => {
    await i18n.changeLanguage(lang);
    await renderDialog();
    expect(screen.getByText(sentence)).toBeTruthy();
  });

  it('bouton rouge INACTIF tant que le titre exact n\'est pas retapé', async () => {
    await renderDialog();
    expect(confirmButton().props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.changeText(titleField(), 'Ngữ văn 7');
    expect(confirmButton().props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.changeText(titleField(), TITLE.toUpperCase());
    expect(confirmButton().props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(confirmButton());
    expect(mockPurge).not.toHaveBeenCalled();
  });

  it('titre exact : le bouton devient actif ; la confirmation envoyée est le titre (sans espaces autour)', async () => {
    await renderDialog();
    await fireEvent.changeText(titleField(), `  ${TITLE} `);
    expect(confirmButton().props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(confirmButton());
    expect(mockPurge).toHaveBeenCalledWith({ quizId: 'z1', confirm: TITLE });
  });

  it('succès : message avec les compteurs (points conservés) puis fermeture par le parent de l\'écran', async () => {
    await renderDialog();
    await fireEvent.changeText(titleField(), TITLE);
    await fireEvent.press(confirmButton());
    expect(mockShow).toHaveBeenCalledWith(`Đã xóa «${TITLE}»: 3 lượt làm của 2 bé; 8 điểm được giữ nguyên. Ô đã trống.`);
    expect(onPurged).toHaveBeenCalledTimes(1);
  });

  it('rejeu (déjà supprimé) : message dédié, pas de compteur inventé', async () => {
    mockPurgeResult = { purged: false, title: '', counts: { families: 0, children: 0, attempts: 0, validated: 0, points: 0, questions: 0 } };
    await renderDialog();
    await fireEvent.changeText(titleField(), TITLE);
    await fireEvent.press(confirmButton());
    expect(mockShow).toHaveBeenCalledWith('Bài này đã được xóa từ trước.');
  });

  it('QCM jamais commencé : on le dit, sans chiffres vides', async () => {
    mockImpact = { data: impact({ attempts: 0, children: 0, families: 0, validated: 0, points: 0, in_progress: 0, submitted: 0 }), isPending: false, isFetching: false, isError: false };
    await renderDialog();
    expect(screen.getByText('Chưa có bé nào làm bài này.')).toBeTruthy();
    expect(screen.queryByText(/lượt làm trong đó/)).toBeNull();
  });

  it('impact en cours de lecture : aucun champ ni bouton rouge (un chiffre périmé ne rassure pas)', async () => {
    mockImpact = { data: impact(), isPending: false, isFetching: true, isError: false };
    await renderDialog();
    expect(screen.queryByLabelText(`Gõ đúng tiêu đề «${TITLE}» để xác nhận`)).toBeNull();
    expect(screen.queryByRole('button', { name: `Xóa vĩnh viễn «${TITLE}»` })).toBeNull();
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeTruthy();
  });

  it('lecture de l\'impact impossible : erreur + nouvel essai, pas de suppression possible', async () => {
    mockImpact = { data: undefined, isPending: false, isFetching: false, isError: true };
    await renderDialog();
    expect(screen.getByText('Không đọc được tác động của việc xóa. Hãy thử lại.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Xóa vĩnh viễn «/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('suppression en cours : on ne peut plus annuler ni retaper', async () => {
    mockPurgePending = true;
    await renderDialog();
    expect(screen.getByRole('button', { name: 'Hủy' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('annuler ferme sans rien supprimer ; fermé = rien d\'affiché', async () => {
    await renderDialog();
    await fireEvent.press(screen.getByRole('button', { name: 'Hủy' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockPurge).not.toHaveBeenCalled();
    await renderDialog(false);
    expect(screen.queryByRole('button', { name: 'Hủy' })).toBeNull();
  });
});
