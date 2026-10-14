import { Plus } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { colors, shadow } from '@/theme/tokens';

export function Fab({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}>
      <Plus color={colors.onPrimary} size={28} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.ring,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
});
