import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import type { AdventureState } from '@/domain/adventure';
import type { CompanionState } from '@/domain/panda';
import type { WeeklyGroup } from '@/hooks/useWeeklyQuizzes';
import { usePandaReaction } from '@/store/pandaReaction';
import type { ChildRow, TaskRow } from '@/types/models';
import V2ChildHome from '../app/(v2)/v2/child/home';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const minh = { id: 'c-minh', name: 'Minh', birth_date: '2015-03-01', color: '#1E88F5' } as ChildRow;
const task = (over: Partial<TaskRow>): TaskRow =>
  ({ id: 't1', child_id: 'c-minh', title: 'Đánh răng', category: 'personal', icon: null, date: '2026-11-02', time_kind: 'range', start_time: '07:00:00', end_time: '07:15:00', points: 10, completed_at: null, validated_at: null, created_by: 'm-p', ...over }) as TaskRow;
let mockTasks: TaskRow[] = [];
const mockToggle = jest.fn();
let mockWeekly: WeeklyGroup[] = [];
let mockCompanion: CompanionState | undefined;
let mockAdventure: AdventureState | undefined;
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({ me: { family: { timezone: 'Asia/Ho_Chi_Minh' } }, viewer: { role: 'child', memberId: 'm', childId: 'c-minh' }, children: [minh], child: minh, select: jest.fn() }),
}));
jest.mock('@/components/onboarding/ChildSetupGate', () => ({ ChildSetupGate: () => null }));
jest.mock('@/components/companion/PandaSetupCard', () => ({ PandaSetupCard: () => { const { Text } = jest.requireActual('react-native'); return <Text>panda-setup-card</Text>; } }));
jest.mock('@/hooks/useCompanion', () => ({ useCompanion: () => ({ data: mockCompanion }) }));
jest.mock('@/hooks/useAdventure', () => ({ useAdventure: () => ({ data: mockAdventure }), useAdventurePending: () => false }));
jest.mock('@/hooks/useNow', () => ({ useNow: () => new Date('2026-11-02T03:00:00Z') }));
jest.mock('@/hooks/useWeeklyQuizzes', () => ({ useWeeklyQuizzes: () => ({ groups: mockWeekly, isPending: false }) }));
jest.mock('@/hooks/useNotifications', () => ({ useUnreadNotifications: () => 2 }));
jest.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({ data: mockTasks, isPending: false }),
  useToggleTask: () => ({ mutate: mockToggle }),
  toggleVars: (t: TaskRow, completed: boolean, asParent: boolean) => ({ task: t, completed, txId: 'tx', asParent }),
}));

const panda: CompanionState = { hasCompanion: true, name: 'Bambou', trait: 'kind', variant: 'boy', stage: 2, stageOffset: 0, energyTotal: 20, level: 1, nextLevelAt: 100 };
const adv = (over: Partial<AdventureState> = {}): AdventureState => ({
  gauge: 18, cost: 60, state: 'filling', level: 1, today: '2026-11-02', active: null, last: null, unlocked: ['ha-long'],
  destinations: [{ slug: 'ha-long', minLevel: 1, discoveries: [] }], found: [], foundCount: 0, totalCount: 30, ...over,
});

