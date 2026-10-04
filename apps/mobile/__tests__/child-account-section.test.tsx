import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import i18n from '@/i18n';
import { ChildAccountSection } from '@/components/ChildAccountSection';
import { createTestQueryClient } from '../test-utils/queryClient';

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
});
