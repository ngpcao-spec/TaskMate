import { useRouter } from 'expo-router';
import { ChevronRight, Gift, ListChecks, Target } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Screen, Title } from '@/components/ui';
import { ageFromBirthDate } from '@/domain/age';
import { todayInTz } from '@/domain/family-time';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

type Href = '/more/tasks' | '/more/goals' | '/more/points';

/** Hồ sơ : cartes des enfants (parent) / sa carte + celle du frère (enfant) et menu (SPEC §3.5). */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  if (!d) return null;
  const today = todayInTz(new Date(), d.me.family.timezone);
  const menu: { key: string; label: string; href: Href; icon: typeof Gift }[] = [
    { key: 'tasks', label: t('profile.tasks'), href: '/more/tasks', icon: ListChecks },
    { key: 'goals', label: t('profile.goals'), href: '/more/goals', icon: Target },
    { key: 'points', label: t('profile.points'), href: '/more/points', icon: Gift },
  ];

  return (
    <Screen>
      <Title>{t('profile.title')}</Title>
      {d.children.map((c) => {
        const active = c.id === d.child?.id;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="radio"
            accessibilityLabel={`${c.name}, ${t('common.yearsOld', { age: ageFromBirthDate(c.birth_date, today) })}`}
            accessibilityState={{ selected: active }}
            onPress={() => d.select(c.id)}
          >
            <Card>
              <View style={styles.childRow}>
                <View style={[styles.avatar, { backgroundColor: c.color ?? colors.primary }]}>
                  <Text style={styles.avatarText}>{c.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={[typography.title, { color: colors.text }]}>{c.name}</Text>
                  <Text style={typography.secondary}>
                    {[c.label, t('common.yearsOld', { age: ageFromBirthDate(c.birth_date, today) })].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {active ? <Text style={styles.check}>✓</Text> : null}
              </View>
            </Card>
          </Pressable>
        );
      })}
      <Card>
        {menu.map(({ key, label, href, icon: Icon }) => (
          <Pressable key={key} accessibilityRole="button" accessibilityLabel={label} onPress={() => router.push(href)} style={styles.menuRow}>
            <Icon color={colors.primary} size={22} />
            <Text style={[styles.menuLabel]}>{label}</Text>
            <ChevronRight color={colors.textSecondary} />
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  check: { color: colors.primary, fontSize: 22, fontWeight: '700' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TARGET + 4 },
  menuLabel: { flex: 1, fontSize: 16, color: colors.text },
});
