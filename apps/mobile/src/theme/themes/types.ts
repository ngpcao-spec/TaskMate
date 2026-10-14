/** Un thème = un jeu COMPLET de jetons. Ajouter un thème : un fichier ici + une entrée dans `THEMES` ; `theme/themes.test` impose les mêmes clés et des contrastes lisibles. */
export type ThemeId = 'glass' | 'kawaii';

export type ThemeColors = {
  /** Fond des boutons et accents (texte `onPrimary` dessus). */
  primary: string;
  /** Variante foncée pour le TEXTE et les icônes de couleur d'accent sur les surfaces claires. */
  accent: string;
  primaryLight: string;
  mint: string;
  background: string;
  backgroundTop: string;
  backgroundBottom: string;
  card: string;
  cardStrong: string;
  cardSolid: string;
  glassBorder: string;
  glassBorderSoft: string;
  text: string;
  textSecondary: string;
  /** Panneaux (bannière d'accueil, carte enfant sélectionnée, pastille active) et leurs textes. */
  navy: string;
  navyDeep: string;
  navyLight: string;
  onNavy: string;
  onNavySecondary: string;
  navyBorder: string;
  /** Barre de navigation (peut différer des panneaux). */
  barFrom: string;
  barTo: string;
  onBar: string;
  navActive: string;
  /** Anneau de progression sur un panneau. */
  ringOnNavy: string;
  trackOnNavy: string;
  /** Texte / icône posé sur un fond `primary` ou une couleur d'enfant. */
  onPrimary: string;
  /** Texte / icône posé sur un fond plein foncé (danger, succès, infobulle). */
  onSolid: string;
  /** Contour d'une surface pleine accentuée (bouton principal, avatar, coche). */
  ring: string;
  danger: string;
  success: string;
  warning: string;
  primaryTint: string;
  mintTint: string;
  warningTint: string;
  successTint: string;
  separator: string;
  tileTeal: string;
  tileBlue: string;
  tileIce: string;
  tileViolet: string;
  inputBg: string;
  track: string;
  placeholder: string;
};

export type Theme = {
  id: ThemeId;
  colors: ThemeColors;
  radius: { card: number; tile: number; control: number; pill: number };
  /** Épaisseur des filets des surfaces (1 = reflet de verre ; 2,5 = contour dessiné à la main). */
  lineWidth: number;
  shadow: string;
  shadowSmall: string;
  shadowInset: string;
  /** Teintes des barres du graphique. */
  chartTones: readonly string[];
  categoryColors: { study: string; sport: string; chores: string; personal: string; other: string };
  /** Teintes des icônes de récompense (par nom d'icône). */
  rewardTints: Record<string, string>;
  /** Ancienne palette vive des profils d'enfant (valeur enregistrée, en majuscules) → teinte affichée. */
  childSoft: Record<string, string>;
  /** Palette proposée à la création d'un enfant (déjà dans la palette du thème). */
  childPalette: readonly [string, string, string, string, string];
  /** Décors illustrés (chiens, nœuds, étincelles) : thème « kawaii » seulement. */
  decor: boolean;
  /** Couleur de la barre du navigateur / de la PWA. */
  browserColor: string;
};
