import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CategoryIcon } from '@/components/CategoryIcon';
import { categoryTint } from '@/domain/calendar';
import { timeLabel } from '@/domain/task-time';
import { CATEGORY_COLORS } from '@/theme/categories';
import { colors, MIN_TARGET, radius } from '@/theme/tokens';
import type { TaskRow } from '@/types/models';

type Props = { task: TaskRow; overdue: boolean; onPress?: () => void };

/** Carte colorée par catégorie (12 %), horaire + titre ; tâche faite atténuée (SPEC §3.3). */
export function CalendarCard({ task, overdue, onPress }: Props) {
  const { t } = useTranslation();
  const done = task.completed_at !== null;
  const label = timeLabel(task);
  const time =
    label.kind === 'range' ? `${label.start} – ${label.end}` : label.kind === 'deadline' ? t('taskForm.deadlineLabel', { time: label.end }) : t('taskForm.anytime');
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${task.title}, ${time}${done ? `, ${t('calendar.done')}` : ''}`}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.card, { backgroundColor: categoryTint(task.category), borderLeftColor: CATEGORY_COLORS[task.category] }, done && styles.done]}
    >
      <View style={styles.body}>
        <Text style={[styles.time, overdue && styles.overdue]}>{time}</Text>
        <Text numberOfLines={2} style={[styles.title, done && styles.titleDone]}>
          {task.title}
        </Text>
      </View>
      <CategoryIcon category={task.category} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TARGET + 16, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.card, borderLeftWidth: 4 },
  done: { opacity: 0.5 },
  body: { flex: 1, gap: 2 },
  time: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  overdue: { color: colors.danger },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  titleDone: { textDecorationLine: 'line-through' },
});
