import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

/**
 * Petites illustrations du thème « kawaii » (dessinées en SVG, contour noir épais comme la référence). Ce sont des ILLUSTRATIONS : leurs couleurs
 * sont celles du dessin, pas des jetons de thème. Toutes décoratives (masquées aux lecteurs d'écran) ; à n'afficher que si `hasDecor`.
 */
const INK = '#1E1E1E';
const W = 3;

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

export function Sparkle({ size = 28, fill = '#FBE3A0' }: { size?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" {...hidden}>
      <Circle cx="20" cy="20" r="18" fill="#FFFFFF" stroke={INK} strokeWidth={W} />
      <Path d="M20 7 C21.5 14 24 17 33 20 C24 23 21.5 26 20 33 C18.5 26 16 23 7 20 C16 17 18.5 14 20 7 Z" fill={fill} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
    </Svg>
  );
}

export function Heart({ size = 24, fill = '#F28B96' }: { size?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" {...hidden}>
      <Path d="M20 34 C6 24 5 12 13 9 C17 7.5 19.5 10 20 12.5 C20.5 10 23 7.5 27 9 C35 12 34 24 20 34 Z" fill={fill} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
    </Svg>
  );
}

export function Bone({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 0.5} viewBox="0 0 80 40" {...hidden}>
      <Path
        d="M18 12 C10 4 0 12 8 19 C0 26 10 36 18 28 L62 28 C70 36 80 26 72 19 C80 12 70 4 62 12 Z"
        fill="#FFFDF4"
        stroke={INK}
        strokeWidth={W}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function Bow({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 0.62} viewBox="0 0 100 62" {...hidden}>
      <Path d="M50 31 C40 8 8 6 6 22 C5 38 36 44 50 31 Z" fill="#F7C9C9" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <Path d="M50 31 C60 8 92 6 94 22 C95 38 64 44 50 31 Z" fill="#F7C9C9" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <Path d="M44 36 L38 58 L50 52 L62 58 L56 36 Z" fill="#FBE3A0" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <Path d="M50 24 C46 16 36 20 40 28 C42 32 48 35 50 38 C52 35 58 32 60 28 C64 20 54 16 50 24 Z" fill="#F28B96" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
    </Svg>
  );
}

/** Petit chien blanc (museau rond, deux oreilles, joues roses). `mood` : yeux ouverts ou fermés (content). */
export function DogFace({ size = 72, happy = false }: { size?: number; happy?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" {...hidden}>
      <Path d="M22 36 C14 20 20 8 34 14 C40 17 42 24 42 30 Z" fill="#FFFFFF" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <Path d="M78 36 C86 20 80 8 66 14 C60 17 58 24 58 30 Z" fill="#FFFFFF" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <Path d="M50 22 C78 20 92 40 90 62 C88 84 70 92 50 92 C30 92 12 84 10 62 C8 40 22 20 50 22 Z" fill="#FFFFFF" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <Ellipse cx="26" cy="64" rx="8" ry="5.5" fill="#F7C9C9" />
      <Ellipse cx="74" cy="64" rx="8" ry="5.5" fill="#F7C9C9" />
      {happy ? (
        <G stroke={INK} strokeWidth={3.2} strokeLinecap="round" fill="none">
          <Path d="M32 52 Q37 46 42 52" />
          <Path d="M58 52 Q63 46 68 52" />
        </G>
      ) : (
        <G fill={INK}>
          <Circle cx="36" cy="52" r="4.2" />
          <Circle cx="64" cy="52" r="4.2" />
        </G>
      )}
      <Ellipse cx="50" cy="62" rx="5.5" ry="4" fill={INK} />
      <Path d="M43 71 Q46.5 76 50 71 Q53.5 76 57 71" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/** Ligne d'ornements du haut d'écran : os – nœud à cœur – os. */
export function OrnamentRow() {
  return (
    <Svg width={220} height={44} viewBox="0 0 220 44" {...hidden}>
      <G transform="translate(0,6) scale(0.62)">
        <Path d="M18 12 C10 4 0 12 8 19 C0 26 10 36 18 28 L62 28 C70 36 80 26 72 19 C80 12 70 4 62 12 Z" fill="#FFFDF4" stroke={INK} strokeWidth={4.6} strokeLinejoin="round" />
      </G>
      <G transform="translate(78,0) scale(0.64)">
        <Path d="M50 31 C40 8 8 6 6 22 C5 38 36 44 50 31 Z" fill="#F7C9C9" stroke={INK} strokeWidth={4.6} strokeLinejoin="round" />
        <Path d="M50 31 C60 8 92 6 94 22 C95 38 64 44 50 31 Z" fill="#F7C9C9" stroke={INK} strokeWidth={4.6} strokeLinejoin="round" />
        <Path d="M50 24 C46 16 36 20 40 28 C42 32 48 35 50 38 C52 35 58 32 60 28 C64 20 54 16 50 24 Z" fill="#F28B96" stroke={INK} strokeWidth={4.2} strokeLinejoin="round" />
      </G>
      <G transform="translate(158,6) scale(0.62)">
        <Path d="M18 12 C10 4 0 12 8 19 C0 26 10 36 18 28 L62 28 C70 36 80 26 72 19 C80 12 70 4 62 12 Z" fill="#FFFDF4" stroke={INK} strokeWidth={4.6} strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

export function Checker({ cream, blue, cell = 56 }: { cream: string; blue: string; cell?: number }) {
  return (
    <>
      <Rect x="0" y="0" width={cell * 2} height={cell * 2} fill={cream} />
      <Rect x="0" y="0" width={cell} height={cell} fill={blue} />
      <Rect x={cell} y={cell} width={cell} height={cell} fill={blue} />
    </>
  );
}
