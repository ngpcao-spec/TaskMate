import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthFlowError, signInParent, signUpParent, type AuthFailure } from '@/api/auth';
import { Button, ErrorText, Field, Screen, Subtitle, Title } from '@/components/ui';
import { isValidEmail, PARENT_PASSWORD_MIN, validateParentPassword } from '@/domain/child-account';

/** Parent : un seul écran e-mail + mot de passe ; aucun e-mail n'est envoyé (« Confirm email » désactivé côté Supabase). */
export default function ParentAuthScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordError = password === '' ? null : validateParentPassword(password);
  const ready = email.trim() !== '' && password !== '';

  const run = async (action: 'signUp' | 'signIn') => {
    if (!isValidEmail(email)) return setError(t('onboarding.auth.invalidEmail'));
    if (validateParentPassword(password)) return setError(t('onboarding.auth.passwordTooShort', { min: PARENT_PASSWORD_MIN }));
    setBusy(true);
    setError(null);
    try {
      await (action === 'signUp' ? signUpParent(email, password) : signInParent(email, password));
      router.replace('/');
    } catch (e) {
      const kind: AuthFailure = e instanceof AuthFlowError ? e.kind : 'unknown';
      setError(t(`onboarding.auth.errors.${kind}`, { min: PARENT_PASSWORD_MIN }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>{t('onboarding.auth.title')}</Title>
      <Subtitle>{t('onboarding.auth.subtitle')}</Subtitle>
      <Field
        label={t('onboarding.auth.email')}
        placeholder={t('onboarding.auth.emailPlaceholder')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
      />
      <Field
        label={t('onboarding.auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        error={passwordError ? t('onboarding.auth.passwordTooShort', { min: PARENT_PASSWORD_MIN }) : null}
      />
      <ErrorText>{error}</ErrorText>
      <Button label={t('onboarding.auth.signUp')} onPress={() => void run('signUp')} loading={busy} disabled={!ready} />
      <Button variant="secondary" label={t('onboarding.auth.signIn')} onPress={() => void run('signIn')} loading={busy} disabled={!ready} />
    </Screen>
  );
}
