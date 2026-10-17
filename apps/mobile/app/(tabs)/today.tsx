import { useRouter } from 'expo-router';
import { Bell, ChevronRight, CircleCheck, Hourglass, ListTodo } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeEdgesFor, useHasBottomBar } from '@/components/TabInset';
import { Backdrop } from '@/components/Backdrop';
import { Avatar } from '@/components/Avatar';
import { Mascot, TopOrnament } from '@/components/decor/Decor';
import { Fab } from '@/components/Fab';
import { ProfilePills } from '@/components/ProfilePills';
import { ProgressRing } from '@/components/ProgressRing';
import { WeeklyQuizSection } from '@/components/quiz/WeeklyQuizSection';
import { RoundButton } from '@/components/RoundButton';
import { StatTile } from '@/components/StatTile';
import { TaskRow } from '@/components/TaskRow';
import { centeredContent, NavyPanel, SectionTitle } from '@/components/ui';
import { timeInTz, todayInTz } from '@/domain/family-time';
import { taskPermissions } from '@/domain/permissions';
import { taskState } from '@/domain/task-state';
import { dayProgress } from '@/domain/progress';
import { isOverdue, sortTasks } from '@/domain/task-time';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useUnreadNotifications } from '@/hooks/useNotifications';
import { useNow } from '@/hooks/useNow';
import { useApprovalCounts } from '@/hooks/useApprovals';
import { useWeeklyQuizzes } from '@/hooks/useWeeklyQuizzes';
import { usePendingTaskIds } from '@/hooks/useSyncStatus';
import { toggleVars, useDeleteTask, useRejectTask, useTasks, useToggleTask, useValidateTask, validateVars } from '@/hooks/useTasks';
import { colors, glass, hasDecor, radius, spacing, typography, line } from '@/theme/tokens';

export default function TodayScreen() {
  const edges = safeEdgesFor(useHasBottomBar());
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
  const weekly = useWeeklyQuizzes(today);

  if (!d || !d.child) {
    return (
      <SafeAreaView style={styles.screen} edges={edges}>
        <Backdrop />
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  const tasks = sortTasks(tasksQuery.data ?? []);
  const progress = dayProgress(tasks);
  const states = tasks.map((task) => taskState(task));
  const validatedCount = states.filter((x) => x === 'validated').length;
  const pendingCount = states.filter((x) => x === 'pending').length;
  const todoCount = states.filter((x) => x === 'todo').length;
  const child = d.child;

  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <Backdrop />
      <ScrollView role="main" contentContainerStyle={[styles.content, centeredContent]}>
        {hasDecor ? (
          <View style={styles.ornament}>
            <TopOrnament />
          </View>
        ) : null}
        <View style={styles.header}>
          <Avatar childId={child.id} name={child.name} color={child.color} size={52} />
          <View style={styles.flex}>
            <Text accessibilityRole="header" style={styles.greeting}>
              {t('today.greeting', { name: child.name })}
            </Text>
            <Text style={typography.secondary}>{t('today.encouragement')}</Text>
          </View>
          <RoundButton
            label={unread > 0 ? `${t('notifications.bell')}, ${t('notifications.unread', { count: unread })}` : t('notifications.bell')}
            onPress={() => router.push('/notifications')}
          >
            <Bell color={colors.text} />
            {unread > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            ) : null}
          </RoundButton>
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

        <WeeklyQuizSection groups={weekly.groups} role={isParent ? 'parent' : 'child'} onSelectChild={d.select} />

        <Pressable accessibilityRole="button" accessibilityLabel={t('today.progress', { done: progress.done, total: progress.total })} onPress={() => router.push('/(tabs)/stats')}>
          <NavyPanel>
            <View style={styles.progressRow}>
              <ProgressRing
                ratio={progress.ratio}
                size={104}
                stroke={12}
                color={colors.ringOnNavy}
                trackColor={colors.trackOnNavy}
                textColor={colors.onNavy}
                label={progress.total === 0 ? '—' : undefined}
                accessibilityLabel={t('today.progress', { done: progress.done, total: progress.total })}
              />
              <View style={styles.flex}>
                <Text style={styles.bannerLabel}>{t('today.progressLabel')}</Text>
                <Text style={styles.progressCount}>
                  {progress.done}/{progress.total}
                </Text>
                <Text style={styles.bannerLabel}>{t('today.progressUnit')}</Text>
              </View>
              {hasDecor ? <Mascot size={76} happy={progress.total > 0 && progress.ratio >= 0.5} /> : <ChevronRight color={colors.onNavySecondary} />}
            </View>
          </NavyPanel>
        </Pressable>

        <View style={styles.tiles}>
          <StatTile tint={colors.tileTeal} icon={<CircleCheck color={colors.accent} size={22} />} label={t('today.tileDone')} value={String(validatedCount)} />
          <StatTile tint={colors.tileIce} icon={<Hourglass color={colors.accent} size={22} />} label={t('today.tilePending')} value={String(pendingCount)} />
          <StatTile tint={colors.tileViolet} icon={<ListTodo color={colors.accent} size={22} />} label={t('today.tileTodo')} value={String(todoCount)} />
        </View>

        <SectionTitle>{t('today.listTitle')}</SectionTitle>

        {tasksQuery.isPending ? (
          <ActivityIndicator color={colors.primary} />
        ) : tasks.length === 0 ? (
          <View style={styles.emptyBox}>
            {hasDecor ? <Mascot size={88} happy /> : null}
            <Text style={[typography.secondary, styles.empty]}>{t('today.empty')}</Text>
          </View>
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
  ornament: { alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.text },
  bellBadge: { position: 'absolute', top: 0, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  bellBadgeText: { color: colors.onSolid, fontSize: 11, fontWeight: '700' },
  banner: { ...glass, borderRadius: radius.control, paddingVertical: 12, paddingHorizontal: 16 },
  bannerText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  bannerPending: { backgroundColor: colors.warningTint, borderWidth: line.width, borderColor: colors.glassBorder, borderRadius: radius.control, paddingVertical: 12, paddingHorizontal: 16 },
  bannerPendingText: { color: colors.warning, fontSize: 14, fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  bannerLabel: { fontSize: 13, color: colors.onNavySecondary },
  progressCount: { fontSize: 36, fontWeight: '800', color: colors.onNavy, lineHeight: 42 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  list: { ...glass, borderRadius: radius.card, paddingHorizontal: 14 },
  separated: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  emptyBox: { alignItems: 'center', gap: 4, paddingVertical: spacing.md },
  empty: { textAlign: 'center' },
  deleteAction: { backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center', width: 88 },
  deleteText: { color: colors.onSolid, fontWeight: '600' },
});
