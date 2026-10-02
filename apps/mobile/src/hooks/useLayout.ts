import { useWindowDimensions } from 'react-native';

/** Au-delà de cette largeur (px), mise en page « bureau » : navigation latérale, contenu centré, colonnes. */
export const WIDE_BREAKPOINT = 900;

export const isWideWidth = (width: number): boolean => width >= WIDE_BREAKPOINT;

export function useIsWide(): boolean {
  return isWideWidth(useWindowDimensions().width);
}
