import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createFamily, redeemInvite } from '@/api/family';
import { queryKeys } from '@/api/keys';
import { Button, ErrorText, Field, Screen, Title } from '@/components/ui';
import { isValidInviteCode, normalizeInviteCode } from '@/domain/invite';

export default function FamilyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [familyName, setFamilyName] = useState('');
  const [yourName, setYourName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'create') {
        await createFamily(familyName.trim(), yourName.trim());
      } else {
        const result = await redeemInvite(normalizeInviteCode(code), yourName.trim());
        if (!result.ok) {
          setError(
            result.reason === 'tooMany'
              ? t('onboarding.join.tooMany')
              : result.reason === 'alreadyMember'
                ? t('onboarding.join.alreadyMember')
                : t('onboarding.join.invalid'),
          );
          return;
        }
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      router.replace('/');
    } catch {
      setError(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const ready =
    yourName.trim() !== '' && (mode === 'create' ? familyName.trim() !== '' : isValidInviteCode(code));

  return (
    <Screen>
      <Title>{t('onboarding.family.title')}</Title>
      {mode === 'create' ? (
        <Field
          label={t('onboarding.family.familyName')}
          placeholder={t('onboarding.family.familyNamePlaceholder')}
          value={familyName}
          onChangeText={setFamilyName}
          maxLength={80}
        />
      ) : (
        <Field
          label={t('onboarding.family.coParentCode')}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
        />
      )}
      <Field
        label={t('onboarding.family.yourName')}
        placeholder={t('onboarding.family.yourNamePlaceholder')}
        value={yourName}
        onChangeText={setYourName}
        maxLength={40}
      />
      <ErrorText>{error}</ErrorText>
      <Button label={t('common.continue')} onPress={submit} loading={busy} disabled={!ready} />
      <Button
        variant="ghost"
        label={mode === 'create' ? t('onboarding.family.join') : t('onboarding.family.create')}
        onPress={() => {
          setMode(mode === 'create' ? 'join' : 'create');
          setError(null);
        }}
      />
    </Screen>
  );
}
