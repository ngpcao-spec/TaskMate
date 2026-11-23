
/** Teinte d'une couleur à `alpha` (suffixe d'opacité hexadécimal). */
export function tint(color: string, alpha: number): string {
  return `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0').toUpperCase()}`;
}
