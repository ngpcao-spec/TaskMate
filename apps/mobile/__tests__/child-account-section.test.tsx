import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import i18n from '@/i18n';
import { ChildAccountSection } from '@/components/ChildAccountSection';
import { useSessionStore } from '@/store/session';
import { useToastStore } from '@/store/toast';
import { createTestQueryClient } from '../test-utils/queryClient';

// hors navigation : l'écran est toujours « affiché » (D-093)
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
const mockCopy = jest.fn();
jest.mock('@/services/clipboard', () => ({ copyText: (...a: unknown[]) => mockCopy(...a) }));
const sessionOf = (email: string | undefined) => ({ user: { id: 'u1', email } }) as never;

const mockCreate = jest.fn();
const mockReset = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/api/childAccounts', () => {
  class MockChildAccountError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return {
    ChildAccountError: MockChildAccountError,
    createChildAccount: (...a: unknown[]) => mockCreate(...a),
    resetChildPassword: (...a: unknown[]) => mockReset(...a),
    deleteChildAccount: (...a: unknown[]) => mockDelete(...a),
  };
});
let mockAccounts: { child_id: string; login_id: string }[] = [];
jest.mock('@/hooks/useFamilyAdmin', () => ({ useChildAccounts: () => ({ data: mockAccounts }) }));

const client = createTestQueryClient();
afterAll(() => client.clear());
const renderSection = () => render(<QueryClientProvider client={client}><ChildAccountSection childId="c1" childName="Minh" /></QueryClientProvider>);

