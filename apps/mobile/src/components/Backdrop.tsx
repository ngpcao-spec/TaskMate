import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { Checker } from '@/components/decor/art';
import { STARFIELD } from '@/components/decor/art-cosmos';
import { colors, decor } from '@/theme/tokens';
import { Gradient } from './Gradient';

/** Fond d'écran du thème : dégradé acier bleuté (verre givré), damier crème et bleu clair (kawaii), ciel nocturne étoilé (cosmos) ou vichy rose poudré (teddy). À placer en premier enfant d'un conteneur `flex: 1`. */
export function Backdrop() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (decor === 'none') return <Gradient from={colors.backgroundTop} to={colors.backgroundBottom} direction="d" />;
  if (decor === 'cosmos') {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Gradient from={colors.backgroundTop} to={colors.backgroundBottom} direction="d" />
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          {STARFIELD.map(([x, y, r]) => (
            <Circle key={`${x}-${y}`} cx={`${x * 100}%`} cy={`${y * 100}%`} r={r} fill="#F5F0E1" opacity={0.7} />
          ))}
        </Svg>
      </View>
    );
  }
  // kawaii : damier crème et bleu clair ; teddy : vichy rose poudré, très discret pour ne pas gêner la lecture
  const plaid = decor === 'teddy' ? { cream: '#E9D0C4', blue: '#DFC2B5' } : { cream: '#F7F1DD', blue: '#D3E2EC' };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} patternUnits="userSpaceOnUse" width="112" height="112">
            <Checker cream={plaid.cream} blue={plaid.blue} />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
