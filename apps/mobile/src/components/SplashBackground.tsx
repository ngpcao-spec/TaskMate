import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/**
 * Illustration de l'écran de démarrage (maquette) : ciel d'aube, soleil, montagnes et deux enfants vus de dos.
 * Placeholder SVG généré — à remplacer par l'illustration finale (HUMAN_TODO « assets »).
 */
export function SplashBackground() {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0A3C8F" />
          <Stop offset="0.45" stopColor="#2B6FD1" />
          <Stop offset="0.72" stopColor="#F2A65A" />
          <Stop offset="1" stopColor="#F7D08A" />
        </LinearGradient>
        <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0A2A66" stopOpacity="0.55" />
          <Stop offset="0.5" stopColor="#0A2A66" stopOpacity="0" />
          <Stop offset="1" stopColor="#0A2A66" stopOpacity="0.35" />
        </LinearGradient>
      </Defs>
      <Rect width="390" height="844" fill="url(#sky)" />
      <Circle cx="195" cy="470" r="90" fill="#FFE9B0" opacity="0.55" />
      <Circle cx="195" cy="470" r="46" fill="#FFF3CF" opacity="0.9" />
      <Path d="M0 520 L70 440 L130 500 L200 410 L270 490 L330 430 L390 500 L390 844 L0 844 Z" fill="#2A4F9C" opacity="0.75" />
      <Path d="M0 575 L90 500 L160 560 L240 490 L320 560 L390 520 L390 844 L0 844 Z" fill="#1B3A7A" />
      <Rect width="390" height="844" fill="url(#shade)" />
      {/* enfants vus de dos (dessinés après l'ombrage pour rester lisibles) */}
      <Circle cx="140" cy="610" r="24" fill="#101C36" />
      <Path d="M92 720 C92 650 188 650 188 720 L188 844 L92 844 Z" fill="#1A3566" />
      <Rect x="160" y="672" width="34" height="86" rx="12" fill="#101C36" />
      <Circle cx="250" cy="650" r="21" fill="#101C36" />
      <Path d="M208 746 C208 686 292 686 292 746 L292 844 L208 844 Z" fill="#2A5593" />
      <Rect x="272" y="702" width="30" height="74" rx="11" fill="#101C36" />

    </Svg>
  );
}
