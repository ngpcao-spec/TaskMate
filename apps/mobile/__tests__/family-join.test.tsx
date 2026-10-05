import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import i18n from '@/i18n';
import FamilyScreen from '../app/onboarding/family';
import { createTestQueryClient } from '../test-utils/queryClient';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/store/session', () => ({
  useSessionStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { user_metadata: { full_name: 'Nguyễn Văn Ba' } } } }),
}));
const mockCreate = jest.fn();
const mockJoin = jest.fn();
jest.mock('@/api/family', () => {
  class MockFamilyActionError extends Error {
    failure: string;
    constructor(failure: string) {
      super(failure);
      this.failure = failure;
    }
  }
  return {
    FamilyActionError: MockFamilyActionError,
    createFamily: (...a: unknown[]) => mockCreate(...a),
    joinFamilyWithCode: (...a: unknown[]) => mockJoin(...a),
  };
});

const client = createTestQueryClient();
afterAll(() => client.clear());
const renderScreen = () => render(<QueryClientProvider client={client}><FamilyScreen /></QueryClientProvider>);

describe('FamilyScreen : créer ou rejoindre', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue('f1');
    mockJoin.mockResolvedValue(undefined);
    await i18n.changeLanguage('fr');
  });

  it('prénom suggéré par le compte Google ; création de famille', async () => {
    await renderScreen();
    expect(screen.getByLabelText('Votre prénom').props.value).toBe('Nguyễn');
    await fireEvent.changeText(screen.getByLabelText('Nom de la famille'), 'Famille Nguyễn');
    await fireEvent.press(screen.getByRole('button', { name: 'Créer la famille' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith('Famille Nguyễn', 'Nguyễn'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('« Rejoindre une famille » : code à 8 caractères (tiret/casse tolérés) puis jointure', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Rejoindre une famille' }));
    expect(screen.getByText(/Inviter un parent/)).toBeTruthy();
    const join = () => screen.getByRole('button', { name: 'Rejoindre la famille' });
    await fireEvent.changeText(screen.getByLabelText('Code d\'invitation'), 'abcd-23');
    await fireEvent.press(join());
    expect(mockJoin).not.toHaveBeenCalled(); // 6 caractères : incomplet
    await fireEvent.changeText(screen.getByLabelText('Code d\'invitation'), 'abcd-2345');
    await fireEvent.press(join());
    await waitFor(() => expect(mockJoin).toHaveBeenCalledWith('abcd-2345', 'Nguyễn'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it.each([
    ['invalidCode', 'Code invalide, expiré ou déjà utilisé.'],
    ['tooManyAttempts', 'Trop d\'essais. Réessayez dans 15 minutes.'],
    ['googleRequired', 'Connectez-vous avec Google pour créer ou rejoindre une famille.'],
  ])('jointure refusée (%s) : message dédié, pas de navigation', async (failure, message) => {
    const { FamilyActionError } = jest.requireMock('@/api/family');
    mockJoin.mockRejectedValueOnce(new FamilyActionError(failure));
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Rejoindre une famille' }));
    await fireEvent.changeText(screen.getByLabelText('Code d\'invitation'), 'ABCD2345');
    await fireEvent.press(screen.getByRole('button', { name: 'Rejoindre la famille' }));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
