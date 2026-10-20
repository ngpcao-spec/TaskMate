import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, line, MIN_TARGET, radius } from '@/theme/tokens';

type Props = { items: { id: string; name: string }[]; value: string; onChange: (id: string) => void; label: string };

/** Onglets par enfant (étapes 3 et 5) : prénoms seulement, dans l'ordre de la famille — jamais de classement ni de comparaison. */
export function ChildTabs({ items, value, onChange, label }: Props) {
  if (items.length < 2) return null;
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.row}>
      {items.map((c) => {
        const selected = c.id === value;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="tab"
            accessibilityLabel={c.name}
            accessibilityState={{ selected }}
            aria-selected={selected}
            onPress={() => onChange(c.id)}
            style={[styles.tab, selected && styles.tabOn]}
          >
            <Text style={[styles.text, selected && styles.textOn]}>{c.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: { minHeight: MIN_TARGET, paddingHorizontal: 18, borderRadius: radius.pill, borderWidth: line.width, borderColor: colors.glassBorder, backgroundColor: colors.cardStrong, justifyContent: 'center' },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.ring },
  text: { fontSize: 14, fontWeight: '700', color: colors.text },
  textOn: { color: colors.onPrimary },
});
