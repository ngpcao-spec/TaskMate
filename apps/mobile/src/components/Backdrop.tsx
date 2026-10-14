import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { Checker } from '@/components/decor/art';
import { colors, hasDecor } from '@/theme/tokens';
import { Gradient } from './Gradient';

/** Fond d'écran du thème : dégradé acier bleuté (verre givré) ou damier crème et bleu clair (kawaii). À placer en premier enfant d'un conteneur `flex: 1`. */
export function Backdrop() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (!hasDecor) return <Gradient from={colors.backgroundTop} to={colors.backgroundBottom} direction="d" />;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} patternUnits="userSpaceOnUse" width="112" height="112">
            <Checker cream="#F7F1DD" blue="#D3E2EC" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
