import { useRouter, type Href } from 'expo-router';
import { Baby, Bell, ChevronRight, ListChecks, Settings, ShieldCheck, Target, UserPlus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsPlatformAdmin } from '@/hooks/useCatalog';
import { V2Screen } from '@/v2/components/V2Screen';
import { v2Card, v2Colors, v2Spacing, v2Text, V2_TOUCH } from '@/v2/theme';

/**
 * Cài đặt du parent (V2) : entrées vers les écrans de la V1 (mêmes écrans, même logique). L'espace administrateur n'apparaît que pour
 * l'administrateur de la plateforme (la base répond ; chaque RPC revérifie, D-080).
 */
export default function V2ParentSettings() {
  const { t } = useTranslation();
  const router = useRouter();
  const isAdmin = useIsPlatformAdmin().data === true;
  const rows: { key: string; label: string; href: Href; Icon: typeof Bell }[] = [
    { key: 'children', label: t('v2.settings.children'), href: '/more/children', Icon: Baby },
    { key: 'add-child', label: t('v2.settings.addChild'), href: '/more/add-child', Icon: UserPlus },
    { key: 'tasks', label: t('profile.tasks'), href: '/more/tasks', Icon: ListChecks },
    { key: 'goals', label: t('profile.goals'), href: '/more/goals', Icon: Target },
    { key: 'notifications', label: t('profile.notifications'), href: '/more/notification-settings', Icon: Bell },
    { key: 'settings', label: t('profile.settings'), href: '/more/settings', Icon: Settings },
    ...(isAdmin ? [{ key: 'admin', label: t('profile.admin'), href: '/admin' as Href, Icon: ShieldCheck }] : []),
  ];
  return (
    <V2Screen title={t('v2.tabs.settings')} testID="v2-parent-settings">
      <View style={[v2Card, styles.group]}>
        {rows.map((r) => (
          <Pressable key={r.key} accessibilityRole="button" accessibilityLabel={r.label} onPress={() => router.push(r.href)} style={styles.row} testID={`v2-settings-${r.key}`}>
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
