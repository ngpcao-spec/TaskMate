import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CategoryIcon } from '@/components/CategoryIcon';
import { timeLabel } from '@/domain/task-time';
import { colors, MIN_TARGET, radius, shadow } from '@/theme/tokens';
import type { TaskRow as Task } from '@/types/db';

type Props = {
  task: Task;
  overdue: boolean;
  canToggle: boolean;
  canEdit: boolean;
  pending?: boolean;
  onToggle: () => void;
  onOpen: () => void;
};

/** Ligne de tâche : case à cocher, titre, horaire, icône de catégorie (SPEC §3.2). */
export function TaskRow({ task, overdue, canToggle, canEdit, pending = false, onToggle, onOpen }: Props) {
  const { t } = useTranslation();
  const done = task.completed_at !== null;
  const label = timeLabel(task);
  const time =
    label.kind === 'range'
      ? `${label.start} – ${label.end}`
      : label.kind === 'deadline'
        ? t('taskForm.deadlineLabel', { time: label.end })
        : t('taskForm.anytime');

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={task.title}
        accessibilityState={{ checked: done, disabled: !canToggle }}
        disabled={!canToggle}
        onPress={onToggle}
        hitSlop={4}
        style={styles.checkHit}
      >
        <View style={[styles.box, done && styles.boxDone, !canToggle && styles.boxLocked]}>
          {done ? <Check size={16} color="#fff" /> : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${task.title}, ${time}`}
        disabled={!canEdit}
        onPress={onOpen}
        style={styles.body}
      >
        <Text numberOfLines={1} style={[styles.title, done && styles.titleDone]}>
          {task.title}
        </Text>
        <Text style={[styles.time, overdue && styles.overdue]}>
          {overdue ? `${t('today.overdue')} · ${time}` : time}
          {pending ? ' ⟳' : ''}
        </Text>
      </Pressable>
      <CategoryIcon category={task.category} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    paddingHorizontal: 12,
    minHeight: 64,
    ...shadow,
  },
  checkHit: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  boxDone: { backgroundColor: colors.primary },
  boxLocked: { borderColor: '#C8D2E0' },
  body: { flex: 1, minHeight: MIN_TARGET, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  titleDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  time: { fontSize: 13, color: colors.textSecondary },
  overdue: { color: colors.danger },
});
