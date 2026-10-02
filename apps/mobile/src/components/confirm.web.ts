import type { ConfirmOptions } from './confirm';

/** Web : boîte de confirmation du navigateur (accessible au clavier et aux lecteurs d'écran). */
export function confirmDialog({ title, message, onConfirm }: ConfirmOptions): void {
  if (window.confirm([title, message].filter(Boolean).join('\n\n'))) onConfirm();
}
