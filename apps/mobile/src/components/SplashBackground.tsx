import { StyleSheet, View } from 'react-native';
import { Backdrop } from '@/components/Backdrop';
import { Bow, DogFace } from '@/components/decor/art';
import { Astronaut, MoonCookie, Planet, Rocket, StarShape } from '@/components/decor/art-cosmos';
import { Duckling, Flower, Paw, TeddyFace } from '@/components/decor/art-teddy';
import { decor } from '@/theme/tokens';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/**
 * Illustration de l'écran de démarrage (maquette) : ciel acier givré, lune pâle, montagnes et deux enfants vus de dos.
 * Placeholder SVG généré — à remplacer par l'illustration finale (HUMAN_TODO « assets »).
 */
export function SplashBackground() {
  if (decor === 'cosmos') {
    return (
      <View style={StyleSheet.absoluteFill}>
        <Backdrop />
        <View style={[styles.float, { top: 90, left: 36 }]}>
          <MoonCookie size={70} />
        </View>
        <View style={[styles.float, { top: 330, right: 24 }]}>
          <Planet size={88} />
        </View>
        <View style={[styles.float, { top: 60, right: 120 }]}>
          <StarShape size={26} />
        </View>
        <View style={[styles.float, { top: 250, left: 70 }]}>
          <StarShape size={20} />
        </View>
        <View style={styles.dogs}>
          <Astronaut size={150} />
          <View style={styles.bow}>
            <Rocket size={64} />
          </View>
          <Astronaut size={116} happy />
        </View>
      </View>
    );
  }
  if (decor === 'teddy') {
    return (
      <View style={StyleSheet.absoluteFill}>
        <Backdrop />
        <View style={[styles.float, { top: 96, left: 30 }]}>
          <Flower size={56} />
        </View>
        <View style={[styles.float, { top: 150, right: 36 }]}>
          <Paw size={48} />
        </View>
        <View style={[styles.float, { top: 300, left: 60 }]}>
          <Flower size={38} petal="#F0AAB0" />
        </View>
        <View style={styles.dogs}>
          <TeddyFace size={150} />
          <View style={styles.bow}>
            <Duckling size={64} />
          </View>
          <TeddyFace size={116} happy />
        </View>
      </View>
    );
  }
  if (decor === 'kawaii') {
    return (
      <View style={StyleSheet.absoluteFill}>
        <Backdrop />
        <View style={styles.dogs}>
          <DogFace size={150} />
          <View style={styles.bow}>
            <Bow size={74} />
          </View>
          <DogFace size={116} happy />
        </View>
      </View>
    );
  }
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#C5D5E0" />
          <Stop offset="0.45" stopColor="#9DB4C6" />
          <Stop offset="0.72" stopColor="#6E88A2" />
          <Stop offset="1" stopColor="#4A6580" />
        </LinearGradient>
        <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1E3145" stopOpacity="0.25" />
          <Stop offset="0.5" stopColor="#0A2A66" stopOpacity="0" />
          <Stop offset="1" stopColor="#1E3145" stopOpacity="0.45" />
        </LinearGradient>
      </Defs>
      <Rect width="390" height="844" fill="url(#sky)" />
      <Circle cx="195" cy="470" r="90" fill="#FFFFFF" opacity="0.55" />
      <Circle cx="195" cy="470" r="46" fill="#F2F8FC" opacity="0.9" />
      <Path d="M0 520 L70 440 L130 500 L200 410 L270 490 L330 430 L390 500 L390 844 L0 844 Z" fill="#5B7893" opacity="0.75" />
      <Path d="M0 575 L90 500 L160 560 L240 490 L320 560 L390 520 L390 844 L0 844 Z" fill="#3B536C" />
      <Rect width="390" height="844" fill="url(#shade)" />
      {/* enfants vus de dos (dessinés après l'ombrage pour rester lisibles) */}
      <Circle cx="140" cy="610" r="24" fill="#1E3145" />
      <Path d="M92 720 C92 650 188 650 188 720 L188 844 L92 844 Z" fill="#2C455D" />
      <Rect x="160" y="672" width="34" height="86" rx="12" fill="#1E3145" />
      <Circle cx="250" cy="650" r="21" fill="#1E3145" />
      <Path d="M208 746 C208 686 292 686 292 746 L292 844 L208 844 Z" fill="#3A5670" />
      <Rect x="272" y="702" width="30" height="74" rx="11" fill="#1E3145" />

    </Svg>
  );
}

const styles = StyleSheet.create({
  dogs: { position: 'absolute', left: 0, right: 0, bottom: 150, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  bow: { position: 'absolute', top: -34 },
  float: { position: 'absolute' },
});
