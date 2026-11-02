/** Interface V1 / V2 (D-106) : `families.ui_version`, écrite par l'administrateur seulement (`admin_set_ui_version`). La V1 reste le défaut. */
export type UiVersion = 'v1' | 'v2';

export const parseUiVersion = (v: unknown): UiVersion => (v === 'v2' ? 'v2' : 'v1');

/** Accueil de chaque interface (route Expo Router). */
export const HOME_ROUTE: Record<UiVersion, '/(tabs)/today' | '/v2'> = { v1: '/(tabs)/today', v2: '/v2' };

/**
 * Faut-il purger le cache et rouvrir l'accueil ? Oui quand la version connue de CE compte change (passage en V2 ou retour en V1).
 * Première lecture (rien de mémorisé) : on mémorise seulement.
 */
export function uiVersionChanged(stored: string | null, current: UiVersion): boolean {
  return stored !== null && parseUiVersion(stored) !== current;
}
