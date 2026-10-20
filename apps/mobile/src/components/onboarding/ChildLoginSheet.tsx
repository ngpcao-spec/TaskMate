import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '@/components/ui';
import { parentLoginEmail } from '@/domain/login-info';
import { copyText } from '@/services/clipboard';
import { shareText } from '@/services/share';
import { useSessionStore } from '@/store/session';
import { colors, typography } from '@/theme/tokens';

type Props = { childName: string; loginId: string; password: string };

/**
 * Fiche de connexion de l'enfant (assistant, étape 2) : e-mail du parent + identifiant + mot de passe + explication, avec « Sao chép hướng dẫn » et « Chia sẻ ».
 * Le mot de passe vient UNIQUEMENT de l'état local du formulaire (jamais relu en base, jamais conservé) : masqué par défaut, révélé par « Hiện ».
 * Après avoir quitté l'écran, il faut passer par `reset-child-password`.
 */
export function ChildLoginSheet({ childName, loginId, password }: Props) {
  const { t } = useTranslation();
  const email = parentLoginEmail(useSessionStore((s) => s.session?.user.email));
  const [shown, setShown] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const guide = [
    t('onboarding.children.sheet.intro', { name: childName, button: t('onboarding.role.child') }),
    email ? t('onboarding.children.sheet.emailLine', { email }) : null,
    t('onboarding.children.sheet.idLine', { id: loginId }),
    t('onboarding.children.sheet.passwordLine', { password }),
  ]
    .filter(Boolean)
    .join('\n');

  const copy = async () => {
    const ok = await copyText(guide);
    setNotice({ ok, text: t(ok ? 'childAccount.login.copied' : 'childAccount.login.copyFailed') });
  };
  const share = async () => {
    const res = await shareText(t('onboarding.children.sheet.shareTitle', { name: childName }), guide);
    setNotice(res === 'failed' ? { ok: false, text: t('childAccount.login.copyFailed') } : { ok: true, text: t(res === 'copied' ? 'childAccount.login.copied' : 'onboarding.children.sheet.shared') });
  };

  return (
    <Card>
      <Text accessibilityRole="header" style={styles.title}>{t('onboarding.children.sheet.title', { name: childName })}</Text>
      <Text style={typography.body}>{t('onboarding.children.sheet.intro', { name: childName, button: t('onboarding.role.child') })}</Text>
      {email ? <Line label={t('childAccount.login.email')} value={email} /> : null}
      <Line label={t('childAccount.login.id')} value={loginId} />
      <View style={styles.passwordRow}>
        <View style={styles.flex}>
          <Text style={styles.label}>{t('childAccount.login.password')}</Text>
          <Text selectable={shown} accessibilityLabel={shown ? t('addChild.passwordIs', { password }) : t('onboarding.children.sheet.passwordHidden')} style={styles.value}>
            {shown ? password : '••••••••'}
          </Text>
        </View>
        <Button variant="secondary" label={shown ? t('onboarding.children.sheet.hide') : t('onboarding.children.sheet.show')} onPress={() => setShown((v) => !v)} />
      </View>
      <Text accessibilityRole="alert" style={styles.warning}>{t('addChild.shownOnce')}</Text>
      <Button label={t('onboarding.children.sheet.copy')} onPress={() => void copy()} />
      <Button variant="secondary" label={t('onboarding.children.sheet.share')} onPress={() => void share()} />
      {notice ? <Text accessibilityLiveRegion="polite" style={notice.ok ? styles.ok : styles.warning}>{notice.text}</Text> : null}
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { ...typography.title, color: colors.text },
  label: { fontSize: 13, color: colors.textSecondary },
  value: { fontSize: 17, fontWeight: '700', color: colors.text },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  warning: { ...typography.secondary, color: colors.danger },
  ok: { ...typography.secondary, color: colors.success },
});
