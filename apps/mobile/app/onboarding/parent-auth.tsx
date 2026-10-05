import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthFlowError, signInParent } from '@/api/auth';
import { startGoogleSignIn } from '@/api/googleAuth';
import { Button, ErrorText, Field, Screen, Subtitle, Title } from '@/components/ui';
import { isValidEmail } from '@/domain/child-account';

/**
 * Parent : « Continuer avec Google » (l'e-mail est vérifié par Google ; seule voie d'inscription d'un nouveau parent).
 * La connexion e-mail + mot de passe reste réservée aux comptes parents déjà existants (aucun bouton d'inscription).
 */
export default function ParentAuthScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (e: unknown) => setError(t(`onboarding.auth.errors.${e instanceof AuthFlowError ? e.kind : 'unknown'}`));

  const google = async () => {
    setBusy(true);
    setError(null);
    try {
      await startGoogleSignIn(); // redirige vers Google ; la session est lue au retour sur le site
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };

  const signIn = async () => {
    if (!isValidEmail(email)) return setError(t('onboarding.auth.invalidEmail'));
    setBusy(true);
    setError(null);
    try {
      await signInParent(email, password);
      router.replace('/');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>{t('onboarding.auth.title')}</Title>
      <Subtitle>{t('onboarding.auth.subtitle')}</Subtitle>
      <Button label={t('onboarding.auth.google')} onPress={() => void google()} loading={busy && !showEmail} />
      {showEmail ? (
        <>
          <Subtitle>{t('onboarding.auth.existingHint')}</Subtitle>
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
          />
          <Button variant="secondary" label={t('onboarding.auth.signIn')} onPress={() => void signIn()} loading={busy} disabled={email.trim() === '' || password === ''} />
        </>
      ) : (
        <Button variant="ghost" label={t('onboarding.auth.existingToggle')} onPress={() => setShowEmail(true)} />
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
