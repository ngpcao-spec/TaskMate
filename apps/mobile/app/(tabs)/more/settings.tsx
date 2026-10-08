import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { confirmDialog } from '@/components/confirm';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { signOut } from '@/api/auth';
import { syncPushLocale } from '@/api/notifications';
import { Chip } from '@/components/Chip';
import { ParentInviteCard } from '@/components/ParentInviteCard';
import { ParentsCard } from '@/components/ParentsCard';
import { Button, Card, Field, Screen, Title } from '@/components/ui';
import { config } from '@/config';
import { isValidTimeZone } from '@/domain/timezone';
import { useDeleteAccount, useUpdateTimezone } from '@/hooks/useFamilyAdmin';
import { useMe } from '@/hooks/useMe';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { setLanguage } from '@/i18n/language';
import { colors, typography } from '@/theme/tokens';

/** Cài đặt chung (SPEC §3.9) : langue, déconnexion ; parent : enfants, appareils, invitation et liste des parents, fuseau, suppression. */
export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe().data;
  const deleteAccount = useDeleteAccount();
  const updateTz = useUpdateTimezone();
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
    confirmDialog({
      title: t('settings.deleteTitle'),
      message: t('settings.deleteBody'),
      confirmLabel: t('settings.deleteConfirm'),
      cancelLabel: t('common.cancel'),
      destructive: true,
      onConfirm: () =>
        deleteAccount.mutate(undefined, {
          onSuccess: async () => {
            await signOut().catch(() => undefined);
            queryClient.clear();
            router.replace('/');
          },
        }),
    });

  return (
    <Screen>
      <Title>{t('settings.title')}</Title>

      <Card>
        <Text accessibilityRole="header" style={styles.section}>{t('settings.language')}</Text>
        <View style={styles.wrap}>
          {SUPPORTED_LANGUAGES.map((l) => (
            <Chip key={l} label={t(`settings.lang.${l}`)} selected={i18n.language === l} onPress={() => void setLanguage(l).then(syncPushLocale)} />
          ))}
        </View>
      </Card>

      {isParent ? (
        <>
          <Button variant="secondary" label={t('settings.manageChildren')} onPress={() => router.push('/more/children')} />
          <Button variant="secondary" label={t('settings.devices')} onPress={() => router.push('/more/devices')} />
          <Button variant="secondary" label={t('settings.diagnostics')} onPress={() => router.push('/more/diagnostics')} />

          <ParentInviteCard />
          <ParentsCard myMemberId={me.member.id} />

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
