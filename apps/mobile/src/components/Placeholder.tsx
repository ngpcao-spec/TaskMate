import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/theme/tokens';

export function Placeholder({ title }: { title: string }) {
  return (
    <View style={styles.root}>
      <Text style={typography.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
