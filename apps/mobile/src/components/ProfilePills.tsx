import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ageFromBirthDate } from '@/domain/age';
import { childColor } from '@/theme/childColor';
import { colors, MIN_TARGET, radius, shadowSmall } from '@/theme/tokens';
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
        const color = childColor(c.color);
        return (
          <Pressable
            key={c.id}
            accessibilityRole="tab"
            accessibilityLabel={`${c.name}, ${age}`}
            accessibilityState={{ selected: active }}
            aria-selected={active}
            onPress={() => onSelect(c.id)}
            style={[styles.pill, active && styles.pillActive]}
          >
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text numberOfLines={1} style={[styles.name, active && styles.onNavy]}>{c.name}</Text>
            <Text numberOfLines={1} style={[styles.age, active && styles.onNavy]}>{age}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexGrow: 1, flexBasis: 100, minHeight: MIN_TARGET + 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardStrong, borderWidth: 1, borderColor: colors.glassBorder, ...shadowSmall },
  pillActive: { backgroundColor: colors.navy, borderColor: 'rgba(255,255,255,0.25)' },
  dot: { position: 'absolute', left: 14, top: '50%', marginTop: -5, width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  age: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  onNavy: { color: colors.onNavy },
});
