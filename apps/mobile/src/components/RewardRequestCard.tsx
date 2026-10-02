import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card } from '@/components/ui';
import { daysUntilExpiry } from '@/domain/rewards';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';
import type { RewardRequestRow } from '@/types/models';

type Props = { request: RewardRequestRow; childName: string; now: Date; online: boolean; onApprove: () => void; onReject: (note?: string) => void; busy?: boolean };

/** Demande d'échange en attente (parent) : approuver / refuser avec motif optionnel (SPEC §3.7). */
export function RewardRequestCard({ request: r, childName, now, online, onApprove, onReject, busy }: Props) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  return (
    <Card>
      <Text style={styles.title}>{t('points.requestLine', { name: childName, title: r.reward_title, cost: r.cost })}</Text>
      <Text style={typography.secondary}>{t('points.expiresIn', { days: daysUntilExpiry(r.expires_at, now) })}</Text>
      <TextInput accessibilityLabel={t('points.rejectNote')} placeholder={t('points.rejectNote')} placeholderTextColor={colors.textSecondary} value={note} onChangeText={setNote} style={styles.input} />
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button label={t('points.approve')} onPress={onApprove} disabled={!online} loading={busy} />
        </View>
        <View style={styles.flex}>
          <Button variant="secondary" label={t('points.reject')} onPress={() => onReject(note.trim() || undefined)} disabled={!online} />
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
