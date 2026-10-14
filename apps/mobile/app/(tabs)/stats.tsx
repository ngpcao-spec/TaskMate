import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Backdrop } from '@/components/Backdrop';
import { BarChart } from '@/components/BarChart';
import { CategoryIcon } from '@/components/CategoryIcon';
import { DonutChart } from '@/components/DonutChart';
import { ProgressRing } from '@/components/ProgressRing';
import { Card, Screen, ScreenHeader, SectionTitle } from '@/components/ui';
import { todayInTz } from '@/domain/family-time';
import { formatDayNumber, formatWeekdayLabel, type CalendarLanguage } from '@/domain/calendar';
import { completionBuckets, computeStats, encouragementFor, formatRate, periodRange, type StatsPeriod } from '@/domain/stats';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useTasks } from '@/hooks/useTasks';
import { CATEGORY_COLORS } from '@/theme/categories';
import { colors, MIN_TARGET, radius, shadowInset, shadowSmall, typography } from '@/theme/tokens';

/**
 * Thống kê (SPEC §3.8, §5.4) : un seul profil à la fois — jamais les deux enfants côte à côte, ni classement.
 * Calcul 100 % local (domain/stats) sur les tâches en cache → fonctionne hors ligne.
 */
export default function StatsScreen() {
  const { t, i18n } = useTranslation();
  const lang = (['vi', 'fr', 'en'].includes(i18n.language) ? i18n.language : 'vi') as CalendarLanguage;
  const d = useDisplayedChild();
  const [period, setPeriod] = useState<StatsPeriod>('week');
  const today = d ? todayInTz(new Date(), d.me.family.timezone) : '1970-01-01';
  const { from, to } = periodRange(period, today);
  const tasks = useTasks(d?.child?.id ?? null, from, to);

  if (!d || !d.child) {
    return (
      <SafeAreaView style={styles.center}>
        <Backdrop />
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  const stats = computeStats(tasks.data ?? [], from, to);
  const message = encouragementFor(stats.rate);
  const bars = completionBuckets(tasks.data ?? [], period, from, to).map((b) => ({
    key: b.from,
    label: period === 'week' ? formatWeekdayLabel(b.from, lang) : formatDayNumber(b.from),
    done: b.done,
    total: b.total,
    accessibilityLabel: `${period === 'week' ? formatWeekdayLabel(b.from, lang) : `${formatDayNumber(b.from)}–${formatDayNumber(b.to)}`}: ${b.done}/${b.total}`,
  }));

  return (
    <Screen>
      <ScreenHeader title={t('stats.title')} />
      {d.viewer.role === 'parent' ? <Text style={typography.secondary}>{d.child.name}</Text> : null}

      <View style={styles.segment} accessibilityRole="tablist">
        {(['week', 'month'] as const).map((p) => (
          <Pressable key={p} accessibilityRole="radio" accessibilityLabel={t(`stats.${p}`)} accessibilityState={{ selected: period === p, checked: period === p }} aria-checked={period === p} onPress={() => setPeriod(p)} style={[styles.segmentItem, period === p && styles.segmentActive]}>
            <Text style={[styles.segmentText, period === p && styles.segmentTextActive]}>{t(`stats.${p}`)}</Text>
          </Pressable>
        ))}
      </View>

      <Card>
        <View style={styles.ringRow}>
          <ProgressRing
            size={132}
            stroke={16}
            color={colors.primary}
            ratio={(stats.rate ?? 0) / 100}
            label={formatRate(stats.rate)}
            sublabel={t('stats.doneShort')}
            accessibilityLabel={`${t('stats.completionRate')}: ${formatRate(stats.rate)}`}
          />
          <View style={styles.legend}>
            <LegendRow color={colors.primary} label={t('stats.done')} value={stats.done} />
            <LegendRow color={colors.danger} label={t('stats.notDone')} value={stats.notDone} />
            <LegendRow color={colors.mint} label={t('stats.total')} value={stats.total} />
          </View>
        </View>
      </Card>

      <View style={styles.charts}>
        <View style={styles.chartCol}>
          <Card fill>
            <SectionTitle>{t('stats.overview')}</SectionTitle>
            <BarChart bars={bars} />
          </Card>
        </View>
        <View style={styles.chartCol}>
          <Card fill>
            <SectionTitle>{t('stats.byCategory')}</SectionTitle>
            <View style={styles.donutRow}>
              <DonutChart segments={stats.byCategory.map((c) => ({ key: c.category, value: c.count, color: CATEGORY_COLORS[c.category] }))} />
              <View style={styles.legend}>
                {stats.byCategory.map((c) => (
                  <View key={c.category} accessible accessibilityRole="progressbar" accessibilityLabel={`${t(`category.${c.category}`)}: ${c.percent}%`} style={styles.catRow}>
                    <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS[c.category] }]} />
                    <CategoryIcon category={c.category} size={16} />
                    <Text numberOfLines={1} style={styles.barLabel}>{t(`category.${c.category}`)}</Text>
                    <Text style={styles.barValue}>{c.percent}%</Text>
                  </View>
                ))}
              </View>
            </View>
          </Card>
        </View>
      </View>

      {message ? (
        <View accessible accessibilityLabel={t(`stats.message.${message}`)} style={styles.encourage}>
          <Trophy color={colors.warning} size={30} />
          <View style={styles.flex}>
            <Text style={styles.encourageTitle}>{t(`stats.message.${message}`).split(/(?<=!)\s+/)[0]}</Text>
            {t(`stats.message.${message}`).split(/(?<=!)\s+/)[1] ? <Text style={typography.secondary}>{t(`stats.message.${message}`).split(/(?<=!)\s+/).slice(1).join(' ')}</Text> : null}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.legendRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[typography.body, styles.flex, { color: colors.text, fontSize: 14 }]}>{label}</Text>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  segment: { flexDirection: 'row', backgroundColor: colors.inputBg, borderRadius: 999, padding: 4, borderWidth: 1, borderColor: colors.glassBorderSoft, ...shadowInset },
  segmentItem: { flex: 1, minHeight: MIN_TARGET, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.primary, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', ...shadowSmall },
  segmentText: { fontSize: 15, fontWeight: '600', color: colors.text },
  segmentTextActive: { color: '#fff' },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  legend: { flex: 1, gap: 12, minWidth: 130 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
  legendValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  charts: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  chartCol: { flexGrow: 1, flexBasis: 300, flexDirection: 'column' },
  donutRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 16 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 30 },
  barLabel: { flex: 1, fontSize: 13, color: colors.text },
  barValue: { fontSize: 13, fontWeight: '700', color: colors.text },
  encourage: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.primaryTint, borderRadius: radius.card, borderWidth: 1, borderColor: colors.glassBorder, padding: 16 },
  encourageTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
});
