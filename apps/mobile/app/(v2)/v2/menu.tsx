import { useRouter } from 'expo-router';
import { Bell, CalendarDays, ChevronRight, Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { V2Screen } from '@/v2/components/V2Screen';
import { v2Card, v2Colors, v2Spacing, v2Text, V2_TOUCH } from '@/v2/theme';

/** Menu du haut (V2) : Lịch (calendrier V1 réutilisé) et réglages rapides. */
export default function V2Menu() {
  const { t } = useTranslation();
  const router = useRouter();
  const rows = [
    { key: 'calendar', Icon: CalendarDays, label: t('v2.top.calendar'), go: () => router.push('/v2/calendar') },
    { key: 'notifications', Icon: Bell, label: t('v2.me.notifications'), go: () => router.push('/v2/notification-settings') },
    { key: 'settings', Icon: Settings, label: t('v2.me.settings'), go: () => router.push('/v2/settings') },
  ];
  return (
    <V2Screen title={t('v2.top.menu')}>
      <View style={[v2Card, styles.group]}>
        {rows.map((r) => (
          <Pressable key={r.key} accessibilityRole="button" accessibilityLabel={r.label} onPress={r.go} style={styles.row}>
            <r.Icon size={22} color={v2Colors.primary} />
            <Text style={[v2Text.bodyBold, styles.flex]}>{r.label}</Text>
            <ChevronRight size={20} color={v2Colors.textSecondary} />
          </Pressable>
        ))}
      </View>
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: v2Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: v2Spacing.md, minHeight: V2_TOUCH + 8 },
});
