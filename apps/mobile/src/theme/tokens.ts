/**
 * Jetons de style = valeurs du THÈME ACTIF (`theme/index.ts` : « verre givré » par défaut, « kawaii » au choix de l'utilisateur, D-064 / D-069).
 * Les noms sont stables : les écrans n'importent que d'ici, jamais un thème précis. Jamais de couleur en dur.
 */
import { theme } from './index';

export const colors = theme.colors;
export const radius = theme.radius;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

// `title` et `body` portent la couleur de texte du thème : sans couleur, un texte s'affiche en noir (illisible sur le thème sombre « cosmos »).
export const typography = {
  title: { fontSize: 24, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  secondary: { fontSize: 13, color: colors.textSecondary },
};

/** Épaisseur des filets (reflet de verre : 1 ; contour dessiné à la main : 2,5). */
export const line = { width: theme.lineWidth } as const;

/**
 * Ombres. « Verre givré » : néomorphisme (ombre portée + reflet, chaîne CSS comprise par React Native ≥ 0.76 et react-native-web). « Kawaii » : aucune
 * ombre, les contours font le relief.
 */
export const shadow = { boxShadow: theme.shadow } as const;
export const shadowSmall = { boxShadow: theme.shadowSmall } as const;
export const shadowInset = { boxShadow: theme.shadowInset } as const;

/** Surface de carte : fond, filet, relief. */
export const glass = {
  backgroundColor: colors.card,
  borderWidth: line.width,
  borderColor: colors.glassBorder,
  ...shadow,
} as const;

export const chartTones = theme.chartTones;
export const themeId = theme.id;
/** Famille de décors du thème (`none`, `kawaii`, `cosmos`) et indicateur « il y a des décors ». */
export const decor = theme.decor;
export const hasDecor = theme.decor !== 'none';

/** Minimum touch target (pt). */
export const MIN_TARGET = 44;
