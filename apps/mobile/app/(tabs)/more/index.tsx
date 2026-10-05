import { useRouter } from 'expo-router';
import { Bell, Check, ChevronRight, ListChecks, Plus, Settings, Star, Target } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Screen, ScreenHeader } from '@/components/ui';
import { ageFromBirthDate } from '@/domain/age';
import { todayInTz } from '@/domain/family-time';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

type Href = '/more/tasks' | '/more/goals' | '/more/points' | '/more/notification-settings' | '/more/settings';

/** Hồ sơ : cartes des enfants (parent) / sa carte + celle du frère (enfant) et menu (SPEC §3.5). */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  if (!d) return null;
  const today = todayInTz(new Date(), d.me.family.timezone);
  const menu: { key: string; label: string; href: Href; icon: typeof Star; tint?: string }[] = [
    { key: 'tasks', label: t('profile.tasks'), href: '/more/tasks', icon: ListChecks },
    { key: 'goals', label: t('profile.goals'), href: '/more/goals', icon: Target },
    { key: 'points', label: t('profile.points'), href: '/more/points', icon: Star, tint: colors.warning },
    { key: 'notifications', label: t('profile.notifications'), href: '/more/notification-settings', icon: Bell },
    { key: 'settings', label: t('profile.settings'), href: '/more/settings', icon: Settings },
  ];

  return (
    <Screen>
      <ScreenHeader title={t('profile.title')} hideBack />
      <View style={styles.cards}>
        {d.children.map((c) => {
          const isParent = d.viewer.role === 'parent';
          const active = c.id === d.child?.id;
          const age = t('common.yearsOld', { age: ageFromBirthDate(c.birth_date, today) });
          const color = c.color ?? colors.primary;
          const content = (
            <>
              {isParent && active ? (
                <View style={[styles.checkBadge, { backgroundColor: color }]}>
                  <Check size={14} color="#fff" strokeWidth={3} />
                </View>
              ) : null}
              <View style={[styles.avatar, { backgroundColor: color }]}>
                <Text style={styles.avatarText}>{c.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <Text style={styles.childName}>{c.name}</Text>
              <Text style={typography.secondary}>{age}</Text>
            </>
          );
          // Enfant (D-052) : sa seule carte, sans sélection possible. Parent : une carte sélectionnable par enfant.
          return isParent ? (
            <Pressable
              key={c.id}
              accessibilityRole="radio"
              accessibilityLabel={`${c.name}, ${age}`}
              accessibilityState={{ selected: active }}
              aria-checked={active}
              onPress={() => d.select(c.id)}
              style={[styles.childCard, { backgroundColor: `${color}1A` }, active && { borderColor: color }]}
            >
              {content}
            </Pressable>
          ) : (
            <View key={c.id} accessible accessibilityLabel={`${c.name}, ${age}`} style={[styles.childCard, { backgroundColor: `${color}1A` }]}>
              {content}
            </View>
          );
        })}
        {d.viewer.role === 'parent' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('addChild.button')}
            onPress={() => router.push('/more/add-child')}
            style={[styles.childCard, styles.addCard]}
          >
            <View style={styles.addIcon}>
              <Plus size={28} color={colors.primary} strokeWidth={2.5} />
            </View>
            <Text style={styles.addText}>{t('addChild.button')}</Text>
          </Pressable>
        ) : null}
      </View>
      <Card>
        {menu.map(({ key, label, href, icon: Icon, tint }, i) => (
          <Pressable key={key} accessibilityRole="button" accessibilityLabel={label} onPress={() => router.push(href)} style={[styles.menuRow, i > 0 && styles.menuSeparator]}>
            <Icon color={tint ?? colors.primary} size={22} />
            <Text style={styles.menuLabel}>{label}</Text>
            <ChevronRight color={colors.textSecondary} />
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  childCard: { flexGrow: 1, flexBasis: 140, alignItems: 'center', gap: 4, paddingVertical: 16, borderRadius: 16, borderWidth: 2, borderColor: 'transparent', minHeight: 140 },
  checkBadge: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  childName: { fontSize: 18, fontWeight: '700', color: colors.text },
  addCard: { justifyContent: 'center', paddingHorizontal: 8, backgroundColor: colors.primaryTint, borderColor: colors.primary, borderStyle: 'dashed' },
  addIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  addText: { fontSize: 15, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: MIN_TARGET + 12 },
  menuSeparator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  menuLabel: { flex: 1, fontSize: 16, color: colors.text },
});
