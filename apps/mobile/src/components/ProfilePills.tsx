import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ageFromBirthDate } from '@/domain/age';
import { colors, MIN_TARGET, radius } from '@/theme/tokens';
import type { ChildRow } from '@/types/models';

type Props = { profiles: ChildRow[]; selectedId: string | null; onSelect: (id: string) => void; today: string };

/**
 * Sélecteur d'enfant du PARENT (jamais rendu pour un enfant, D-052) : une puce par enfant avec son PRÉNOM, l'âge en second texte.
 * Aucun classement ni comparaison entre les enfants (ordre de création, mêmes tailles).
 */
export function ProfilePills({ profiles, selectedId, onSelect, today }: Props) {
  const { t } = useTranslation();
  return (
    <View accessibilityRole="tablist" style={styles.row}>
      {profiles.map((c) => {
        const active = c.id === selectedId;
        const age = t('common.yearsOld', { age: ageFromBirthDate(c.birth_date, today) });
        const color = c.color ?? colors.primary;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="tab"
            accessibilityLabel={`${c.name}, ${age}`}
            accessibilityState={{ selected: active }}
            aria-selected={active}
            onPress={() => onSelect(c.id)}
            style={[styles.pill, { backgroundColor: active ? color : `${color}26` }]}
          >
            <Text numberOfLines={1} style={[styles.name, { color: active ? '#fff' : color }]}>{c.name}</Text>
            <Text numberOfLines={1} style={[styles.age, { color: active ? '#fff' : color }]}>{age}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexGrow: 1, flexBasis: 100, minHeight: MIN_TARGET + 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700' },
  age: { fontSize: 12, fontWeight: '500', opacity: 0.9 },
});
