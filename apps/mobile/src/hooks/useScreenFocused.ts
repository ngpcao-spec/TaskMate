import * as Router from 'expo-router';

/**
 * L'écran est-il celui que l'utilisateur regarde ? (faux pour un écran resté monté sous un autre dans la pile, ou dans un onglet non affiché).
 * Hors navigation (tests qui simulent `expo-router` sans `useIsFocused`) : toujours vrai.
 */
const useFocused: () => boolean = (Router as { useIsFocused?: () => boolean }).useIsFocused ?? (() => true);

export function useScreenFocused(): boolean {
  return useFocused();
}
