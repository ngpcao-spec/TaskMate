import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Chip } from '@/components/Chip';
import { Button, Card, Field, Screen, Title } from '@/components/ui';
import { parseAdjustment } from '@/domain/rewards';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useAdjustPoints } from '@/hooks/usePoints';

/** Ajustement manuel (+/−, motif obligatoire) — parent uniquement (SPEC §3.7, RPC `adjust_points`). */
export default function PointsAdjustScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const d = useDisplayedChild();
  const adjust = useAdjustPoints();
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  if (!d || d.viewer.role !== 'parent') return null;
  const target = d.children.find((c) => c.id === childId) ?? d.child;
  const delta = parseAdjustment(amount, sign);

  return (
    <Screen>
      <Title>{t('points.adjustTitle', { name: target?.name ?? '' })}</Title>
      <Card>
        <View style={styles.row}>
          <Chip label="+" selected={sign === 1} onPress={() => setSign(1)} />
          <Chip label="−" selected={sign === -1} onPress={() => setSign(-1)} />
        </View>
        <Field label={t('points.adjustAmount')} value={amount} onChangeText={(v) => setAmount(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} />
        <Field label={t('points.adjustNote')} value={note} onChangeText={setNote} maxLength={120} />
      </Card>
      <Button
        label={t('common.save')}
        disabled={delta === null || note.trim() === '' || !target}
        loading={adjust.isPending}
        onPress={() => delta !== null && target && adjust.mutate({ childId: target.id, delta, note: note.trim() }, { onSuccess: () => router.back() })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 8 } });
