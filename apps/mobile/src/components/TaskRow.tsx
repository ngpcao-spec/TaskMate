import { Check, RefreshCw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CategoryIcon } from '@/components/CategoryIcon';
import { taskState } from '@/domain/task-state';
import { timeLabel } from '@/domain/task-time';
import { CATEGORY_COLORS } from '@/theme/categories';
import { colors, MIN_TARGET } from '@/theme/tokens';
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

/**
 * Ligne de tâche (maquette « Hôm nay », SPEC v4 §3.2) : case, titre + horaire, pastille de catégorie, état.
 * Rendue SANS carte : l'écran regroupe les lignes dans une seule carte à séparateurs.
 */
export function TaskRow({ task, overdue, canToggle, canOpen, canValidate = false, pending = false, onToggle, onOpen, onValidate, onReject }: Props) {
  const { t } = useTranslation();
  const state = taskState(task);
  const checked = state !== 'todo';
  const label = timeLabel(task);
  const time =
    label.kind === 'range'
      ? `${label.start} - ${label.end}`
      : label.kind === 'deadline'
        ? t('taskForm.deadlineLabel', { time: label.end })
        : t('taskForm.anytime');
  const stateLabel = state === 'pending' ? t('task.pending') : state === 'validated' ? t('task.validated', { points: task.points }) : '';

  return (
    <View>
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
          <View style={[styles.box, checked && styles.boxDone, !canToggle && !checked && styles.boxLocked]}>{checked ? <Check size={16} color="#fff" strokeWidth={3} /> : null}</View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${task.title}, ${time}${stateLabel ? `, ${stateLabel}` : ''}`}
          disabled={!canOpen}
          onPress={onOpen}
          style={styles.body}
        >
          <Text numberOfLines={1} style={styles.title}>
            {task.title}
          </Text>
          <Text style={[styles.time, overdue && styles.overdue]}>{overdue ? `${t('today.overdue')} · ${time}` : time}</Text>
        </Pressable>
        <View style={[styles.tile, { backgroundColor: `${CATEGORY_COLORS[task.category]}1F` }]}>
          <CategoryIcon category={task.category} size={18} />
        </View>
        {state === 'pending' ? (
          <View style={styles.badgePending}>
            <Text style={styles.badgePendingText}>{t('task.pending')}</Text>
          </View>
        ) : null}
        {state === 'validated' ? (
          <View accessible accessibilityLabel={t('task.validated', { points: task.points })} style={styles.validated}>
            <Check size={14} color="#fff" strokeWidth={3} />
          </View>
        ) : null}
        {pending ? <RefreshCw size={14} color={colors.textSecondary} accessibilityLabel={t('sync.pendingItem')} /> : null}
      </View>
      {state === 'validated' ? <Text style={styles.points}>{t('task.validated', { points: task.points })}</Text> : null}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 68 },
  checkHit: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  boxDone: { backgroundColor: colors.primary },
  boxLocked: { borderColor: '#C8D2E0' },
  body: { flex: 1, minHeight: MIN_TARGET, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  time: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  overdue: { color: colors.danger },
  tile: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgePending: { backgroundColor: colors.warningTint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgePendingText: { color: '#B86E00', fontSize: 12, fontWeight: '700' },
  validated: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  points: { color: '#1B7F43', fontSize: 12, fontWeight: '700', marginTop: -10, marginBottom: 8, paddingLeft: MIN_TARGET + 10 },
  rejection: { color: colors.danger, fontSize: 13, paddingBottom: 10, paddingLeft: MIN_TARGET + 10 },
  actions: { flexDirection: 'row', gap: 8, paddingBottom: 10, paddingLeft: MIN_TARGET + 10 },
  action: { flex: 1, minHeight: MIN_TARGET, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  actionOk: { backgroundColor: colors.primary },
  actionOkText: { color: '#fff', fontWeight: '700' },
  actionKo: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.danger },
  actionKoText: { color: colors.danger, fontWeight: '700' },
});
