import { create } from 'zustand';
import type { ConfirmOptions } from '@/components/confirm';

/**
 * Confirmations dans l'application (D-107) : pour une famille en interface V2, `confirmDialog` n'ouvre plus de fenêtre système (`window.confirm`,
 * `Alert.alert`) mais une feuille V2 (`V2ConfirmHost`, montée à la racine) avec des libellés traduits. La V1 garde son comportement.
 */
type ConfirmState = {
  /** une feuille V2 est montée et prend les confirmations */
  enabled: boolean;
  request: ConfirmOptions | null;
  setEnabled: (enabled: boolean) => void;
  open: (o: ConfirmOptions) => void;
  close: () => void;
};

export const useConfirmStore = create<ConfirmState>((set) => ({
  enabled: false,
  request: null,
  setEnabled: (enabled) => set((s) => (s.enabled === enabled ? s : { enabled, request: enabled ? s.request : null })),
  open: (request) => set({ request }),
  close: () => set({ request: null }),
}));

/** Vrai si la confirmation a été confiée à la feuille V2. */
export function confirmInApp(o: ConfirmOptions): boolean {
  const s = useConfirmStore.getState();
  if (!s.enabled) return false;
  s.open(o);
  return true;
}
