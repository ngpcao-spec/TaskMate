import { StyleSheet, Text, View } from 'react-native';
import { v2Colors, v2Radius, v2Shadow, v2Spacing, v2Text } from '../theme';

/** Bulle de parole du panda posée sur le décor (D-107) : crème opaque, petite queue vers le bas, lue par les lecteurs d'écran. */
export function SpeechBubble({ text, testID }: { text: string; testID?: string }) {
  return (
    <View style={styles.wrap} pointerEvents="none" testID={testID}>
      <View style={styles.bubble} accessibilityLiveRegion="polite">
        <Text style={styles.text} numberOfLines={3}>
          {text}
        </Text>
      </View>
      <View style={styles.tail} importantForAccessibility="no" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', maxWidth: 300, alignSelf: 'center' },
  bubble: { backgroundColor: v2Colors.card, borderRadius: v2Radius.control, paddingHorizontal: v2Spacing.md, paddingVertical: v2Spacing.sm, ...v2Shadow },
  text: { ...v2Text.bodyBold, textAlign: 'center' },
  tail: { width: 14, height: 14, backgroundColor: v2Colors.card, transform: [{ rotate: '45deg' }], marginTop: -8 },
});
