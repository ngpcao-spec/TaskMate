import { format, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Screen, Title } from '@/components/ui';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useTransactions } from '@/hooks/usePoints';
import { colors, typography } from '@/theme/tokens';

/** Historique des mouvements de points (SPEC §3.7 : tap sur la carte solde). */
export default function PointsHistoryScreen() {
  const { t } = useTranslation();
  const d = useDisplayedChild();
  const tx = useTransactions(d?.child?.id ?? null);
  if (!d) return null;
  const rows = tx.data ?? [];
  return (
    <Screen>
      <Title>{t('points.history')}</Title>
      {rows.length === 0 ? <Text style={typography.secondary}>{t('points.historyEmpty')}</Text> : null}
      {rows.map((r) => (
        <Card key={r.id}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.title}>{t(`points.reason.${r.reason}`)}</Text>
              <Text style={typography.secondary}>
                {format(parseISO(r.created_at), 'dd/MM/yyyy HH:mm')}
                {r.note ? ` · ${r.note}` : ''}
              </Text>
            </View>
            <Text style={[styles.delta, r.delta < 0 && styles.negative]}>
              {r.delta > 0 ? '+' : ''}
              {r.delta}
            </Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  delta: { fontSize: 18, fontWeight: '700', color: colors.success },
  negative: { color: colors.danger },
});
