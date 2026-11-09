import { act, fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import { Platform, StyleSheet } from 'react-native';
import type { AdventureState } from '@/domain/adventure';
import type { CompanionState } from '@/domain/panda';
import type { WeeklyGroup } from '@/hooks/useWeeklyQuizzes';
import { useHomeScene } from '@/store/homeScene';
import { usePandaReaction } from '@/store/pandaReaction';
import { useTripStore } from '@/store/trip';
import type { ChildRow, TaskRow } from '@/types/models';
import * as videoModule from '@/v2/video';
import { homeVideoForStage } from '@/v2/video';
import { v2Colors } from '@/v2/theme';
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
const mockCollect = { mutate: jest.fn(), data: undefined as unknown, variables: undefined as unknown };
jest.mock('@/hooks/useAdventure', () => ({ useAdventure: () => ({ data: mockAdventure }), useAdventurePending: () => false, useCollectAdventure: () => mockCollect }));
let mockReduce = false;
jest.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => mockReduce }));
jest.mock('@/hooks/useNow', () => ({ useNow: () => new Date('2026-11-02T03:00:00Z') }));
jest.mock('@/hooks/useWeeklyQuizzes', () => ({ useWeeklyQuizzes: () => ({ groups: mockWeekly, isPending: false }) }));
jest.mock('@/hooks/useNotifications', () => ({ useUnreadNotifications: () => 2 }));
// lecteur de la vidéo de voyage (web) remplacé par un espion : ses props = ce que l'écran demande
let mockTripVideo: { mode: string; video: { key: string }; onFailed: () => void } | null = null;
jest.mock('@/v2/components/TripVideo', () => ({
  TripVideo: (p: { mode: string; video: { key: string }; onFailed: () => void }) => {
    mockTripVideo = p;
    const { View } = jest.requireActual('react-native');
    return <View testID="v2-trip-video" />;
  },
}));
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

  it('jauge pleine et journée finie (D-107) : « Chọn nơi đến » et « Đi phiêu lưu! » vers la carte ; le panda reste éveillé et le dit', async () => {
    mockTasks = [task({ completed_at: 'x' })];
    mockAdventure = adv({ gauge: 60, state: 'ready_to_go' });
    await render(<V2ChildHome />);
    expect(screen.getByText('Đi phiêu lưu thôi!')).toBeTruthy();
    expect(screen.getAllByLabelText(/^Panda Bambou, /).length).toBeGreaterThan(0); // panda du décor (et celui de la carte de fin de journée)
    expect(screen.queryByLabelText(/ngủ/)).toBeNull(); // jamais endormi jauge pleine
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn nơi đến' }));
    expect(mockPush).toHaveBeenCalledWith('/v2/child/adventure');
    mockPush.mockClear();
    await fireEvent.press(screen.getByRole('button', { name: 'Đi phiêu lưu!' })); // carte de fin de journée
    expect(mockPush).toHaveBeenCalledWith('/v2/child/adventure');
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

describe('V2 : vidéo d’accueil dans Hôm nay (D-106)', () => {
  const teen: CompanionState = { hasCompanion: true, name: 'Bambou', trait: 'kind', variant: 'boy', stage: 3, stageOffset: 0, energyTotal: 20, level: 1, nextLevelAt: 100 };
  const H = { includeHiddenElements: true } as const;
  const opacityOf = (id: string) => StyleSheet.flatten(screen.getByTestId(id, H).props.style).opacity;
  /** panda dessiné (sol) : masqué quand l'aperçu de la vidéo couvre le décor */
  const groundOpacity = () => opacityOf('v2-scene-ground');
  beforeEach(() => {
    usePandaReaction.setState({ childId: null, active: false, energy: 0 });
    mockCompanion = teen;
    mockAdventure = adv();
    mockTasks = [task({})];
  });
  afterEach(() => jest.restoreAllMocks());

  it('web, stade 4 à la maison : l\'aperçu fixe de la vidéo couvre le décor, panda dessiné masqué (jamais un fond vide) ; décor et panda pendant une réaction (stade sans réaction vidéo)', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    jest.spyOn(videoModule, 'homeReactionsForStage').mockReturnValue(null);
    mockCompanion = { ...teen, stage: 4 };
    await render(<V2ChildHome />);
    expect(screen.getByTestId('v2-home-video-poster', H)).toBeTruthy();
    expect(opacityOf('v2-scene-backdrop')).toBe(1);
    expect(groundOpacity()).toBe(0);
    expect(screen.getByLabelText('Panda Bambou, bình tĩnh', H)).toBeTruthy(); // le libellé du panda reste
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Đánh răng' }));
    expect(opacityOf('v2-scene-backdrop')).toBe(0);
    expect(groundOpacity()).toBe(1);
  });
  it('web, les 4 stades affichés (décalage compris) ont leur vidéo ; variante fille : décor fixe et panda dessiné', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    for (const stage of [1, 2, 4] as const) {
      mockCompanion = { ...teen, stage };
      const view = await render(<V2ChildHome />);
      expect(screen.getByTestId('v2-home-video-poster', H)).toBeTruthy();
      expect(groundOpacity()).toBe(0);
      await view.unmount();
    }
    // stade 3 avec le décalage −1 : le stade AFFICHÉ (2) choisit la vidéo
    mockCompanion = { ...teen, stage: 2, stageOffset: -1 };
    const shifted = await render(<V2ChildHome />);
    expect(screen.getByTestId('v2-home-video-poster', H)).toBeTruthy();
    await shifted.unmount();
    // conditions inchangées : pas de vidéo pour la variante fille (pas encore de fichiers)
    mockCompanion = { ...teen, stage: 1, variant: 'girl' };
    const girl = await render(<V2ChildHome />);
    expect(screen.queryByTestId('v2-home-video-poster', H)).toBeNull();
    expect(groundOpacity()).toBe(1);
    await girl.unmount();
  });
  it('web, vidéo affichée : le fond sous l\'en-tête prolonge la vidéo (couleur de son sable, fondu, sans coins arrondis) ; sans vidéo : vert du thème', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    for (const stage of [1, 2, 3, 4] as const) {
      mockCompanion = { ...teen, stage };
      const view = await render(<V2ChildHome />);
      const color = homeVideoForStage(stage)!.groundColor;
      expect(StyleSheet.flatten(screen.getByTestId('v2-child-home').props.style).backgroundColor).toBe(color);
      expect(String(StyleSheet.flatten(screen.getByTestId('v2-scene-extend', H).props.style).backgroundImage)).toContain(color);
      // la barre d'onglets (layout) lit la même couleur tant que l'écran a le focus ; effacée en quittant l'écran
      expect(useHomeScene.getState().color).toBe(color);
      await view.unmount();
      expect(useHomeScene.getState().color).toBeNull();
    }
    mockCompanion = { ...teen, variant: 'girl' };
    await render(<V2ChildHome />);
    expect(StyleSheet.flatten(screen.getByTestId('v2-child-home').props.style).backgroundColor).toBe(v2Colors.background);
    expect(screen.queryByTestId('v2-scene-extend', H)).toBeNull();
    expect(useHomeScene.getState().color).toBeNull();
  });
  it('natif : ni aperçu ni vidéo, décor et panda visibles', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await render(<V2ChildHome />);
    expect(screen.queryByTestId('v2-scene-backdrop', H)).toBeNull();
    expect(groundOpacity()).toBe(1);
  });
  it('web, en voyage (D-107) : décor de la maison, sans vidéo ni panda', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockAdventure = adv({ state: 'away', active: { id: 'a1', destination: 'ha-long', departedOn: '2026-11-01', returnsOn: '2026-11-02' } });
    await render(<V2ChildHome />);
    expect(screen.getByTestId('v2-scene-home')).toBeTruthy();
    expect(screen.queryByTestId('v2-scene-backdrop', H)).toBeNull();
    expect(screen.queryByTestId('v2-panda', H)).toBeNull();
  });
});

