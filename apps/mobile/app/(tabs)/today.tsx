import { useRouter } from 'expo-router';
import { Bell, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fab } from '@/components/Fab';
import { ProfilePills } from '@/components/ProfilePills';
import { ProgressRing } from '@/components/ProgressRing';
import { TaskRow } from '@/components/TaskRow';
import { Card, centeredContent } from '@/components/ui';
import { timeInTz, todayInTz } from '@/domain/family-time';
import { taskPermissions } from '@/domain/permissions';
import { dayProgress } from '@/domain/progress';
import { isOverdue, sortTasks } from '@/domain/task-time';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useUnreadNotifications } from '@/hooks/useNotifications';
import { useNow } from '@/hooks/useNow';
import { useApprovalCounts } from '@/hooks/useApprovals';
import { usePendingTaskIds } from '@/hooks/useSyncStatus';
import { toggleVars, useDeleteTask, useRejectTask, useTasks, useToggleTask, useValidateTask, validateVars } from '@/hooks/useTasks';
import { colors, MIN_TARGET, radius, shadow, spacing, typography } from '@/theme/tokens';

export default function TodayScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const unread = useUnreadNotifications();
  const now = useNow();
  const tz = d?.me.family.timezone ?? 'Asia/Ho_Chi_Minh';
  const today = todayInTz(now, tz);
  const nowTime = timeInTz(now, tz);
  const tasksQuery = useTasks(d?.child?.id ?? null, today);
  const toggle = useToggleTask();
  const remove = useDeleteTask();
  const validate = useValidateTask();
  const reject = useRejectTask();
  const pendingIds = usePendingTaskIds();
  const isParent = d?.viewer.role === 'parent';
  const counts = useApprovalCounts(isParent);

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
      <ScrollView role="main" contentContainerStyle={[styles.content, centeredContent]}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: child.color ?? colors.primary }]} accessible accessibilityLabel={child.name}>
            <Text style={styles.avatarText}>{child.name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.flex}>
            <Text accessibilityRole="header" style={styles.greeting}>
              {t('today.greeting', { name: child.name })}
            </Text>
            <Text style={typography.secondary}>{t('today.encouragement')}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `${t('notifications.bell')}, ${t('notifications.unread', { count: unread })}` : t('notifications.bell')}
            onPress={() => router.push('/notifications')}
            style={styles.bell}
          >
            <Bell color={colors.text} />
            {unread > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {isParent && d.children.length > 1 ? <ProfilePills profiles={d.children} selectedId={child.id} onSelect={d.select} today={today} /> : null}

        {isParent && counts.tasks > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('home.tasksToValidate', { count: counts.tasks })} onPress={() => router.push('/approvals')} style={styles.bannerPending}>
            <Text style={styles.bannerPendingText}>{t('home.tasksToValidate', { count: counts.tasks })}</Text>
          </Pressable>
        ) : null}
        {isParent && counts.requests > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('home.toApprove', { count: counts.requests })} onPress={() => router.push('/approvals')} style={styles.banner}>
            <Text style={styles.bannerText}>{t('home.toApprove', { count: counts.requests })}</Text>
          </Pressable>
        ) : null}

        <Pressable accessibilityRole="button" accessibilityLabel={t('today.progress', { done: progress.done, total: progress.total })} onPress={() => router.push('/(tabs)/stats')}>
          <Card>
            <View style={styles.progressRow}>
              <ProgressRing ratio={progress.ratio} size={96} stroke={11} label={progress.total === 0 ? '—' : undefined} accessibilityLabel={t('today.progress', { done: progress.done, total: progress.total })} />
              <View style={styles.flex}>
                <Text style={typography.secondary}>{t('today.progressLabel')}</Text>
                <Text style={styles.progressCount}>
                  {progress.done}/{progress.total}
                </Text>
                <Text style={typography.secondary}>{t('today.progressUnit')}</Text>
              </View>
              <ChevronRight color={colors.textSecondary} />
            </View>
          </Card>
        </Pressable>

        <Text accessibilityRole="header" style={styles.listTitle}>
          {t('today.listTitle')}
        </Text>

        {tasksQuery.isPending ? (
          <ActivityIndicator color={colors.primary} />
        ) : tasks.length === 0 ? (
          <Text style={[typography.secondary, styles.empty]}>{t('today.empty')}</Text>
        ) : (
          <View style={styles.list}>
            {tasks.map((task, index) => {
              const perms = taskPermissions(d.viewer, task);
              const row = (
                <TaskRow
                  task={task}
                  overdue={isOverdue(task, today, nowTime)}
                  canToggle={perms.canToggle}
                  canOpen
                  canValidate={perms.canValidate}
                  pending={pendingIds.has(task.id)}
                  onToggle={() => toggle.mutate(toggleVars(task, task.completed_at === null, isParent))}
                  onOpen={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
                  onValidate={() => validate.mutate(validateVars(task))}
                  onReject={() => reject.mutate({ task })}
                />
              );
              const separated = index > 0 ? styles.separated : null;
              return perms.canDelete ? (
                <ReanimatedSwipeable
                  key={task.id}
                  overshootRight={false}
                  renderRightActions={() => (
                    <Pressable accessibilityRole="button" accessibilityLabel={t('taskForm.delete')} onPress={() => remove.mutate(task)} style={styles.deleteAction}>
                      <Text style={styles.deleteText}>{t('taskForm.deleteShort')}</Text>
                    </Pressable>
                  )}
                >
                  <View style={separated}>{row}</View>
                </ReanimatedSwipeable>
              ) : (
                <View key={task.id} style={separated}>
                  {row}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      {!isParent ? null : <Fab label={t('today.addTask')} onPress={() => router.push('/task/new')} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 96 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.text },
  bellBadge: { position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  bellBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bell: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  banner: { backgroundColor: colors.primaryTint, borderRadius: radius.card, paddingVertical: 10, paddingHorizontal: 14 },
  bannerText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  bannerPending: { backgroundColor: colors.warningTint, borderRadius: radius.card, paddingVertical: 10, paddingHorizontal: 14 },
  bannerPendingText: { color: '#B86E00', fontSize: 14, fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  progressCount: { fontSize: 34, fontWeight: '800', color: colors.text, lineHeight: 40 },
  listTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 4 },
  list: { backgroundColor: colors.card, borderRadius: radius.card, paddingHorizontal: 12, ...shadow },
  separated: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  empty: { textAlign: 'center', paddingVertical: spacing.lg },
  deleteAction: { backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center', width: 88 },
  deleteText: { color: '#fff', fontWeight: '600' },
});
