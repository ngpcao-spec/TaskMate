import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Avatar } from '@/components/Avatar';
import type { ChildRow } from '@/types/models';
import { v2Colors, v2Radius, v2Shadow, v2Spacing, v2Text, V2_TOUCH } from '../theme';

/** Sélecteur d'enfant du parent (V2) : UN enfant affiché à la fois, dans l'ordre de la famille (jamais un classement). */
export function ChildPicker({ profiles: children, selectedId, onSelect }: { profiles: ChildRow[]; selectedId: string; onSelect: (id: string) => void }) {
  const { t } = useTranslation();
  if (children.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t('v2.parent.pickChild')}>
      {children.map((c) => {
        const on = c.id === selectedId;
        return (
          <Pressable key={c.id} accessibilityRole="radio" accessibilityLabel={c.name} accessibilityState={{ selected: on, checked: on }} aria-checked={on} onPress={() => onSelect(c.id)} style={[styles.pill, on ? styles.on : null]}>
            <Avatar childId={c.id} name={c.name} color={c.color} size={32} />
            <Text style={[v2Text.bodyBold, on ? styles.onText : null]}>{c.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: v2Spacing.sm, paddingVertical: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: v2Spacing.sm, minHeight: V2_TOUCH, paddingHorizontal: v2Spacing.md, borderRadius: v2Radius.pill, backgroundColor: v2Colors.card, ...v2Shadow },
  on: { backgroundColor: v2Colors.primary },
  onText: { color: v2Colors.onPrimary },
});
