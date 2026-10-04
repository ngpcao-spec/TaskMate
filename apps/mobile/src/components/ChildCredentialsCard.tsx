import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { Button, Card } from '@/components/ui';
import { copyText } from '@/services/clipboard';
import { colors, typography } from '@/theme/tokens';

/** Affiche UNE fois l'identifiant et le mot de passe d'un enfant (le mot de passe n'est stocké nulle part en clair). */
export function ChildCredentialsCard({ childName, loginId, password }: { childName: string; loginId: string; password: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<boolean | null>(null);
  const copy = async () => setCopied(await copyText(t('addChild.copyText', { name: childName, loginId, password })));
  return (
    <Card>
      <Text accessibilityRole="header" style={typography.title}>{t('addChild.credentialsTitle', { name: childName })}</Text>
      <Text selectable accessibilityLabel={t('addChild.loginIdIs', { id: loginId })} style={styles.value}>{t('addChild.loginIdIs', { id: loginId })}</Text>
      <Text selectable accessibilityLabel={t('addChild.passwordIs', { password })} style={styles.value}>{t('addChild.passwordIs', { password })}</Text>
      <Text accessibilityRole="alert" style={styles.warning}>{t('addChild.shownOnce')}</Text>
      <Button variant="secondary" label={t('addChild.copy')} accessibilityLabel={`${t('addChild.copy')} ${childName}`} onPress={() => void copy()} />
      {copied !== null ? <Text accessibilityLiveRegion="polite" style={copied ? styles.ok : styles.warning}>{copied ? t('addChild.copied') : t('addChild.copyFailed')}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  value: { fontSize: 18, fontWeight: '700', color: colors.text },
  warning: { ...typography.secondary, color: colors.danger },
  ok: { ...typography.secondary, color: colors.success },
});
