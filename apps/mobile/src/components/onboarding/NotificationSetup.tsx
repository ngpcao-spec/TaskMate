import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Lock, Share } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { queryKeys } from '@/api/keys';
import { Button, Card, ErrorText } from '@/components/ui';
import { needsInstall } from '@/domain/onboarding';
import type { EnableFailure, TestOutcome } from '@/domain/web-push';
import { enableWebPush, getWebPushStatus, installState, sendTestNotification, type WebPushStatus } from '@/services/webPush';
import { colors, typography } from '@/theme/tokens';

type Props = {
  /** Phrase d'exemple de notification (parcours enfant) ; absent = aucune. */
  example?: string;
};

/**
 * Installer puis notifier (assistant parent, étape 4, et parcours enfant) :
 *  1. iOS hors PWA installée → « Chia sẻ → Thêm vào Màn hình chính » + « Tôi đã thêm xong » ; les sous-étapes suivantes restent VERROUILLÉES tant que l'app n'est pas ouverte en mode standalone ;
 *  2. « Bật thông báo » (la permission se demande depuis un TAP) puis vérification que la ligne `devices` existe vraiment (état lu de la base, D-088) ;
 *  3. « Gửi thông báo thử » avec un résultat clair.
 * Réutilise exactement l'enregistrement et l'envoi de test déjà livrés (services/webPush).
 */
export function NotificationSetup({ example }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [install, setInstall] = useState(() => installState());
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<EnableFailure | null>(null);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestOutcome | null>(null);
  const locked = needsInstall(install.ios, install.standalone);
  const status = useQuery<WebPushStatus>({ queryKey: [...queryKeys.onboardingDevice, 'status'], queryFn: getWebPushStatus, enabled: !locked, staleTime: 0, retry: false });
  const refreshDevice = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.onboardingDevice });
  };

  const enabled = status.data === 'on';
  const web = Platform.OS === 'web';

  const recheckInstall = () => {
    setInstall(installState());
    setChecked(true);
  };
  const enable = async () => {
    setBusy(true);
    setFailure(null);
    setTest(null);
    try {
      const res = await enableWebPush();
      setFailure(res.ok ? null : res.reason);
    } finally {
      setBusy(false);
      void status.refetch();
      refreshDevice();
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
  const testText = (o: TestOutcome): string =>
    o.kind === 'sent' ? t('notifSettings.test.sent') : o.kind === 'no_device' ? t('notifSettings.test.noDevice') : o.kind === 'no_vapid' ? t('notifSettings.test.noVapid') : o.code ? t('notifSettings.test.errorCode', { code: o.code }) : t('notifSettings.test.error');

  const lockedText = t('onboarding.notifications.locked');

  return (
    <>
      {locked ? (
        <Card>
          <View style={styles.head}>
            <Share color={colors.primary} size={24} />
            <Text accessibilityRole="header" style={styles.section}>{t('onboarding.notifications.installTitle')}</Text>
          </View>
          <Text style={typography.body}>{t('onboarding.notifications.installBody')}</Text>
          <Button label={t('onboarding.notifications.installDone')} onPress={recheckInstall} />
          {checked ? <Text accessibilityLiveRegion="polite" style={styles.warning}>{t('onboarding.notifications.installStill')}</Text> : null}
        </Card>
      ) : null}

      <Card>
        <Row title={t('onboarding.notifications.enableTitle')} done={enabled} locked={locked} lockedText={lockedText} doneText={t('onboarding.notifications.enabledOn')}>
          {!web ? <Text style={typography.secondary}>{t('onboarding.notifications.native')}</Text> : null}
          {web && !locked ? (
            enabled ? null : <Button label={t('notifSettings.webPush.enable')} onPress={() => void enable()} loading={busy} />
          ) : null}
          {failure ? <ErrorText>{t(`notifSettings.webPush.reason.${failure}`)}</ErrorText> : null}
          {web && !locked && status.data === 'unsynced' ? <Text style={styles.warning}>{t('notifSettings.webPush.unsynced')}</Text> : null}
        </Row>
        <Row title={t('onboarding.notifications.testTitle')} done={test?.kind === 'sent'} locked={locked || !enabled} lockedText={locked ? lockedText : t('onboarding.notifications.needEnable')} doneText="">
          {web && !locked && enabled ? <Button variant="secondary" label={t('notifSettings.test.button')} onPress={() => void runTest()} loading={testing} /> : null}
          {test ? (test.kind === 'sent' ? <Text accessibilityLiveRegion="polite" style={styles.ok}>{testText(test)}</Text> : <ErrorText>{testText(test)}</ErrorText>) : null}
        </Row>
      </Card>

      {example ? (
        <Card>
          <Text style={typography.secondary}>{t('onboarding.child.exampleTitle')}</Text>
          <Text accessibilityLabel={t('onboarding.child.exampleA11y', { text: example })} style={styles.example}>{example}</Text>
        </Card>
      ) : null}
    </>
  );
}

function Row({ title, done, locked, lockedText, doneText, children }: { title: string; done: boolean; locked: boolean; lockedText: string; doneText: string; children?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        {done ? <Check color={colors.success} size={22} /> : locked ? <Lock color={colors.textSecondary} size={20} /> : null}
        <Text accessibilityRole="header" style={[styles.rowTitle, locked && styles.off]}>{title}</Text>
      </View>
      {done && doneText ? <Text style={styles.ok}>{doneText}</Text> : null}
      {locked ? <Text accessibilityState={{ disabled: true }} style={typography.secondary}>{lockedText}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  section: { ...typography.title, color: colors.text },
  row: { gap: 8 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  off: { color: colors.textSecondary },
  warning: { ...typography.secondary, color: colors.danger },
  ok: { ...typography.secondary, color: colors.success },
  example: { fontSize: 16, fontWeight: '700', color: colors.text },
});
