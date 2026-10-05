import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import i18n from '@/i18n';
import ParentAuthScreen from '../app/onboarding/parent-auth';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
const mockSignIn = jest.fn().mockResolvedValue(undefined);
const mockGoogle = jest.fn().mockResolvedValue(undefined);
jest.mock('@/api/auth', () => {
  class MockAuthFlowError extends Error {
    kind: string;
    constructor(kind: string) {
      super(kind);
      this.kind = kind;
    }
  }
  return { AuthFlowError: MockAuthFlowError, signInParent: (...a: unknown[]) => mockSignIn(...a) };
});
jest.mock('@/api/googleAuth', () => ({ startGoogleSignIn: () => mockGoogle() }));

describe('ParentAuthScreen (Google d\'abord)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('fr');
  });

  it('bouton principal « Continuer avec Google » ; aucune inscription par e-mail ni OTP', async () => {
    await render(<ParentAuthScreen />);
    expect(screen.getByRole('button', { name: 'Continuer avec Google' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Créer un compte' })).toBeNull();
    expect(screen.queryByText(/code/i)).toBeNull();
    expect(screen.queryByLabelText('Email')).toBeNull(); // formulaire e-mail replié par défaut
  });

  it('« Continuer avec Google » lance la connexion Google', async () => {
    await render(<ParentAuthScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer avec Google' }));
    await waitFor(() => expect(mockGoogle).toHaveBeenCalledTimes(1));
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('Google indisponible (natif) : message clair', async () => {
    const { AuthFlowError } = jest.requireMock('@/api/auth');
    mockGoogle.mockRejectedValueOnce(new AuthFlowError('googleUnavailable'));
    await render(<ParentAuthScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer avec Google' }));
    expect(await screen.findByText('La connexion Google est disponible sur la version web de TaskMate.')).toBeTruthy();
  });

  it('parents existants : connexion e-mail + mot de passe, seulement connexion (pas d\'inscription)', async () => {
    await render(<ParentAuthScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'J\'ai déjà un compte avec e-mail et mot de passe' }));
    expect(screen.queryByRole('button', { name: 'Créer un compte' })).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ba@example.com');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('ba@example.com', 'motdepasse1'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('email invalide : message, aucun appel ; identifiants refusés : message adapté', async () => {
    const { AuthFlowError } = jest.requireMock('@/api/auth');
    await render(<ParentAuthScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'J\'ai déjà un compte avec e-mail et mot de passe' }));
    await fireEvent.changeText(screen.getByLabelText('Email'), 'pas-un-email');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'x');
    await fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
    expect(screen.getByText('Email invalide')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
    mockSignIn.mockRejectedValueOnce(new AuthFlowError('invalidCredentials'));
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ba@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByText('Email ou mot de passe incorrect.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
