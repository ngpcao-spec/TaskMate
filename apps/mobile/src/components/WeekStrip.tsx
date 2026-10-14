import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDayNumber, formatDayTitle, formatWeekdayLabel, type CalendarLanguage } from '@/domain/calendar';
import { colors, MIN_TARGET, radius, shadowSmall } from '@/theme/tokens';

type Props = { days: readonly string[]; selected: string; today: string; lang: CalendarLanguage; onSelect: (day: string) => void };

/** Bandeau semaine (maquette « Lịch ») : libellés T2…CN au-dessus, jour sélectionné dans un cercle bleu, aujourd'hui marqué. */
export function WeekStrip({ days, selected, today, lang, onSelect }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      {days.map((day) => {
        const active = day === selected;
        const isToday = day === today;
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={`${formatDayTitle(day, lang)}${isToday ? `, ${t('calendar.today')}` : ''}`}
            accessibilityState={{ selected: active }}
            aria-selected={active}
            onPress={() => onSelect(day)}
            style={styles.day}
          >
            <Text style={styles.weekday}>{formatWeekdayLabel(day, lang)}</Text>
            <View style={[styles.circle, active && styles.circleActive]}>
              <Text style={[styles.number, active && styles.numberActive, isToday && !active && styles.numberToday]}>{formatDayNumber(day)}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.glassBorder, paddingHorizontal: 4 },
  day: { flex: 1, minHeight: MIN_TARGET + 24, alignItems: 'center', justifyContent: 'center', gap: 6 },
  weekday: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  circleActive: { backgroundColor: colors.primary, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', ...shadowSmall },
  number: { fontSize: 15, fontWeight: '600', color: colors.text },
  numberActive: { color: '#fff', fontWeight: '700' },
  numberToday: { color: colors.accent, fontWeight: '800' },
});
