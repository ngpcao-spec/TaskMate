import { useRouter } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GoalIcon } from '@/components/GoalIcon';
import { ProfilePills } from '@/components/ProfilePills';
import { Button, Card, Screen, Title } from '@/components/ui';
import { formatGoalProgress, goalRatio, isGoalAchieved } from '@/domain/goals';
import { todayInTz } from '@/domain/family-time';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useGoals, useSetGoalProgress } from '@/hooks/useGoals';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

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
      <Title>{t('goals.title')}</Title>
      {d.children.length > 1 ? <ProfilePills profiles={d.children} selectedId={d.child.id} onSelect={d.select} today={today} /> : null}
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
          <Card key={g.id}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${g.title}, ${label}${achieved ? `, ${t('goals.achieved')}` : ''}`}
              disabled={d.readOnly}
              onPress={() => router.push({ pathname: '/goal/[id]', params: { id: g.id } })}
              style={styles.head}
            >
              <GoalIcon name={g.icon} color={color} />
              <Text style={[styles.title, styles.flex]}>{g.title}</Text>
              {achieved ? <Text style={styles.badge}>{t('goals.achieved')}</Text> : null}
            </Pressable>
            <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={styles.track}>
              <View style={[styles.fill, { width: `${goalRatio(g.progress, g.target) * 100}%`, backgroundColor: achieved ? colors.success : color }]} />
            </View>
            <View style={styles.footer}>
              <Text style={styles.progress}>{label}</Text>
              {d.readOnly ? null : (
                <View style={styles.steppers}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${t('goals.decrease')} ${g.title}`} disabled={g.progress <= 0} onPress={() => setProgress.mutate({ goal: g, progress: g.progress - 1 })} style={[styles.step, g.progress <= 0 && styles.stepOff]}>
                    <Minus color={colors.primary} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${t('goals.increase')} ${g.title}`} onPress={() => setProgress.mutate({ goal: g, progress: g.progress + 1 })} style={styles.step}>
                    <Plus color={colors.primary} />
                  </Pressable>
                </View>
              )}
            </View>
          </Card>
        );
      })}
      {d.readOnly ? null : <Button label={t('goals.add')} onPress={() => router.push('/goal/new')} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TARGET },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  badge: { backgroundColor: colors.success, color: '#fff', fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  track: { height: 10, borderRadius: 5, backgroundColor: '#E4ECF7', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { fontSize: 15, fontWeight: '700', color: colors.text },
  steppers: { flexDirection: 'row', gap: 8 },
  step: { width: MIN_TARGET, height: MIN_TARGET, borderRadius: MIN_TARGET / 2, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepOff: { opacity: 0.35 },
  empty: { textAlign: 'center', paddingVertical: 24 },
  banner: { backgroundColor: '#E8F1FE', borderRadius: 16, padding: 12 },
  bannerText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
