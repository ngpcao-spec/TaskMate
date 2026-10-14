/**
 * Thème « verre givré bleu-gris » (D-064) : fond acier bleuté, cartes en verre dépoli translucide avec reflet clair,
 * panneaux marine pour la navigation et les bannières, boutons sarcelle en relief, champs en creux (néomorphisme doux).
 * Référence : docs/mockups/style-reference.webp. Les noms de jetons historiques sont conservés ; seules les valeurs changent.
 */
export const colors = {
  /** Sarcelle des boutons et accents (texte blanc dessus ≥ 4,5:1). */
  primary: '#2B7A89',
  /** Sarcelle foncé pour le TEXTE et les icônes sur verre (≥ 4,5:1). */
  accent: '#1B5967',
  primaryLight: '#4C9DAA',
  mint: '#4FB5A5',
  /** Fond opaque de repli (le dégradé `backgroundTop → backgroundBottom` est dessiné par `Backdrop`). */
  background: '#9CB0C0',
  backgroundTop: '#B1C4D2',
  backgroundBottom: '#9AAFC0',
  /** Verre dépoli : blanc translucide posé sur le fond. */
  card: 'rgba(255,255,255,0.30)',
  cardStrong: 'rgba(255,255,255,0.46)',
  /** Verre opaque (fenêtres, menus déroulants) quand la transparence gênerait la lecture. */
  cardSolid: '#C3D2DE',
  glassBorder: 'rgba(255,255,255,0.55)',
  glassBorderSoft: 'rgba(255,255,255,0.28)',
  text: '#142638',
  textSecondary: '#243B4F',
  /** Panneaux marine (barre de navigation, bannière) et leurs textes. */
  navy: '#3C536C',
  navyDeep: '#2F4459',
  navyLight: '#4D6783',
  onNavy: '#EAF3F9',
  onNavySecondary: '#B8CBDA',
  danger: '#97283A',
  success: '#1B6048',
  /** Fonds teintés (pastilles, bannières, tuiles) ramenés dans la palette acier. */
  primaryTint: 'rgba(76,157,170,0.30)',
  mintTint: 'rgba(79,181,165,0.30)',
  warning: '#7E4C0C',
  warningTint: 'rgba(240,184,92,0.38)',
  successTint: 'rgba(79,181,140,0.30)',
  separator: 'rgba(255,255,255,0.38)',
  /** Tuiles de statistiques (maquette : sarcelle, bleu acier, givre, violet). */
  tileTeal: '#8ECFC6',
  tileBlue: '#9DB9D1',
  tileIce: '#E2EEF6',
  tileViolet: '#9C9ACE',
  /** Champs de saisie en creux. */
  inputBg: 'rgba(255,255,255,0.22)',
  /** Rail (gouttière) des barres de progression. */
  track: 'rgba(255,255,255,0.38)',
  placeholder: '#4A6177',
} as const;

export const radius = { card: 24, tile: 22, control: 16, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const typography = {
  title: { fontSize: 24, fontWeight: '700' as const },
  body: { fontSize: 15 },
  secondary: { fontSize: 13, color: colors.textSecondary },
};

/**
 * Ombres néomorphes : une ombre portée sombre en bas à droite + un reflet clair en haut à gauche.
 * Chaîne CSS (comprise par React Native ≥ 0.76 et par react-native-web) pour combiner plusieurs couches et l'ombre interne.
 */
export const shadow = {
  boxShadow: '6px 8px 18px rgba(28,46,66,0.30), -4px -4px 12px rgba(255,255,255,0.32)',
} as const;

/** Relief léger (tuiles d'icônes, pastilles, boutons ronds). */
export const shadowSmall = {
  boxShadow: '3px 4px 9px rgba(28,46,66,0.30), -2px -2px 6px rgba(255,255,255,0.30)',
} as const;

/** Creux (champs, rails de barres, sélecteurs) : ombre interne sombre en haut à gauche, reflet clair en bas à droite. */
export const shadowInset = {
  boxShadow: 'inset 3px 3px 7px rgba(28,46,66,0.30), inset -3px -3px 6px rgba(255,255,255,0.32)',
} as const;

/** Surface en verre dépoli : fond translucide, filet clair, relief. */
export const glass = {
  backgroundColor: colors.card,
  borderWidth: 1,
  borderColor: colors.glassBorder,
  ...shadow,
} as const;

/** Minimum touch target (pt). */
export const MIN_TARGET = 44;
