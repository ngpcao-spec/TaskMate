import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

/**
 * Illustrations du thème « bunny » (SVG : lapinou cotonneux, fraises, étoiles, nuages ; contour bleu-gris). Ce sont des ILLUSTRATIONS : leurs couleurs sont
 * celles du dessin, pas des jetons de thème. Toutes décoratives (masquées aux lecteurs d'écran) ; à n'afficher que si `decor === 'bunny'`.
 */
const INK = '#4D5A78';
const CREAM = '#FFFAF6';
const PINK = '#F6B4C0';
const BLUSH = '#F9C9D2';
const RED = '#EE6F80';
const LEAF = '#7FBF9A';
const YELLOW = '#FBE08A';
const W = 2.6;

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

/** Fraise. */
export function Strawberry({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" {...hidden}>
      <Path d="M20 36 C8 30 5 20 8 14 C12 10 28 10 32 14 C35 20 32 30 20 36 Z" fill={RED} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <Path d="M9 13 C13 7 18 10 20 12 C22 10 27 7 31 13 C26 14 14 14 9 13 Z" fill={LEAF} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <G fill="#FFE9EC">
        <Circle cx="15" cy="21" r="1.4" />
        <Circle cx="22" cy="19" r="1.4" />
        <Circle cx="25" cy="25" r="1.4" />
        <Circle cx="18" cy="28" r="1.4" />
      </G>
    </Svg>
  );
}

/** Étoile jaune aux joues roses. */
export function CuteStar({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" {...hidden}>
      <Path d="M20 4 L24.5 14.5 L36 15.5 L27.3 23 L30 34 L20 28 L10 34 L12.7 23 L4 15.5 L15.5 14.5 Z" fill={YELLOW} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <G fill={INK}>
        <Circle cx="16.5" cy="21" r="1.4" />
        <Circle cx="23.5" cy="21" r="1.4" />
      </G>
      <Ellipse cx="13.5" cy="24" rx="2.4" ry="1.6" fill={PINK} />
      <Ellipse cx="26.5" cy="24" rx="2.4" ry="1.6" fill={PINK} />
    </Svg>
  );
}

/** Nuage. */
export function Cloud({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 0.6} viewBox="0 0 80 48" {...hidden}>
      <Path d="M18 42 C6 42 4 28 14 25 C13 14 26 8 34 16 C38 6 56 8 56 20 C68 18 76 30 66 38 C64 41 60 42 58 42 Z" fill={CREAM} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
    </Svg>
  );
}

/** Lapinou blanc cotonneux (oreilles tombantes, joues roses, petite fraise sur la tête). `happy` : yeux souriants. */
export function BunnyFace({ size = 76, happy = false }: { size?: number; happy?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" {...hidden}>
      <Path d="M24 40 C10 28 12 10 26 12 C36 14 40 28 38 40 Z" fill={CREAM} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <Path d="M76 40 C90 28 88 10 74 12 C64 14 60 28 62 40 Z" fill={CREAM} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <Path d="M24 34 C18 26 19 18 25 19 C29 20 31 27 31 34 Z" fill={BLUSH} />
      <Path d="M76 34 C82 26 81 18 75 19 C71 20 69 27 69 34 Z" fill={BLUSH} />
      <Path d="M50 24 C78 22 92 42 90 62 C88 82 70 92 50 92 C30 92 12 82 10 62 C8 42 22 22 50 24 Z" fill={CREAM} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <Ellipse cx="24" cy="66" rx="8.5" ry="6" fill={BLUSH} />
      <Ellipse cx="76" cy="66" rx="8.5" ry="6" fill={BLUSH} />
      {happy ? (
        <G stroke={INK} strokeWidth={3.2} strokeLinecap="round" fill="none">
          <Path d="M29 54 Q34 48 39 54" />
          <Path d="M61 54 Q66 48 71 54" />
        </G>
      ) : (
        <G fill={INK}>
          <Circle cx="34" cy="54" r="4.2" />
          <Circle cx="66" cy="54" r="4.2" />
        </G>
      )}
      <Ellipse cx="50" cy="63" rx="4" ry="3" fill={PINK} stroke={INK} strokeWidth={1.8} />
      <Path d="M44 71 Q47 76 50 71 Q53 76 56 71" stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      <G transform="translate(58,14) scale(0.42)">
        <Path d="M20 36 C8 30 5 20 8 14 C12 10 28 10 32 14 C35 20 32 30 20 36 Z" fill={RED} stroke={INK} strokeWidth={5.6} strokeLinejoin="round" />
        <Path d="M9 13 C13 7 18 10 20 12 C22 10 27 7 31 13 C26 14 14 14 9 13 Z" fill={LEAF} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

/** Ligne d'ornements du haut d'écran : fraise – étoile – lapinou – étoile – fraise. */
export function BunnyOrnamentRow() {
  return (
    <Svg width={250} height={46} viewBox="0 0 250 46" {...hidden}>
      <G transform="translate(2,6) scale(0.85)">
        <Path d="M20 36 C8 30 5 20 8 14 C12 10 28 10 32 14 C35 20 32 30 20 36 Z" fill={RED} stroke={INK} strokeWidth={2.9} strokeLinejoin="round" />
        <Path d="M9 13 C13 7 18 10 20 12 C22 10 27 7 31 13 C26 14 14 14 9 13 Z" fill={LEAF} stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
      </G>
      <G transform="translate(52,6) scale(0.85)">
        <Path d="M20 4 L24.5 14.5 L36 15.5 L27.3 23 L30 34 L20 28 L10 34 L12.7 23 L4 15.5 L15.5 14.5 Z" fill={YELLOW} stroke={INK} strokeWidth={2.9} strokeLinejoin="round" />
      </G>
      <G transform="translate(100,0) scale(0.46)">
        <Path d="M24 40 C10 28 12 10 26 12 C36 14 40 28 38 40 Z" fill={CREAM} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <Path d="M76 40 C90 28 88 10 74 12 C64 14 60 28 62 40 Z" fill={CREAM} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <Path d="M50 24 C78 22 92 42 90 62 C88 82 70 92 50 92 C30 92 12 82 10 62 C8 42 22 22 50 24 Z" fill={CREAM} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <Ellipse cx="24" cy="66" rx="8.5" ry="6" fill={BLUSH} />
        <Ellipse cx="76" cy="66" rx="8.5" ry="6" fill={BLUSH} />
        <Circle cx="34" cy="54" r="5" fill={INK} />
        <Circle cx="66" cy="54" r="5" fill={INK} />
      </G>
      <G transform="translate(152,6) scale(0.85)">
        <Path d="M20 4 L24.5 14.5 L36 15.5 L27.3 23 L30 34 L20 28 L10 34 L12.7 23 L4 15.5 L15.5 14.5 Z" fill={YELLOW} stroke={INK} strokeWidth={2.9} strokeLinejoin="round" />
      </G>
      <G transform="translate(208,6) scale(0.85)">
        <Path d="M20 36 C8 30 5 20 8 14 C12 10 28 10 32 14 C35 20 32 30 20 36 Z" fill={RED} stroke={INK} strokeWidth={2.9} strokeLinejoin="round" />
        <Path d="M9 13 C13 7 18 10 20 12 C22 10 27 7 31 13 C26 14 14 14 9 13 Z" fill={LEAF} stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
      </G>
    </Svg>
  );
}
