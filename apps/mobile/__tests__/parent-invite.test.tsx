import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import i18n from '@/i18n';
import { ParentInviteCard } from '@/components/ParentInviteCard';
import { ParentsCard } from '@/components/ParentsCard';
import { createTestQueryClient } from '../test-utils/queryClient';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }) }));
const mockCopy = jest.fn().mockResolvedValue(true);
jest.mock('@/services/clipboard', () => ({ copyText: (...a: unknown[]) => mockCopy(...a) }));

const mockCreate = jest.fn();
const mockRevoke = jest.fn();
const mockLeave = jest.fn();
let mockActive: { id: string; expires_at: string } | null = null;
let mockParents: { id: string; display_name: string }[] = [];
jest.mock('@/hooks/useFamilyAdmin', () => ({
  useActiveParentInvite: () => ({ data: mockActive }),
  useCreateParentInvite: () => ({ mutate: (...a: unknown[]) => mockCreate(...a), isPending: false }),
  useRevokeParentInvite: () => ({ mutate: (...a: unknown[]) => mockRevoke(...a), isPending: false }),
  useParents: () => ({ data: mockParents }),
  useLeaveFamily: () => ({ mutate: (...a: unknown[]) => mockLeave(...a), isPending: false }),
}));

const client = createTestQueryClient();
afterAll(() => client.clear());
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);

describe('ParentInviteCard', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockActive = null;
    await i18n.changeLanguage('fr');
  });

  it('génère un code, l\'affiche UNE fois avec avertissement, et permet de le copier', async () => {
    mockCreate.mockImplementation((_v: unknown, o: { onSuccess: (c: string) => void }) => o.onSuccess('ABCD2345'));
    await wrap(<ParentInviteCard />);
    expect(screen.getByText('Aucune invitation active.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Générer un code' }));
    expect(await screen.findByText('ABCD-2345')).toBeTruthy();
    expect(screen.getByText(/il ne sera plus affiché/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Copier le code' }));
    await waitFor(() => expect(mockCopy).toHaveBeenCalledWith('ABCD2345'));
    expect(await screen.findByText('Code copié')).toBeTruthy();
  });

  it('invitation déjà active : le code n\'est pas relisible ; régénérer ou annuler', async () => {
    mockActive = { id: 'i1', expires_at: '2030-01-01T10:00:00Z' };
    await wrap(<ParentInviteCard />);
    expect(screen.getByText(/Son code n'est plus affichable/)).toBeTruthy();
    expect(screen.queryByText(/[A-Z2-9]{4}-[A-Z2-9]{4}/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Annuler l\'invitation' }));
    expect(mockRevoke).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Nouveau code (annule le précédent)' }));
    expect(mockCreate).toHaveBeenCalled();
  });
});

describe('ParentsCard', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('fr');
  });

  it('liste les parents ; un parent peut quitter la famille après confirmation', async () => {
    mockParents = [{ id: 'm1', display_name: 'Ba' }, { id: 'm2', display_name: 'Mẹ' }];
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => void buttons?.[1]?.onPress?.());
    mockLeave.mockImplementation((_v: unknown, o: { onSuccess: () => void }) => o.onSuccess());
    await wrap(<ParentsCard myMemberId="m1" />);
    expect(screen.getByText('Ba (vous)')).toBeTruthy();
    expect(screen.getByText('Mẹ')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Quitter la famille' }));
    await waitFor(() => expect(mockLeave).toHaveBeenCalled());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('dernier parent : pas de bouton « Quitter », il doit supprimer la famille', async () => {
    mockParents = [{ id: 'm1', display_name: 'Ba' }];
    await wrap(<ParentsCard myMemberId="m1" />);
    expect(screen.queryByRole('button', { name: 'Quitter la famille' })).toBeNull();
    expect(screen.getByText(/supprimez la famille/)).toBeTruthy();
  });
});
