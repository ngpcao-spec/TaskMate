import { useRouter } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GoalIcon } from '@/components/GoalIcon';
import { ProfilePills } from '@/components/ProfilePills';
import { Screen, ScreenHeader } from '@/components/ui';
import { formatGoalProgress, goalRatio, isGoalAchieved } from '@/domain/goals';
import { todayInTz } from '@/domain/family-time';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useGoals, useSetGoalProgress } from '@/hooks/useGoals';
import { colors, MIN_TARGET, shadow, typography } from '@/theme/tokens';

/** Mục tiêu : cartes avec barre de progression, −/+ manuel ; frère en lecture seule (SPEC §3.6). */
export default function GoalsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const goals = useGoals(d?.child?.id ?? null);
  const setProgress = useSetGoalProgress();
  if (!d || !d.child) return null;
  const today = todayInTz(new Date(), d.me.family.timezone);
  const list = goals.data ?? [];
  const color = d.child.color ?? colors.primary;

  return (
    <Screen>
      <ScreenHeader title={t('goals.title')} />
      {d.children.length > 1 ? <ProfilePills profiles={d.children} selectedId={d.child.id} onSelect={d.select} today={today} showName /> : null}
      {d.readOnly ? (
        <View accessible style={styles.banner}>
          <Text style={styles.bannerText}>{t('today.readOnlyBanner', { name: d.child.name })}</Text>
        </View>
      ) : null}
      {list.length === 0 ? <Text style={[typography.secondary, styles.empty]}>{t('goals.empty')}</Text> : null}
      {list.map((g) => {
        const achieved = isGoalAchieved(g.progress, g.target);
        const label = formatGoalProgress(g.progress, g.target, g.unit);
        return (
          <View key={g.id} style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${g.title}, ${label}${achieved ? `, ${t('goals.achieved')}` : ''}`}
              disabled={d.readOnly}
              onPress={() => router.push({ pathname: '/goal/[id]', params: { id: g.id } })}
              style={styles.head}
            >
              <View style={[styles.iconCircle, { backgroundColor: `${color}1F` }]}>
                <GoalIcon name={g.icon} color={color} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.title}>{g.title}</Text>
                <View style={styles.barRow}>
                  <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={styles.track}>
                    <View style={[styles.fill, { width: `${goalRatio(g.progress, g.target) * 100}%`, backgroundColor: achieved ? colors.success : color }]} />
                  </View>
                  <Text style={styles.progress}>{label}</Text>
                </View>
              </View>
              {achieved ? <Text style={styles.badge}>{t('goals.achieved')}</Text> : null}
            </Pressable>
            {d.readOnly ? null : (
              <View style={styles.steppers}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${t('goals.decrease')} ${g.title}`} disabled={g.progress <= 0} onPress={() => setProgress.mutate({ goal: g, progress: g.progress - 1 })} style={[styles.step, g.progress <= 0 && styles.stepOff]}>
                  <Minus color={colors.primary} size={20} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`${t('goals.increase')} ${g.title}`} onPress={() => setProgress.mutate({ goal: g, progress: g.progress + 1 })} style={styles.step}>
                  <Plus color={colors.primary} size={20} />
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
      {d.readOnly ? null : (
        <Pressable accessibilityRole="button" accessibilityLabel={t('goals.add')} onPress={() => router.push('/goal/new')} style={styles.addButton}>
          <Plus color={colors.primary} size={20} />
          <Text style={styles.addText}>{t('goals.add')}</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 4, ...shadow },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: MIN_TARGET + 12 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#E4ECF7', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  progress: { fontSize: 13, color: colors.textSecondary, minWidth: 34, textAlign: 'right' },
  badge: { backgroundColor: colors.success, color: '#fff', fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  steppers: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  step: { width: MIN_TARGET, height: MIN_TARGET, borderRadius: MIN_TARGET / 2, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepOff: { opacity: 0.35 },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: MIN_TARGET + 12, borderRadius: 16, backgroundColor: colors.primaryTint },
  addText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  empty: { textAlign: 'center', paddingVertical: 24 },
  banner: { backgroundColor: colors.primaryTint, borderRadius: 16, padding: 12 },
  bannerText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
