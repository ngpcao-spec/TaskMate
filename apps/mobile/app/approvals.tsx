import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ApprovalTaskCard } from '@/components/ApprovalTaskCard';
import { Chip } from '@/components/Chip';
import { RewardRequestCard } from '@/components/RewardRequestCard';
import { Button, Screen, Title } from '@/components/ui';
import { groupPendingByChild } from '@/domain/approvals';
import { formatDayTitle, type CalendarLanguage } from '@/domain/calendar';
import { useApprovalCounts } from '@/hooks/useApprovals';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useApproveRequest, useRejectRequest, useRequests } from '@/hooks/usePoints';
import { useOnline } from '@/hooks/useSyncStatus';
import { useRejectTask, usePendingTasks, useValidateTask, validateVars } from '@/hooks/useTasks';
import { colors, typography } from '@/theme/tokens';

/** File « Cần duyệt » (SPEC §3.10, parent) : onglets Tâches / Récompenses, « Duyệt tất cả » par enfant. */
export default function ApprovalsScreen() {
  const { t, i18n } = useTranslation();
  const d = useDisplayedChild();
  const isParent = d?.viewer.role === 'parent';
  const [tab, setTab] = useState<'tasks' | 'rewards'>('tasks');
  const counts = useApprovalCounts(isParent);
  const pending = usePendingTasks(isParent);
  const requests = useRequests(null, isParent);
  const validate = useValidateTask();
  const reject = useRejectTask();
  const approve = useApproveRequest();
  const rejectRequest = useRejectRequest();
  const online = useOnline();
  if (!d || !isParent) return null;

  const lang = (['vi', 'fr', 'en'].includes(i18n.language) ? i18n.language : 'vi') as CalendarLanguage;
  const tz = d.me.family.timezone;
  const now = new Date();
  const nameOf = (id: string) => d.children.find((c) => c.id === id)?.name ?? '';
  const groups = groupPendingByChild(pending.data ?? [], d.children.map((c) => c.id));
  const openRequests = (requests.data ?? []).filter((r) => r.status === 'pending' && new Date(r.expires_at) > now);

  const confirmAll = (childId: string) => {
    const g = groups.find((x) => x.childId === childId);
    if (!g) return;
    Alert.alert(t('approvals.approveAll'), t('approvals.approveAllBody', { count: g.count, name: nameOf(childId), points: g.totalPoints }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('approvals.approve'), onPress: () => g.days.flatMap((day) => day.tasks).forEach((task) => validate.mutate(validateVars(task))) },
    ]);
  };

  return (
    <Screen>
      <Title>{t('approvals.title')}</Title>
      <View style={styles.tabs}>
        <Chip label={t('approvals.tabTasks', { count: counts.tasks })} selected={tab === 'tasks'} onPress={() => setTab('tasks')} />
        <Chip label={t('approvals.tabRewards', { count: counts.requests })} selected={tab === 'rewards'} onPress={() => setTab('rewards')} />
      </View>

      {tab === 'tasks' ? (
        groups.length === 0 ? (
          <Text style={[typography.secondary, styles.empty]}>{t('approvals.emptyTasks')}</Text>
        ) : (
          groups.map((g) => (
            <View key={g.childId} style={styles.group}>
              <View style={styles.groupHead}>
                <Text accessibilityRole="header" style={styles.groupTitle}>
                  {nameOf(g.childId)} · {g.count}
                </Text>
                <Button label={t('approvals.approveAll')} accessibilityLabel={`${t('approvals.approveAll')} ${nameOf(g.childId)}`} onPress={() => confirmAll(g.childId)} />
              </View>
              {g.days.map((day) => (
                <View key={day.date} style={styles.day}>
                  <Text style={styles.dayTitle}>{formatDayTitle(day.date, lang)}</Text>
                  {day.tasks.map((task) => (
                    <ApprovalTaskCard key={task.id} task={task} timeZone={tz} onValidate={() => validate.mutate(validateVars(task))} onReject={(note) => reject.mutate({ task, note })} />
                  ))}
                </View>
              ))}
            </View>
          ))
        )
      ) : openRequests.length === 0 ? (
        <Text style={[typography.secondary, styles.empty]}>{t('approvals.emptyRewards')}</Text>
      ) : (
        openRequests.map((r) => (
          <RewardRequestCard key={r.id} request={r} childName={nameOf(r.child_id)} now={now} online={online} onApprove={() => approve.mutate(r.id)} onReject={(note) => rejectRequest.mutate({ id: r.id, note })} />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8 },
  empty: { textAlign: 'center', paddingVertical: 32 },
  group: { gap: 10 },
  groupHead: { gap: 8 },
  groupTitle: { ...typography.title, color: colors.text },
  day: { gap: 8 },
  dayTitle: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
});
