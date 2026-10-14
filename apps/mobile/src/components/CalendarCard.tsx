import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CategoryIcon } from '@/components/CategoryIcon';
import { categoryTint } from '@/domain/calendar';
import { timeLabel } from '@/domain/task-time';
import { CATEGORY_COLORS } from '@/theme/categories';
import { GlassTile } from '@/components/GlassTile';
import { tint } from '@/theme/tint';
import { colors, hasDecor, MIN_TARGET, radius, shadow, line } from '@/theme/tokens';
import type { TaskRow } from '@/types/models';

type Props = { task: TaskRow; overdue: boolean; onPress?: () => void };

/**
 * Carte colorée par catégorie (12 %), pastille d'icône à gauche, horaire puis titre ; tâche cochée atténuée (SPEC §3.3).
 * Thèmes illustrés : teinte OPAQUE (le motif de fond ne doit pas transparaître) et atténuation du seul contenu.
 */
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
      style={[styles.card, { backgroundColor: hasDecor ? tint(CATEGORY_COLORS[task.category], done ? 0.12 : 0.2) : categoryTint(task.category) }, done && !hasDecor && styles.done]}
    >
      <View style={[styles.inner, done && hasDecor && styles.done]}>
        <GlassTile size={46} tint={tint(CATEGORY_COLORS[task.category], 0.2)}>
          <CategoryIcon category={task.category} size={22} />
        </GlassTile>
        <View style={styles.body}>
          <Text style={[styles.time, overdue && styles.overdue]}>{time}</Text>
          <Text numberOfLines={2} style={styles.title}>
            {task.title}
          </Text>
        </View>
        {done ? <Check size={18} color={colors.textSecondary} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: MIN_TARGET + 24, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center', borderRadius: radius.card, borderWidth: line.width, borderColor: colors.glassBorder, ...shadow },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  done: { opacity: 0.72 },
  body: { flex: 1, gap: 2 },
  time: { fontSize: 13, color: colors.textSecondary },
  overdue: { color: colors.danger },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
});
