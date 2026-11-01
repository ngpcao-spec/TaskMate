import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { createTestQueryClient } from '../test-utils/queryClient';
import '@/i18n';
import { adventureKeys } from '@/api/keys';
import { AdventureJournal } from '@/components/adventure/AdventureJournal';
import { AdventurePanel } from '@/components/adventure/AdventurePanel';
import { AdventureReveal, REVEAL_DELAY_MS } from '@/components/adventure/AdventureReveal';
import { DestinationPicker } from '@/components/adventure/DestinationPicker';
import { ParentPandaCard } from '@/components/companion/ParentPandaCard';
import { parseAdventureState, type AdventureState } from '@/domain/adventure';
import { parseCompanionState } from '@/domain/panda';
import { registerMutationDefaults } from '@/sync/mutations';
import { useToastStore } from '@/store/toast';

const mockStart = jest.fn();
const mockCollect = jest.fn();
const mockFetchAdventure = jest.fn();
jest.mock('@/api/adventure', () => ({
  fetchAdventureState: (...a: unknown[]) => mockFetchAdventure(...a),
  startAdventure: (...a: unknown[]) => mockStart(...a),
  collectAdventure: (...a: unknown[]) => mockCollect(...a),
}));
const mockFetchCompanion = jest.fn();
jest.mock('@/api/companion', () => ({ fetchCompanionState: (...a: unknown[]) => mockFetchCompanion(...a), setupCompanion: jest.fn(), setCompanionStageOffset: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
let mockCounter = 0;
jest.mock('@/api/ids', () => ({ newId: jest.fn(() => `adv-${++mockCounter}`) }));
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace, canGoBack: () => true }) }));
let mockConfirmAnswer = true;
const mockConfirm = jest.fn();
jest.mock('@/components/confirm', () => ({
  confirmDialog: (o: { onConfirm: () => void; title: string }) => {
    mockConfirm(o.title);
    if (mockConfirmAnswer) o.onConfirm();
  },
}));

const CATALOG = [
  { slug: 'ha-long', min_level: 1, discoveries: ['ha-long-coquillage', 'ha-long-perle', 'ha-long-jonque'] },
  { slug: 'hoi-an', min_level: 2, discoveries: ['hoi-an-lanterne'] },
  { slug: 'phong-nha', min_level: 6, discoveries: ['phong-nha-cristal'] },
];
const adv = (over: Record<string, unknown> = {}): AdventureState =>
  parseAdventureState({ gauge: 30, cost: 30, state: 'ready_to_go', level: 2, today: '2026-11-02', destinations: CATALOG, found: [], found_count: 0, total_count: 30, ...over });

const clients: QueryClient[] = [];
const makeClient = () => {
  const client = createTestQueryClient({ defaultOptions: { queries: { retry: undefined } } });
  clients.push(client);
  registerMutationDefaults(client, { retryDelay: () => 0 });
  return client;
};
const withClient = (client: QueryClient, ui: ReactElement) => <QueryClientProvider client={client}>{ui}</QueryClientProvider>;

beforeEach(() => {
  jest.clearAllMocks();
  mockCounter = 0;
  mockConfirmAnswer = true;
  mockStart.mockReset().mockResolvedValue(undefined);
  mockCollect.mockReset();
  mockFetchAdventure.mockReset().mockResolvedValue(adv());
  mockFetchCompanion.mockResolvedValue(parseCompanionState({ has_companion: true, name: 'Bambou', stage: 2 }));
  useToastStore.setState({ toast: null });
  onlineManager.setOnline(true);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  clients.splice(0).forEach((c) => c.clear());
});
afterAll(() => onlineManager.setOnline(true));

