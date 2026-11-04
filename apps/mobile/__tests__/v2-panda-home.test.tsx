import { act, fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import { Platform, StyleSheet } from 'react-native';
import type { AdventureState } from '@/domain/adventure';
import type { CompanionState } from '@/domain/panda';
import type { HomeVideoProps } from '@/v2/components/HomeVideo';
import { usePandaReaction } from '@/store/pandaReaction';
import type { ChildRow, TaskRow } from '@/types/models';
import V2ChildHome from '../app/(v2)/v2/child/home';

/**
 * Panda vidéo du stade 1 dans Hôm nay (D-106) : déclencheurs et enchaînements, le lecteur web étant remplacé par un espion (ses props = ce que
 * le gestionnaire demande ; ses rappels `onEnded` / `onFailed` simulent les événements réels de la vidéo).
 */
let mockVideo: HomeVideoProps | null = null;
jest.mock('@/v2/components/HomeVideo', () => ({
  HomeVideo: (p: HomeVideoProps) => {
    mockVideo = p;
    return null;
  },
}));
const mockStore = new Map<string, string>();
jest.mock('@/sync/storage', () => ({
  kvStorage: { getItem: (k: string) => mockStore.get(k) ?? null, setItem: (k: string, v: string) => void mockStore.set(k, v), removeItem: (k: string) => void mockStore.delete(k) },
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const minh = { id: 'c-minh', name: 'Minh', birth_date: '2021-03-01', color: '#1E88F5' } as ChildRow;
const task = (over: Partial<TaskRow>): TaskRow =>
  ({ id: 't1', child_id: 'c-minh', title: 'Đánh răng', category: 'personal', icon: null, date: '2026-11-02', time_kind: 'anytime', start_time: null, end_time: null, points: 10, completed_at: null, validated_at: null, created_by: 'm-p', ...over }) as TaskRow;
let mockTasks: TaskRow[] = [];
const mockToggle = jest.fn();
let mockCompanion: CompanionState | undefined;
let mockToday = '2026-11-02T03:00:00Z';
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({ me: { family: { timezone: 'Asia/Ho_Chi_Minh' } }, viewer: { role: 'child', memberId: 'm', childId: 'c-minh' }, children: [minh], child: minh, select: jest.fn() }),
}));
jest.mock('@/components/onboarding/ChildSetupGate', () => ({ ChildSetupGate: () => null }));
jest.mock('@/hooks/useCompanion', () => ({ useCompanion: () => ({ data: mockCompanion }) }));
const adventure: AdventureState = {
  gauge: 18, cost: 60, state: 'filling', level: 1, today: '2026-11-02', active: null, last: null, unlocked: ['ha-long'],
  destinations: [{ slug: 'ha-long', minLevel: 1, discoveries: [] }], found: [], foundCount: 0, totalCount: 30,
};
jest.mock('@/hooks/useAdventure', () => ({ useAdventure: () => ({ data: adventure }), useAdventurePending: () => false }));
jest.mock('@/hooks/useNow', () => ({ useNow: () => new Date(mockToday) }));
jest.mock('@/hooks/useWeeklyQuizzes', () => ({ useWeeklyQuizzes: () => ({ groups: [], isPending: false }) }));
jest.mock('@/hooks/useNotifications', () => ({ useUnreadNotifications: () => 0 }));
jest.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({ data: mockTasks, isPending: false }),
  useToggleTask: () => ({ mutate: mockToggle }),
  toggleVars: (t: TaskRow, completed: boolean, asParent: boolean) => ({ task: t, completed, txId: 'tx', asParent }),
}));

const be: CompanionState = { hasCompanion: true, name: 'Bambou', trait: 'kind', variant: 'boy', stage: 1, stageOffset: 0, energyTotal: 20, level: 1, nextLevelAt: 100 };
const H = { includeHiddenElements: true } as const;
/** `asleep` = le panda RESTE endormi : vidéo du sommeil en boucle (ou image endormie en images fixes) */
const anim = () => (mockVideo?.clip?.name === 'sleep' && mockVideo.clip.loop) || mockVideo?.still !== undefined ? 'asleep' : (mockVideo?.clip?.name ?? 'idle');
const ended = async (name: 'happy' | 'curious' | 'sleep') => act(async () => mockVideo!.onEnded!(name));
const check = async (title: string) => fireEvent.press(screen.getByRole('checkbox', { name: title }));

