import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import i18n from '@/i18n';
import ChildLoginScreen from '../app/onboarding/child-login';
import ParentAuthScreen from '../app/onboarding/parent-auth';
import { PasswordField } from '@/components/PasswordField';
import { SignedOutOnly } from '@/components/SignedOutOnly';
import { useSessionStore } from '@/store/session';

let mockFocused = true;
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }), useIsFocused: () => mockFocused }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@tanstack/react-query', () => ({ ...jest.requireActual('@tanstack/react-query'), useQueryClient: () => ({ clear: jest.fn() }) }));
jest.mock('@/api/auth', () => {
  class MockAuthFlowError extends Error {
    kind = 'unknown';
  }
  return { AuthFlowError: MockAuthFlowError, signInChild: jest.fn(), signInParent: jest.fn() };
});
jest.mock('@/api/googleAuth', () => ({ startGoogleSignIn: jest.fn() }));

const signedIn = { user: { id: 'u1', email: 'ba@example.com' } } as never;

beforeEach(async () => {
  mockFocused = true;
  useSessionStore.setState({ session: null });
  await i18n.changeLanguage('fr');
});

function Harness({ autoComplete }: { autoComplete: 'new-password' | 'current-password' }) {
  const [value, setValue] = useState('');
  return <PasswordField label="Mot de passe" value={value} onChangeText={setValue} autoComplete={autoComplete} />;
}

describe('PasswordField (D-093) : le seul champ mot de passe, seulement quand son écran est affiché', () => {
  it('affiché : secureTextEntry, autoComplete demandé, pas de majuscule ni de correction', async () => {
    await render(<Harness autoComplete="new-password" />);
    const field = screen.getByLabelText('Mot de passe');
    expect(field.props.secureTextEntry).toBe(true);
    expect(field.props.autoComplete).toBe('new-password');
    expect(field.props.autoCapitalize).toBe('none');
    expect(field.props.autoCorrect).toBe(false);
  });

  it('écran resté monté sous un autre (non affiché) : AUCUN champ dans l\'arbre ; la saisie survit au retour', async () => {
    const view = await render(<Harness autoComplete="current-password" />);
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'secret1');
    mockFocused = false;
    await view.rerender(<Harness autoComplete="current-password" />);
    expect(screen.queryByLabelText('Mot de passe')).toBeNull();
    mockFocused = true;
    await view.rerender(<Harness autoComplete="current-password" />);
    expect(screen.getByLabelText('Mot de passe').props.value).toBe('secret1');
  });
});

describe('SignedOutOnly (D-093) : un écran de connexion n\'existe que sans session', () => {
  it('sans session : le contenu ; connecté : rien (champs démontés même si l\'écran reste dans la pile)', async () => {
    const { Text } = jest.requireActual('react-native');
    await render(<SignedOutOnly><Text>formulaire</Text></SignedOutOnly>);
    expect(screen.getByText('formulaire')).toBeTruthy();
    await act(async () => useSessionStore.setState({ session: signedIn }));
    expect(screen.queryByText('formulaire')).toBeNull();
  });

  it('connexion parent : champs e-mail et mot de passe présents sans session, absents dès la connexion', async () => {
    await render(<ParentAuthScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'J\'ai déjà un compte avec e-mail et mot de passe' }));
    expect(screen.getByLabelText('Email').props.autoComplete).toBe('email');
    expect(screen.getByLabelText('Mot de passe').props.autoComplete).toBe('current-password');
    await act(async () => useSessionStore.setState({ session: signedIn }));
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(screen.queryByLabelText('Mot de passe')).toBeNull();
  });

  it('connexion enfant : aucun champ une fois connecté', async () => {
    await render(<ChildLoginScreen />);
    expect(screen.getByLabelText('Mot de passe')).toBeTruthy();
    await act(async () => useSessionStore.setState({ session: signedIn }));
    expect(screen.queryByLabelText('Mot de passe')).toBeNull();
    expect(screen.queryByLabelText('Identifiant')).toBeNull();
    expect(screen.queryByLabelText('E-mail d\'un parent de la famille')).toBeNull();
  });
});
