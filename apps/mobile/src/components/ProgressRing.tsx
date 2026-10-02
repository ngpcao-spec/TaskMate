import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/theme/tokens';

type Props = { ratio: number; size?: number; stroke?: number; label?: string; sublabel?: string; color?: string; accessibilityLabel?: string };

/** Anneau de progression (SVG maison, SPEC §6). `label` = texte central (ex. « 60% » ou « — »). */
export function ProgressRing({ ratio, size = 72, stroke = 8, label, sublabel, color = colors.primary, accessibilityLabel }: Props) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(ratio, 0), 1);
  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#E4ECF7" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {label ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={styles.label}>{label}</Text>
          {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 22, fontWeight: '800', color: colors.text },
  sublabel: { fontSize: 12, color: colors.textSecondary },
});
