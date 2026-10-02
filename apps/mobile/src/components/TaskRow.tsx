import { Check, RefreshCw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CategoryIcon } from '@/components/CategoryIcon';
import { taskState } from '@/domain/task-state';
import { timeLabel } from '@/domain/task-time';
import { colors, MIN_TARGET, radius, shadow } from '@/theme/tokens';
import type { TaskRow as Task } from '@/types/models';

type Props = {
  task: Task;
  overdue: boolean;
  canToggle: boolean;
  /** Ouvre le détail (lecture seule pour l'enfant) ou l'édition (parent). */
  canOpen: boolean;
  /** Parent : boutons Duyệt / Từ chối sur une tâche en attente. */
  canValidate?: boolean;
  pending?: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onValidate?: () => void;
  onReject?: () => void;
};

/** Ligne de tâche (SPEC v4 §3.2) : case, titre, horaire, catégorie, badge d'état (Chờ duyệt / +N điểm), motif de refus. */
export function TaskRow({ task, overdue, canToggle, canOpen, canValidate = false, pending = false, onToggle, onOpen, onValidate, onReject }: Props) {
  const { t } = useTranslation();
  const state = taskState(task);
  const checked = state !== 'todo';
  const label = timeLabel(task);
  const time =
    label.kind === 'range'
      ? `${label.start} – ${label.end}`
      : label.kind === 'deadline'
        ? t('taskForm.deadlineLabel', { time: label.end })
        : t('taskForm.anytime');
  const stateLabel = state === 'pending' ? t('task.pending') : state === 'validated' ? t('task.validated', { points: task.points }) : '';

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={task.title}
          accessibilityState={{ checked, disabled: !canToggle }}
          disabled={!canToggle}
          onPress={onToggle}
          hitSlop={4}
          style={styles.checkHit}
        >
          <View style={[styles.box, checked && styles.boxDone, !canToggle && styles.boxLocked]}>{checked ? <Check size={16} color="#fff" /> : null}</View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${task.title}, ${time}${stateLabel ? `, ${stateLabel}` : ''}`}
          disabled={!canOpen}
          onPress={onOpen}
          style={styles.body}
        >
          <Text numberOfLines={1} style={[styles.title, checked && styles.titleDone]}>
            {task.title}
          </Text>
          <Text style={[styles.time, overdue && styles.overdue]}>{overdue ? `${t('today.overdue')} · ${time}` : time}</Text>
        </Pressable>
        {state === 'pending' ? (
          <View style={[styles.badge, styles.badgePending]}>
            <Text style={styles.badgePendingText}>{t('task.pending')}</Text>
          </View>
        ) : null}
        {state === 'validated' ? (
          <View style={[styles.badge, styles.badgeDone]}>
            <Text style={styles.badgeDoneText}>{t('task.validated', { points: task.points })}</Text>
          </View>
        ) : null}
        {pending ? <RefreshCw size={14} color={colors.textSecondary} accessibilityLabel={t('sync.pendingItem')} /> : null}
        <CategoryIcon category={task.category} />
      </View>
      {state === 'todo' && task.rejection_note ? (
        <Text accessibilityLabel={`${t('task.rejectedLabel')}: ${task.rejection_note}`} style={styles.rejection}>
          {t('task.rejectedLabel')}: {task.rejection_note}
        </Text>
      ) : null}
      {canValidate ? (
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t('approvals.approve')} ${task.title}`} onPress={onValidate} style={[styles.action, styles.actionOk]}>
            <Text style={styles.actionOkText}>{t('approvals.approve')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t('approvals.reject')} ${task.title}`} onPress={onReject} style={[styles.action, styles.actionKo]}>
            <Text style={styles.actionKoText}>{t('approvals.reject')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, paddingHorizontal: 12, ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64 },
  checkHit: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  boxDone: { backgroundColor: colors.primary },
  boxLocked: { borderColor: '#C8D2E0' },
  body: { flex: 1, minHeight: MIN_TARGET, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  titleDone: { color: colors.textSecondary },
  time: { fontSize: 13, color: colors.textSecondary },
  overdue: { color: colors.danger },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgePending: { backgroundColor: '#FFF1DB' },
  badgePendingText: { color: '#B86E00', fontSize: 12, fontWeight: '700' },
  badgeDone: { backgroundColor: '#E3F6EA' },
  badgeDoneText: { color: '#1B7F43', fontSize: 12, fontWeight: '700' },
  rejection: { color: colors.danger, fontSize: 13, paddingBottom: 10, paddingLeft: MIN_TARGET + 10 },
  actions: { flexDirection: 'row', gap: 8, paddingBottom: 10 },
  action: { flex: 1, minHeight: MIN_TARGET, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionOk: { backgroundColor: colors.primary },
  actionOkText: { color: '#fff', fontWeight: '700' },
  actionKo: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.danger },
  actionKoText: { color: colors.danger, fontWeight: '700' },
});