describe('V2 : Hôm nay de l’enfant (D-106)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePandaReaction.setState({ childId: null, active: false, energy: 0 });
    mockCompanion = panda;
    mockAdventure = adv();
    mockWeekly = [];
    mockTasks = [
      task({}),
      task({ id: 't2', title: 'Làm toán', category: 'study', icon: 'maths', start_time: '14:00:00', end_time: '15:00:00', points: 15 }),
      task({ id: 't3', title: 'Tưới cây', category: 'chores', time_kind: 'anytime', start_time: null, end_time: null, points: 5 }),
    ];
  });

  it('décor maison, panda, boutons du haut, jauge, « Còn 3 việc », sections par moment de la journée', async () => {
    await render(<V2ChildHome />);
    expect(screen.getByTestId('v2-scene-home')).toBeTruthy();
    expect(screen.getByLabelText('Panda Bambou, bình tĩnh')).toBeTruthy();
    expect(screen.getByLabelText('Phiêu lưu: 18 trên 60 năng lượng')).toBeTruthy();
    expect(screen.getByText('Còn 3 việc hôm nay!')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Buổi sáng, 1 việc' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Buổi chiều, 1 việc' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lúc nào cũng được, 1 việc' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Buổi tối/ })).toBeNull(); // section vide masquée
    expect(screen.getByLabelText('15 năng lượng')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thêm việc' })).toBeNull(); // aucun « + » pour l'enfant
    await fireEvent.press(screen.getByRole('button', { name: 'Thông báo, 2 chưa đọc (2)' }));
    expect(mockPush).toHaveBeenCalledWith('/notifications');
  });

  it('cocher : même mutation que la V1 (enfant), réaction immédiate du panda avec les points de la tâche', async () => {
    await render(<V2ChildHome />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Làm toán' }));
    expect(mockToggle).toHaveBeenCalledWith(expect.objectContaining({ completed: true, asParent: false }));
    expect(usePandaReaction.getState()).toMatchObject({ childId: 'c-minh', energy: 15, active: true });
    expect(screen.getByText('+15 ⚡')).toBeTruthy(); // bulle de réaction sur le décor (aussi pendant le fondu depuis la vidéo d'accueil)
  });

  it('tâche cochée : « chờ bố mẹ duyệt » ; tâche validée : case inactive', async () => {
    mockTasks = [task({ completed_at: '2026-11-02T01:00:00Z' }), task({ id: 't2', title: 'Làm toán', completed_at: 'x', validated_at: 'y' }), task({ id: 't3', title: 'Tưới cây' })];
    await render(<V2ChildHome />);
    expect(screen.getByText('chờ bố mẹ duyệt')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Làm toán' }).props.accessibilityState).toMatchObject({ checked: true, disabled: true });
  });

  it('toutes cochées : carte de fin de journée (voix du stade, énergie manquante), « Xem lại » rouvre la liste', async () => {
    mockTasks = mockTasks.map((x) => ({ ...x, completed_at: '2026-11-02T01:00:00Z' }));
    await render(<V2ChildHome />);
    expect(screen.getByText('Xong hết rồi!')).toBeTruthy();
    expect(screen.getByText('Giỏi quá! Tụi mình hoàn thành mục tiêu hôm nay rồi!')).toBeTruthy();
    expect(screen.getByText('Hôm nay: 3/3 việc ✓')).toBeTruthy(); // la pastille ne répète pas « xong hết rồi »
    expect(screen.getAllByText(/xong hết rồi/i)).toHaveLength(1);
    expect(screen.getByText('Còn 42 ⚡ nữa là đi được!')).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Làm toán' })).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: 'Xem lại' }));
    expect(screen.getByRole('checkbox', { name: 'Làm toán' })).toBeTruthy();
  });

  it('jauge pleine et journée finie : « Đi phiêu lưu! » vers la carte', async () => {
    mockTasks = [task({ completed_at: 'x' })];
    mockAdventure = adv({ gauge: 60, state: 'ready_to_go' });
    await render(<V2ChildHome />);
    const go = screen.getAllByRole('button', { name: 'Đi phiêu lưu!' });
    expect(go.length).toBe(2); // carte d'aventure + carte de fin de journée
    await fireEvent.press(go[1]!);
    expect(mockPush).toHaveBeenCalledWith('/v2/child/adventure');
  });

  it('en voyage : décor de la destination, panda en marche, chemin ; au retour : maison, panda surpris', async () => {
    mockAdventure = adv({ state: 'away', active: { id: 'a1', destination: 'ha-long', departedOn: '2026-11-01', returnsOn: '2026-11-02', departedAt: '2026-11-01T10:00:00Z' } });
    const { rerender } = await render(<V2ChildHome />);
    expect(screen.getByTestId('v2-scene-ha-long')).toBeTruthy();
    expect(screen.getByLabelText('Panda Bambou đang đi phiêu lưu')).toBeTruthy();
    // 03:00 UTC le 2/11 = après 07:00 locale (00:00 UTC) : arrivé
    expect(screen.getByLabelText('Bambou đang trên đường, đã đi 100%')).toBeTruthy();
    mockAdventure = adv({ state: 'back', active: { id: 'a1', destination: 'ha-long', departedOn: '2026-11-01', returnsOn: '2026-11-02' } });
    await rerender(<V2ChildHome />);
    expect(screen.getByTestId('v2-scene-home')).toBeTruthy();
    expect(screen.getByLabelText('Panda Bambou, ngạc nhiên')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Mở túi' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/adventure/reveal', params: { id: 'a1' } });
  });

  it('révision de la semaine : une ligne « quand je veux » avec l’icône devoirs, ouvre l’écran weekly', async () => {
    mockTasks = [task({})];
    const item = { quizId: 'q1', subject: 'maths', title: 'Toán', weekLabel: 'Tuần 1', releaseOn: '2026-11-02', dueOn: '2026-11-08', attemptId: null, state: 'todo', late: false, progress: null, result: null, maxPoints: 8, pointsAwarded: 0 } as const;
    mockWeekly = [{ childId: 'c-minh', childName: 'Minh', items: [item] }];
    await render(<V2ChildHome />);
    expect(screen.getByTestId('v2-goal-weekly')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lúc nào cũng được, 1 việc' })).toBeTruthy(); // section créée par la seule révision
    await fireEvent.press(screen.getByRole('button', { name: /^Xem: / }));
    expect(mockPush).toHaveBeenCalledWith('/weekly');
  });

  it('sans panda : l’étape de création', async () => {
    mockCompanion = { ...panda, hasCompanion: false };
    await render(<V2ChildHome />);
    expect(screen.getByText('panda-setup-card')).toBeTruthy();
  });
});
