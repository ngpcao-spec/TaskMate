import { colors } from './tokens';

/**
 * Couleur d'un enfant à l'AFFICHAGE (D-064). Les profils existants portent l'ancienne palette vive (bleu, menthe, violet, orange, rouge) ;
 * elle est traduite vers la palette acier du thème (texte blanc ≥ 4:1 dessus). La valeur enregistrée n'est jamais modifiée.
 */
const SOFT: Record<string, string> = {
  '#1E88F5': '#3A7CA5',
  '#2EC4A6': '#2F8F80',
  '#8B5CF6': '#6E6BB8',
  '#F5A623': '#B07A28',
  '#E5484D': '#A83A44',
};

export const childColor = (stored: string | null | undefined): string => {
  if (!stored) return colors.primary;
  return SOFT[stored.toUpperCase()] ?? stored;
};

/** Palette proposée à la création / modification d'un enfant (déjà dans la palette acier). */
export const CHILD_PALETTE = ['#3A7CA5', '#2F8F80', '#6E6BB8', '#B07A28', '#A83A44'] as const;
