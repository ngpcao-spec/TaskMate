import { Alert } from 'react-native';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
};

/** Confirmation native (Alert). Sur le web, `Alert.alert` est un no-op : voir confirm.web.ts. */
export function confirmDialog({ title, message, confirmLabel, cancelLabel, destructive = false, onConfirm }: ConfirmOptions): void {
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
