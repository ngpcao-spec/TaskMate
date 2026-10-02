import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip } from '@/components/Chip';
import { ProfilePills } from '@/components/ProfilePills';
import { ProgressRing } from '@/components/ProgressRing';
import { Card, Screen, Title } from '@/components/ui';
import { todayInTz } from '@/domain/family-time';
import { computeStats, encouragementFor, formatRate, periodRange, type StatsPeriod } from '@/domain/stats';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useTasks } from '@/hooks/useTasks';
import { CATEGORY_COLORS } from '@/theme/categories';
import { colors, typography } from '@/theme/tokens';

/**
 * Thống kê (SPEC §3.8, §5.4) : un seul profil à la fois — jamais les deux enfants côte à côte, ni classement.
 * Calcul 100 % local (domain/stats) sur les tâches en cache → fonctionne hors ligne.
 */
export default function StatsScreen() {
  const { t } = useTranslation();
  const d = useDisplayedChild();
  const [period, setPeriod] = useState<StatsPeriod>('week');
  const today = d ? todayInTz(new Date(), d.me.family.timezone) : '1970-01-01';
  const { from, to } = periodRange(period, today);
  const tasks = useTasks(d?.child?.id ?? null, from, to);

  if (!d || !d.child) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const stats = computeStats(tasks.data ?? [], from, to);
  const message = encouragementFor(stats.rate);

  return (
    <Screen>
      <Title>{t('stats.title')}</Title>
      {d.children.length > 1 ? <ProfilePills profiles={d.children} selectedId={d.child.id} onSelect={d.select} today={today} /> : null}
      {d.readOnly ? (
        <View accessible style={styles.banner}>
          <Text style={styles.bannerText}>{t('today.readOnlyBanner', { name: d.child.name })}</Text>
        </View>
      ) : null}

      <View style={styles.toggle}>
        <Chip label={t('stats.week')} selected={period === 'week'} onPress={() => setPeriod('week')} />
        <Chip label={t('stats.month')} selected={period === 'month'} onPress={() => setPeriod('month')} />
      </View>

      <Card>
        <View style={styles.ringRow}>
          <ProgressRing
            size={120}
            stroke={12}
            ratio={(stats.rate ?? 0) / 100}
            label={formatRate(stats.rate)}
            accessibilityLabel={`${t('stats.completionRate')}: ${formatRate(stats.rate)}`}
          />
          <View style={styles.legend}>
            <LegendRow color={colors.primary} label={t('stats.done')} value={stats.done} />
            <LegendRow color="#C8D2E0" label={t('stats.notDone')} value={stats.notDone} />
            <LegendRow color={colors.text} label={t('stats.total')} value={stats.total} />
          </View>
        </View>
      </Card>

      <Card>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {t('stats.byCategory')}
        </Text>
        {stats.byCategory.map((c) => (
          <View
            key={c.category}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`${t(`category.${c.category}`)}: ${c.percent}%`}
            style={styles.barRow}
          >
            <Text style={styles.barLabel}>{t(`category.${c.category}`)}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${c.percent}%`, backgroundColor: CATEGORY_COLORS[c.category] }]} />
            </View>
            <Text style={styles.barValue}>{c.percent}%</Text>
          </View>
        ))}
      </Card>

      {message ? (
        <View accessible style={styles.encourage}>
          <Text style={styles.encourageText}>{t(`stats.message.${message}`)}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.legendRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[typography.body, styles.flex, { color: colors.text }]}>{label}</Text>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  toggle: { flexDirection: 'row', gap: 8 },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  legend: { flex: 1, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  sectionTitle: { ...typography.title, color: colors.text },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 },
  barLabel: { width: 84, fontSize: 14, color: colors.text },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#E4ECF7', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  barValue: { width: 44, textAlign: 'right', fontSize: 14, fontWeight: '600', color: colors.text },
  encourage: { backgroundColor: '#E8F6F1', borderRadius: 16, padding: 16 },
  encourageText: { color: '#1B7F63', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  banner: { backgroundColor: '#E8F1FE', borderRadius: 16, padding: 12 },
  bannerText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
