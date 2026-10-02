import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { signInAnonymously } from '@/api/auth';
import { fetchMe, redeemInvite, type RedeemResult } from '@/api/family';
import { queryKeys } from '@/api/keys';
import { supabase } from '@/api/supabase';
import { QrScanner } from '@/components/QrScanner';
import { Button, ErrorText, Field, Screen, Subtitle, Title } from '@/components/ui';
import { isValidInviteCode, normalizeInviteCode, parseInviteLink } from '@/domain/invite';

type JoinOutcome = { result: RedeemResult; name: string };

/** Jointure d'un enfant : code saisi, QR scanné ou lien profond ; session anonyme (SPEC §2.1, §6). */
export default function JoinScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(() => (params.code ? normalizeInviteCode(params.code) : ''));
  const [scanning, setScanning] = useState(false);

  const joinMutation = useMutation<JoinOutcome, Error, string>({
    mutationFn: async (rawCode) => {
      await signInAnonymously();
      const result = await redeemInvite(normalizeInviteCode(rawCode));
      if (!result.ok) return { result, name: '' };
      const { data } = await supabase.auth.getSession();
      const me = data.session ? await fetchMe(data.session.user.id) : null;
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      return { result, name: me?.member.display_name ?? '' };
    },
  });
  const { mutate: join } = joinMutation;
  const busy = joinMutation.isPending;
  const joinedName = joinMutation.data?.result.ok ? joinMutation.data.name : null;
  const failure = joinMutation.data && !joinMutation.data.result.ok ? joinMutation.data.result.reason : null;
  const error = joinMutation.isError
    ? t('common.error')
    : failure === 'tooMany'
      ? t('onboarding.join.tooMany')
      : failure === 'alreadyMember'
        ? t('onboarding.join.alreadyMember')
        : failure === 'invalid'
          ? t('onboarding.join.invalid')
          : null;

  // Lien profond avec code : jointure immédiate.
  const deepLinkCode = params.code;
  useEffect(() => {
    if (deepLinkCode && isValidInviteCode(deepLinkCode)) join(deepLinkCode);
  }, [deepLinkCode, join]);

  if (joinedName !== null) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <Title>{t('onboarding.join.confirmTitle', { name: joinedName })}</Title>
          <Subtitle>{t('onboarding.join.confirmBody', { name: joinedName })}</Subtitle>
        </View>
        <Button label={t('onboarding.join.confirmYes')} onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  if (scanning) {
    return (
      <Screen scroll={false}>
        <Title>{t('onboarding.join.scan')}</Title>
        <QrScanner
          onScan={(data) => {
            const parsed = parseInviteLink(data);
            if (parsed) {
              setScanning(false);
              setCode(parsed);
              join(parsed);
            }
          }}
        />
        <Button variant="ghost" label={t('common.cancel')} onPress={() => setScanning(false)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{t('onboarding.join.title')}</Title>
      <Field
        label={t('onboarding.join.codeLabel')}
        placeholder={t('onboarding.join.codePlaceholder')}
        value={code}
        onChangeText={(v) => setCode(normalizeInviteCode(v))}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={8}
      />
      <ErrorText>{error}</ErrorText>
      <Button label={t('onboarding.join.submit')} onPress={() => join(code)} loading={busy} disabled={!isValidInviteCode(code)} />
      <Button
        variant="secondary"
        label={t('onboarding.join.scan')}
        onPress={() => setScanning(true)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
