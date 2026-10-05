import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createFamily, FamilyActionError, joinFamilyWithCode } from '@/api/family';
import { queryKeys } from '@/api/keys';
import { Button, ErrorText, Field, Screen, Subtitle, Title } from '@/components/ui';
import { isValidInviteCode, toJoinFailure } from '@/domain/parent-invite';
import { useSessionStore } from '@/store/session';

/** Prénom suggéré par le compte Google (champ modifiable). */
function suggestedName(meta: Record<string, unknown> | undefined): string {
  const given = meta?.given_name ?? meta?.name ?? meta?.full_name;
  return typeof given === 'string' ? given.trim().split(/\s+/)[0]?.slice(0, 40) ?? '' : '';
}

/** Après la connexion Google : créer une famille OU rejoindre celle d'un autre parent avec son code d'invitation. */
export default function FamilyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSessionStore((s) => s.session);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [familyName, setFamilyName] = useState('');
  const [yourName, setYourName] = useState(() => suggestedName(session?.user.user_metadata));
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'create') await createFamily(familyName.trim(), yourName.trim());
      else await joinFamilyWithCode(code, yourName.trim());
      // refetchType 'all' : la requête `me` est inactive sur cet écran ; sans cela l'accueil lirait le cache « pas de famille »
      await queryClient.invalidateQueries({ queryKey: queryKeys.me, refetchType: 'all' });
      router.replace('/');
    } catch (e) {
      const failure = e instanceof FamilyActionError ? e.failure : toJoinFailure((e as { message?: string } | null)?.message);
      setError(t(`onboarding.family.errors.${failure}`));
    } finally {
      setBusy(false);
    }
  };

  const ready = yourName.trim() !== '' && (mode === 'create' ? familyName.trim() !== '' : isValidInviteCode(code));

  return (
    <Screen>
      <Title>{t('onboarding.family.title')}</Title>
      {mode === 'join' ? <Subtitle>{t('onboarding.family.codeHint')}</Subtitle> : null}
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
          label={t('onboarding.family.code')}
          placeholder={t('onboarding.family.codePlaceholder')}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
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
      <Button label={mode === 'create' ? t('onboarding.family.create') : t('onboarding.family.join')} onPress={() => void submit()} loading={busy} disabled={!ready} />
      <Button
        variant="ghost"
        label={mode === 'create' ? t('onboarding.family.switchToJoin') : t('onboarding.family.switchToCreate')}
        onPress={() => {
          setMode(mode === 'create' ? 'join' : 'create');
          setError(null);
        }}
      />
    </Screen>
  );
}
