import { format, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Screen, Title } from '@/components/ui';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useActivity, useDecidedRequests } from '@/hooks/useNotifications';
import { colors, typography } from '@/theme/tokens';

type Payload = { title?: string; cost?: number; delta?: number };

/** Centre de notifications [H] : parent = activité récente ; enfant = décisions sur ses demandes d'échange. */
export default function NotificationsScreen() {
  const { t } = useTranslation();
  const d = useDisplayedChild();
  const isParent = d?.viewer.role === 'parent';
  const activity = useActivity(isParent);
  const decided = useDecidedRequests(!isParent && d !== null);
  if (!d) return null;
  const nameOf = (id: string | null) => d.children.find((c) => c.id === id)?.name ?? '';

  const rows = isParent
    ? (activity.data ?? []).map((a) => {
        const p = (a.payload ?? {}) as Payload;
        return { id: a.id, at: a.created_at, text: t(`notifications.activity.${a.type}`, { name: nameOf(a.child_id), title: p.title ?? '', cost: p.cost ?? '', delta: p.delta ?? '', defaultValue: a.type }) };
      })
    : (decided.data ?? []).map((r) => ({
        id: r.id,
        at: r.updated_at,
        text: t(`notifications.activity.reward_${r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'expired'}`, { title: r.reward_title, defaultValue: r.reward_title }),
      }));

  return (
    <Screen>
      <Title>{t('notifications.title')}</Title>
      {rows.length === 0 ? <Text style={[typography.secondary, styles.empty]}>{t('notifications.empty')}</Text> : null}
      {rows.map((r) => (
        <Card key={r.id}>
          <View accessible accessibilityLabel={r.text}>
            <Text style={styles.text}>{r.text}</Text>
            <Text style={typography.secondary}>{format(parseISO(r.at), 'dd/MM/yyyy HH:mm')}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 15, fontWeight: '600', color: colors.text },
  empty: { textAlign: 'center', paddingVertical: 24 },
});
