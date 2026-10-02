import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text } from 'react-native';
import { Button, Card, ErrorText } from '@/components/ui';
import { disableWebPush, enableWebPush, getWebPushStatus, type WebPushStatus } from '@/services/webPush';
import { colors, typography } from '@/theme/tokens';

/** Réglage « Notifications du navigateur » (Web Push, optionnel — le centre de notifications intégré reste le canal principal). */
export function WebPushCard() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<WebPushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const refresh = useCallback(() => void getWebPushStatus().then(setStatus), []);
  useEffect(refresh, [refresh]);
  if (Platform.OS !== 'web' || status === null) return null;

  const toggle = async () => {
    setBusy(true);
    setFailed(false);
    try {
      if (status === 'on') await disableWebPush();
      else setFailed((await enableWebPush()) === 'failed');
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const message: Record<WebPushStatus, string> = {
    on: t('notifSettings.webPush.on'),
    off: t('notifSettings.webPush.off'),
    ready: t('notifSettings.webPush.off'),
    denied: t('notifSettings.webPush.denied'),
    unsupported: t('notifSettings.webPush.unsupported'),
    'needs-install': t('notifSettings.webPush.needsInstall'),
    'not-configured': t('notifSettings.webPush.notConfigured'),
  };
  const actionable = status === 'on' || status === 'off' || status === 'ready';

  return (
    <Card>
      <Text accessibilityRole="header" style={styles.title}>
        {t('notifSettings.webPush.title')}
      </Text>
      <Text style={typography.secondary}>{t('notifSettings.webPush.body')}</Text>
      <Text accessibilityLiveRegion="polite" style={styles.status}>
        {message[status]}
      </Text>
      {actionable ? <Button variant={status === 'on' ? 'secondary' : 'primary'} label={status === 'on' ? t('notifSettings.webPush.disable') : t('notifSettings.webPush.enable')} onPress={() => void toggle()} loading={busy} /> : null}
      <ErrorText>{failed ? t('notifSettings.webPush.failed') : null}</ErrorText>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  status: { fontSize: 14, color: colors.text, fontWeight: '600' },
});
