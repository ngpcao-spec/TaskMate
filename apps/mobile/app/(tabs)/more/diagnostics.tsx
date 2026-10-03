import { StyleSheet, Text, View } from 'react-native';
import { VapidTool } from '@/components/VapidTool';
import { Button, Card, Screen, ScreenHeader } from '@/components/ui';
import type { HealthStatus } from '@/domain/health';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useHealth } from '@/hooks/useHealth';
import i18n from '@/i18n';
import { colors, typography } from '@/theme/tokens';

/** Outil d'exploitation destiné au propriétaire : toujours en français, quelle que soit la langue de l'app. */
const tf = i18n.getFixedT('fr');

const STATUS_COLOR: Record<HealthStatus, string> = { ok: '#1E8E5A', warn: '#B86E00', fail: colors.danger };
const STATUS_MARK: Record<HealthStatus, string> = { ok: '✓', warn: '!', fail: '✕' };

/** Réglages → Diagnostic (parents) : ce qui fonctionne, ce qui manque et où cliquer pour le corriger. */
export default function DiagnosticsScreen() {
  const d = useDisplayedChild();
  const isParent = d?.viewer.role === 'parent';
  const health = useHealth(isParent);
  if (!d || !isParent) return null;

  const data = health.data;
  return (
    <Screen>
      <ScreenHeader title={tf('health.screenTitle')} />
      <Text style={typography.secondary}>{tf('health.intro')}</Text>
      <Button label={health.isFetching ? tf('health.running') : tf('health.run')} onPress={() => void health.refetch()} loading={health.isFetching} />

      {data ? (
        <>
          <Text accessibilityRole="alert" style={[styles.summary, { color: data.summary.fail > 0 ? colors.danger : data.summary.warn > 0 ? STATUS_COLOR.warn : STATUS_COLOR.ok }]}>
            {data.summary.fail + data.summary.warn === 0 ? tf('health.allGood') : tf('health.summary', data.summary)}
          </Text>
          {data.items.map((item) => (
            <Card key={item.id}>
              <View accessible accessibilityLabel={`${tf(`health.itemTitle.${item.id}`)} : ${tf(`health.status.${item.status}`)}. ${tf(item.messageKey, item.params)}`} style={styles.row}>
                <Text style={[styles.mark, { color: STATUS_COLOR[item.status] }]}>{STATUS_MARK[item.status]}</Text>
                <View style={styles.flex}>
                  <Text style={styles.itemTitle}>
                    {tf(`health.itemTitle.${item.id}`)} · <Text style={{ color: STATUS_COLOR[item.status] }}>{tf(`health.status.${item.status}`)}</Text>
                  </Text>
                  <Text selectable style={typography.secondary}>
                    {tf(item.messageKey, item.params)}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </>
      ) : null}

      <VapidTool />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  mark: { fontSize: 20, fontWeight: '800', width: 24, textAlign: 'center' },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  summary: { fontSize: 16, fontWeight: '700' },
});
