import { fireEvent, render, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import { AppErrorScreen } from '@/components/AppErrorScreen';
import { CRASH_KEY } from '@/domain/crash-report';

const mockReload = jest.fn();
jest.mock('@/theme/themeStore', () => ({ ...jest.requireActual('@/theme/themeStore'), reloadApp: () => mockReload() }));
const mockSetItem = jest.fn();
jest.mock('@/sync/storage', () => ({ kvStorage: { getItem: jest.fn(), setItem: (...a: unknown[]) => mockSetItem(...a), removeItem: jest.fn() } }));

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('vi');
});

describe('Écran d\'erreur racine (D-094) : jamais un écran vide', () => {
  it('message clair, détail technique, « Thử lại » rejoue, « Tải lại ứng dụng » recharge', async () => {
    const retry = jest.fn();
    await render(<AppErrorScreen error={new Error('boom d\'affichage')} retry={retry} />);
    expect(screen.getByRole('header', { name: 'Đã có lỗi hiển thị' })).toBeTruthy();
    expect(screen.getByLabelText('Chi tiết kỹ thuật của lỗi').props.children).toContain('Error: boom d\'affichage');
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    expect(retry).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại ứng dụng' }));
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('le rapport est conservé sur l\'appareil (dernière erreur) pour le retrouver après un rechargement', async () => {
    await render(<AppErrorScreen error={new Error('x')} retry={jest.fn()} />);
    expect(mockSetItem).toHaveBeenCalledWith(CRASH_KEY, expect.stringContaining('"message":"x"'));
  });

  it('stockage indisponible : l\'écran s\'affiche quand même', async () => {
    mockSetItem.mockImplementation(() => {
      throw new Error('quota');
    });
    await render(<AppErrorScreen error={new Error('y')} retry={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
  });

  it.each(['fr', 'en'])('traduit (%s)', async (lang) => {
    await i18n.changeLanguage(lang);
    await render(<AppErrorScreen error={new Error('z')} retry={jest.fn()} />);
    expect(screen.queryByText('Thử lại')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
