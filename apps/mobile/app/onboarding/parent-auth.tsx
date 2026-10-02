import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { requestEmailOtp, verifyEmailOtp } from '@/api/auth';
import { Button, ErrorText, Field, Screen, Subtitle, Title } from '@/components/ui';
import { config } from '@/config';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ParentAuthScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!EMAIL_RE.test(email.trim())) return setError(t('onboarding.auth.invalidEmail'));
    setBusy(true);
    setError(null);
    try {
      await requestEmailOtp(email.trim());
      setSent(true);
    } catch {
      setError(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      await verifyEmailOtp(email.trim(), code.trim());
      router.replace('/');
    } catch {
      setError(t('onboarding.auth.invalidCode'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>{t('onboarding.auth.title')}</Title>
      {sent ? (
        <>
          <Subtitle>{t('onboarding.auth.codeSent', { email: email.trim() })}</Subtitle>
          <Field
            label={t('onboarding.auth.code')}
            placeholder={t('onboarding.auth.codePlaceholder')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={8}
          />
          <ErrorText>{error}</ErrorText>
          <Button label={t('onboarding.auth.verify')} onPress={verify} loading={busy} disabled={code.trim().length < 6} />
          <Button variant="ghost" label={t('onboarding.auth.changeEmail')} onPress={() => setSent(false)} />
        </>
      ) : (
        <>
          <Field
            label={t('onboarding.auth.email')}
            placeholder={t('onboarding.auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <ErrorText>{error}</ErrorText>
          <Button label={t('onboarding.auth.sendCode')} onPress={send} loading={busy} disabled={email.trim() === ''} />
          {config.socialAuthEnabled ? (
            <>
              <Button variant="secondary" label={t('onboarding.auth.apple')} onPress={() => setError(t('common.error'))} />
              <Button variant="secondary" label={t('onboarding.auth.google')} onPress={() => setError(t('common.error'))} />
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
