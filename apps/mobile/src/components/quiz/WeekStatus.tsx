import type { TFunction } from 'i18next';
import { StyleSheet, Text } from 'react-native';
import type { QuizWeekStatus } from '@/domain/quiz-week';
import { colors } from '@/theme/tokens';

/** Libellé du statut d'un quiz pour le PARENT : Pas commencé / En cours (n sur N) / Envoyé / En retard (n sur N) / Validé. Information seulement. */
export function weekStatusLabel(t: TFunction, s: QuizWeekStatus): string {
  const p = s.progress;
  if (s.state === 'late') return p ? t('revisions.week.state.lateProgress', { done: p.answered, total: p.total }) : t('revisions.week.state.late');
  if (s.state === 'in_progress' && p) return t('revisions.week.state.in_progress', { done: p.answered, total: p.total });
  return t(`revisions.week.state.${s.state}`, { done: 0, total: 0 });
}

export function WeekStatusBadge({ label, late }: { label: string; late: boolean }) {
  return <Text style={[styles.badge, late ? styles.late : null]}>{label}</Text>;
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', color: colors.textSecondary, backgroundColor: colors.separator, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  late: { color: colors.warning, backgroundColor: colors.warningTint },
});
