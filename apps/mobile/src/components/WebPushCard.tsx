import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text } from 'react-native';
import { Button, Card, ErrorText } from '@/components/ui';
import type { EnableFailure, TestOutcome } from '@/domain/web-push';
import { disableWebPush, enableWebPush, getWebPushStatus, sendTestNotification, type WebPushStatus } from '@/services/webPush';
import { colors, typography } from '@/theme/tokens';

/** Réglage « Notifications du navigateur » (Web Push, optionnel — le centre de notifications intégré reste le canal principal). */
export function WebPushCard() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<WebPushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<EnableFailure | null>(null);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestOutcome | null>(null);
  const refresh = useCallback(() => void getWebPushStatus().then(setStatus), []);
  useEffect(refresh, [refresh]);
  if (Platform.OS !== 'web' || status === null) return null;

  const toggle = async () => {
    setBusy(true);
    setFailure(null);
    setTest(null);
    try {
      if (status === 'on') await disableWebPush();
      else {
        const result = await enableWebPush();
        setFailure(result.ok ? null : result.reason);
      }
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      setTest(await sendTestNotification());
    } finally {
      setTesting(false);
    }
  };

  const testMessage = (o: TestOutcome): string =>
    o.kind === 'sent' ? t('notifSettings.test.sent') : o.kind === 'no_device' ? t('notifSettings.test.noDevice') : o.kind === 'no_vapid' ? t('notifSettings.test.noVapid') : o.code ? t('notifSettings.test.errorCode', { code: o.code }) : t('notifSettings.test.error');

  const message: Record<WebPushStatus, string> = {
    on: t('notifSettings.webPush.on'),
    off: t('notifSettings.webPush.off'),
    ready: t('notifSettings.webPush.off'),
    denied: t('notifSettings.webPush.denied'),
    unsupported: t('notifSettings.webPush.unsupported'),
    'needs-install': t('notifSettings.webPush.needsInstall'),
    'not-configured': t('notifSettings.webPush.notConfigured'),
    unsynced: t('notifSettings.webPush.unsynced'),
    unverified: t('notifSettings.webPush.unverified'),
  };
  const actionable = status === 'on' || status === 'off' || status === 'ready' || status === 'unsynced';
  const enableLabel = status === 'unsynced' ? t('notifSettings.webPush.resync') : t('notifSettings.webPush.enable');

  return (
    <Card>
      <Text accessibilityRole="header" style={styles.title}>
        {t('notifSettings.webPush.title')}
      </Text>
      <Text style={typography.secondary}>{t('notifSettings.webPush.body')}</Text>
      <Text accessibilityLiveRegion="polite" style={styles.status}>
        {message[status]}
      </Text>
      {actionable ? <Button variant={status === 'on' ? 'secondary' : 'primary'} label={status === 'on' ? t('notifSettings.webPush.disable') : enableLabel} onPress={() => void toggle()} loading={busy} /> : null}
      <ErrorText>{failure ? t(`notifSettings.webPush.reason.${failure}`) : null}</ErrorText>
      {status === 'unverified' ? <Button variant="secondary" label={t('notifSettings.webPush.recheck')} onPress={refresh} /> : null}
      {status === 'on' ? (
        <>
          <Button variant="secondary" label={t('notifSettings.test.button')} onPress={() => void runTest()} loading={testing} />
          {test ? (
            test.kind === 'sent' ? (
              <Text accessibilityLiveRegion="polite" style={styles.status}>
                {testMessage(test)}
              </Text>
            ) : (
              <ErrorText>{testMessage(test)}</ErrorText>
            )
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  status: { fontSize: 14, color: colors.text, fontWeight: '600' },
});
