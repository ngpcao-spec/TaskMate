import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Style de l'interface V2 (D-106, « style Finch ») : UN seul style, indépendant des cinq thèmes V1 (que la V2 n'utilise jamais).
 * Fond vert doux sous le décor, cartes crème arrondies (rayon 24) à ombre légère, vert pour les actions et la validation, orange pour l'énergie,
 * texte brun foncé. Contrastes AA vérifiés par `theme.test.ts`. Les écrans V2 n'utilisent QUE ces jetons (jamais une couleur en dur).
 */
export const v2Colors = {
  /** fond de l'écran (sous le décor et autour des cartes) */
  background: '#DCEFD6',
  backgroundDeep: '#C3E2B8',
  card: '#FFF8EC',
  cardMuted: '#F6ECDA',
  cardBorder: '#EADCC2',
  text: '#3B2A1E',
  textSecondary: '#6B5242',
  /** actions et validation */
  primary: '#276B2B',
  primaryPressed: '#1F5722',
  primarySoft: '#DDF0D5',
  onPrimary: '#FFFFFF',
  /** énergie ⚡ : remplissage (jamais du texte) et texte sur crème */
  energy: '#F59E0B',
  energySoft: '#FDE7C2',
  energyText: '#9A4D00',
  onEnergy: '#3B2A1E',
  /** mention « en attente » (tâche cochée, validation du parent attendue) */
  pending: '#8A5A00',
  pendingSoft: '#FCEFD2',
  danger: '#B3261E',
  onDanger: '#FFFFFF',
  track: '#EADFC9',
  /** cases à cocher vides, filets */
  line: '#D9C9AE',
  tabBar: '#FFF8EC',
  tabActive: '#276B2B',
  tabInactive: '#6F5A4A',
  badge: '#C2410C',
  onBadge: '#FFFFFF',
  /** voile sous une carte posée sur le décor (opaque : jamais de fond translucide sous du texte) */
  scrim: '#FFF8EC',
  shadow: '#3B2A1E',
  /** boutons ronds du haut, posés sur le ciel du décor */
  topButton: '#FFF8EC',
  onTopButton: '#3B2A1E',
} as const;
export type V2ColorKey = keyof typeof v2Colors;

export const v2Radius = { card: 24, pill: 999, control: 16, small: 12 } as const;
export const v2Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
/** cible tactile minimale (pt) */
export const V2_TOUCH = 44;

export const v2Shadow: ViewStyle = Platform.select<ViewStyle>({
  web: { boxShadow: '0 4px 14px rgba(59, 42, 30, 0.12)' } as ViewStyle,
  default: { shadowColor: v2Colors.shadow, shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
}) as ViewStyle;

/** Polices Nunito (OFL, `assets/fonts/nunito`), chargées par expo-font dans le layout V2 ; repli système tant qu'elles ne sont pas prêtes. */
export const V2_FONT_FILES = {
  Nunito_600SemiBold: require('../../assets/fonts/nunito/Nunito_600SemiBold.ttf'),
  Nunito_700Bold: require('../../assets/fonts/nunito/Nunito_700Bold.ttf'),
  Nunito_800ExtraBold: require('../../assets/fonts/nunito/Nunito_800ExtraBold.ttf'),
} as const;

export type V2Weight = 600 | 700 | 800;
const FAMILY: Record<V2Weight, keyof typeof V2_FONT_FILES> = { 600: 'Nunito_600SemiBold', 700: 'Nunito_700Bold', 800: 'Nunito_800ExtraBold' };

/** Style de police : famille Nunito du poids demandé (+ repli système sur le web), poids conservé pour le repli. */
export function v2Font(weight: V2Weight, size: number): TextStyle {
  const family = FAMILY[weight];
  return {
    fontFamily: Platform.OS === 'web' ? `${family}, Nunito, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` : family,
    fontWeight: String(weight) as TextStyle['fontWeight'],
    fontSize: size,
    color: v2Colors.text,
  };
}

export const v2Text = {
  title: v2Font(800, 24),
  heading: v2Font(800, 18),
  body: v2Font(600, 15),
  bodyBold: v2Font(700, 15),
  small: v2Font(600, 13),
  caption: { ...v2Font(700, 12), color: v2Colors.textSecondary },
} as const;

/** Carte crème arrondie (rayon 24, ombre légère). */
export const v2Card: ViewStyle = { backgroundColor: v2Colors.card, borderRadius: v2Radius.card, padding: v2Spacing.lg, ...v2Shadow };
