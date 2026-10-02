import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Card, Screen, Title } from '@/components/ui';
import { formatDayTitle, type CalendarLanguage } from '@/domain/calendar';
import { taskState } from '@/domain/task-state';
import { timeLabel } from '@/domain/task-time';
import { colors, typography } from '@/theme/tokens';
import type { TaskRow } from '@/types/models';

/** Détail d'une tâche en LECTURE SEULE (enfant : SPEC v4 §3.2 — note comprise, aucune édition). */
export function TaskDetail({ task }: { task: TaskRow }) {
  const { t, i18n } = useTranslation();
  const lang = (['vi', 'fr', 'en'].includes(i18n.language) ? i18n.language : 'vi') as CalendarLanguage;
  const label = timeLabel(task);
  const time =
    label.kind === 'range' ? `${label.start} – ${label.end}` : label.kind === 'deadline' ? t('taskForm.deadlineLabel', { time: label.end }) : t('taskForm.anytime');
  const state = taskState(task);
  return (
    <Screen>
      <Title>{task.title}</Title>
      <Card>
        <View style={styles.row}>
          <CategoryIcon category={task.category} />
          <Text style={typography.body}>{t(`category.${task.category}`)}</Text>
        </View>
        <Text style={styles.value}>{formatDayTitle(task.date, lang)}</Text>
        <Text style={typography.secondary}>{time}</Text>
        <Text style={styles.value}>{t('task.pointsLine', { points: task.points })}</Text>
        <Text accessibilityLabel={t(`task.state.${state}`)} style={styles.state}>
          {t(`task.state.${state}`)}
        </Text>
        {state === 'todo' && task.rejection_note ? <Text style={styles.rejection}>{t('task.rejectedLabel')}: {task.rejection_note}</Text> : null}
      </Card>
      {task.note ? (
        <Card>
          <Text style={typography.secondary}>{t('taskForm.note')}</Text>
          <Text style={typography.body}>{task.note}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { fontSize: 16, fontWeight: '600', color: colors.text },
  state: { fontSize: 14, fontWeight: '700', color: colors.primary },
  rejection: { color: colors.danger, fontSize: 14 },
});
