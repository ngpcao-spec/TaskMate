import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDayNumber, formatDayTitle, formatWeekdayLabel, type CalendarLanguage } from '@/domain/calendar';
import { colors, MIN_TARGET, radius } from '@/theme/tokens';

type Props = { days: readonly string[]; selected: string; today: string; lang: CalendarLanguage; onSelect: (day: string) => void };

/** Bandeau semaine (lundi → dimanche) : jour sélectionné surligné, aujourd'hui marqué. */
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
            onPress={() => onSelect(day)}
            style={[styles.day, active && styles.dayActive]}
          >
            <Text style={[styles.weekday, active && styles.textActive]}>{formatWeekdayLabel(day, lang)}</Text>
            <Text style={[styles.number, active && styles.textActive]}>{formatDayNumber(day)}</Text>
            <View style={[styles.dot, isToday && (active ? styles.dotActive : styles.dotToday)]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  day: { flex: 1, minHeight: MIN_TARGET + 20, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: colors.card },
  dayActive: { backgroundColor: colors.primary },
  weekday: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  number: { fontSize: 17, fontWeight: '700', color: colors.text },
  textActive: { color: '#fff' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  dotToday: { backgroundColor: colors.primary },
  dotActive: { backgroundColor: '#fff' },
});
