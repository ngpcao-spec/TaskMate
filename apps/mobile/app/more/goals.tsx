import { useRouter } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassTile } from '@/components/GlassTile';
import { GoalIcon } from '@/components/GoalIcon';
import { ProfilePills } from '@/components/ProfilePills';
import { Screen, ScreenHeader } from '@/components/ui';
import { formatGoalProgress, goalRatio, isGoalAchieved } from '@/domain/goals';
import { todayInTz } from '@/domain/family-time';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useGoals, useSetGoalProgress } from '@/hooks/useGoals';
import { colors, glass, MIN_TARGET, radius, shadowInset, shadowSmall, typography, line } from '@/theme/tokens';

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
  const color = colors.accent;

  return (
    <Screen>
      <ScreenHeader title={t('goals.title')} />
      {d.viewer.role === 'parent' && d.children.length > 1 ? <ProfilePills profiles={d.children} selectedId={d.child.id} onSelect={d.select} today={today} /> : null}
      {list.length === 0 ? <Text style={[typography.secondary, styles.empty]}>{t('goals.empty')}</Text> : null}
      {list.map((g) => {
        const achieved = isGoalAchieved(g.progress, g.target);
        const label = formatGoalProgress(g.progress, g.target, g.unit);
        return (
          <View key={g.id} style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${g.title}, ${label}${achieved ? `, ${t('goals.achieved')}` : ''}`}
              onPress={() => router.push({ pathname: '/goal/[id]', params: { id: g.id } })}
              style={styles.head}
            >
              <GlassTile size={48}>
                <GoalIcon name={g.icon} color={color} />
              </GlassTile>
              <View style={styles.flex}>
                <Text style={styles.title}>{g.title}</Text>
                <View style={styles.barRow}>
                  <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={styles.track}>
                    <View style={[styles.fill, { width: `${goalRatio(g.progress, g.target) * 100}%`, backgroundColor: achieved ? colors.success : colors.primary }]} />
                  </View>
                  <Text style={styles.progress}>{label}</Text>
                </View>
              </View>
              {achieved ? <Text style={styles.badge}>{t('goals.achieved')}</Text> : null}
            </Pressable>
            <View style={styles.steppers}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${t('goals.decrease')} ${g.title}`} disabled={g.progress <= 0} onPress={() => setProgress.mutate({ goal: g, progress: g.progress - 1 })} style={[styles.step, g.progress <= 0 && styles.stepOff]}>
                <Minus color={colors.accent} size={20} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`${t('goals.increase')} ${g.title}`} onPress={() => setProgress.mutate({ goal: g, progress: g.progress + 1 })} style={styles.step}>
                <Plus color={colors.accent} size={20} />
              </Pressable>
            </View>
          </View>
        );
      })}
      <Pressable accessibilityRole="button" accessibilityLabel={t('goals.add')} onPress={() => router.push('/goal/new')} style={styles.addButton}>
        <Plus color={colors.accent} size={20} />
        <Text style={styles.addText}>{t('goals.add')}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { ...glass, borderRadius: radius.card, padding: 14, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: MIN_TARGET + 12 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  track: { flex: 1, height: 12, borderRadius: 6, backgroundColor: colors.track, overflow: 'hidden', ...shadowInset },
  fill: { height: '100%', borderRadius: 6, borderWidth: line.width, borderColor: colors.ring },
  progress: { fontSize: 13, color: colors.textSecondary, minWidth: 34, textAlign: 'right' },
  badge: { backgroundColor: colors.success, color: colors.onSolid, fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  steppers: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  step: { width: MIN_TARGET, height: MIN_TARGET, borderRadius: MIN_TARGET / 2, borderWidth: line.width, borderColor: colors.glassBorder, backgroundColor: colors.cardStrong, alignItems: 'center', justifyContent: 'center', ...shadowSmall },
  stepOff: { opacity: 0.35 },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: MIN_TARGET + 12, borderRadius: radius.pill, backgroundColor: colors.cardStrong, borderWidth: line.width, borderColor: colors.glassBorder, ...shadowSmall },
  addText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  empty: { textAlign: 'center', paddingVertical: 24 },
  banner: { backgroundColor: colors.primaryTint, borderRadius: 16, padding: 12 },
  bannerText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
