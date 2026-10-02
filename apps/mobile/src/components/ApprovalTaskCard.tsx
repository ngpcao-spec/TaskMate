import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { formatInTimeZone } from 'date-fns-tz';
import { Button, Card } from '@/components/ui';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';
import type { TaskRow } from '@/types/models';

type Props = { task: TaskRow; timeZone: string; onValidate: () => void; onReject: (note?: string) => void };

/** Ligne de la file « Cần duyệt » : titre, heure de coche, points ; Duyệt / Từ chối (motif optionnel). */
export function ApprovalTaskCard({ task, timeZone, onValidate, onReject }: Props) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  const doneAt = task.completed_at ? formatInTimeZone(new Date(task.completed_at), timeZone, 'HH:mm') : '';
  return (
    <Card>
      <Text style={styles.title}>{task.title}</Text>
      <Text style={typography.secondary}>{t('approvals.taskMeta', { time: doneAt, points: task.points })}</Text>
      <TextInput accessibilityLabel={`${t('points.rejectNote')} — ${task.title}`} placeholder={t('points.rejectNote')} placeholderTextColor={colors.textSecondary} value={note} onChangeText={setNote} style={styles.input} />
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button label={t('approvals.approve')} accessibilityLabel={`${t('approvals.approve')} ${task.title}`} onPress={onValidate} />
        </View>
        <View style={styles.flex}>
          <Button variant="secondary" label={t('approvals.reject')} accessibilityLabel={`${t('approvals.reject')} ${task.title}`} onPress={() => onReject(note.trim() || undefined)} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  actions: { flexDirection: 'row', gap: 8 },
  input: { minHeight: MIN_TARGET, borderRadius: 12, borderWidth: 1, borderColor: '#DDE5F0', paddingHorizontal: 12, color: colors.text, backgroundColor: colors.card },
});
