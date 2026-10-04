import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthFlowError, signInChild, type AuthFailure } from '@/api/auth';
import { Button, ErrorText, Field, Screen, Subtitle, Title } from '@/components/ui';

/** Enfant : identifiant + mot de passe donnés par le parent (ni e-mail, ni code, ni QR). */
export default function ChildLoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInChild(loginId, password);
      queryClient.clear();
      router.replace('/');
    } catch (e) {
      const kind: AuthFailure = e instanceof AuthFlowError ? e.kind : 'unknown';
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
      <Button label={t('onboarding.childLogin.submit')} onPress={() => void submit()} loading={busy} disabled={loginId.trim() === '' || password === ''} />
    </Screen>
  );
}
