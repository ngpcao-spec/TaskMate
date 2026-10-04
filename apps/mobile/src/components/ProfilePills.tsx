import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ageFromBirthDate } from '@/domain/age';
import { colors, MIN_TARGET, radius } from '@/theme/tokens';
import type { ChildRow } from '@/types/models';

type Props = { profiles: ChildRow[]; selectedId: string | null; onSelect: (id: string) => void; today: string; /** « Minh (17 tuổi) » (objectifs, points) au lieu de « 17 tuổi » (accueil). */ showName?: boolean };

/** Pills « 17 tuổi » / « 13 tuổi » : changement de profil affiché (SPEC §3.2). */
export function ProfilePills({ profiles, selectedId, onSelect, today, showName = false }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      {profiles.map((c) => {
        const active = c.id === selectedId;
        const age = t('common.yearsOld', { age: ageFromBirthDate(c.birth_date, today) });
        const label = showName ? `${c.name} (${age})` : age;
        const color = c.color ?? colors.primary;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="tab"
            accessibilityLabel={showName ? label : `${c.name}, ${label}`}
            accessibilityState={{ selected: active }}
            aria-selected={active}
            onPress={() => onSelect(c.id)}
            style={[styles.pill, { backgroundColor: active ? color : `${color}26` }]}
          >
            <Text style={[styles.text, { color: active ? '#fff' : color }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  pill: { flex: 1, minHeight: MIN_TARGET, paddingHorizontal: 12, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 15, fontWeight: '600' },
});
