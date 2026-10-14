import { colors } from './tokens';
import { theme } from './index';

/**
 * Couleur d'un enfant à l'AFFICHAGE (D-064, D-069). Les profils existants portent l'ancienne palette vive (bleu, menthe, violet, orange, rouge) ;
 * elle est traduite vers la palette du thème actif. La valeur enregistrée n'est jamais modifiée.
 */
export const childColor = (stored: string | null | undefined): string => {
  if (!stored) return colors.primary;
  return theme.childSoft[stored.toUpperCase()] ?? stored;
};

/** Palette proposée à la création / modification d'un enfant (déjà dans la palette du thème actif). */
export const CHILD_PALETTE = theme.childPalette;
