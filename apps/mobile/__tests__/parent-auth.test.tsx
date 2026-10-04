import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import i18n from '@/i18n';
import ParentAuthScreen from '../app/onboarding/parent-auth';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
const mockSignUp = jest.fn().mockResolvedValue(undefined);
const mockSignIn = jest.fn().mockResolvedValue(undefined);
jest.mock('@/api/auth', () => {
  class MockAuthFlowError extends Error {
    kind: string;
    constructor(kind: string) {
      super(kind);
      this.kind = kind;
    }
  }
  return {
    AuthFlowError: MockAuthFlowError,
    signUpParent: (...a: unknown[]) => mockSignUp(...a),
    signInParent: (...a: unknown[]) => mockSignIn(...a),
  };
});

describe('ParentAuthScreen (e-mail + mot de passe, sans OTP)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('fr');
  });

  const fill = async (email: string, password: string) => {
    await fireEvent.changeText(screen.getByLabelText('Email'), email);
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), password);
  };

  it('ne propose ni code ni connexion sociale', async () => {
    await render(<ParentAuthScreen />);
    expect(screen.queryByText(/code/i)).toBeNull();
    expect(screen.queryByText(/Apple|Google/)).toBeNull();
  });

  it('refuse un email invalide sans appeler le serveur', async () => {
    await render(<ParentAuthScreen />);
    await fill('pas-un-email', 'motdepasse1');
    await fireEvent.press(screen.getByRole('button', { name: 'Créer un compte' }));
    expect(screen.getByText('Email invalide')).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('refuse un mot de passe de moins de 8 caractères', async () => {
    await render(<ParentAuthScreen />);
    await fill('ba@example.com', '1234567');
    expect(screen.getByText('Mot de passe : 8 caractères minimum.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('« Créer un compte » inscrit puis route vers l’accueil', async () => {
    await render(<ParentAuthScreen />);
    await fill('ba@example.com', 'motdepasse1');
    await fireEvent.press(screen.getByRole('button', { name: 'Créer un compte' }));
    await waitFor(() => expect(mockSignUp).toHaveBeenCalledWith('ba@example.com', 'motdepasse1'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('« Se connecter » connecte puis route vers l’accueil', async () => {
    await render(<ParentAuthScreen />);
    await fill('ba@example.com', 'motdepasse1');
    await fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('ba@example.com', 'motdepasse1'));
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('affiche le message adapté quand les identifiants sont refusés', async () => {
    const { AuthFlowError } = jest.requireMock('@/api/auth');
    mockSignIn.mockRejectedValueOnce(new AuthFlowError('invalidCredentials'));
    await render(<ParentAuthScreen />);
    await fill('ba@example.com', 'motdepasse1');
    await fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByText('Email ou mot de passe incorrect.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
