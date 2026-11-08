import { act, fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import { Alert } from 'react-native';
import { confirmDialog } from '@/components/confirm';
import { confirmDialog as confirmDialogWeb } from '@/components/confirm.web';
import { useConfirmStore } from '@/store/confirm';
import { V2ConfirmHost } from '@/v2/components/V2ConfirmHost';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const opts = (onConfirm = jest.fn()) => ({ title: 'Đổi quà?', message: 'Dùng 30 điểm', confirmLabel: 'Đổi', cancelLabel: 'Hủy', onConfirm });

describe('confirmations sans fenêtre système (D-107)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    useConfirmStore.setState({ enabled: false, request: null });
  });

  it('famille V2 : feuille V2 traduite (jamais Alert ni window.confirm) ; « Đổi » confirme, « Hủy » annule', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    await render(<V2ConfirmHost enabled />);
    const onConfirm = jest.fn();
    await act(async () => confirmDialog(opts(onConfirm)));
    expect(alert).not.toHaveBeenCalled();
    expect(screen.getByText('Đổi quà?')).toBeTruthy();
    expect(screen.getByText('Dùng 30 điểm')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Đổi' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Đổi quà?')).toBeNull();

    const other = jest.fn();
    await act(async () => confirmDialog(opts(other)));
    await fireEvent.press(screen.getByRole('button', { name: 'Hủy' }));
    expect(other).not.toHaveBeenCalled();
    expect(screen.queryByTestId('v2-confirm')).toBeNull();
  });

  it('web, famille V2 : jamais window.confirm', async () => {
    const native = jest.fn(() => true);
    (globalThis as unknown as { window: { confirm: () => boolean } }).window.confirm = native;
    await render(<V2ConfirmHost enabled />);
    await act(async () => confirmDialogWeb(opts()));
    expect(native).not.toHaveBeenCalled();
    expect(screen.getByTestId('v2-confirm')).toBeTruthy();
  });

  it('interface V1 (hôte inactif) : comportement d’avant (Alert natif, boîte du navigateur sur le web)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<V2ConfirmHost enabled={false} />);
    confirmDialog(opts());
    expect(alert).toHaveBeenCalledWith('Đổi quà?', 'Dùng 30 điểm', expect.any(Array));
    const native = jest.fn(() => false);
    (globalThis as unknown as { window: { confirm: () => boolean } }).window.confirm = native;
    confirmDialogWeb(opts());
    expect(native).toHaveBeenCalledWith('Đổi quà?\n\nDùng 30 điểm');
  });
});
