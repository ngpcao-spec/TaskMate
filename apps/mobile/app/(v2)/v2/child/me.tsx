import { useRouter } from 'expo-router';
import { Bell, ChevronRight, Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { syncPushLocale } from '@/api/notifications';
import { Avatar } from '@/components/Avatar';
import { PandaSettingsCard } from '@/components/companion/PandaSettingsCard';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { setLanguage } from '@/i18n/language';
import { V2Screen } from '@/v2/components/V2Screen';
import { v2Card, v2Colors, v2Radius, v2Spacing, v2Text, V2_TOUCH } from '@/v2/theme';

function LinkRow({ label, onPress, Icon }: { label: string; onPress: () => void; Icon: typeof Bell }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.link}>
      <Icon size={22} color={v2Colors.primary} />
      <Text style={[v2Text.bodyBold, styles.flex]}>{label}</Text>
      <ChevronRight size={20} color={v2Colors.textSecondary} />
    </Pressable>
  );
}

/** Tôi (enfant, V2) : mon panda (nom, trait, plus jeune / plus grand), mon avatar, notifications, langue. Réglages et composants existants. */
export default function V2ChildMe() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  if (!d || !d.child) return null;
  const child = d.child;
  return (
    <V2Screen title={t('v2.tabs.me')} testID="v2-me">
      <Pressable accessibilityRole="button" accessibilityLabel={t('v2.me.avatar')} onPress={() => router.push('/v2/avatar')} style={[v2Card, styles.profile]}>
        <Avatar childId={child.id} name={child.name} color={child.color} size={72} />
        <View style={styles.flex}>
          <Text style={v2Text.heading}>{child.name}</Text>
          <Text style={v2Text.caption}>{t('v2.me.avatar')}</Text>
        </View>
        <ChevronRight size={20} color={v2Colors.textSecondary} />
      </Pressable>

      <PandaSettingsCard childId={child.id} />

      <View style={[v2Card, styles.group]}>
        <Text accessibilityRole="header" style={v2Text.heading}>
          {t('settings.language')}
        </Text>
        <View style={styles.wrap}>
          {SUPPORTED_LANGUAGES.map((l) => {
            const on = i18n.language === l;
            return (
              <Pressable key={l} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={t(`settings.lang.${l}`)} onPress={() => void setLanguage(l).then(syncPushLocale)} style={[styles.chip, on ? styles.chipOn : null]}>
                <Text style={[v2Text.bodyBold, on ? styles.chipTextOn : null]}>{t(`settings.lang.${l}`)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[v2Card, styles.group]}>
        <LinkRow Icon={Bell} label={t('v2.me.notifications')} onPress={() => router.push('/v2/notification-settings')} />
        <LinkRow Icon={Settings} label={t('v2.me.settings')} onPress={() => router.push('/v2/settings')} />
      </View>
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: v2Spacing.lg },
  group: { gap: v2Spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: v2Spacing.sm },
  chip: { minHeight: V2_TOUCH, paddingHorizontal: v2Spacing.lg, borderRadius: v2Radius.pill, borderWidth: 2, borderColor: v2Colors.line, justifyContent: 'center', backgroundColor: v2Colors.card },
  chipOn: { backgroundColor: v2Colors.primary, borderColor: v2Colors.primary },
  chipTextOn: { color: v2Colors.onPrimary },
  link: { flexDirection: 'row', alignItems: 'center', gap: v2Spacing.md, minHeight: V2_TOUCH + 8 },
});