describe('choix de la destination', () => {
  it('cartes postales du catalogue ; verrouillées grisées avec « Mở ở cấp n »', async () => {
    await render(withClient(makeClient(), <DestinationPicker childId="c1" pandaName="Bambou" adventure={adv()} />));
    expect(screen.getByRole('button', { name: 'Vịnh Hạ Long' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Phố cổ Hội An' })).toBeTruthy();
    const locked = screen.getByRole('button', { name: 'Phong Nha, mở ở cấp 6' });
    expect(locked.props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText('Mở ở cấp 6')).toBeTruthy();
    await fireEvent.press(locked);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('appui → confirmation → adventure_start par la file d’écritures (id fixé), puis retour', async () => {
    await render(withClient(makeClient(), <DestinationPicker childId="c1" pandaName="Bambou" adventure={adv()} />));
    await fireEvent.press(screen.getByRole('button', { name: 'Vịnh Hạ Long' }));
    expect(mockConfirm).toHaveBeenCalledWith('Đi Vịnh Hạ Long?');
    await waitFor(() => expect(mockStart).toHaveBeenCalledWith('c1', 'adv-1', 'ha-long'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('confirmation refusée : rien ne part', async () => {
    mockConfirmAnswer = false;
    await render(withClient(makeClient(), <DestinationPicker childId="c1" pandaName="Bambou" adventure={adv()} />));
    await fireEvent.press(screen.getByRole('button', { name: 'Vịnh Hạ Long' }));
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('jauge pas pleine : message doux, aucun départ', async () => {
    await render(withClient(makeClient(), <DestinationPicker childId="c1" pandaName="Bambou" adventure={adv({ gauge: 12, state: 'filling' })} />));
    await fireEvent.press(screen.getByRole('button', { name: 'Vịnh Hạ Long' }));
    expect(useToastStore.getState().toast).toMatchObject({ message: 'Panda cần đầy năng lượng phiêu lưu trước nhé.', tone: 'info' });
    expect(mockStart).not.toHaveBeenCalled();
  });
});

describe('écritures refusées par le serveur', () => {
  it('jauge pas pleine : message doux (jamais d’erreur technique)', async () => {
    mockStart.mockRejectedValue({ message: 'gauge_not_full', code: 'P0001' });
    await render(withClient(makeClient(), <DestinationPicker childId="c1" pandaName="Bambou" adventure={adv()} />));
    await fireEvent.press(screen.getByRole('button', { name: 'Vịnh Hạ Long' }));
    await waitFor(() => expect(useToastStore.getState().toast).toMatchObject({ message: 'Panda cần thêm chút năng lượng nữa nhé.', tone: 'info' }));
  });
  it('double appui (aventure déjà en cours) : abandonné sans message', async () => {
    mockStart.mockRejectedValue({ message: 'adventure_in_progress', code: 'P0001' });
    await render(withClient(makeClient(), <DestinationPicker childId="c1" pandaName="Bambou" adventure={adv()} />));
    await fireEvent.press(screen.getByRole('button', { name: 'Vịnh Hạ Long' }));
    await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(1));
    await act(async () => undefined);
    expect(useToastStore.getState().toast).toBeNull();
  });
});

describe('panneau d’aventure (hors ligne)', () => {
  it('un départ en attente de réseau affiche « Đang chờ kết nối… », sans bouton de départ', async () => {
    const client = makeClient();
    onlineManager.setOnline(false);
    await act(async () => {
      void client.getMutationCache().build(client, { mutationKey: ['startAdventure'] }).execute({ childId: 'c1', adventureId: 'x', destination: 'ha-long' });
    });
    await render(withClient(client, <AdventurePanel childId="c1" pandaName="Bambou" adventure={adv()} />));
    expect(screen.getByText('Đang chờ kết nối…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Đi phiêu lưu!' })).toBeNull();
    expect(mockStart).not.toHaveBeenCalled();
  });
});

describe('révélation', () => {
  it('« surpris », puis la trouvaille tirée par le serveur, sa réplique de récit, puis « fier »', async () => {
    jest.useFakeTimers();
    mockCollect.mockResolvedValue({ discoverySlug: 'ha-long-perle', duplicate: false, destination: 'ha-long' });
    mockFetchAdventure.mockResolvedValue(adv({ state: 'back', active: { id: 'a1', destination: 'ha-long', departed_on: '2026-11-01', returns_on: '2026-11-02' } }));
    await render(withClient(makeClient(), <AdventureReveal childId="c1" adventureId="a1" childName="Minh" pandaName="Bambou" stage={2} />));
    await waitFor(() => expect(mockCollect).toHaveBeenCalledWith('c1', 'a1'));
    expect(screen.getByLabelText('Panda Bambou, ngạc nhiên')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(REVEAL_DELAY_MS + 10);
    });
    expect(screen.getByLabelText('Panda Bambou, tự hào')).toBeTruthy();
    expect(screen.getByText('Bambou mang về: ngọc trai')).toBeTruthy();
    expect(screen.getByLabelText('ngọc trai')).toBeTruthy();
    expect(screen.getByText(/Hạ Long/)).toBeTruthy(); // réplique de récit de la destination (stade nhí)
  });

  it('doublon : « đã có trong sổ » et la réplique du doublon', async () => {
    jest.useFakeTimers();
    mockCollect.mockResolvedValue({ discoverySlug: 'ha-long-perle', duplicate: true, destination: 'ha-long' });
    mockFetchAdventure.mockResolvedValue(adv({ found: [{ slug: 'ha-long-perle', times_found: 2 }] }));
    await render(withClient(makeClient(), <AdventureReveal childId="c1" adventureId="a1" childName="Minh" pandaName="Bambou" stage={2} />));
    await waitFor(() => expect(mockCollect).toHaveBeenCalled());
    await act(async () => {
      jest.advanceTimersByTime(REVEAL_DELAY_MS + 10);
    });
    await waitFor(() => expect(screen.getByText('Đã có trong sổ (×2)')).toBeTruthy());
    expect(screen.getByText(/cậu có rồi|Lại là món này/)).toBeTruthy();
  });

  it('« réduire les animations » : trouvaille aussitôt, sans effet', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const spring = jest.spyOn(Animated, 'spring');
    mockCollect.mockResolvedValue({ discoverySlug: 'ha-long-perle', duplicate: false, destination: 'ha-long' });
    mockFetchAdventure.mockResolvedValue(adv());
    await render(withClient(makeClient(), <AdventureReveal childId="c1" adventureId="a1" childName="Minh" pandaName="Bambou" stage={3} />));
    await waitFor(() => expect(screen.getByText('Bambou mang về: ngọc trai')).toBeTruthy());
    expect(spring).not.toHaveBeenCalled();
  });

  it('hors ligne : « en attente », le serveur reste seul juge', async () => {
    onlineManager.setOnline(false);
    mockFetchAdventure.mockResolvedValue(adv());
    await render(withClient(makeClient(), <AdventureReveal childId="c1" adventureId="a1" childName="Minh" pandaName="Bambou" stage={2} />));
    await waitFor(() => expect(screen.getByText('Đang chờ kết nối…')).toBeTruthy());
    expect(mockCollect).not.toHaveBeenCalled();
  });

  it('rouvert après coup : la même trouvaille, lue dans l’état du serveur', async () => {
    mockCollect.mockRejectedValue({ message: 'Network request failed' });
    const client = makeClient();
    const withLast = adv({ last: { id: 'a1', destination: 'ha-long', discovery_slug: 'ha-long-jonque', duplicate: false } });
    mockFetchAdventure.mockResolvedValue(withLast);
    client.setQueryData(adventureKeys.state('c1'), withLast);
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(withClient(client, <AdventureReveal childId="c1" adventureId="a1" childName="Minh" pandaName="Bambou" stage={2} />));
    await waitFor(() => expect(screen.getByText('Bambou mang về: thuyền buồm')).toBeTruthy());
  });
});

describe('carnet « Sổ phiêu lưu »', () => {
  it('compteur, trouvailles en couleur (×N), silhouettes « ? » pour les autres', async () => {
    await render(<AdventureJournal adventure={adv({ found: [{ slug: 'ha-long-perle', times_found: 3 }, { slug: 'hoi-an-lanterne', times_found: 1 }], found_count: 2 })} />);
    expect(screen.getByText('2/30')).toBeTruthy();
    expect(screen.getByLabelText('Đã tìm được 2 trên 30 món')).toBeTruthy();
    expect(screen.getByLabelText('ngọc trai, tìm được 3 lần')).toBeTruthy();
    expect(screen.getByText('×3')).toBeTruthy();
    expect(screen.getByLabelText('đèn lồng, tìm được 1 lần')).toBeTruthy();
    expect(screen.queryByText('×1')).toBeNull();
    expect(screen.getAllByLabelText('Chưa tìm thấy')).toHaveLength(3); // coquillage, jonque, cristal
    for (const name of ['Vịnh Hạ Long', 'Phố cổ Hội An', 'Phong Nha']) expect(screen.getByText(name)).toBeTruthy();
    expect(screen.queryByText('vỏ sò')).toBeNull(); // nom caché tant que la trouvaille n'est pas obtenue
  });
  it('carnet vide : message d’encouragement', async () => {
    await render(<AdventureJournal adventure={adv()} />);
    expect(screen.getByText('0/30')).toBeTruthy();
    expect(screen.getByText('Chưa có món nào. Panda sẽ mang về sau mỗi chuyến đi!')).toBeTruthy();
  });
});

describe('fiche de l’enfant (parent)', () => {
  it('aventure en cours (destination, retour prévu) et lien vers SON carnet ; aucun bouton de départ', async () => {
    mockFetchAdventure.mockResolvedValue(adv({ state: 'away', active: { id: 'a1', destination: 'ha-long', departed_on: '2026-11-01', returns_on: '2026-11-02' } }));
    await render(withClient(makeClient(), <ParentPandaCard childId="c1" childName="Minh" />));
    await waitFor(() => expect(screen.getByText(/Đang phiêu lưu ở Vịnh Hạ Long, về ngày .*02\/11/)).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Đi phiêu lưu!' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Xem sổ phiêu lưu' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/adventure/journal', params: { child: 'c1' } });
  });
  it('rentré : en attente que l’enfant ouvre son sac ; sinon « aucune aventure »', async () => {
    mockFetchAdventure.mockResolvedValueOnce(adv({ state: 'back', active: { id: 'a1', destination: 'hoi-an', departed_on: '2026-11-01', returns_on: '2026-11-02' } }));
    const view = await render(withClient(makeClient(), <ParentPandaCard childId="c1" childName="Minh" />));
    await waitFor(() => expect(screen.getByText('Đã về từ Phố cổ Hội An, đang chờ con mở túi')).toBeTruthy());
    await view.unmount();
    mockFetchAdventure.mockResolvedValueOnce(adv({ state: 'filling', gauge: 3 }));
    await render(withClient(makeClient(), <ParentPandaCard childId="c2" childName="Minh" />));
    await waitFor(() => expect(screen.getByText('Không có chuyến phiêu lưu nào')).toBeTruthy());
  });
});
