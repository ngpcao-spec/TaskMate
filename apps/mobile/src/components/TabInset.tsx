import { createContext, useContext } from 'react';

/**
 * Hauteur de la barre de navigation du bas, mesurée par la barre elle-même et fournie aux écrans des onglets (0 hors onglets et sur grand écran, où la
 * navigation est latérale). Les écrans à défilement l'ajoutent à leur marge basse : sur iPhone (PWA), le bas du contenu passait sous la barre et le dernier
 * élément ne pouvait pas être atteint.
 */
export const TabInsetContext = createContext(0);
export const useTabInset = (): number => useContext(TabInsetContext);

/** Marge basse d'un écran à défilement : la marge normale, plus la hauteur de la barre du bas quand il y en a une. */
export const bottomPaddingFor = (inset: number, base = 16): number => base + (inset > 0 ? inset : 0);
