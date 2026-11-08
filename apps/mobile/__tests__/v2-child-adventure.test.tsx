import { act, fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import type { AdventureState } from '@/domain/adventure';
import { useTripStore } from '@/store/trip';
import V2ChildAdventure from '../app/(v2)/v2/child/adventure';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: mockNavigate }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
let mockAdventure: AdventureState | undefined;
type Callbacks = { onSuccess?: () => void; onError?: (e: unknown) => void };
let mockLast: { vars: unknown; cb: Callbacks } | null = null;
const mockStart = jest.fn((vars: unknown, cb: Callbacks) => {
  mockLast = { vars, cb };
});
let mockPending = false;
let mockReduce = false;
jest.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => mockReduce }));
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: { member: { role: 'child', child_id: 'c1' }, children: [{ id: 'c1', name: 'Minh' }] } }) }));
jest.mock('@/hooks/useCompanion', () => ({ useCompanion: () => ({ data: { hasCompanion: true, name: 'Bambou', stage: 2, variant: 'boy' } }) }));
jest.mock('@/hooks/useAdventure', () => ({
  useAdventure: () => ({ data: mockAdventure }),
  useAdventurePending: () => mockPending,
  useStartAdventure: () => ({ mutate: mockStart, isPending: false }),
  startVars: (childId: string, destination: string) => ({ childId, adventureId: 'fixed', destination }),
}));
const mockConfirm = jest.fn();
jest.mock('@/components/confirm', () => ({ confirmDialog: (o: unknown) => mockConfirm(o) }));

const HL = ['ha-long-coquillage', 'ha-long-perle', 'ha-long-jonque', 'ha-long-etoile-de-mer', 'ha-long-rocher', 'ha-long-flotteur'];
const DEST = [
  { slug: 'ha-long', minLevel: 1, discoveries: HL }, { slug: 'hoi-an', minLevel: 2, discoveries: [] }, { slug: 'mekong', minLevel: 3, discoveries: [] },
  { slug: 'da-lat', minLevel: 4, discoveries: [] }, { slug: 'sa-pa', minLevel: 5, discoveries: [] }, { slug: 'phong-nha', minLevel: 6, discoveries: ['phong-nha-lampe'] },
];
const adv = (over: Partial<AdventureState> = {}): AdventureState => ({
  gauge: 60, cost: 60, state: 'ready_to_go', level: 1, today: '2026-11-02', active: null, last: null, unlocked: ['ha-long'], destinations: DEST,
  found: [{ slug: 'ha-long-perle', timesFound: 1 }], foundCount: 2, totalCount: 30, ...over,
});

async function layout() {
  await fireEvent(screen.getByTestId('v2-map'), 'layout', { nativeEvent: { layout: { width: 300, height: 400 } } });
}

