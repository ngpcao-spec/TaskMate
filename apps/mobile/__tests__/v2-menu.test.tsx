import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import V2Menu from '../app/(v2)/v2/menu';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack }) }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

describe('Menu V2 : retour vers l’accueil (la PWA n’a pas de bouton retour du navigateur)', () => {
  beforeEach(() => jest.clearAllMocks());
  it('bouton « Quay lại » : page précédente', async () => {
    mockCanGoBack = true;
    await render(<V2Menu />);
    await fireEvent.press(screen.getByRole('button', { name: 'Quay lại' }));
    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
  it('sans historique (PWA rouverte sur le Menu) : accueil V2', async () => {
    mockCanGoBack = false;
    await render(<V2Menu />);
    await fireEvent.press(screen.getByRole('button', { name: 'Quay lại' }));
    expect(mockReplace).toHaveBeenCalledWith('/v2');
  });
  it('les entrées du menu restent là', async () => {
    await render(<V2Menu />);
    await fireEvent.press(screen.getByRole('button', { name: 'Lịch' }));
    expect(mockPush).toHaveBeenCalledWith('/v2/calendar');
  });
});
