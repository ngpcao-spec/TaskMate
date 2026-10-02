import { format, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Screen, Title } from '@/components/ui';
import { useDevices, useRevokeDevice } from '@/hooks/useFamilyAdmin';
import { useMe } from '@/hooks/useMe';
import { colors, typography } from '@/theme/tokens';

/** Appareils liés (parent) : révocation immédiate — l'appareil perd l'accès à sa prochaine requête (SPEC §5.8). */
export default function DevicesScreen() {
  const { t } = useTranslation();
  const me = useMe().data;
  const isParent = me?.member.role === 'parent';
  const devices = useDevices(isParent);
  const revoke = useRevokeDevice();
  if (!me || !isParent) return null;
  const list = devices.data ?? [];

  const confirm = (id: string, name: string) =>
    Alert.alert(t('settings.revokeTitle'), t('settings.revokeBody', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.revoke'), style: 'destructive', onPress: () => revoke.mutate(id) },
    ]);

  return (
    <Screen>
      <Title>{t('settings.devices')}</Title>
      {list.length === 0 ? <Text style={[typography.secondary, styles.empty]}>{t('settings.devicesEmpty')}</Text> : null}
      {list.map((d) => {
        const name = d.member?.display_name ?? '—';
        const self = d.member_id === me.member.id;
        return (
          <Card key={d.id}>
            <View accessible accessibilityLabel={`${name}, ${d.platform ?? ''}`}>
              <Text style={styles.name}>{name}{self ? ` (${t('settings.thisDevice')})` : ''}</Text>
              <Text style={typography.secondary}>
                {[d.platform, d.member?.role === 'child' ? t('settings.roleChild') : t('settings.roleParent'), format(parseISO(d.last_seen_at), 'dd/MM/yyyy HH:mm')].filter(Boolean).join(' · ')}
              </Text>
            </View>
            {self ? null : <Button variant="secondary" label={`${t('settings.revoke')} ${name}`} onPress={() => confirm(d.id, name)} loading={revoke.isPending} />}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  empty: { textAlign: 'center', paddingVertical: 24 },
});
