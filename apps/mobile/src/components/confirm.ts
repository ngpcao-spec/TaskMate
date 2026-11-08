import { Alert } from 'react-native';
import { confirmInApp } from '@/store/confirm';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
};

/** Confirmation : feuille V2 dans l'application pour une famille V2 (D-107), sinon confirmation native (Alert). Web : voir confirm.web.ts. */
export function confirmDialog(o: ConfirmOptions): void {
  if (confirmInApp(o)) return;
  const { title, message, confirmLabel, cancelLabel, destructive = false, onConfirm } = o;
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
