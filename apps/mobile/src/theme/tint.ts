import { solidTint } from './blend';
import { colors, hasDecor } from './tokens';

/**
 * Teinte d'une couleur à `alpha` : translucide sur « verre givré » (comme avant), OPAQUE sur les thèmes illustrés
 * (le damier / les étoiles du fond ne doivent pas transparaître à travers une carte ou une tuile).
 */
export function tint(color: string, alpha: number): string {
  if (hasDecor) return solidTint(color, alpha, colors.cardSolid);
  return `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0').toUpperCase()}`;
}
