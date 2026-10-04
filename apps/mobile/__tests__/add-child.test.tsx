import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import i18n from '@/i18n';
import AddChildScreen from '../app/(tabs)/more/add-child';
import { createTestQueryClient } from '../test-utils/queryClient';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn(), canGoBack: () => true }),
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));

let mockRole: 'parent' | 'child' = 'parent';
jest.mock('@/hooks/useMe', () => ({
  useMe: () => ({ data: { member: { id: 'm1', role: mockRole }, family: { id: 'f1', timezone: 'Asia/Ho_Chi_Minh' }, children: [{ id: 'c1' }, { id: 'c2' }] } }),
}));
const mockAdd = jest.fn();
jest.mock('@/api/childAccounts', () => {
  class MockChildAccountError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return { ChildAccountError: MockChildAccountError, addChildWithAccount: (...a: unknown[]) => mockAdd(...a) };
});
const mockCopy = jest.fn();
jest.mock('@/services/clipboard', () => ({ copyText: (...a: unknown[]) => mockCopy(...a) }));

const client = createTestQueryClient();
afterAll(() => client.clear());
const renderScreen = (ui: ReactElement = <AddChildScreen />) => render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);

const fill = async (over: { loginId?: string; password?: string } = {}) => {
  await fireEvent.changeText(screen.getByLabelText('Prénom de l\'enfant'), 'Cam');
  await fireEvent.changeText(screen.getByLabelText('Date de naissance (AAAA-MM-JJ)'), '2016-02-01');
  await fireEvent.changeText(screen.getByLabelText('Identifiant (lettres, chiffres, . _ -)'), over.loginId ?? 'cam.test');
  await fireEvent.changeText(screen.getByLabelText('Mot de passe (6 caractères minimum)'), over.password ?? 'secret1');
};
const submitButton = () => screen.getByRole('button', { name: 'Créer l\'enfant et son accès' });

describe('AddChildScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockRole = 'parent';
    mockCopy.mockResolvedValue(true);
    await i18n.changeLanguage('fr');
  });

  it('inaccessible à un enfant : redirection, aucun formulaire', async () => {
    mockRole = 'child';
    await renderScreen();
    expect(screen.getByText('redirect:/')).toBeTruthy();
    expect(screen.queryByLabelText('Prénom de l\'enfant')).toBeNull();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('bouton inactif tant que le profil, l\'identifiant et le mot de passe (≥ 6) ne sont pas valides', async () => {
    await renderScreen();
    await fill({ password: '12345' });
    expect(screen.getByText('Mot de passe : 6 caractères minimum.')).toBeTruthy();
    expect(submitButton().props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.changeText(screen.getByLabelText('Mot de passe (6 caractères minimum)'), '123456');
    expect(submitButton().props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('crée l\'enfant puis affiche UNE fois identifiant et mot de passe, avec copie et avertissement', async () => {
    mockAdd.mockResolvedValue({ id: 'c3', name: 'Cam' });
    await renderScreen();
    await fill({ loginId: 'Cam.Test' });
    await fireEvent.press(submitButton());
    await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(1));
    expect(mockAdd).toHaveBeenCalledWith('f1', expect.objectContaining({ name: 'Cam', birthDate: '2016-02-01', sortOrder: 2 }), 'Cam.Test', 'secret1');

    expect(await screen.findByText('Identifiant : cam.test')).toBeTruthy();
    expect(screen.getByText('Mot de passe : secret1')).toBeTruthy();
    expect(screen.getByText(/ne sera plus jamais affiché/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Copier l\'identifiant et le mot de passe Cam' }));
    await waitFor(() => expect(mockCopy).toHaveBeenCalledWith(expect.stringContaining('cam.test')));
    expect(mockCopy.mock.calls[0]?.[0]).toContain('secret1');
    expect(await screen.findByText('Copié dans le presse-papiers')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Terminer' }));
    expect(mockReplace).toHaveBeenCalledWith('/more');
  });

  it('identifiant déjà pris : message dédié, saisie conservée, aucun écran d\'accès', async () => {
    const { ChildAccountError } = jest.requireMock('@/api/childAccounts');
    mockAdd.mockRejectedValueOnce(new ChildAccountError('identifier_taken'));
    await renderScreen();
    await fill();
    await fireEvent.press(submitButton());
    expect(await screen.findByText('Cet identifiant est déjà pris. Choisissez-en un autre.')).toBeTruthy();
    expect(screen.queryByText(/Mot de passe : secret1/)).toBeNull();
    expect(screen.getByLabelText('Prénom de l\'enfant').props.value).toBe('Cam');
  });
});
