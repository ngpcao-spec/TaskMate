import { Bell } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { GlassTile } from '@/components/GlassTile';
import { Button, ErrorText } from '@/components/ui';
import { parseSnooze, shouldPrompt, SNOOZE_KEY, SNOOZE_MS } from '@/domain/notification-prompt';
import { enableWebPush, getWebPushStatus } from '@/services/webPush';
import { kvStorage } from '@/sync/storage';
import { colors, radius, shadow, line } from '@/theme/tokens';

type Phase = 'hidden' | 'ask' | 'denied';

/**
 * Invitation à activer les notifications, affichée à l'ouverture de l'app (web/PWA) tant qu'elles ne sont pas activées (D-067).
 * iOS n'autorise la demande de permission que depuis un GESTE de l'utilisateur : l'invitation affiche donc un bouton, jamais d'appel automatique.
 */
export function NotificationPrompt() {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('hidden');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

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
    setFailed(false);
    try {
      const result = await enableWebPush();
      if (result === 'on') setPhase('hidden');
      else if (result === 'denied') setPhase('denied');
      else setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <View accessibilityViewIsModal accessibilityRole="alert" aria-modal style={styles.dialog}>
        <GlassTile size={64} style={styles.icon}>
          <Bell color={colors.accent} size={30} />
        </GlassTile>
        <Text accessibilityRole="header" style={styles.title}>
          {t('notifPrompt.title')}
        </Text>
        <Text style={styles.body}>{phase === 'denied' ? t('notifPrompt.denied') : t('notifPrompt.body')}</Text>
        {phase === 'ask' ? (
          <>
            <Button label={t('notifPrompt.enable')} onPress={() => void enable()} loading={busy} />
            <Button variant="ghost" label={t('notifPrompt.later')} onPress={later} disabled={busy} />
            <ErrorText>{failed ? t('notifSettings.webPush.failed') : null}</ErrorText>
          </>
        ) : (
          <Button label={t('common.done')} onPress={() => setPhase('hidden')} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(20,38,56,0.55)' },
  dialog: { width: '100%', maxWidth: 420, alignItems: 'stretch', gap: 12, padding: 24, borderRadius: radius.card, backgroundColor: colors.cardSolid, borderWidth: line.width, borderColor: colors.glassBorder, ...shadow },
  icon: { alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  body: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
