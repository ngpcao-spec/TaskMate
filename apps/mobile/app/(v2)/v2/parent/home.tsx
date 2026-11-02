import { useRouter } from 'expo-router';
import { Bell, CalendarDays } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { pandaStageImage } from '@/components/companion/pandaImages';
import { SetupCard } from '@/components/onboarding/SetupCard';
import { ValidateAttemptBar } from '@/components/quiz/ValidateAttemptBar';
import { groupByDaySection } from '@/domain/day-sections';
import { todayInTz } from '@/domain/family-time';
import { goalIconFor } from '@/domain/goal-icons';
import { taskPermissions } from '@/domain/permissions';
import { taskState } from '@/domain/task-state';
import { timeLabel } from '@/domain/task-time';
import { useCompanion } from '@/hooks/useCompanion';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useUnreadNotifications } from '@/hooks/useNotifications';
import { useNow } from '@/hooks/useNow';
import { toggleVars, usePendingTasks, useRejectTask, useTasks, useToggleTask, useValidateTask, validateVars } from '@/hooks/useTasks';
import { useWeeklyQuizzes } from '@/hooks/useWeeklyQuizzes';
import { ChildPicker } from '@/v2/components/ChildPicker';
import { GoalRow } from '@/v2/components/GoalRow';
import { GoalSection } from '@/v2/components/GoalSection';
import { V2Button } from '@/v2/components/V2Button';
import { V2Screen } from '@/v2/components/V2Screen';
import { goalIconImage } from '@/v2/images';
import { v2Card, v2Colors, v2Radius, v2Spacing, v2Text, V2_TOUCH } from '@/v2/theme';

/**
 * Hôm nay du parent (V2, D-106) : UN enfant à la fois (sélecteur en haut, jamais deux enfants côte à côte ni de classement), d'abord « À valider »
 * (tâches cochées, quiz envoyés : `validate_task`, `reject_task`, `ValidateAttemptBar`), puis la journée de l'enfant groupée comme côté enfant,
 * et le petit panda de l'enfant (sans chiffre d'énergie). Mêmes hooks et mutations que la V1.
 */
