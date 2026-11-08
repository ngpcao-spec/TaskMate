import { useEffect } from 'react';
import { useConfirmStore } from '@/store/confirm';
import { V2ConfirmSheet } from './V2Sheet';

/**
 * Hôte des confirmations V2 (D-107), monté à la racine : quand la famille est en V2 (`enabled`), `confirmDialog` passe par cette feuille au lieu
 * d'une fenêtre système, y compris dans les écrans V1 réutilisés par la V2 (points, réglages, calendrier, avatar).
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
    <V2ConfirmSheet
      visible
      title={request.title}
      message={request.message}
      confirmLabel={request.confirmLabel}
      cancelLabel={request.cancelLabel}
      destructive={request.destructive}
      onCancel={close}
      onConfirm={() => {
        close();
        request.onConfirm();
      }}
    />
  );
}
