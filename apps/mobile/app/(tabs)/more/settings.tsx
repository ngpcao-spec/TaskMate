import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { signOut } from '@/api/auth';
import { Chip } from '@/components/Chip';
import { InviteCard } from '@/components/InviteCard';
import { Button, Card, Field, Screen, Title } from '@/components/ui';
import { config } from '@/config';
import { isValidTimeZone } from '@/domain/timezone';
import { useCreateInvite, useDeleteAccount, useUpdateTimezone } from '@/hooks/useFamilyAdmin';
import { useMe } from '@/hooks/useMe';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { setLanguage } from '@/i18n/language';
import { colors, typography } from '@/theme/tokens';

/** Cài đặt chung (SPEC §3.9) : langue, déconnexion ; parent : enfants, appareils, co-parent, fuseau, suppression. */
export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe().data;
  const invite = useCreateInvite();
  const deleteAccount = useDeleteAccount();
  const updateTz = useUpdateTimezone();
  const [coParentCode, setCoParentCode] = useState<string | null>(null);
  const [tz, setTz] = useState(me?.family.timezone ?? 'Asia/Ho_Chi_Minh');
  if (!me) return null;
  const isParent = me.member.role === 'parent';
  const tzValid = isValidTimeZone(tz);

  const logout = async () => {
    await signOut();
    queryClient.clear();
    router.replace('/');
  };

  const confirmDelete = () =>
    Alert.alert(t('settings.deleteTitle'), t('settings.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteConfirm'),
        style: 'destructive',
        onPress: () =>
          deleteAccount.mutate(undefined, {
            onSuccess: async () => {
              await signOut().catch(() => undefined);
              queryClient.clear();
              router.replace('/');
            },
          }),
      },
    ]);

  return (
    <Screen>
      <Title>{t('settings.title')}</Title>

      <Card>
        <Text accessibilityRole="header" style={styles.section}>{t('settings.language')}</Text>
        <View style={styles.wrap}>
          {SUPPORTED_LANGUAGES.map((l) => (
            <Chip key={l} label={t(`settings.lang.${l}`)} selected={i18n.language === l} onPress={() => void setLanguage(l)} />
          ))}
        </View>
      </Card>

      {isParent ? (
        <>
          <Button variant="secondary" label={t('settings.manageChildren')} onPress={() => router.push('/more/children')} />
          <Button variant="secondary" label={t('settings.devices')} onPress={() => router.push('/more/devices')} />

          <Card>
            <Text accessibilityRole="header" style={styles.section}>{t('settings.coParent')}</Text>
            <InviteCard
              code={coParentCode}
              hint={t('settings.coParentHint')}
              actionLabel={coParentCode ? t('onboarding.children.regenerate') : t('settings.coParentInvite')}
              loading={invite.isPending}
              onGenerate={() => invite.mutate(null, { onSuccess: setCoParentCode })}
            />
          </Card>

          <Card>
            <Field label={t('settings.timezone')} value={tz} onChangeText={setTz} autoCapitalize="none" autoCorrect={false} error={tzValid ? null : t('settings.timezoneInvalid')} />
            <Button
              label={t('common.save')}
              disabled={!tzValid || tz === me.family.timezone}
              loading={updateTz.isPending}
              onPress={() => updateTz.mutate({ familyId: me.family.id, timezone: tz })}
            />
          </Card>
        </>
      ) : null}

      {config.privacyPolicyUrl ? <Button variant="ghost" label={t('settings.privacy')} onPress={() => void Linking.openURL(config.privacyPolicyUrl)} /> : null}
      <Button variant="secondary" label={t('settings.logout')} onPress={() => void logout()} />
      {isParent ? (
        <Card>
          <Text style={typography.secondary}>{t('settings.deleteHint')}</Text>
          <Button label={t('settings.deleteAccount')} onPress={confirmDelete} loading={deleteAccount.isPending} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { ...typography.title, color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
