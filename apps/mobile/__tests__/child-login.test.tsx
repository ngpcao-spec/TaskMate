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

describe('ChildLoginScreen (identifiant + mot de passe)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('fr');
  });

  it('ne demande ni email, ni code, ni QR', async () => {
    await renderScreen();
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(screen.queryByText(/QR|code/i)).toBeNull();
  });

  it('bouton inactif tant que les deux champs ne sont pas remplis', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Identifiant'), 'minh.test');
    await fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
    expect(mockSignInChild).not.toHaveBeenCalled();
  });

  it('connecte l’enfant puis route vers l’accueil', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Identifiant'), 'Minh.Test');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'secret1');
    await fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
    await waitFor(() => expect(mockSignInChild).toHaveBeenCalledWith('Minh.Test', 'secret1'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('identifiant ou mot de passe incorrect : message, pas de navigation', async () => {
    const { AuthFlowError } = jest.requireMock('@/api/auth');
    mockSignInChild.mockRejectedValueOnce(new AuthFlowError('invalidCredentials'));
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Identifiant'), 'minh.test');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'mauvais');
    await fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByText('Identifiant ou mot de passe incorrect.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
