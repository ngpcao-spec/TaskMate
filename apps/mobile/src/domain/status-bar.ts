/**
 * Barre d'état translucide de l'iPhone (PWA, D-106) : la page passe dessous et iOS y écrit l'heure et la batterie EN BLANC. Un voile sombre en dégradé
 * d'opacité, sur la hauteur de la marge haute, garde ce texte lisible sur n'importe quel fond (décors V2, thèmes V1 clairs).
 * Opacité : `top` en haut de l'écran, `insetBottom` au bas de la marge haute, puis fondu jusqu'à 0 sur `fadeBelow` pt.
 * Teo proposait 0,25 → 0 : mesuré sur le ciel des 7 décors V2, le blanc n'y atteint que 1,8:1 dans les coins ; 0,6 → 0,3 donnait ≥ 4,2:1 à mi-hauteur.
 * D-110 (2026-11-24, Teo : « une zone un peu sombre en haut ») : allégé à 0,35 → 0,12 puis fondu sur 24 pt (plus de bord visible). À mi-hauteur
 * (≈ 0,235) l'heure reste ≥ 3:1 sur le ciel du décor `home` (le seul de Hôm nay depuis D-107) ; ≥ 2,2:1 sur les ciels les plus clairs.
 */
export const STATUS_SCRIM = { top: 0.35, insetBottom: 0.12, fadeBelow: 24 } as const;

/** Opacité du voile à `y` pt du haut de l'écran, pour une marge haute `inset` (0 = pas de voile). */
export function scrimOpacityAt(y: number, inset: number): number {
  if (inset <= 0 || y < 0) return inset <= 0 ? 0 : STATUS_SCRIM.top;
  if (y <= inset) return STATUS_SCRIM.top + (STATUS_SCRIM.insetBottom - STATUS_SCRIM.top) * (y / inset);
  const t = (y - inset) / STATUS_SCRIM.fadeBelow;
  return t >= 1 ? 0 : STATUS_SCRIM.insetBottom * (1 - t);
}

const channel = (v: number) => {
  const x = v / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};

/** Contraste du texte blanc d'iOS sur un fond `#RRGGBB` assombri par un voile noir d'opacité `alpha`. */
export function whiteOnScrimContrast(background: string, alpha: number): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(background.slice(i, i + 2), 16) * (1 - alpha)) as [number, number, number];
  const lum = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return 1.05 / (lum + 0.05);
}
