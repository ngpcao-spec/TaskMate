import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import ChildrenAdminScreen from '../app/(tabs)/more/children';
import ProfileScreen from '../app/(tabs)/more/index';
import { createTestQueryClient } from '../test-utils/queryClient';

const mockPush = jest.fn();
const mockSelect = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));

const kids = [
  { id: 'c1', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5' },
  { id: 'c2', name: 'Khang', birth_date: '2013-05-01', color: '#2EC4A6' },
  { id: 'c3', name: 'Cam', birth_date: '2016-02-01', color: '#8B5CF6' },
];
let mockRole: 'parent' | 'child' = 'parent';
const mockMe = () => ({ member: { id: 'm1', role: mockRole, child_id: mockRole === 'child' ? 'c1' : null }, family: { id: 'f1', timezone: 'Asia/Ho_Chi_Minh' }, children: kids });
// même résolution que le vrai hook : un enfant ne reçoit QUE son profil, même si la liste fournie contient tous les enfants
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => {
    const { resolveDisplayedChild } = jest.requireActual('@/domain/displayed-child');
    const r = resolveDisplayedChild({ role: mockRole, memberChildId: mockRole === 'child' ? 'c1' : null, children: kids, selectedId: null });
    return { me: mockMe(), viewer: { role: mockRole, memberId: 'm1', childId: mockRole === 'child' ? 'c1' : null }, children: r.children, child: r.child, select: mockSelect };
  },
}));
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: mockMe() }) }));
jest.mock('@/hooks/useFamilyAdmin', () => ({
  useUpdateChild: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteChild: () => ({ mutate: jest.fn(), isPending: false }),
  useChildAccounts: () => ({ data: [{ child_id: 'c1', login_id: 'minh.test' }] }),
}));
jest.mock('@/api/childAccounts', () => ({
  ChildAccountError: class extends Error {},
  createChildAccount: jest.fn(),
  resetChildPassword: jest.fn(),
  deleteChildAccount: jest.fn(),
}));

const client = createTestQueryClient();
afterAll(() => client.clear());
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);

describe('Hồ sơ : cartes enfants + « Ajouter un enfant »', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockRole = 'parent';
    await i18n.changeLanguage('fr');
  });

  it('parent : une carte sélectionnable par enfant (3 enfants) et la carte « Ajouter un enfant »', async () => {
    await wrap(<ProfileScreen />);
    for (const n of ['Minh', 'Khang', 'Cam']) expect(screen.getByRole('radio', { name: new RegExp(`^${n},`) })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: /^Cam,/ }));
    expect(mockSelect).toHaveBeenCalledWith('c3');
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter un enfant' }));
    expect(mockPush).toHaveBeenCalledWith('/more/add-child');
  });

  it('enfant (D-052) : voit uniquement SA carte, non sélectionnable, et jamais « Ajouter un enfant »', async () => {
    mockRole = 'child';
    await wrap(<ProfileScreen />);
    expect(screen.getByLabelText(/^Minh,/)).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull(); // aucune sélection possible
    expect(screen.queryByText('Khang')).toBeNull();
    expect(screen.queryByText('Cam')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ajouter un enfant' })).toBeNull();
  });
});

describe('Gérer les profils enfants', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockRole = 'parent';
    await i18n.changeLanguage('fr');
  });

  it('parent : « Ajouter un enfant », et par enfant : changer le mot de passe / supprimer le compte (si compte) ou créer le compte', async () => {
    await wrap(<ChildrenAdminScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter un enfant' }));
    expect(mockPush).toHaveBeenCalledWith('/more/add-child');
    expect(screen.getByRole('button', { name: 'Changer le mot de passe Minh' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Supprimer le compte Minh' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Créer le compte Khang' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Supprimer le profil Cam' })).toBeTruthy();
  });

  it('enfant : rien n\'est rendu', async () => {
    mockRole = 'child';
    await wrap(<ChildrenAdminScreen />);
    expect(screen.queryByRole('button', { name: 'Ajouter un enfant' })).toBeNull();
  });
});