describe('V2 : le grand départ et le retour dans Hôm nay (D-107)', () => {
  const HL = { slug: 'ha-long', minLevel: 1, discoveries: ['ha-long-perle', 'ha-long-coquillage'] };
  const awayAdv = (id: string) => adv({ state: 'away', gauge: 5, destinations: [HL], active: { id, destination: 'ha-long', departedOn: '2026-11-01', returnsOn: '2026-11-02', departedAt: '2026-11-01T10:00:00Z' } });
  const backAdv = (id: string) => adv({ state: 'back', gauge: 5, destinations: [HL], active: { id, destination: 'ha-long', departedOn: '2026-11-01', returnsOn: '2026-11-02' } });
  beforeEach(() => {
    jest.clearAllMocks();
    usePandaReaction.setState({ childId: null, active: false, energy: 0 });
    useTripStore.setState({ departure: null });
    mockCompanion = panda;
    mockReduce = false;
    mockTasks = [task({})];
    mockWeekly = [];
    mockCollect.data = undefined;
    mockCollect.variables = undefined;
  });

  it('départ accepté : le panda quitte la maison par la droite en le disant ; un toucher passe à la maison vide', async () => {
    mockAdventure = awayAdv('dep1');
    useTripStore.getState().depart({ childId: 'c-minh', destination: 'ha-long', at: Date.now() });
    await render(<V2ChildHome />);
    expect(screen.getByTestId('v2-trip-walk-out')).toBeTruthy();
    expect(screen.getByLabelText('Bambou đang lên đường đến Vịnh Hạ Long')).toBeTruthy();
    expect(screen.getByText(/^(Đi thôi! Sáng mai tớ về nhé!|Tớ đi đây! Sáng mai gặp lại cậu nhé!)$/)).toBeTruthy();
    expect(screen.queryByTestId('v2-trip-note')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Bỏ qua' }));
    expect(useTripStore.getState().departure).toBeNull();
    expect(screen.getByTestId('v2-trip-note')).toBeTruthy();
  });

  it('« réduire les animations » : directement la maison vide', async () => {
    mockReduce = true;
    mockAdventure = awayAdv('dep2');
    useTripStore.getState().depart({ childId: 'c-minh', destination: 'ha-long', at: Date.now() });
    await render(<V2ChildHome />);
    expect(useTripStore.getState().departure).toBeNull();
    expect(screen.getByTestId('v2-trip-note')).toBeTruthy();
  });

  it('en voyage : maison vide, mot épinglé (texte = libellé) qui rouvre la carte postale en lecture seule ; carte d’aventure et jauge « Chuyến tiếp theo đang chờ! »', async () => {
    mockAdventure = awayAdv('a-away');
    await render(<V2ChildHome />);
    expect(screen.getByTestId('v2-scene-home')).toBeTruthy();
    expect(screen.queryByTestId('v2-panda')).toBeNull();
    expect(screen.getByText('Bambou đang ở Vịnh Hạ Long · về sáng mai')).toBeTruthy();
    expect(screen.getByText('Chuyến tiếp theo đang chờ!')).toBeTruthy();
    expect(screen.getByLabelText('Chuyến tiếp theo đang chờ! 5 trên 60 năng lượng')).toBeTruthy();
    expect(screen.queryByText(/Chuyến sau/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Tớ đi Vịnh Hạ Long, sáng mai về nhé! — Bambou' }));
    expect(screen.getByTestId('v2-postcard-ha-long')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lên đường!' })).toBeNull();
    await fireEvent.press(screen.getByTestId('v2-postcard-close'));
    expect(screen.queryByTestId('v2-postcard-ha-long')).toBeNull();
  });

  it('cocher pendant le voyage : aucune animation du panda (absent), « +N ⚡ » sur la jauge', async () => {
    mockAdventure = awayAdv('a-check');
    await render(<V2ChildHome />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Đánh răng' }));
    expect(mockToggle).toHaveBeenCalled();
    expect(screen.getByTestId('v2-adventure-plus')).toBeTruthy();
    expect(screen.getAllByText('+10 ⚡')).toHaveLength(1); // seulement sur la jauge
  });

  it('retour : le panda entre par la gauche (une seule fois), puis paquet fermé et bulle ; ouverture → trouvaille, récit, « Cất vào sổ »', async () => {
    mockAdventure = backAdv('a-back');
    const view = await render(<V2ChildHome />);
    expect(screen.getByTestId('v2-trip-walk-in')).toBeTruthy();
    expect(screen.getByLabelText('Bambou đang về nhà')).toBeTruthy();
    await view.unmount();
    // fin de l'entrée (« réduire les animations » : immédiate) → paquet fermé, bulle
    mockReduce = true;
    const again = await render(<V2ChildHome />);
    expect(screen.getByTestId('v2-trip-gift')).toBeTruthy();
    expect(screen.getByText(/^(Tớ về rồi! Có quà cho Minh nè!|Tớ về rồi đây! Quà này cho Minh nè!)$/)).toBeTruthy();
    await again.unmount();
    // l'app rouverte : plus d'entrée, le panda attend au centre avec le paquet
    mockReduce = false;
    await render(<V2ChildHome />);
    expect(screen.queryByTestId('v2-trip-walk-in')).toBeNull();
    const gift = screen.getByTestId('v2-trip-gift-button');
    expect(gift.props.accessibilityLabel).toBe('Mở quà');
    expect(gift).toHaveStyle({ width: 72, height: 72 }); // ≥ 44 pt
    await fireEvent.press(gift);
    expect(mockCollect.mutate).toHaveBeenCalledWith({ childId: 'c-minh', adventureId: 'a-back' }, expect.anything());
    expect(screen.getByText('Đang chờ kết nối…')).toBeTruthy(); // résultat pas encore reçu (hors ligne) : rien d'inventé
    expect(screen.queryByTestId('v2-trip-reveal')).toBeNull();
    // résultat du serveur
    mockCollect.data = { discoverySlug: 'ha-long-perle', duplicate: false, destination: 'ha-long' };
    mockCollect.variables = { childId: 'c-minh', adventureId: 'a-back' };
    mockAdventure = adv({ state: 'filling', gauge: 5, destinations: [HL], found: [{ slug: 'ha-long-perle', timesFound: 1 }], last: { id: 'a-back', destination: 'ha-long', discoverySlug: 'ha-long-perle', duplicate: false } });
    await screen.rerender(<V2ChildHome />);
    expect(screen.getByTestId('v2-trip-opened')).toBeTruthy();
    expect(screen.getByTestId('v2-trip-confetti', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('ngọc trai')).toBeTruthy();
    expect(screen.getByText(/Hạ Long/)).toBeTruthy(); // réplique de récit de la destination
    await fireEvent.press(screen.getByRole('button', { name: 'Cất vào sổ' }));
    expect(screen.queryByTestId('v2-trip-reveal')).toBeNull();
    expect(screen.getByLabelText('Panda Bambou, bình tĩnh')).toBeTruthy();
  });

  it('paquet ouvert : jamais rejoué (même aventure, autre affichage) ; doublon : réplique adventure_duplicate ; sans confettis si moins d’animations', async () => {
    mockReduce = true;
    mockAdventure = backAdv('a-dup');
    await render(<V2ChildHome />);
    await fireEvent.press(screen.getByTestId('v2-trip-gift-button'));
    mockCollect.data = { discoverySlug: 'ha-long-perle', duplicate: true, destination: 'ha-long' };
    mockCollect.variables = { childId: 'c-minh', adventureId: 'a-dup' };
    mockAdventure = adv({ state: 'filling', destinations: [HL], found: [{ slug: 'ha-long-perle', timesFound: 2 }], last: { id: 'a-dup', destination: 'ha-long', discoverySlug: 'ha-long-perle', duplicate: true } });
    await screen.rerender(<V2ChildHome />);
    expect(screen.getByText('Đã có trong sổ (×2)')).toBeTruthy();
    expect(screen.getByText(/^(Cái này cậu có rồi|Lại là món này)/)).toBeTruthy();
    expect(screen.queryByTestId('v2-trip-confetti', { includeHiddenElements: true })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Cất vào sổ' }));
    await screen.unmount();
    mockCollect.data = undefined;
    await render(<V2ChildHome />);
    expect(screen.queryByTestId('v2-trip-reveal')).toBeNull();
    expect(screen.queryByTestId('v2-trip-gift')).toBeNull();
  });
});

describe('V2 : vidéo de voyage du stade 1 dans Hôm nay (D-107)', () => {
  const HL = { slug: 'ha-long', minLevel: 1, discoveries: ['ha-long-perle'] };
  const awayAdv = () => adv({ state: 'away', gauge: 5, destinations: [HL], active: { id: 'a-walk', destination: 'ha-long', departedOn: '2026-11-01', returnsOn: '2026-11-02', departedAt: '2026-11-01T10:00:00Z' } });
  const be: CompanionState = { ...panda, stage: 1 };
  beforeEach(() => {
    jest.clearAllMocks();
    jest.replaceProperty(Platform, 'OS', 'web');
    usePandaReaction.setState({ childId: null, active: false, energy: 0 });
    useTripStore.setState({ departure: null });
    mockTripVideo = null;
    mockCompanion = be;
    mockReduce = false;
    mockTasks = [task({})];
    mockWeekly = [];
    mockAdventure = awayAdv();
  });
  afterEach(() => jest.restoreAllMocks());

  it('en voyage, stade 1 : la vidéo de voyage remplace la maison vide (plus de mot) ; la carte garde « đang ở … · về sáng mai » ; toucher le panda rouvre la carte postale', async () => {
    await render(<V2ChildHome />);
    expect(screen.getByTestId('v2-trip-video')).toBeTruthy();
    expect(mockTripVideo).toMatchObject({ mode: 'video', video: { key: 'trip-be' } });
    expect(screen.queryByTestId('v2-trip-note')).toBeNull();
    expect(screen.queryByTestId('v2-panda')).toBeNull();
    expect(screen.getByText('Bambou đang ở Vịnh Hạ Long · về sáng mai')).toBeTruthy();
    const hit = screen.getByRole('button', { name: 'Bambou đang trên đường đến Vịnh Hạ Long' });
    const st = StyleSheet.flatten(hit.props.style);
    expect(Math.min(st.width as number, st.height as number)).toBeGreaterThanOrEqual(44);
    await fireEvent.press(hit);
    expect(screen.getByTestId('v2-postcard-ha-long')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lên đường!' })).toBeNull();
  });

  it('« réduire les animations » : image fixe du voyage, pas de vidéo', async () => {
    mockReduce = true;
    await render(<V2ChildHome />);
    expect(mockTripVideo?.mode).toBe('still');
    expect(screen.queryByTestId('v2-trip-note')).toBeNull();
  });

  it('lecture refusée : retour à la maison vide + mot (D-107)', async () => {
    await render(<V2ChildHome />);
    await act(async () => mockTripVideo!.onFailed());
    expect(screen.queryByTestId('v2-trip-video')).toBeNull();
    expect(screen.getByTestId('v2-trip-note')).toBeTruthy();
  });

  it('stade sans vidéo de voyage (2) : maison vide + mot, inchangé', async () => {
    mockCompanion = panda;
    await render(<V2ChildHome />);
    expect(screen.queryByTestId('v2-trip-video')).toBeNull();
    expect(screen.getByTestId('v2-trip-note')).toBeTruthy();
    // natif : `tripMediaMode` (web seulement) et le lecteur natif vide, testés à part
  });

  it('pendant la séquence de départ : le panda sort de la maison ; une fois sorti, directement la vidéo de voyage', async () => {
    useTripStore.getState().depart({ childId: 'c-minh', destination: 'ha-long', at: Date.now() });
    await render(<V2ChildHome />);
    expect(JSON.stringify(screen.toJSON())).toContain('"testID":"v2-trip-walk-out"'); // nœud animé (opacité), ignoré par getByTestId sur le web
    expect(screen.queryByTestId('v2-trip-video')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Bỏ qua' }));
    expect(screen.getByTestId('v2-trip-video')).toBeTruthy();
  });

  it('retour (« back ») : séquence de retour D-107, aucune vidéo de voyage', async () => {
    mockAdventure = adv({ state: 'back', gauge: 5, destinations: [HL], active: { id: 'a-walk', destination: 'ha-long', departedOn: '2026-11-01', returnsOn: '2026-11-02' } });
    await render(<V2ChildHome />);
    expect(screen.queryByTestId('v2-trip-video')).toBeNull();
    expect(JSON.stringify(screen.toJSON())).toContain('"testID":"v2-trip-walk-in"'); // nœud animé (opacité), ignoré par getByTestId sur le web
  });
});
