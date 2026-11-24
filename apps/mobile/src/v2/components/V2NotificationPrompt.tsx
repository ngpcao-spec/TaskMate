import { Bell } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text } from 'react-native';
import type { EnableFailure } from '@/domain/web-push';
import { parseSnooze, shouldPrompt, SNOOZE_KEY, SNOOZE_MS } from '@/domain/notification-prompt';
import { enableWebPush, getWebPushStatus } from '@/services/webPush';
import { kvStorage } from '@/sync/storage';
import { v2Colors, v2Text } from '../theme';
import { ConfirmSheet } from './ConfirmSheet';

type Phase = 'hidden' | 'ask' | 'denied';

/**
 * Invitation à activer les notifications (D-067, remise dans la V2 par D-116), à l'ouverture de l'app (web/PWA) tant qu'elles ne sont pas activées :
 * feuille du bas V2 (`ConfirmSheet`). iOS n'autorise la demande de permission que depuis un GESTE : un bouton, jamais d'appel automatique.
 * « Để sau » (ou fermer la feuille) la reporte de 24 h ; refusée sur l'appareil : explication pour la réactiver, sans insister.
 */
export function V2NotificationPrompt() {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('hidden');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<EnableFailure | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let alive = true;
    void getWebPushStatus()
      .then((status) => {
        if (alive && shouldPrompt(status, parseSnooze(kvStorage.getItem(SNOOZE_KEY)), Date.now())) setPhase('ask');
      })
      .catch(() => undefined); // statut illisible : pas d'invitation, les réglages restent disponibles
    return () => {
      alive = false;
    };
  }, []);

  if (phase === 'hidden') return null;

  const later = () => {
    kvStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    setPhase('hidden');
  };
  const enable = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const result = await enableWebPush();
      if (result.ok) setPhase('hidden');
      else if (result.reason === 'denied') setPhase('denied');
      else setFailure(result.reason);
    } finally {
      setBusy(false);
    }
  };

  const ask = phase === 'ask';
  return (
    <ConfirmSheet
      visible
      onClose={ask ? (busy ? () => undefined : later) : () => setPhase('hidden')}
      title={t('notifPrompt.title')}
      message={ask ? t('notifPrompt.body') : t('notifPrompt.denied')}
      icon={<Bell color={v2Colors.primary} size={30} />}
      testID="v2-notif-prompt"
      actions={
        ask
          ? [
              { label: t('notifPrompt.enable'), onPress: () => void enable(), loading: busy, testID: 'v2-notif-enable' },
              { label: t('notifPrompt.later'), variant: 'secondary', onPress: later, disabled: busy, testID: 'v2-notif-later' },
            ]
          : [{ label: t('common.done'), onPress: () => setPhase('hidden'), testID: 'v2-notif-done' }]
      }
    >
      {failure ? (
        <Text style={styles.error} accessibilityRole="alert">
          {t(`notifSettings.webPush.reason.${failure}`)}
        </Text>
      ) : null}
    </ConfirmSheet>
  );
}

const styles = StyleSheet.create({
  error: { ...v2Text.small, color: v2Colors.danger, textAlign: 'center' },
});
