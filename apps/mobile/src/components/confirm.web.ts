import { confirmInApp } from '@/store/confirm';
import type { ConfirmOptions } from './confirm';

/**
 * Web : feuille V2 dans l'application pour une famille V2 (D-107 : jamais de fenêtre système, libellés traduits) ; interface V1 : boîte de
 * confirmation du navigateur (accessible au clavier et aux lecteurs d'écran).
 */
export function confirmDialog(o: ConfirmOptions): void {
  if (confirmInApp(o)) return;
  if (window.confirm([o.title, o.message].filter(Boolean).join('\n\n'))) o.onConfirm();
}
