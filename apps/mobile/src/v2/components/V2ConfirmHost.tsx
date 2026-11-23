import { useEffect } from 'react';
import { useConfirmStore } from '@/store/confirm';
import { ConfirmSheet } from './ConfirmSheet';

/**
 * Hôte des confirmations V2 (D-107, D-111), monté à la racine : quand la famille est en V2 (`enabled`), `confirmDialog` passe par `ConfirmSheet`
 * au lieu d'une fenêtre système, y compris dans les écrans V1 réutilisés par la V2 (points, réglages, calendrier, avatar, validations).
 */
export function V2ConfirmHost({ enabled }: { enabled: boolean }) {
  const setEnabled = useConfirmStore((s) => s.setEnabled);
  const request = useConfirmStore((s) => s.request);
  const close = useConfirmStore((s) => s.close);
  useEffect(() => {
    setEnabled(enabled);
    return () => setEnabled(false);
  }, [enabled, setEnabled]);
  if (!enabled || !request) return null;
  return (
    <ConfirmSheet
      visible
      onClose={close}
      title={request.title}
      message={request.message}
      testID="v2-confirm"
      actions={[
        {
          label: request.confirmLabel,
          variant: request.destructive ? 'danger' : 'primary',
          testID: 'v2-confirm-ok',
          onPress: () => {
            close();
            request.onConfirm();
          },
        },
        { label: request.cancelLabel, variant: 'secondary', testID: 'v2-confirm-cancel', onPress: close },
      ]}
    />
  );
}
