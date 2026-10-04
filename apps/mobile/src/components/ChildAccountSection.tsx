import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { ChildAccountError, createChildAccount, deleteChildAccount, resetChildPassword } from '@/api/childAccounts';
import { confirmDialog } from '@/components/confirm';
import { Button, ErrorText, Field } from '@/components/ui';
import { CHILD_PASSWORD_MIN, validateChildPassword, validateLoginId } from '@/domain/child-account';
import { useChildAccounts } from '@/hooks/useFamilyAdmin';
import { useToastStore } from '@/store/toast';
import { colors, typography } from '@/theme/tokens';

/** Compte de connexion d'un enfant, géré par le parent : création (identifiant + mot de passe), nouveau mot de passe, suppression. */
export function ChildAccountSection({ childId, childName }: { childId: string; childName: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  const accounts = useChildAccounts(true);
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

  return (
    <View style={styles.box}>
      <Text accessibilityRole="header" style={typography.title}>{t('childAccount.title')}</Text>
      {account ? (
        <>
          <Text style={typography.secondary}>{t('childAccount.loginIdIs', { id: account.login_id })}</Text>
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

const styles = StyleSheet.create({
  box: { gap: 8, borderTopWidth: 1, borderTopColor: colors.primaryTint, paddingTop: 12 },
});
