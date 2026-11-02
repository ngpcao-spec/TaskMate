import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import type { AdventureState } from '@/domain/adventure';
import V2ChildAdventure from '../app/(v2)/v2/child/adventure';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: mockNavigate }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
let mockAdventure: AdventureState | undefined;
const mockStart = jest.fn();
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: { member: { role: 'child', child_id: 'c1' } } }) }));
jest.mock('@/hooks/useCompanion', () => ({ useCompanion: () => ({ data: { hasCompanion: true, name: 'Bambou', stage: 2, variant: 'boy' } }) }));
jest.mock('@/hooks/useAdventure', () => ({
  useAdventure: () => ({ data: mockAdventure }),
  useAdventurePending: () => false,
  useStartAdventure: () => ({ mutate: mockStart }),
  startVars: (childId: string, destination: string) => ({ childId, adventureId: 'fixed', destination }),
}));
const mockConfirm = jest.fn((o: { onConfirm: () => void }) => o.onConfirm());
jest.mock('@/components/confirm', () => ({ confirmDialog: (o: { onConfirm: () => void }) => mockConfirm(o) }));
const mockToast = jest.fn();
jest.mock('@/store/toast', () => ({ useToastStore: (sel: (s: { show: typeof mockToast }) => unknown) => sel({ show: mockToast }) }));

const DEST = [
  { slug: 'ha-long', minLevel: 1, discoveries: [] }, { slug: 'hoi-an', minLevel: 2, discoveries: [] }, { slug: 'mekong', minLevel: 3, discoveries: [] },
  { slug: 'da-lat', minLevel: 4, discoveries: [] }, { slug: 'sa-pa', minLevel: 5, discoveries: [] }, { slug: 'phong-nha', minLevel: 6, discoveries: [] },
];
const adv = (over: Partial<AdventureState> = {}): AdventureState => ({ gauge: 60, cost: 60, state: 'ready_to_go', level: 1, today: '2026-11-02', active: null, last: null, unlocked: ['ha-long'], destinations: DEST, found: [], foundCount: 2, totalCount: 30, ...over });

async function layout() {
  await fireEvent(screen.getByTestId('v2-map'), 'layout', { nativeEvent: { layout: { width: 300, height: 400 } } });
}

describe('V2 : carte des aventures (D-106)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdventure = adv();
  });
  it('6 repères placés selon map-spots.json ; verrouillés : cadenas et « Mở ở cấp n »', async () => {
    await render(<V2ChildAdventure />);
    await layout();
    for (const d of DEST) expect(screen.getByTestId(`v2-spot-${d.slug}`)).toBeTruthy();
    expect(screen.getByTestId('v2-spot-ha-long')).toHaveStyle({ left: 0.651 * 300 - 26, top: 0.162 * 400 - 26 });
    expect(screen.getByRole('button', { name: 'Phong Nha, mở ở cấp 6' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText('Mở ở cấp 6')).toBeTruthy();
  });
  it('jauge pleine : appui sur une destination débloquée → confirmation → adventure_start (id fixé) → Hôm nay', async () => {
    await render(<V2ChildAdventure />);
    await layout();
    await fireEvent.press(screen.getByRole('button', { name: 'Vịnh Hạ Long' }));
    expect(mockStart).toHaveBeenCalledWith({ childId: 'c1', adventureId: 'fixed', destination: 'ha-long' });
    expect(mockNavigate).toHaveBeenCalledWith('/v2/child/home');
  });
  it('jauge incomplète : message doux, aucun départ', async () => {
    mockAdventure = adv({ gauge: 20, state: 'filling' });
    await render(<V2ChildAdventure />);
    await layout();
    await fireEvent.press(screen.getByRole('button', { name: 'Vịnh Hạ Long' }));
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalled();
  });
  it('en voyage : le petit panda sur la clairière de la destination ; carnet', async () => {
    mockAdventure = adv({ state: 'away', gauge: 0, active: { id: 'a', destination: 'ha-long', departedOn: '2026-11-02', returnsOn: '2026-11-03' } });
    await render(<V2ChildAdventure />);
    await layout();
    expect(screen.getByRole('button', { name: 'Bambou đang ở Vịnh Hạ Long' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Sổ phiêu lưu · 2/30' }));
    expect(mockPush).toHaveBeenCalledWith('/adventure/journal');
  });
});
