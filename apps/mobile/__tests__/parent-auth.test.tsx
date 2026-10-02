import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import '@/i18n';
import ParentAuthScreen from '../app/onboarding/parent-auth';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
const mockRequest = jest.fn().mockResolvedValue(undefined);
const mockVerify = jest.fn().mockResolvedValue(undefined);
jest.mock('@/api/auth', () => ({
  requestEmailOtp: (...a: unknown[]) => mockRequest(...a),
  verifyEmailOtp: (...a: unknown[]) => mockVerify(...a),
}));

describe('ParentAuthScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('refuse un email invalide sans appeler le serveur', async () => {
    await render(<ParentAuthScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'pas-un-email');
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi mã' }));
    expect(screen.getByText('Email không hợp lệ')).toBeTruthy();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('envoie le code puis valide et route vers l’accueil', async () => {
    await render(<ParentAuthScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ba@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi mã' }));
    await waitFor(() => expect(mockRequest).toHaveBeenCalledWith('ba@example.com'));
    await fireEvent.changeText(await screen.findByLabelText('Mã xác nhận'), '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(mockVerify).toHaveBeenCalledWith('ba@example.com', '123456'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('n’affiche pas les boutons Apple/Google tant que le flag est désactivé', async () => {
    await render(<ParentAuthScreen />);
    expect(screen.queryByText('Tiếp tục với Apple')).toBeNull();
  });
});
