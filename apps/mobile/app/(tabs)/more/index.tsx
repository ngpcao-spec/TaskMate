import { useRouter } from 'expo-router';
import { Bell, BookOpen, Camera, Check, ChevronRight, ListChecks, Plus, Settings, ShieldCheck, Star, Target } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { GlassTile } from '@/components/GlassTile';
import { Card, Screen, ScreenHeader } from '@/components/ui';
import { ageFromBirthDate } from '@/domain/age';
import { todayInTz } from '@/domain/family-time';
import { useIsPlatformAdmin } from '@/hooks/useCatalog';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { childColor } from '@/theme/childColor';
import { colors, MIN_TARGET, radius, shadow, shadowSmall, typography, line } from '@/theme/tokens';

type Href = '/admin' | '/more/avatar' | '/more/tasks' | '/more/goals' | '/more/revisions' | '/more/points' | '/more/notification-settings' | '/more/settings';

/** Hồ sơ : cartes des enfants (parent) / sa carte + celle du frère (enfant) et menu (SPEC §3.5). */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  // D-080 : l'entrée « Administration » n'existe que pour l'administrateur de la plateforme (la base répond ; chaque RPC revérifie)
  const isAdmin = useIsPlatformAdmin().data === true && d?.viewer.role === 'parent';
  if (!d) return null;
  const today = todayInTz(new Date(), d.me.family.timezone);
  const menu: { key: string; label: string; href: Href; icon: typeof Star; tint?: string }[] = [
    { key: 'tasks', label: t('profile.tasks'), href: '/more/tasks', icon: ListChecks },
    { key: 'goals', label: t('profile.goals'), href: '/more/goals', icon: Target },
    { key: 'avatar', label: t('profile.avatar'), href: '/more/avatar', icon: Camera },
    { key: 'revisions', label: t('profile.revisions'), href: '/more/revisions', icon: BookOpen },
    { key: 'points', label: t('profile.points'), href: '/more/points', icon: Star, tint: colors.warning },
    { key: 'notifications', label: t('profile.notifications'), href: '/more/notification-settings', icon: Bell },
    { key: 'settings', label: t('profile.settings'), href: '/more/settings', icon: Settings },
    ...(isAdmin ? [{ key: 'admin', label: t('profile.admin'), href: '/admin' as Href, icon: ShieldCheck }] : []),
  ];

  return (
    <Screen>
      <ScreenHeader title={t('profile.title')} hideBack />
      <View style={styles.cards}>
        {d.children.map((c) => {
          const isParent = d.viewer.role === 'parent';
          const active = c.id === d.child?.id;
          const age = t('common.yearsOld', { age: ageFromBirthDate(c.birth_date, today) });
          const color = childColor(c.color);
          const content = (
            <>
              {isParent && active ? (
                <View style={[styles.checkBadge, { backgroundColor: color }]}>
                  <Check size={14} color={colors.onPrimary} strokeWidth={3} />
                </View>
              ) : null}
              <View style={styles.avatarGap}>
                <Avatar childId={c.id} name={c.name} color={c.color} size={64} />
              </View>
              <Text style={[styles.childName, isParent && active && styles.onNavy]}>{c.name}</Text>
              <Text style={[typography.secondary, isParent && active && styles.onNavySecondary]}>{age}</Text>
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
              style={[styles.childCard, active && styles.childCardActive]}
            >
              {content}
            </Pressable>
          ) : (
            <View key={c.id} accessible accessibilityLabel={`${c.name}, ${age}`} style={styles.childCard}>
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
              <Plus size={28} color={colors.accent} strokeWidth={2.5} />
            </View>
            <Text style={styles.addText}>{t('addChild.button')}</Text>
          </Pressable>
        ) : null}
      </View>
      <Card>
        {menu.map(({ key, label, href, icon: Icon, tint }, i) => (
          <Pressable key={key} accessibilityRole="button" accessibilityLabel={label} onPress={() => router.push(href)} style={[styles.menuRow, i > 0 && styles.menuSeparator]}>
            <GlassTile size={42}>
              <Icon color={tint ?? colors.accent} size={22} />
            </GlassTile>
            <Text style={styles.menuLabel}>{label}</Text>
            <ChevronRight color={colors.text} />
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  childCard: { flexGrow: 1, flexBasis: 140, alignItems: 'center', gap: 4, paddingVertical: 16, borderRadius: radius.card, borderWidth: line.width, borderColor: colors.glassBorder, backgroundColor: colors.card, minHeight: 140, ...shadow },
  childCardActive: { backgroundColor: colors.navy, borderColor: colors.navyBorder },
  checkBadge: { position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12, borderWidth: line.width, borderColor: colors.ring, alignItems: 'center', justifyContent: 'center' },
  avatarGap: { marginBottom: 4 },
  childName: { fontSize: 18, fontWeight: '700', color: colors.text },
  onNavy: { color: colors.onNavy },
  onNavySecondary: { color: colors.onNavySecondary },
  addCard: { justifyContent: 'center', paddingHorizontal: 8, borderColor: colors.accent, borderStyle: 'dashed', borderWidth: 1.5, backgroundColor: colors.primaryTint },
  addIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardStrong, borderWidth: line.width, borderColor: colors.glassBorder, ...shadowSmall },
  addText: { fontSize: 15, fontWeight: '700', color: colors.accent, textAlign: 'center' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: MIN_TARGET + 16 },
  menuSeparator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
});