describe('ChildAccountSection', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockAccounts = [];
    mockCopy.mockResolvedValue(true);
    useSessionStore.setState({ session: sessionOf('ba@example.com') });
    mockCreate.mockResolvedValue(undefined);
    mockReset.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
    await i18n.changeLanguage('fr');
  });

  it('sans compte : crée avec identifiant + mot de passe (≥ 6)', async () => {
    await renderSection();
    const create = () => screen.getByRole('button', { name: 'Créer le compte Minh' });
    await fireEvent.changeText(screen.getByLabelText('Identifiant (lettres, chiffres, . _ -)'), 'minh.test');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe (6 caractères minimum)'), '12345');
    expect(screen.getByText('Mot de passe : 6 caractères minimum.')).toBeTruthy();
    await fireEvent.press(create());
    expect(mockCreate).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Mot de passe (6 caractères minimum)'), '123456');
    await fireEvent.press(create());
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith('c1', 'minh.test', '123456'));
  });

  it('identifiant invalide : message et pas d’appel', async () => {
    await renderSection();
    await fireEvent.changeText(screen.getByLabelText('Identifiant (lettres, chiffres, . _ -)'), 'a b');
    expect(screen.getByText('Lettres, chiffres, point, tiret et underscore uniquement')).toBeTruthy();
  });

  it('« identifiant déjà pris » est expliqué à l’utilisateur', async () => {
    const { ChildAccountError } = jest.requireMock('@/api/childAccounts');
    mockCreate.mockRejectedValueOnce(new ChildAccountError('identifier_taken'));
    await renderSection();
    await fireEvent.changeText(screen.getByLabelText('Identifiant (lettres, chiffres, . _ -)'), 'minh.test');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe (6 caractères minimum)'), '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Créer le compte Minh' }));
    expect(await screen.findByText('Cet identifiant est déjà pris. Choisissez-en un autre.')).toBeTruthy();
  });

  it('avec compte : affiche l’identifiant, change le mot de passe', async () => {
    mockAccounts = [{ child_id: 'c1', login_id: 'minh.test' }];
    await renderSection();
    expect(screen.getByText('Identifiant : minh.test')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Créer le compte Minh' })).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Nouveau mot de passe'), 'nouveau1');
    await fireEvent.press(screen.getByRole('button', { name: 'Changer le mot de passe Minh' }));
    await waitFor(() => expect(mockReset).toHaveBeenCalledWith('c1', 'nouveau1'));
  });

  it('avec compte : suppression après confirmation', async () => {
    mockAccounts = [{ child_id: 'c1', login_id: 'minh.test' }];
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => void buttons?.[1]?.onPress?.());
    await renderSection();
    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer le compte Minh' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('c1'));
  });

  describe('bloc « Connexion de l\'enfant » (D-082)', () => {
    beforeEach(() => { mockAccounts = [{ child_id: 'c1', login_id: 'tom' }]; });

    it('récapitule les 3 éléments : e-mail du parent connecté, identifiant, « le mot de passe que vous avez défini »', async () => {
      await renderSection();
      expect(screen.getByRole('header', { name: 'Connexion de Minh' })).toBeTruthy();
      expect(screen.getByText('1. E-mail du parent connecté')).toBeTruthy();
      expect(screen.getByText('ba@example.com')).toBeTruthy();
      expect(screen.getByText('2. Identifiant de l’enfant')).toBeTruthy();
      expect(screen.getByText('tom')).toBeTruthy();
      expect(screen.getByText('3. Mot de passe')).toBeTruthy();
      expect(screen.getByText('Le mot de passe que vous avez défini')).toBeTruthy();
    });

    it('« Copier » l\'e-mail et l\'identifiant (cibles ≥ 44 pt, libellés d\'accessibilité) ; JAMAIS de mot de passe copiable', async () => {
      await renderSection();
      await fireEvent.press(screen.getByRole('button', { name: 'Copier l’e-mail du parent' }));
      await waitFor(() => expect(mockCopy).toHaveBeenCalledWith('ba@example.com'));
      await waitFor(() => expect(useToastStore.getState().toast).toMatchObject({ message: 'Copié', tone: 'info' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Copier l’identifiant de Minh' }));
      await waitFor(() => expect(mockCopy).toHaveBeenLastCalledWith('tom'));
      expect(mockCopy).toHaveBeenCalledTimes(2);
      expect(screen.queryAllByRole('button').filter((b) => /^Copier/.test(String(b.props.accessibilityLabel)) && /mot de passe/i.test(String(b.props.accessibilityLabel)))).toHaveLength(0);
      const copy = screen.getByRole('button', { name: 'Copier l’e-mail du parent' });
      const style = [copy.props.style].flat(Infinity).reduce((a: Record<string, unknown>, b: unknown) => ({ ...a, ...(b as object) }), {}) as { minHeight?: number; minWidth?: number };
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(style.minWidth).toBeGreaterThanOrEqual(44);
    });

    it('copie impossible : message, rien ne plante', async () => {
      mockCopy.mockResolvedValue(false);
      await renderSection();
      await fireEvent.press(screen.getByRole('button', { name: 'Copier l’identifiant de Minh' }));
      await waitFor(() => expect(useToastStore.getState().toast).toMatchObject({ message: 'Copie impossible', tone: 'error' }));
    });

    it('jamais l\'adresse INTERNE d\'un compte enfant : ligne et bouton « e-mail » absents', async () => {
      useSessionStore.setState({ session: sessionOf('3f2a-uuid@child.taskmate.invalid') });
      await renderSection();
      expect(screen.queryByText(/child\.taskmate\.invalid/)).toBeNull();
      expect(screen.queryByRole('button', { name: 'Copier l’e-mail du parent' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Copier l’identifiant de Minh' })).toBeTruthy();
    });

    it('sans compte enfant : pas de bloc (rien à saisir encore)', async () => {
      mockAccounts = [];
      await renderSection();
      expect(screen.queryByRole('header', { name: 'Connexion de Minh' })).toBeNull();
    });
  });

  // D-093 : iOS ne doit jamais proposer « le mot de passe de l'e-mail du parent » sur un formulaire de compte enfant
  it('création : identifiant sans sémantique « username » (off), mot de passe new-password, secureTextEntry', async () => {
    await renderSection();
    expect(screen.getByLabelText('Identifiant (lettres, chiffres, . _ -)').props.autoComplete).toBe('off');
    const password = screen.getByLabelText('Mot de passe (6 caractères minimum)');
    expect(password.props.autoComplete).toBe('new-password');
    expect(password.props.secureTextEntry).toBe(true);
  });

  it('réinitialisation : le nouveau mot de passe est new-password (jamais current-password)', async () => {
    mockAccounts = [{ child_id: 'c1', login_id: 'minh.test' }];
    await renderSection();
    const password = screen.getByLabelText('Nouveau mot de passe');
    expect(password.props.autoComplete).toBe('new-password');
    expect(password.props.secureTextEntry).toBe(true);
  });
});
