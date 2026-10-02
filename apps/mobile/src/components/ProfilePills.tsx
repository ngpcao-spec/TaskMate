import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ageFromBirthDate } from '@/domain/age';
import { colors, MIN_TARGET, radius } from '@/theme/tokens';
import type { ChildRow } from '@/types/db';

type Props = { profiles: ChildRow[]; selectedId: string | null; onSelect: (id: string) => void; today: string };

/** Pills « 17 tuổi » / « 13 tuổi » : changement de profil affiché (SPEC §3.2). */
export function ProfilePills({ profiles, selectedId, onSelect, today }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      {profiles.map((c) => {
        const active = c.id === selectedId;
        const label = t('common.yearsOld', { age: ageFromBirthDate(c.birth_date, today) });
        return (
          <Pressable
            key={c.id}
            accessibilityRole="tab"
            accessibilityLabel={`${c.name}, ${label}`}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(c.id)}
            style={[styles.pill, active && { backgroundColor: c.color ?? colors.primary, borderColor: c.color ?? colors.primary }]}
          >
            <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  pill: {
    minHeight: MIN_TARGET,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: '#D5DFEC',
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  textActive: { color: '#fff' },
});
