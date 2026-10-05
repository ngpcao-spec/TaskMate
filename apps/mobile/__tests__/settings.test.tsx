import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { createTestQueryClient } from '../test-utils/queryClient';
import { Alert } from 'react-native';
import i18n from '@/i18n';
import DevicesScreen from '../app/(tabs)/more/devices';
import SettingsScreen from '../app/(tabs)/more/settings';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/sync/storage', () => ({ kvStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() } }));
const mockSignOut = jest.fn().mockResolvedValue(undefined);
jest.mock('@/api/auth', () => ({ signOut: () => mockSignOut() }));

let mockRole: 'parent' | 'child' = 'parent';
jest.mock('@/hooks/useMe', () => ({
  useMe: () => ({ data: { member: { id: 'm-p', role: mockRole }, family: { id: 'f1', timezone: 'Asia/Ho_Chi_Minh' }, children: [] } }),
}));
const mockRevoke = jest.fn();
const mockDeleteAccount = jest.fn();
let mockDevices: unknown[] = [];
jest.mock('@/hooks/useFamilyAdmin', () => ({
  useDevices: () => ({ data: mockDevices }),
  useRevokeDevice: () => ({ mutate: mockRevoke, isPending: false }),
  useChildAccounts: () => ({ data: [] }),
  useActiveParentInvite: () => ({ data: null }),
  useCreateParentInvite: () => ({ mutate: jest.fn(), isPending: false }),
  useRevokeParentInvite: () => ({ mutate: jest.fn(), isPending: false }),
  useParents: () => ({ data: [{ id: 'm-p', display_name: 'Ba' }, { id: 'm-p2', display_name: 'Mẹ' }] }),
  useLeaveFamily: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteAccount: () => ({ mutate: (...a: unknown[]) => mockDeleteAccount(...a), isPending: false }),
  useUpdateTimezone: () => ({ mutate: jest.fn(), isPending: false }),
}));

const client = createTestQueryClient();
const renderWithClient = (ui: ReactElement) => render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
afterAll(() => client.clear());

describe('SettingsScreen', () => {
  beforeEach(async () => { jest.clearAllMocks(); mockRole = 'parent'; await i18n.changeLanguage('vi'); });

  it('change la langue (vi → fr) immédiatement', async () => {
    await renderWithClient(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Français' }));
    await waitFor(() => expect(i18n.language).toBe('fr'));
    expect(screen.getByText('Réglages généraux')).toBeTruthy();
  });

  it('parent : enfants, appareils, invitation d\'un parent, parents, fuseau, suppression', async () => {
    await renderWithClient(<SettingsScreen />);
    expect(screen.getByRole('button', { name: 'Quản lý hồ sơ của các con' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thiết bị đã liên kết' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Xóa tài khoản và dữ liệu' })).toBeTruthy();
    // invitation d'un parent (code haché, 24 h) et liste des parents
    expect(screen.getByRole('button', { name: 'Tạo mã' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rời gia đình' })).toBeTruthy();
  });

  it('enfant : seulement langue et déconnexion (pas de gestion du foyer ni de suppression)', async () => {
    mockRole = 'child';
    await renderWithClient(<SettingsScreen />);
    expect(screen.queryByRole('button', { name: 'Thiết bị đã liên kết' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tạo mã' })).toBeNull(); // un enfant ne peut pas inviter
    expect(screen.queryByRole('button', { name: 'Rời gia đình' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xóa tài khoản và dữ liệu' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeTruthy();
  });

  it('suppression : demande confirmation, puis supprime et déconnecte', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => void buttons?.[1]?.onPress?.());
    mockDeleteAccount.mockImplementation((_v: unknown, opts: { onSuccess: () => void }) => opts.onSuccess());
    await renderWithClient(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Xóa tài khoản và dữ liệu' }));
    expect(alert).toHaveBeenCalled();
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('déconnexion', async () => {
    await renderWithClient(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng xuất' }));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });
});

describe('DevicesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole = 'parent';
    mockDevices = [
      { id: 'd1', member_id: 'm-p', platform: 'ios', last_seen_at: '2026-07-01T10:00:00Z', member: { display_name: 'Ba', role: 'parent' } },
      { id: 'd2', member_id: 'm-minh', platform: 'android', last_seen_at: '2026-07-01T11:00:00Z', member: { display_name: 'Minh', role: 'child' } },
    ];
  });

  it('liste les appareils ; ne propose pas de se révoquer soi-même', async () => {
    await render(<DevicesScreen />);
    expect(screen.getByText('Minh')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thu hồi Ba' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Thu hồi Minh' })).toBeTruthy();
  });

  it('révoque après confirmation', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => void buttons?.[1]?.onPress?.());
    await render(<DevicesScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Thu hồi Minh' }));
    expect(mockRevoke).toHaveBeenCalledWith('d2');
  });

  it('inaccessible à un enfant', async () => {
    mockRole = 'child';
    await render(<DevicesScreen />);
    expect(screen.queryByText('Thiết bị đã liên kết')).toBeNull();
  });
});