describe('V2 : carte des aventures (D-106, D-107)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdventure = adv();
    mockLast = null;
    mockPending = false;
    mockReduce = false;
    useTripStore.setState({ departure: null });
  });

  it('6 repères placés selon map-spots.json, et la maison du panda au point « home »', async () => {
    await render(<V2ChildAdventure />);
    await layout();
    for (const d of DEST) expect(screen.getByTestId(`v2-spot-${d.slug}`)).toBeTruthy();
    expect(screen.getByTestId('v2-spot-ha-long')).toHaveStyle({ left: 0.651 * 300 - 26, top: 0.162 * 400 - 26 });
    expect(screen.getByLabelText('Nhà của Bambou')).toHaveStyle({ left: 0.22 * 300 - 30, top: 0.42 * 400 - 30 });
    expect(screen.getByText('Mở ở cấp 6')).toBeTruthy();
    expect(screen.queryAllByTestId('v2-trip-dot')).toHaveLength(0); // aucun trajet avant le départ
  });

  it('destination débloquée : carte postale (image, nom, invitation du stade, trouvailles 1/6 dont les silhouettes), « Lên đường! » et « Để sau »', async () => {
    await render(<V2ChildAdventure />);
    await layout();
    await fireEvent.press(screen.getByRole('button', { name: 'Vịnh Hạ Long' }));
    expect(screen.getByTestId('v2-postcard-ha-long')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Vịnh Hạ Long' })).toBeTruthy();
    expect(screen.getByText('Cậu muốn đi thuyền ở Vịnh Hạ Long với tớ không?')).toBeTruthy();
    expect(screen.getByText('1/6')).toBeTruthy();
    expect(screen.getByTestId('v2-find-ha-long-perle')).toBeTruthy();
    expect(screen.getByText('ngọc trai')).toBeTruthy();
    expect(screen.getByTestId('v2-find-ha-long-coquillage-unknown').props.accessibilityLabel).toBe('Chưa tìm thấy');
    expect(screen.queryByText('vỏ sò')).toBeNull(); // nom caché
    expect(screen.getByRole('button', { name: 'Lên đường!' }).props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(screen.getByRole('button', { name: 'Để sau' }));
    expect(screen.queryByTestId('v2-postcard-ha-long')).toBeNull();
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled(); // jamais de fenêtre système
  });

  it('jauge insuffisante : « Lên đường! » inactif, « Còn {n} ⚡ nữa là đi được! »', async () => {
    mockAdventure = adv({ gauge: 20, state: 'filling' });
    await render(<V2ChildAdventure />);
    await layout();
    await fireEvent.press(screen.getByRole('button', { name: 'Vịnh Hạ Long' }));
    expect(screen.getByText('Còn 40 ⚡ nữa là đi được!')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lên đường!' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('destination verrouillée : même feuille, image atténuée, « Mở ở cấp {n} » et niveau actuel, sans départ', async () => {
    await render(<V2ChildAdventure />);
    await layout();
    await fireEvent.press(screen.getByRole('button', { name: 'Phong Nha, mở ở cấp 6' }));
    expect(screen.getByTestId('v2-postcard-phong-nha')).toBeTruthy();
    expect(screen.getByTestId('v2-postcard-image')).toHaveStyle({ opacity: 0.4 });
    expect(screen.getAllByText('Mở ở cấp 6').length).toBeGreaterThan(0);
    expect(screen.getByText('Cấp hiện tại: 1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lên đường!' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Để sau' })).toBeTruthy();
  });

  it('« Lên đường! » : adventure_start (id fixé, refus affiché dans la feuille) ; accepté → le trajet se trace ; un toucher passe à Hôm nay', async () => {
    await render(<V2ChildAdventure />);
    await layout();
    await fireEvent.press(screen.getByRole('button', { name: 'Vịnh Hạ Long' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lên đường!' }));
    expect(mockStart).toHaveBeenCalledWith({ childId: 'c1', adventureId: 'fixed', destination: 'ha-long', quiet: true }, expect.anything());
    expect(mockNavigate).not.toHaveBeenCalled(); // pas avant la réponse du serveur
    await act(async () => mockLast!.cb.onSuccess!());
    expect(screen.queryByTestId('v2-postcard-ha-long')).toBeNull();
    expect(screen.getAllByTestId('v2-trip-dot').length).toBeGreaterThan(10);
    expect(screen.getByTestId('v2-trip-head')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Bỏ qua' }));
    expect(mockNavigate).toHaveBeenCalledWith('/v2/child/home');
    expect(useTripStore.getState().departure).toBeNull(); // séquence passée : directement la maison vide
  });

  it('départ refusé par le serveur : message doux dans la feuille, aucune séquence', async () => {
    await render(<V2ChildAdventure />);
    await layout();
    await fireEvent.press(screen.getByRole('button', { name: 'Vịnh Hạ Long' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lên đường!' }));
    await act(async () => mockLast!.cb.onError!({ message: 'gauge_not_full' }));
    expect(screen.getByText('Panda cần thêm chút năng lượng nữa nhé.')).toBeTruthy();
    expect(screen.getByTestId('v2-postcard-ha-long')).toBeTruthy();
    expect(screen.queryAllByTestId('v2-trip-dot')).toHaveLength(0);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('« réduire les animations » : départ accepté → directement Hôm nay (état final)', async () => {
    mockReduce = true;
    await render(<V2ChildAdventure />);
    await layout();
    await fireEvent.press(screen.getByRole('button', { name: 'Vịnh Hạ Long' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lên đường!' }));
    await act(async () => mockLast!.cb.onSuccess!());
    expect(mockNavigate).toHaveBeenCalledWith('/v2/child/home');
    expect(screen.queryAllByTestId('v2-trip-dot')).toHaveLength(0);
  });

  it('en voyage : trajet maison → clairière dessiné, tête du panda sur la clairière ; « Lên đường! » inactif ; carnet', async () => {
    mockAdventure = adv({ state: 'away', gauge: 0, active: { id: 'a', destination: 'ha-long', departedOn: '2026-11-02', returnsOn: '2026-11-03' } });
    await render(<V2ChildAdventure />);
    await layout();
    expect(screen.getAllByTestId('v2-trip-dot').length).toBeGreaterThan(10);
    expect(screen.getByTestId('v2-trip-head')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Bambou đang ở Vịnh Hạ Long' }));
    expect(screen.getByText('Bambou đang đi xa rồi, chuyến sau nhé!')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lên đường!' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Để sau' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sổ phiêu lưu · 2/30' }));
    expect(mockPush).toHaveBeenCalledWith('/adventure/journal');
  });
});
