import { createContext, useContext } from 'react';
import type { Edge } from 'react-native-safe-area-context';

/**
 * Vrai pour les écrans affichés au-dessus de la barre de navigation du bas (onglets sur téléphone ; faux sur grand écran, où la navigation est latérale,
 * et hors onglets). La barre porte déjà la marge de sécurité du bas (indicateur d'accueil de l'iPhone) : l'écran ne doit pas l'ajouter une seconde fois,
 * sinon une bande vide de la hauteur de cette marge apparaît entre la fin de la liste (coupée net) et la barre.
 */
export const BottomBarContext = createContext(false);
export const useHasBottomBar = (): boolean => useContext(BottomBarContext);

const ALL_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left'];
const NO_BOTTOM_EDGES: readonly Edge[] = ['top', 'right', 'left'];

/** Bords de sécurité d'un écran : sans le bas quand une barre du bas est présente. */
export const safeEdgesFor = (hasBottomBar: boolean): readonly Edge[] => (hasBottomBar ? NO_BOTTOM_EDGES : ALL_EDGES);
