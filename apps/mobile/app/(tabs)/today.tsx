import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fab } from '@/components/Fab';
import { ProfilePills } from '@/components/ProfilePills';
import { ProgressRing } from '@/components/ProgressRing';
import { TaskRow } from '@/components/TaskRow';
import { Card } from '@/components/ui';
import { timeInTz, todayInTz } from '@/domain/family-time';
import { taskPermissions } from '@/domain/permissions';
import { dayProgress } from '@/domain/progress';
import { isOverdue, sortTasks } from '@/domain/task-time';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useNow } from '@/hooks/useNow';
import { useRequests } from '@/hooks/usePoints';
import { usePendingTaskIds } from '@/hooks/useSyncStatus';
import { toggleVars, useDeleteTask, useTasks, useToggleTask } from '@/hooks/useTasks';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function TodayScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const now = useNow();
  const tz = d?.me.family.timezone ?? 'Asia/Ho_Chi_Minh';
  const today = todayInTz(now, tz);
  const nowTime = timeInTz(now, tz);
  const tasksQuery = useTasks(d?.child?.id ?? null, today);
  const toggle = useToggleTask();
  const remove = useDeleteTask();
  const pendingIds = usePendingTaskIds();
  const isParent = d?.viewer.role === 'parent';
  const requests = useRequests(null, isParent);
  const toApprove = isParent ? (requests.data ?? []).filter((r) => r.status === 'pending' && new Date(r.expires_at) > now).length : 0;

  if (!d || !d.child) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const tasks = sortTasks(tasksQuery.data ?? []);
  const progress = dayProgress(tasks);
  const child = d.child;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: child.color ?? colors.primary }]} accessible accessibilityLabel={child.name}>
            <Text style={styles.avatarText}>{child.name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.flex}>
            <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
              {t('today.greeting', { name: child.name })}
            </Text>
            <Text style={typography.secondary}>{t('today.encouragement')}</Text>
          </View>
        </View>

        {d.children.length > 1 ? <ProfilePills profiles={d.children} selectedId={child.id} onSelect={d.select} today={today} /> : null}

        {toApprove > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('home.toApprove', { count: toApprove })} onPress={() => router.push('/more/points')} style={styles.banner}>
            <Text style={styles.bannerText}>{t('home.toApprove', { count: toApprove })}</Text>
          </Pressable>
        ) : null}

        {d.readOnly ? (
          <View accessible accessibilityRole="text" style={styles.banner}>
            <Text style={styles.bannerText}>{t('today.readOnlyBanner', { name: child.name })}</Text>
          </View>
        ) : null}

        <Pressable accessibilityRole="button" accessibilityLabel={t('today.progress', { done: progress.done, total: progress.total })} onPress={() => router.push('/(tabs)/stats')}>
          <Card>
            <View style={styles.progressRow}>
              <ProgressRing
                ratio={progress.ratio}
                label={progress.total === 0 ? '—' : `${Math.round(progress.ratio * 100)}%`}
                accessibilityLabel={t('today.progress', { done: progress.done, total: progress.total })}
              />
              <Text style={[typography.body, styles.flex, { color: colors.text }]}>
                {t('today.progress', { done: progress.done, total: progress.total })}
              </Text>
            </View>
          </Card>
        </Pressable>

        <Text accessibilityRole="header" style={[typography.title, styles.listTitle]}>
          {t('today.listTitle')}
        </Text>

        {tasksQuery.isPending ? (
          <ActivityIndicator color={colors.primary} />
        ) : tasks.length === 0 ? (
          <Text style={[typography.secondary, styles.empty]}>{t('today.empty')}</Text>
        ) : (
          <View style={styles.list}>
            {tasks.map((task) => {
              const perms = taskPermissions(d.viewer, task);
              const row = (
                <TaskRow
                  task={task}
                  overdue={isOverdue(task, today, nowTime)}
                  canToggle={perms.canToggle && !d.readOnly}
                  canEdit={perms.canEdit && !d.readOnly}
                  pending={pendingIds.has(task.id)}
                  onToggle={() => toggle.mutate(toggleVars(task, task.completed_at === null))}
                  onOpen={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
                />
              );
              return perms.canDelete && !d.readOnly ? (
                <ReanimatedSwipeable
                  key={task.id}
                  overshootRight={false}
                  renderRightActions={() => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('taskForm.delete')}
                      onPress={() => remove.mutate(task)}
                      style={styles.deleteAction}
                    >
                      <Text style={styles.deleteText}>{t('taskForm.deleteShort')}</Text>
                    </Pressable>
                  )}
                >
                  {row}
                </ReanimatedSwipeable>
              ) : (
                <View key={task.id}>{row}</View>
              );
            })}
          </View>
        )}
      </View>
      {d.readOnly ? null : <Fab label={t('today.addTask')} onPress={() => router.push('/task/new')} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  banner: { backgroundColor: '#E8F1FE', borderRadius: radius.card, paddingVertical: 10, paddingHorizontal: 14 },
  bannerText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  listTitle: { color: colors.text },
  list: { gap: 10 },
  empty: { textAlign: 'center', paddingVertical: spacing.lg },
  deleteAction: { backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center', width: 88, marginLeft: 8, borderRadius: radius.card },
  deleteText: { color: '#fff', fontWeight: '600' },
});
