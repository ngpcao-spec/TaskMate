import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

/**
 * Illustrations du thème « cosmos » (SVG, contour bleu nuit). Ce sont des ILLUSTRATIONS : leurs couleurs sont celles du dessin, pas des jetons de
 * thème. Toutes décoratives (masquées aux lecteurs d'écran) ; à n'afficher que si `decor === 'cosmos'`.
 */
const INK = '#102338';
const YELLOW = '#FFD66B';
const CREAM = '#F5F0E1';
const W = 2.6;

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

const STAR = 'M20 4 L24.5 14.5 L36 15.5 L27.3 23 L30 34 L20 28 L10 34 L12.7 23 L4 15.5 L15.5 14.5 Z';

export function StarShape({ size = 26, fill = YELLOW }: { size?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" {...hidden}>
      <Path d={STAR} fill={fill} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
    </Svg>
  );
}

/** Planète à anneau. */
export function Planet({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="-6 -2 92 84" {...hidden}>
      <Path d="M8 52 C0 40 20 24 46 18 C66 14 80 18 76 28 C72 38 46 52 22 56 C14 57 10 56 8 52 Z" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
      <Path d="M8 52 C0 40 20 24 46 18 C66 14 80 18 76 28 C72 38 46 52 22 56 C14 57 10 56 8 52 Z" fill="none" stroke="#9CCFC6" strokeWidth={4.4} strokeLinecap="round" />
      <Circle cx="40" cy="40" r="20" fill="#F3A6A0" stroke={INK} strokeWidth={W} />
      <Path d="M24 34 Q40 28 56 36" stroke="#FBD59A" strokeWidth={4} fill="none" strokeLinecap="round" />
      <Path d="M23 46 Q38 52 57 44" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={3.4} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** Fusée. */
export function Rocket({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60" {...hidden}>
      <Path d="M22 44 L12 54 L24 50 Z M38 44 L48 54 L36 50 Z" fill="#F3A6A0" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <Path d="M30 6 C40 14 42 30 38 46 L22 46 C18 30 20 14 30 6 Z" fill={CREAM} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <Circle cx="30" cy="25" r="6" fill="#9CCFC6" stroke={INK} strokeWidth={W} />
      <Path d="M24 46 L30 58 L36 46 Z" fill={YELLOW} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
    </Svg>
  );
}

/** Lune « biscuit » pêche. */
export function MoonCookie({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60" {...hidden}>
      <Circle cx="30" cy="30" r="25" fill="#FBD59A" stroke={INK} strokeWidth={W} />
      <Circle cx="21" cy="22" r="5" fill="#F4B07A" />
      <Circle cx="40" cy="30" r="6.5" fill="#F4B07A" />
      <Circle cx="26" cy="41" r="4" fill="#F4B07A" />
    </Svg>
  );
}

/** Petit astronaute : casque blanc, visière bleu nuit, joues roses. `happy` : yeux souriants. */
export function Astronaut({ size = 76, happy = false }: { size?: number; happy?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" {...hidden}>
      <Rect x="40" y="82" width="20" height="10" rx="4" fill="#C9E8F7" stroke={INK} strokeWidth={W} />
      <Circle cx="50" cy="46" r="38" fill="#FFFFFF" stroke={INK} strokeWidth={W + 0.4} />
      <Path d="M20 30 Q30 14 50 12" stroke="#DCE8F2" strokeWidth={5} fill="none" strokeLinecap="round" />
      <Ellipse cx="50" cy="48" rx="28" ry="23" fill="#3D5E80" stroke={INK} strokeWidth={W} />
      <Ellipse cx="36" cy="38" rx="6" ry="3.4" fill="#FFFFFF" fillOpacity={0.45} transform="rotate(-25 36 38)" />
      {happy ? (
        <G stroke={CREAM} strokeWidth={3.2} strokeLinecap="round" fill="none">
          <Path d="M36 50 Q41 44 46 50" />
          <Path d="M54 50 Q59 44 64 50" />
        </G>
      ) : (
        <G fill={CREAM}>
          <Circle cx="41" cy="49" r="3.6" />
          <Circle cx="59" cy="49" r="3.6" />
        </G>
      )}
      <Ellipse cx="33" cy="58" rx="5" ry="3" fill="#F3A6A0" />
      <Ellipse cx="67" cy="58" rx="5" ry="3" fill="#F3A6A0" />
      <Path d="M45 58 Q50 63 55 58" stroke={CREAM} strokeWidth={3} strokeLinecap="round" fill="none" />
      <Circle cx="20" cy="46" r="5" fill="#F3A6A0" stroke={INK} strokeWidth={W} />
      <Circle cx="80" cy="46" r="5" fill="#F3A6A0" stroke={INK} strokeWidth={W} />
    </Svg>
  );
}

/** Ligne d'ornements du haut d'écran : étoile – lune – planète – fusée – étoile. */
export function CosmosOrnamentRow() {
  return (
    <Svg width={250} height={46} viewBox="0 0 250 46" {...hidden}>
      <G transform="translate(0,8) scale(0.72)">
        <Path d={STAR} fill={YELLOW} stroke={INK} strokeWidth={3.4} strokeLinejoin="round" />
      </G>
      <G transform="translate(36,2) scale(0.7)">
        <Circle cx="30" cy="30" r="25" fill="#FBD59A" stroke={INK} strokeWidth={3.4} />
        <Circle cx="21" cy="22" r="5" fill="#F4B07A" />
        <Circle cx="40" cy="30" r="6.5" fill="#F4B07A" />
      </G>
      <G transform="translate(88,0) scale(0.58)">
        <Circle cx="40" cy="40" r="20" fill="#F3A6A0" stroke={INK} strokeWidth={4.4} />
        <Path d="M8 52 C0 40 20 24 46 18 C66 14 80 18 76 28 C72 38 46 52 22 56 C14 57 10 56 8 52 Z" fill="none" stroke="#9CCFC6" strokeWidth={5} strokeLinecap="round" />
      </G>
      <G transform="translate(140,0) scale(0.72)">
        <Path d="M30 6 C40 14 42 30 38 46 L22 46 C18 30 20 14 30 6 Z" fill={CREAM} stroke={INK} strokeWidth={3.4} strokeLinejoin="round" />
        <Circle cx="30" cy="25" r="6" fill="#9CCFC6" stroke={INK} strokeWidth={3} />
        <Path d="M24 46 L30 58 L36 46 Z" fill={YELLOW} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      </G>
      <G transform="translate(200,8) scale(0.72)">
        <Path d={STAR} fill={YELLOW} stroke={INK} strokeWidth={3.4} strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

/** Étoiles de fond, positions fixes (aucun aléa : rendu identique à chaque affichage). */
export const STARFIELD: readonly (readonly [number, number, number])[] = [
  [0.08, 0.06, 1.6], [0.22, 0.14, 1.1], [0.37, 0.05, 1.4], [0.55, 0.11, 1], [0.71, 0.04, 1.7], [0.9, 0.12, 1.2],
  [0.14, 0.3, 1.2], [0.31, 0.38, 1.7], [0.48, 0.27, 1], [0.66, 0.34, 1.3], [0.84, 0.29, 1.1], [0.95, 0.42, 1.5],
  [0.06, 0.5, 1.5], [0.25, 0.58, 1], [0.42, 0.52, 1.3], [0.6, 0.6, 1.6], [0.78, 0.54, 1], [0.92, 0.63, 1.3],
  [0.12, 0.74, 1.1], [0.3, 0.82, 1.5], [0.5, 0.76, 1], [0.68, 0.86, 1.4], [0.86, 0.78, 1.1], [0.04, 0.93, 1.3], [0.58, 0.95, 1.1], [0.97, 0.92, 1.6],
];
