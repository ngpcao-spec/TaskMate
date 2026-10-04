import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createFamily } from '@/api/family';
import { queryKeys } from '@/api/keys';
import { Button, ErrorText, Field, Screen, Title } from '@/components/ui';

export default function FamilyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [familyName, setFamilyName] = useState('');
  const [yourName, setYourName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await createFamily(familyName.trim(), yourName.trim());
      // refetchType 'all' : la requête `me` est inactive sur cet écran ; sans cela l'accueil lirait le cache « pas de famille » et renverrait ici
      await queryClient.invalidateQueries({ queryKey: queryKeys.me, refetchType: 'all' });
      router.replace('/');
    } catch {
      setError(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const ready = yourName.trim() !== '' && familyName.trim() !== '';

  return (
    <Screen>
      <Title>{t('onboarding.family.title')}</Title>
      <Field
        label={t('onboarding.family.familyName')}
        placeholder={t('onboarding.family.familyNamePlaceholder')}
        value={familyName}
        onChangeText={setFamilyName}
        maxLength={80}
      />
      <Field
        label={t('onboarding.family.yourName')}
        placeholder={t('onboarding.family.yourNamePlaceholder')}
        value={yourName}
        onChangeText={setYourName}
        maxLength={40}
      />
      <ErrorText>{error}</ErrorText>
      <Button label={t('common.continue')} onPress={submit} loading={busy} disabled={!ready} />
    </Screen>
  );
}