describe('panda vidéo du stade 1 dans Hôm nay (D-106)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.replaceProperty(Platform, 'OS', 'web');
    mockVideo = null;
    mockStore.clear();
    mockToday = '2026-11-02T03:00:00Z';
    usePandaReaction.setState({ childId: null, active: false, energy: 0 });
    mockCompanion = be;
    mockTasks = [task({}), task({ id: 't2', title: 'Làm toán', points: 15 })];
  });
  afterEach(() => jest.restoreAllMocks());

  it('1. ouverture : la vidéo de repos démarre, les réactions sont préparées légèrement', async () => {
    await render(<V2ChildHome />);
    expect(anim()).toBe('idle');
    expect(mockVideo!.prefetch).toHaveLength(4); // content, curieux, transition du coucher, sommeil en boucle
    expect(mockVideo!.visible).toBe(true);
  });

  it('2. coche acceptée : « content » puis repos (fin réelle simulée) ; la coche n’attend pas l’animation', async () => {
    await render(<V2ChildHome />);
    await check('Đánh răng');
    expect(mockToggle).toHaveBeenCalledTimes(1);
    expect(anim()).toBe('happy');
    // le stade 1 ne fond PAS vers le décor fixe pendant la réaction : la vidéo reste visible
    expect(mockVideo!.visible).toBe(true);
    await ended('happy');
    expect(anim()).toBe('idle');
  });

  it('3. toucher le panda : « curieux » puis repos ; zone tactile accessible, ≥ 44 × 44', async () => {
    await render(<V2ChildHome />);
    const hit = screen.getByRole('button', { name: 'Chạm vào Bambou' });
    const st = StyleSheet.flatten(hit.props.style);
    expect(st.width).toBeGreaterThanOrEqual(44);
    expect(st.height).toBeGreaterThanOrEqual(44);
    await fireEvent.press(hit);
    expect(anim()).toBe('curious');
    await ended('curious');
    expect(anim()).toBe('idle');
  });

  it('4. toucher pendant « content » : « content » continue', async () => {
    await render(<V2ChildHome />);
    await check('Đánh răng');
    const serial = mockVideo!.clip!.serial;
    await fireEvent.press(screen.getByRole('button', { name: 'Chạm vào Bambou' }));
    expect(anim()).toBe('happy');
    expect(mockVideo!.clip!.serial).toBe(serial);
  });

  it('5. dernière tâche cochée : « content », puis la transition (il se couche et s’endort), puis il RESTE endormi (sommeil en boucle, même après un nouvel affichage le même jour)', async () => {
    mockTasks = [task({ completed_at: '2026-11-02T01:00:00Z' }), task({ id: 't2', title: 'Làm toán', points: 15 })];
    const r = await render(<V2ChildHome />);
    await check('Làm toán');
    expect(anim()).toBe('happy');
    // la coche acceptée rend la journée finie (`dayComplete`) : le coucher attend la fin de « content »
    mockTasks = mockTasks.map((x) => ({ ...x, completed_at: '2026-11-02T02:00:00Z' }));
    await r.rerender(<V2ChildHome />);
    expect(anim()).toBe('happy');
    await ended('happy');
    // la transition : une seule lecture
    expect(mockVideo!.clip).toMatchObject({ name: 'sleep', key: 'be-fall-asleep', loop: false });
    expect(screen.getByText(/Tốt lắm|hoàn thành/i, H)).toBeTruthy(); // la carte de fin de journée reste là
    await ended('sleep');
    // il reste endormi : le sommeil en boucle, l'aperçu dessous montre le panda endormi (jamais le panda éveillé si la boucle ne joue pas)
    expect(mockVideo!.clip).toMatchObject({ name: 'sleep', key: 'be-sleep', loop: true });
    expect(mockVideo!.still).toBeUndefined();
    expect(screen.getByTestId('v2-home-video-poster-still', H)).toBeTruthy();
    await r.rerender(<V2ChildHome />);
    expect(anim()).toBe('asleep');
    // nouvel affichage le même jour : directement endormi, sans rejouer la transition
    await r.unmount();
    await render(<V2ChildHome />);
    expect(anim()).toBe('asleep');
    expect(mockVideo!.clip).toMatchObject({ key: 'be-sleep', loop: true });
  });

  it('coucher : jamais pour une tâche cochée tant qu’il en reste ; réveil quand une tâche est décochée, et au nouveau jour', async () => {
    mockTasks = [task({ completed_at: '2026-11-02T01:00:00Z' }), task({ id: 't2', title: 'Làm toán', completed_at: '2026-11-02T01:00:00Z' })];
    mockStore.set('taskmate-panda-sleep:c-minh', '2026-11-02');
    const r = await render(<V2ChildHome />);
    expect(anim()).toBe('asleep');
    mockTasks = [task({ completed_at: '2026-11-02T01:00:00Z' }), task({ id: 't2', title: 'Làm toán' })];
    await r.rerender(<V2ChildHome />);
    expect(anim()).toBe('idle');
    // nouveau jour local : journée pas finie → repos
    mockToday = '2026-11-03T03:00:00Z';
    mockTasks = [task({ date: '2026-11-03' })];
    await r.rerender(<V2ChildHome />);
    expect(anim()).toBe('idle');
  });

  it('déjà couché aujourd’hui, tâche décochée puis recochée sous les yeux de l’enfant : la transition se REJOUE (pas directement la boucle)', async () => {
    mockStore.set('taskmate-panda-sleep:c-minh', '2026-11-02');
    mockTasks = [task({ completed_at: '2026-11-02T01:00:00Z' }), task({ id: 't2', title: 'Làm toán', completed_at: '2026-11-02T01:00:00Z' })];
    const r = await render(<V2ChildHome />);
    // ouverture, journée déjà finie et coucher déjà joué : directement endormi, sans transition
    expect(mockVideo!.clip).toMatchObject({ key: 'be-sleep', loop: true });
    // décoche : réveil
    mockTasks = [task({ completed_at: '2026-11-02T01:00:00Z' }), task({ id: 't2', title: 'Làm toán' })];
    await r.rerender(<V2ChildHome />);
    expect(anim()).toBe('idle');
    // recoche : la journée se termine à l'écran → transition, puis boucle
    mockTasks = [task({ completed_at: '2026-11-02T01:00:00Z' }), task({ id: 't2', title: 'Làm toán', completed_at: '2026-11-02T03:00:00Z' })];
    await r.rerender(<V2ChildHome />);
    expect(mockVideo!.clip).toMatchObject({ key: 'be-fall-asleep', loop: false });
    await ended('sleep');
    expect(mockVideo!.clip).toMatchObject({ key: 'be-sleep', loop: true });
    // nouvel affichage le même jour : la boucle seule
    await r.unmount();
    await render(<V2ChildHome />);
    expect(mockVideo!.clip).toMatchObject({ key: 'be-sleep', loop: true });
  });

  it('7. vidéo indisponible : repos (réaction) ou endormi (transition du coucher), jamais d’écran noir', async () => {
    const r = await render(<V2ChildHome />);
    await check('Đánh răng');
    await act(async () => mockVideo!.onFailed!('happy'));
    expect(anim()).toBe('idle');
    // transition impossible : directement endormi (boucle, aperçu endormi dessous)
    mockTasks = mockTasks.map((x) => ({ ...x, completed_at: '2026-11-02T02:00:00Z' }));
    await r.rerender(<V2ChildHome />);
    expect(mockVideo!.clip).toMatchObject({ key: 'be-fall-asleep' });
    await act(async () => mockVideo!.onFailed!('sleep'));
    expect(anim()).toBe('asleep');
    expect(screen.getByTestId('v2-home-video-poster-still', H)).toBeTruthy();
  });

  it('8. même tâche cochée deux fois (décochée puis recochée, ou rejouée) : une seule animation', async () => {
    const r = await render(<V2ChildHome />);
    await check('Đánh răng');
    expect(anim()).toBe('happy');
    await ended('happy');
    mockTasks = [task({ completed_at: '2026-11-02T01:00:00Z' }), task({ id: 't2', title: 'Làm toán' })];
    await r.rerender(<V2ChildHome />);
    await check('Đánh răng'); // décoche : rien
    expect(anim()).toBe('idle');
    mockTasks = [task({}), task({ id: 't2', title: 'Làm toán' })];
    await r.rerender(<V2ChildHome />);
    await check('Đánh răng'); // recoche le même jour : rien
    expect(anim()).toBe('idle');
    expect(mockToggle).toHaveBeenCalledTimes(3); // les coches, elles, passent toujours
  });

  it('moins d’animations : aucune vidéo, images fixes (repos, puis endormi le soir)', async () => {
    // déjà une fonction simulée par le preset (`spyOn` la réutilise) : remise à « non » à la fin, pour ne rien laisser aux tests suivants
    const spy = jest.spyOn(jest.requireActual('react-native').AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    try {
      mockTasks = [task({ completed_at: '2026-11-02T01:00:00Z' })];
      await render(<V2ChildHome />);
      await act(async () => undefined);
      expect(screen.getByTestId('v2-home-video-poster-still', H)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Chạm vào Bambou' })).toBeNull();
    } finally {
      spy.mockResolvedValue(false);
    }
  });

  it('stade 3 : comportement d’avant (aucune réaction vidéo, pas de zone tactile, fondu vers le décor pendant « content »)', async () => {
    mockCompanion = { ...be, stage: 3 };
    await render(<V2ChildHome />);
    expect(screen.queryByRole('button', { name: 'Chạm vào Bambou' })).toBeNull();
    await check('Đánh răng');
    expect(mockVideo!.clip).toBeNull();
    expect(mockVideo!.visible).toBe(false);
  });
});
