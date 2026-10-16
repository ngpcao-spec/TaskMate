import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChildAccountError, createChildAccount, deleteChildAccount, resetChildPassword } from '@/api/childAccounts';
import { confirmDialog } from '@/components/confirm';
import { Button, ErrorText, Field } from '@/components/ui';
import { CHILD_PASSWORD_MIN, validateChildPassword, validateLoginId } from '@/domain/child-account';
import { parentLoginEmail } from '@/domain/login-info';
import { useChildAccounts } from '@/hooks/useFamilyAdmin';
import { copyText } from '@/services/clipboard';
import { useSessionStore } from '@/store/session';
import { useToastStore } from '@/store/toast';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

/** Compte de connexion d'un enfant, géré par le parent : création (identifiant + mot de passe), nouveau mot de passe, suppression. */
export function ChildAccountSection({ childId, childName }: { childId: string; childName: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  const accounts = useChildAccounts(true);
  const parentEmail = parentLoginEmail(useSessionStore((s) => s.session?.user.email));
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const account = accounts.data?.find((a) => a.child_id === childId);
  const loginIdError = loginId === '' ? null : validateLoginId(loginId);
  const passwordError = password === '' ? null : validateChildPassword(password);

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setPassword('');
      setLoginId('');
      show(t(success));
      await queryClient.invalidateQueries({ queryKey: ['child-accounts'] });
    } catch (e) {
      setError(t(`childAccount.errors.${e instanceof ChildAccountError ? e.code : 'server_error'}`, { min: CHILD_PASSWORD_MIN }));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    const ok = await copyText(text);
    show(t(ok ? 'childAccount.login.copied' : 'childAccount.login.copyFailed'), ok ? 'info' : 'error');
  };

  return (
    <View style={styles.box}>
      <Text accessibilityRole="header" style={typography.title}>{t('childAccount.title')}</Text>
      {account ? (
        <>
          <Text style={typography.secondary}>{t('childAccount.loginIdIs', { id: account.login_id })}</Text>
          <View style={styles.login}>
            <Text accessibilityRole="header" style={styles.loginTitle}>{t('childAccount.login.title', { name: childName })}</Text>
            <Text style={typography.secondary}>{t('childAccount.login.intro', { name: childName })}</Text>
            {parentEmail ? <LoginLine label={t('childAccount.login.email')} value={parentEmail} copyLabel={t('childAccount.login.copyEmail')} onCopy={() => void copy(parentEmail)} /> : null}
            <LoginLine label={t('childAccount.login.id')} value={account.login_id} copyLabel={t('childAccount.login.copyId', { name: childName })} onCopy={() => void copy(account.login_id)} />
            <View style={styles.line}>
              <Text style={styles.lineLabel}>{t('childAccount.login.password')}</Text>
              <Text style={styles.lineValue}>{t('childAccount.login.passwordValue')}</Text>
            </View>
          </View>
          <Field
            label={t('childAccount.newPassword')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            error={passwordError ? t('childAccount.errors.weak_password', { min: CHILD_PASSWORD_MIN }) : null}
          />
          <Button
            variant="secondary"
            label={t('childAccount.changePassword')}
            accessibilityLabel={`${t('childAccount.changePassword')} ${childName}`}
            disabled={password === '' || passwordError !== null}
            loading={busy}
            onPress={() => void run(() => resetChildPassword(childId, password), 'childAccount.passwordChanged')}
          />
          <Button
            variant="secondary"
            label={t('childAccount.delete')}
            accessibilityLabel={`${t('childAccount.delete')} ${childName}`}
            onPress={() =>
              confirmDialog({
                title: t('childAccount.delete'),
                message: t('childAccount.deleteBody', { name: childName }),
                confirmLabel: t('childAccount.delete'),
                cancelLabel: t('common.cancel'),
                destructive: true,
                onConfirm: () => void run(() => deleteChildAccount(childId), 'childAccount.deleted'),
              })
            }
          />
        </>
      ) : (
        <>
          <Text style={typography.secondary}>{t('childAccount.hint', { name: childName })}</Text>
          <Field
            label={t('childAccount.loginId')}
            value={loginId}
            onChangeText={setLoginId}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={60}
            error={loginIdError ? t(`childAccount.loginIdErrors.${loginIdError}`) : null}
          />
          <Field
            label={t('childAccount.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            error={passwordError ? t('childAccount.errors.weak_password', { min: CHILD_PASSWORD_MIN }) : null}
          />
          <Button
            label={t('childAccount.create')}
            accessibilityLabel={`${t('childAccount.create')} ${childName}`}
            disabled={loginId === '' || password === '' || loginIdError !== null || passwordError !== null}
            loading={busy}
            onPress={() => void run(() => createChildAccount(childId, loginId, password), 'childAccount.created')}
          />
        </>
      )}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

/** Une valeur à saisir sur le téléphone de l'enfant, avec son bouton « Copier » (cible ≥ 44 pt). */
function LoginLine({ label, value, copyLabel, onCopy }: { label: string; value: string; copyLabel: string; onCopy: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.line}>
      <View style={styles.lineText}>
        <Text style={styles.lineLabel}>{label}</Text>
        <Text selectable style={styles.lineValue}>{value}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={copyLabel} onPress={onCopy} style={styles.copy}>
        <Text style={styles.copyText}>{t('childAccount.login.copy')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  login: { gap: 8, backgroundColor: colors.card, borderRadius: 12, padding: 12 },
  loginTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TARGET },
  lineText: { flex: 1 },
  lineLabel: { fontSize: 13, color: colors.textSecondary },
  lineValue: { fontSize: 16, fontWeight: '600', color: colors.text },
  copy: { minWidth: MIN_TARGET, minHeight: MIN_TARGET, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: colors.primaryTint },
  copyText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  box: { gap: 8, borderTopWidth: 1, borderTopColor: colors.primaryTint, paddingTop: 12 },
});
