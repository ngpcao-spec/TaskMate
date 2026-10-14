import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

/**
 * Illustrations du thème « teddy » (SVG : nounours chocolat, pattes, fleurs, canard). Ce sont des ILLUSTRATIONS : leurs couleurs sont celles du dessin, pas
 * des jetons de thème. Toutes décoratives (masquées aux lecteurs d'écran) ; à n'afficher que si `decor === 'teddy'`.
 */
const INK = '#4A2C27';
const FUR = '#7A4A3F';
const MUZZLE = '#D9A78F';
const CHEEK = '#F2A5AE';
const PAW_PINK = '#F0A5B0';
const BLUE = '#8394C8';
const YELLOW = '#FFD866';
const W = 2.6;

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

/** Tête d'ours en peluche. `happy` : yeux souriants. */
export function TeddyFace({ size = 76, happy = false }: { size?: number; happy?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" {...hidden}>
      <Circle cx="24" cy="26" r="14" fill={FUR} stroke={INK} strokeWidth={W} />
      <Circle cx="76" cy="26" r="14" fill={FUR} stroke={INK} strokeWidth={W} />
      <Circle cx="24" cy="26" r="6.5" fill={PAW_PINK} />
      <Circle cx="76" cy="26" r="6.5" fill={PAW_PINK} />
      <Path d="M50 20 C78 18 92 38 90 60 C88 82 70 92 50 92 C30 92 12 82 10 60 C8 38 22 18 50 20 Z" fill={FUR} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <Ellipse cx="50" cy="68" rx="19" ry="14" fill={MUZZLE} />
      <Ellipse cx="24" cy="64" rx="8" ry="5.5" fill={CHEEK} />
      <Ellipse cx="76" cy="64" rx="8" ry="5.5" fill={CHEEK} />
      {happy ? (
        <G stroke={INK} strokeWidth={3.2} strokeLinecap="round" fill="none">
          <Path d="M29 50 Q34 44 39 50" />
          <Path d="M61 50 Q66 44 71 50" />
        </G>
      ) : (
        <G fill={INK}>
          <Circle cx="34" cy="50" r="4.2" />
          <Circle cx="66" cy="50" r="4.2" />
        </G>
      )}
      <Ellipse cx="50" cy="61" rx="6.5" ry="4.6" fill={INK} />
      <Path d="M44 71 Q47 76 50 71 Q53 76 56 71" stroke={INK} strokeWidth={2.8} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/** Empreinte de patte (coussinet + quatre doigts). */
export function Paw({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" {...hidden}>
      <Ellipse cx="20" cy="26" rx="10" ry="8.5" fill={PAW_PINK} stroke={INK} strokeWidth={2.2} />
      <Ellipse cx="9" cy="16" rx="4.2" ry="5.2" fill={PAW_PINK} stroke={INK} strokeWidth={2.2} />
      <Ellipse cx="17" cy="9.5" rx="4.2" ry="5.2" fill={PAW_PINK} stroke={INK} strokeWidth={2.2} />
      <Ellipse cx="25" cy="9.5" rx="4.2" ry="5.2" fill={PAW_PINK} stroke={INK} strokeWidth={2.2} />
      <Ellipse cx="32" cy="16" rx="4.2" ry="5.2" fill={PAW_PINK} stroke={INK} strokeWidth={2.2} />
    </Svg>
  );
}

/** Fleur à cinq pétales. */
export function Flower({ size = 30, petal = BLUE }: { size?: number; petal?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" {...hidden}>
      {[0, 72, 144, 216, 288].map((angle) => (
        <Ellipse key={angle} cx="20" cy="9.5" rx="6.2" ry="8" fill={petal} stroke={INK} strokeWidth={2} transform={`rotate(${angle} 20 20)`} />
      ))}
      <Circle cx="20" cy="20" r="5.2" fill="#FFF3E6" stroke={INK} strokeWidth={2} />
    </Svg>
  );
}

/** Petit canard jaune. */
export function Duckling({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 50 50" {...hidden}>
      <Path d="M8 32 C8 44 40 46 44 32 C46 24 38 22 34 24 C34 14 28 8 22 10 C14 12 14 22 18 26 C12 24 8 26 8 32 Z" fill={YELLOW} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <Path d="M14 18 L5 20 L14 24 Z" fill="#F4A24D" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <Circle cx="21" cy="17" r="2" fill={INK} />
      <Path d="M26 34 Q34 36 38 30" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/** Ligne d'ornements du haut d'écran : patte – fleur – ourson – fleur – patte. */
export function TeddyOrnamentRow() {
  return (
    <Svg width={250} height={46} viewBox="0 0 250 46" {...hidden}>
      <G transform="translate(2,8) scale(0.8)">
        <Ellipse cx="20" cy="26" rx="10" ry="8.5" fill={PAW_PINK} stroke={INK} strokeWidth={2.8} />
        <Ellipse cx="9" cy="16" rx="4.2" ry="5.2" fill={PAW_PINK} stroke={INK} strokeWidth={2.8} />
        <Ellipse cx="17" cy="9.5" rx="4.2" ry="5.2" fill={PAW_PINK} stroke={INK} strokeWidth={2.8} />
        <Ellipse cx="25" cy="9.5" rx="4.2" ry="5.2" fill={PAW_PINK} stroke={INK} strokeWidth={2.8} />
        <Ellipse cx="32" cy="16" rx="4.2" ry="5.2" fill={PAW_PINK} stroke={INK} strokeWidth={2.8} />
      </G>
      <G transform="translate(52,6) scale(0.85)">
        {[0, 72, 144, 216, 288].map((angle) => (
          <Ellipse key={angle} cx="20" cy="9.5" rx="6.2" ry="8" fill={BLUE} stroke={INK} strokeWidth={2.4} transform={`rotate(${angle} 20 20)`} />
        ))}
        <Circle cx="20" cy="20" r="5.2" fill="#FFF3E6" stroke={INK} strokeWidth={2.4} />
      </G>
      <G transform="translate(100,0) scale(0.46)">
        <Circle cx="24" cy="26" r="14" fill={FUR} stroke={INK} strokeWidth={4.6} />
        <Circle cx="76" cy="26" r="14" fill={FUR} stroke={INK} strokeWidth={4.6} />
        <Path d="M50 20 C78 18 92 38 90 60 C88 82 70 92 50 92 C30 92 12 82 10 60 C8 38 22 18 50 20 Z" fill={FUR} stroke={INK} strokeWidth={4.6} strokeLinejoin="round" />
        <Ellipse cx="50" cy="68" rx="19" ry="14" fill={MUZZLE} />
        <Circle cx="34" cy="50" r="5" fill={INK} />
        <Circle cx="66" cy="50" r="5" fill={INK} />
        <Ellipse cx="50" cy="61" rx="6.5" ry="4.6" fill={INK} />
      </G>
      <G transform="translate(152,6) scale(0.85)">
        {[0, 72, 144, 216, 288].map((angle) => (
          <Ellipse key={angle} cx="20" cy="9.5" rx="6.2" ry="8" fill={PAW_PINK} stroke={INK} strokeWidth={2.4} transform={`rotate(${angle} 20 20)`} />
        ))}
        <Circle cx="20" cy="20" r="5.2" fill="#FFF3E6" stroke={INK} strokeWidth={2.4} />
      </G>
      <G transform="translate(208,8) scale(0.8)">
        <Ellipse cx="20" cy="26" rx="10" ry="8.5" fill={PAW_PINK} stroke={INK} strokeWidth={2.8} />
        <Ellipse cx="9" cy="16" rx="4.2" ry="5.2" fill={PAW_PINK} stroke={INK} strokeWidth={2.8} />
        <Ellipse cx="17" cy="9.5" rx="4.2" ry="5.2" fill={PAW_PINK} stroke={INK} strokeWidth={2.8} />
        <Ellipse cx="25" cy="9.5" rx="4.2" ry="5.2" fill={PAW_PINK} stroke={INK} strokeWidth={2.8} />
        <Ellipse cx="32" cy="16" rx="4.2" ry="5.2" fill={PAW_PINK} stroke={INK} strokeWidth={2.8} />
      </G>
    </Svg>
  );
}
