import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createTestQueryClient } from '../test-utils/queryClient';
import '@/i18n';
import { SetupCard } from '@/components/onboarding/SetupCard';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
let mockRole: 'parent' | 'child' = 'parent';
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: { member: { role: mockRole, id: 'm1' }, family: { id: 'f1' }, children: [] } }) }));
const mockFetch = jest.fn();
const mockHide = jest.fn();
jest.mock('@/api/onboarding', () => ({ fetchOnboarding: async () => jest.requireActual('@/domain/onboarding').parseOnboarding(await mockFetch()), hideSetupCard: (h: boolean) => mockHide(h), setOnboardingStep: jest.fn(), restartOnboarding: jest.fn() }));
const mockDevice = jest.fn();
jest.mock('@/services/webPush', () => ({ thisDeviceRegistered: () => mockDevice() }));

const kid = (over: Record<string, unknown> = {}) => ({ id: 'c1', name: 'Minh', country: 'VN', grade: '7', subjects: ['maths'], available: ['maths'], ...over });
const server = (over: Record<string, unknown> = {}) => ({
  is_owner: true, language_confirmed: true, skipped: [], card_hidden: false, children: [kid()], tasks: 1, rewards: 1, parents: 2, invite_active: false, ...over,
});
// raw (snake_case) → ce que renvoie la RPC
const rpc = (s: ReturnType<typeof server>) => s;

const clients: QueryClient[] = [];
async function show(role: 'parent' | 'child' = 'parent') {
  mockRole = role;
  const client = createTestQueryClient();
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <SetupCard role={role} />
    </QueryClientProvider>,
  );
}
afterEach(() => { clients.splice(0).forEach((c) => c.clear()); jest.clearAllMocks(); mockRole = 'parent'; });
beforeEach(() => { mockDevice.mockResolvedValue(true); mockHide.mockResolvedValue(undefined); });

describe('Carte « Hoàn tất cài đặt » (D-090)', () => {
  it('famille neuve : 0/6, six lignes, prochaine étape = langue ; le bouton ouvre CETTE étape', async () => {
    mockDevice.mockResolvedValue(false);
    mockFetch.mockResolvedValue(rpc(server({ language_confirmed: false, children: [], tasks: 0, rewards: 0, parents: 1 })));
    await show();
    expect(await screen.findByText('Hoàn tất cài đặt')).toBeTruthy();
    expect(screen.getByText('0/6')).toBeTruthy();
    for (const name of ['Ngôn ngữ và gia đình', 'Thêm con', 'Môn ôn tập', 'Thông báo', 'Việc và phần thưởng', 'Phụ huynh thứ hai']) expect(screen.getByText(name)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục: Ngôn ngữ và gia đình' }));
    expect(mockPush).toHaveBeenCalledWith('/onboarding/setup/language');
  });

  it('étapes faites : cochées, compteur, prochaine = la première non faite ; la barre de progression est lisible', async () => {
    mockDevice.mockResolvedValue(false);
    mockFetch.mockResolvedValue(rpc(server({ tasks: 0, rewards: 0, parents: 1 })));
    await show();
    expect(await screen.findByText('3/6')).toBeTruthy(); // langue, enfant, matières
    expect(screen.getByRole('progressbar', { name: '3 trên 6 bước đã xong' })).toBeTruthy();
    expect(screen.getByLabelText('Ngôn ngữ và gia đình, đã xong')).toBeTruthy();
    expect(screen.getByLabelText('Thông báo, chưa làm')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục: Thông báo' }));
    expect(mockPush).toHaveBeenCalledWith('/onboarding/setup/notifications');
  });

  it('une étape passée reste « à faire » : elle ne compte pas ; la prochaine ignore les passées', async () => {
    mockDevice.mockResolvedValue(false);
    mockFetch.mockResolvedValue(rpc(server({ skipped: ['notifications'], tasks: 0, rewards: 0, parents: 1 })));
    await show();
    expect(await screen.findByText('3/6')).toBeTruthy();
    expect(screen.getByLabelText('Thông báo, đã bỏ qua')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tiếp tục: Việc và phần thưởng' })).toBeTruthy();
  });

  it('CET appareil enregistré : l’étape notifications est faite', async () => {
    mockFetch.mockResolvedValue(rpc(server({ tasks: 0, rewards: 0, parents: 1 })));
    await show();
    expect(await screen.findByText('4/6')).toBeTruthy();
  });

  it('famille existante COMPLÈTE : aucune carte', async () => {
    mockFetch.mockResolvedValue(rpc(server()));
    await show();
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    await waitFor(() => expect(mockDevice).toHaveBeenCalled());
    // jamais de clignotement : la carte n'apparaît pas même un instant pendant la lecture
    for (let i = 0; i < 5; i += 1) {
      await new Promise((r) => setTimeout(r, 0));
      expect(screen.queryByText('Hoàn tất cài đặt')).toBeNull();
    }
  });

  it('carte masquée : rien ; « Ẩn » la masque côté serveur', async () => {
    mockDevice.mockResolvedValue(false);
    mockFetch.mockResolvedValue(rpc(server({ card_hidden: true, tasks: 0 })));
    await show();
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(screen.queryByText('Hoàn tất cài đặt')).toBeNull();
  });

  it('« Ẩn » appelle la RPC de masquage', async () => {
    mockDevice.mockResolvedValue(false);
    mockFetch.mockResolvedValue(rpc(server({ tasks: 0 })));
    await show();
    await fireEvent.press(await screen.findByRole('button', { name: 'Ẩn' }));
    await waitFor(() => expect(mockHide).toHaveBeenCalledWith(true));
  });

  it('parent INVITÉ : assistant court, compteur n/2', async () => {
    mockDevice.mockResolvedValue(false);
    mockFetch.mockResolvedValue(rpc(server({ is_owner: false, language_confirmed: true })));
    await show();
    expect(await screen.findByText('1/2')).toBeTruthy();
    expect(screen.queryByText('Thêm con')).toBeNull();
    expect(screen.getByRole('button', { name: 'Tiếp tục: Thông báo' })).toBeTruthy();
  });

  it('un enfant ne voit jamais la carte et ne lit rien', async () => {
    await show('child');
    expect(screen.queryByText('Hoàn tất cài đặt')).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('la carte ne cite aucun enfant (ni comparaison ni classement)', async () => {
    mockDevice.mockResolvedValue(false);
    mockFetch.mockResolvedValue(rpc(server({ children: [kid({ name: 'Minh' }), kid({ id: 'c2', name: 'Khang', subjects: [] })], tasks: 0 })));
    await show();
    await screen.findByText('Hoàn tất cài đặt');
    expect(screen.queryByText(/Minh|Khang/)).toBeNull();
  });
});