export default function V2ParentHome() {
  const { t } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const now = useNow();
  const unread = useUnreadNotifications();
  const tz = d?.me.family.timezone ?? 'Asia/Ho_Chi_Minh';
  const today = todayInTz(now, tz);
  const childId = d?.child?.id ?? null;
  const tasksQuery = useTasks(childId, today);
  const pending = usePendingTasks(true).data ?? [];
  const toggle = useToggleTask();
  const validate = useValidateTask();
  const reject = useRejectTask();
  const weekly = useWeeklyQuizzes(today, false);
  const companion = useCompanion(childId, !!childId).data;

  if (!d || !d.child) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={v2Colors.primary} />
      </View>
    );
  }
  const child = d.child;
  const toValidate = pending.filter((x) => x.child_id === child.id);
  const quizzes = weekly.groups.filter((g) => g.childId === child.id).flatMap((g) => g.items).filter((i) => i.state === 'waiting' && i.attemptId);
  const tasks = tasksQuery.data ?? [];
  const groups = groupByDaySection(tasks);

  return (
    <V2Screen
      title={t('v2.parent.title', { name: child.name })}
      testID="v2-parent-home"
      right={
        <View style={styles.top}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('v2.top.calendar')} onPress={() => router.push('/v2/parent/calendar')} style={styles.topBtn}>
            <CalendarDays size={22} color={v2Colors.onTopButton} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={unread > 0 ? t('v2.top.notificationsCount', { count: unread }) : t('v2.top.notifications')} onPress={() => router.push('/notifications')} style={styles.topBtn}>
            <Bell size={22} color={v2Colors.onTopButton} />
          </Pressable>
        </View>
      }
    >
      <SetupCard role="parent" />
      <ChildPicker profiles={d.children} selectedId={child.id} onSelect={d.select} />

      <View style={[v2Card, styles.childCard]}>
        {companion?.hasCompanion ? (
          <Image source={pandaStageImage(companion.stage, 'small', companion.variant)} style={styles.panda} resizeMode="contain" accessibilityRole="image" accessibilityLabel={t('v2.parent.pandaOf', { child: child.name, name: companion.name ?? '' })} />
        ) : null}
        <Text style={[v2Text.heading, styles.flex]}>{child.name}</Text>
      </View>

      <Text accessibilityRole="header" style={v2Text.heading}>
        {t('v2.parent.toValidate')}
      </Text>
      {toValidate.length === 0 && quizzes.length === 0 ? <Text style={v2Text.body}>{t('v2.parent.nothingToValidate')}</Text> : null}
      {toValidate.map((task) => (
        <View key={task.id} style={[v2Card, styles.approval]} testID={`v2-approve-${task.id}`}>
          <View style={styles.approvalHead}>
            <Image source={goalIconImage(goalIconFor(task))} style={styles.icon} resizeMode="contain" />
            <View style={styles.flex}>
              <Text style={v2Text.bodyBold}>{task.title}</Text>
              <Text style={v2Text.caption}>{t('v2.parent.taskMeta', { date: task.date.slice(5).split('-').reverse().join('/'), points: task.points })}</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <View style={styles.flex}>
              <V2Button label={t('approvals.approve')} onPress={() => validate.mutate(validateVars(task))} testID={`v2-validate-${task.id}`} />
            </View>
            <View style={styles.flex}>
              <V2Button variant="secondary" label={t('approvals.reject')} onPress={() => reject.mutate({ task })} />
            </View>
          </View>
        </View>
      ))}
      {quizzes.map((q) => (
        <View key={q.attemptId} style={[v2Card, styles.approval]}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('v2.parent.openQuiz', { title: q.title })} onPress={() => router.push({ pathname: '/quiz/detail', params: { child: child.id, quiz: q.quizId } })} style={styles.approvalHead}>
            <Image source={goalIconImage('devoirs')} style={styles.icon} resizeMode="contain" />
            <View style={styles.flex}>
              <Text style={v2Text.bodyBold}>{q.title}</Text>
              {q.result ? <Text style={v2Text.caption}>{t('v2.parent.quizScore', { score: q.result.score, total: q.result.total })}</Text> : null}
            </View>
          </Pressable>
          <ValidateAttemptBar attemptId={q.attemptId as string} />
        </View>
      ))}

      <Text accessibilityRole="header" style={v2Text.heading}>
        {t('v2.parent.day')}
      </Text>
      {tasksQuery.isPending ? <ActivityIndicator color={v2Colors.primary} /> : null}
      {!tasksQuery.isPending && tasks.length === 0 ? <Text style={v2Text.body}>{t('today.empty')}</Text> : null}
      {groups.map((g) => (
        <GoalSection key={g.section} section={g.section} count={g.items.length}>
          {g.items.map((task) => {
            const perms = taskPermissions(d.viewer, task);
            const state = taskState(task);
            const label = timeLabel(task);
            return (
              <GoalRow
                key={task.id}
                icon={goalIconFor(task)}
                title={task.title}
                subtitle={label.kind === 'range' ? `${label.start} - ${label.end}` : label.kind === 'deadline' ? t('taskForm.deadlineLabel', { time: label.end }) : null}
                energy={task.points}
                checked={state !== 'todo'}
                pending={state === 'pending'}
                toggleDisabled={!perms.canToggle}
                onToggle={() => toggle.mutate(toggleVars(task, task.completed_at === null, true))}
                onOpen={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
              />
            );
          })}
        </GoalSection>
      ))}
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: v2Colors.background },
  top: { flexDirection: 'row', gap: v2Spacing.sm },
  topBtn: { width: V2_TOUCH, height: V2_TOUCH, borderRadius: V2_TOUCH / 2, backgroundColor: v2Colors.topButton, alignItems: 'center', justifyContent: 'center' },
  childCard: { flexDirection: 'row', alignItems: 'center', gap: v2Spacing.md },
  panda: { width: 64, height: 64 },
  approval: { gap: v2Spacing.md },
  approvalHead: { flexDirection: 'row', alignItems: 'center', gap: v2Spacing.md, minHeight: V2_TOUCH },
  icon: { width: 44, height: 44, borderRadius: v2Radius.small },
  actions: { flexDirection: 'row', gap: v2Spacing.sm },
});
