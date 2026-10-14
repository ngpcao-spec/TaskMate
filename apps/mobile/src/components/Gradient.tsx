import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type Props = {
  from: string;
  to: string;
  /** Direction : `v` = haut → bas, `h` = gauche → droite, `d` = diagonale haut-gauche → bas-droite. */
  direction?: 'v' | 'h' | 'd';
  style?: StyleProp<ViewStyle>;
};

/** Dégradé linéaire plein cadre (SVG : identique sur iOS, Android et web), posé SOUS le contenu, sans capter les touches. */
export function Gradient({ from, to, direction = 'v', style }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [x2, y2] = direction === 'h' ? ['1', '0'] : direction === 'd' ? ['1', '1'] : ['0', '1'];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
