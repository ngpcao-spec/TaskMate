import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthFlowError, signInChild } from '@/api/auth';
import { Button, ErrorText, Field, Screen, Subtitle, Title } from '@/components/ui';

/**
 * Enfant : e-mail d'un parent de la famille + identifiant + mot de passe (Edge Function `child-login`).
 * Le message d'erreur est le même quel que soit le champ faux (aucune énumération d'e-mails).
 */
export default function ChildLoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [parentEmail, setParentEmail] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInChild(parentEmail, loginId, password);
      queryClient.clear();
      router.replace('/');
    } catch (e) {
      const kind = e instanceof AuthFlowError ? e.kind : 'unknown';
      setError(t(`onboarding.childLogin.errors.${kind}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>{t('onboarding.childLogin.title')}</Title>
      <Subtitle>{t('onboarding.childLogin.subtitle')}</Subtitle>
      <Field
        label={t('onboarding.childLogin.parentEmail')}
        placeholder={t('onboarding.auth.emailPlaceholder')}
        value={parentEmail}
        onChangeText={setParentEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
      />
      <Field
        label={t('onboarding.childLogin.loginId')}
        value={loginId}
        onChangeText={setLoginId}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        maxLength={60}
      />
      <Field
        label={t('onboarding.childLogin.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
      />
      <ErrorText>{error}</ErrorText>
      <Button label={t('onboarding.childLogin.submit')} onPress={() => void submit()} loading={busy} disabled={parentEmail.trim() === '' || loginId.trim() === '' || password === ''} />
    </Screen>
  );
}
