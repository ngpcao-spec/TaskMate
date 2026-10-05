import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import i18n from '@/i18n';
import ChildLoginScreen from '../app/onboarding/child-login';
import { createTestQueryClient } from '../test-utils/queryClient';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
const mockSignInChild = jest.fn().mockResolvedValue(undefined);
jest.mock('@/api/auth', () => {
  class MockAuthFlowError extends Error {
    kind: string;
    constructor(kind: string) {
      super(kind);
      this.kind = kind;
    }
  }
  return { AuthFlowError: MockAuthFlowError, signInChild: (...a: unknown[]) => mockSignInChild(...a) };
});

const client = createTestQueryClient();
afterAll(() => client.clear());
const renderScreen = () => render(<QueryClientProvider client={client}><ChildLoginScreen /></QueryClientProvider>);
const fill = async (email = 'parent@example.com', id = 'minh', pw = 'secret1') => {
  await fireEvent.changeText(screen.getByLabelText('E-mail d\'un parent de la famille'), email);
  await fireEvent.changeText(screen.getByLabelText('Identifiant'), id);
  await fireEvent.changeText(screen.getByLabelText('Mot de passe'), pw);
};

describe('ChildLoginScreen (e-mail d\'un parent + identifiant + mot de passe)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('fr');
  });

  it('trois champs, aucun code ni QR', async () => {
    await renderScreen();
    expect(screen.getByLabelText('E-mail d\'un parent de la famille')).toBeTruthy();
    expect(screen.getByLabelText('Identifiant')).toBeTruthy();
    expect(screen.getByLabelText('Mot de passe')).toBeTruthy();
    expect(screen.queryByText(/QR|code/i)).toBeNull();
  });

  it('bouton inactif tant que les trois champs ne sont pas remplis', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Identifiant'), 'minh');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'secret1');
    await fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
    expect(mockSignInChild).not.toHaveBeenCalled();
  });

  it('connecte l\'enfant avec les trois valeurs puis route vers l\'accueil', async () => {
    await renderScreen();
    await fill('Parent@Example.com', 'Minh.Test', 'secret1');
    await fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
    await waitFor(() => expect(mockSignInChild).toHaveBeenCalledWith('Parent@Example.com', 'Minh.Test', 'secret1'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('même message quel que soit le champ faux (pas d\'énumération d\'e-mails) ; verrouillage temporaire expliqué', async () => {
    const { AuthFlowError } = jest.requireMock('@/api/auth');
    await renderScreen();
    await fill();
    mockSignInChild.mockRejectedValueOnce(new AuthFlowError('invalidCredentials'));
    await fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
    const message = 'Connexion impossible : vérifie l\'e-mail du parent, ton identifiant et ton mot de passe.';
    expect(await screen.findByText(message)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    mockSignInChild.mockRejectedValueOnce(new AuthFlowError('tooManyAttempts'));
    await fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByText('Trop d\'essais. Réessaie dans quelques minutes.')).toBeTruthy();
  });
});
