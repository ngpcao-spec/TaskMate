import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CategoryIcon } from '@/components/CategoryIcon';
import { categoryTint } from '@/domain/calendar';
import { timeLabel } from '@/domain/task-time';
import { CATEGORY_COLORS } from '@/theme/categories';
import { GlassTile } from '@/components/GlassTile';
import { colors, MIN_TARGET, radius, shadow } from '@/theme/tokens';
import type { TaskRow } from '@/types/models';

type Props = { task: TaskRow; overdue: boolean; onPress?: () => void };

/** Carte colorée par catégorie (12 %), pastille d'icône à gauche, horaire puis titre ; tâche cochée atténuée (SPEC §3.3). */
export function CalendarCard({ task, overdue, onPress }: Props) {
  const { t } = useTranslation();
  const done = task.completed_at !== null;
  const label = timeLabel(task);
  const time =
    label.kind === 'range' ? `${label.start} - ${label.end}` : label.kind === 'deadline' ? t('taskForm.deadlineLabel', { time: label.end }) : t('taskForm.anytime');
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${task.title}, ${time}${done ? `, ${t('calendar.done')}` : ''}`}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.card, { backgroundColor: categoryTint(task.category) }, done && styles.done]}
    >
      <GlassTile size={46} tint={`${CATEGORY_COLORS[task.category]}33`}>
        <CategoryIcon category={task.category} size={22} />
      </GlassTile>
      <View style={styles.body}>
        <Text style={[styles.time, overdue && styles.overdue]}>{time}</Text>
        <Text numberOfLines={2} style={styles.title}>
          {task.title}
        </Text>
      </View>
      {done ? <Check size={18} color={colors.textSecondary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: MIN_TARGET + 24, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.card, borderWidth: 1, borderColor: colors.glassBorder, ...shadow },
  done: { opacity: 0.72 },
  body: { flex: 1, gap: 2 },
  time: { fontSize: 13, color: colors.textSecondary },
  overdue: { color: colors.danger },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
});
