import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { CalendarCard } from '@/components/CalendarCard';
import { Chip } from '@/components/Chip';
import { Screen, Title } from '@/components/ui';
import { formatDayTitle, type CalendarLanguage } from '@/domain/calendar';
import { timeInTz, todayInTz } from '@/domain/family-time';
import { taskPermissions } from '@/domain/permissions';
import { filterTasks, type TaskFilter } from '@/domain/task-filters';
import { isOverdue } from '@/domain/task-time';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useAllTasks } from '@/hooks/useTasks';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

const FILTERS: TaskFilter[] = ['upcoming', 'done', 'overdue'];

/** Danh sách việc : toutes les tâches du profil, filtres + recherche (SPEC §3.5). */
export default function TaskListScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const [filter, setFilter] = useState<TaskFilter>('upcoming');
  const [query, setQuery] = useState('');
  const tasks = useAllTasks(d?.child?.id ?? null);
  if (!d) return null;

  const lang = (['vi', 'fr', 'en'].includes(i18n.language) ? i18n.language : 'vi') as CalendarLanguage;
  const now = new Date();
  const today = todayInTz(now, d.me.family.timezone);
  const nowTime = timeInTz(now, d.me.family.timezone);
  const list = filterTasks(tasks.data ?? [], filter, query, today, nowTime);

  return (
    <Screen>
      <Title>{t('profile.tasks')}</Title>
      <View style={styles.chips}>
        {FILTERS.map((f) => (
          <Chip key={f} label={t(`taskList.${f}`)} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>
      <TextInput
        accessibilityLabel={t('taskList.search')}
        placeholder={t('taskList.search')}
        placeholderTextColor={colors.textSecondary}
        value={query}
        onChangeText={setQuery}
        style={styles.search}
      />
      {list.length === 0 ? <Text style={[typography.secondary, styles.empty]}>{t('taskList.empty')}</Text> : null}
      {list.map((task) => {
        const perms = taskPermissions(d.viewer, task);
        return (
          <View key={task.id} style={styles.item}>
            <Text style={styles.date}>{formatDayTitle(task.date, lang)}</Text>
            <CalendarCard
              task={task}
              overdue={isOverdue(task, today, nowTime)}
              onPress={perms.canEdit && !d.readOnly ? () => router.push({ pathname: '/task/[id]', params: { id: task.id } }) : undefined}
            />
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  search: { minHeight: MIN_TARGET, borderRadius: 12, borderWidth: 1, borderColor: '#DDE5F0', paddingHorizontal: 14, color: colors.text, backgroundColor: colors.card },
  empty: { textAlign: 'center', paddingVertical: 24 },
  item: { gap: 4 },
  date: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
});
