import { useRouter } from 'expo-router';
import { Activity, BellRing, Baby, RefreshCw, UserRound, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminGate } from '@/components/admin/AdminGate';
import { SeriesChart } from '@/components/admin/SeriesChart';
import { Chip } from '@/components/Chip';
import { gradeText, subjectText } from '@/components/quiz/subject';
import { StatTile } from '@/components/StatTile';
import { Button, Card, ErrorText, Field, Screen, ScreenHeader, SectionTitle } from '@/components/ui';
import {
  cronState,
  dayBars,
  DEFAULT_SORT,
  FAMILY_SORTS,
  formatBytes,
  formatDate,
  formatStamp,
  lastPage,
  nextSort,
  weekBars,
  classLabel,
  countriesLabel,
  type FamilyRow,
  type SortState,
  type UsageCounters,
} from '@/domain/admin-stats';
import { useAdminFamilies, useAdminHealth, useAdminOverview, useAdminSeries, useAdminUsage, useRefreshAdminStats } from '@/hooks/useAdminStats';
import { chartTones, colors, MIN_TARGET, typography } from '@/theme/tokens';

/** Administration → Suivi des utilisateurs (D-102) : lecture seule, réservé à l'administrateur (garde ici, autorité côté base : chaque RPC `admin_*` la revérifie). */
export function UserTracking() {
  return (
    <AdminGate>
      <Tracking />
    </AdminGate>
  );
}

function Tracking() {
  const { t } = useTranslation();
  const { refresh, busy } = useRefreshAdminStats();
  return (
    <Screen>
      <ScreenHeader title={t('adminStats.title')} />
      <Text style={typography.secondary}>{t('adminStats.intro')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('adminStats.refresh')} accessibilityState={{ busy }} disabled={busy} onPress={refresh} style={styles.refresh}>
        {busy ? <ActivityIndicator color={colors.primary} /> : <RefreshCw color={colors.primary} size={20} />}
        <Text style={styles.refreshText}>{busy ? t('adminStats.refreshing') : t('adminStats.refresh')}</Text>
      </Pressable>
      <Indicators />
      <Charts />
      <UsageSection />
      <Families />
      <HealthSection />
    </Screen>
  );
}

/** Zone d'une section : chargement, erreur avec « Thử lại », sinon le contenu. */
function Async({ query, children }: { query: { isPending: boolean; isError: boolean; refetch: () => unknown }; children: () => React.ReactNode }) {
  const { t } = useTranslation();
  if (query.isPending) return <ActivityIndicator accessibilityLabel={t('adminStats.loading')} color={colors.primary} />;
  if (query.isError) {
    return (
      <View style={styles.gap}>
        <ErrorText>{t('adminStats.error')}</ErrorText>
        <Button label={t('adminStats.retry')} variant="secondary" onPress={() => void query.refetch()} />
      </View>
    );
  }
  return <>{children()}</>;
}

// ───────────── 1. indicateurs ─────────────
function Indicators() {
  const { t } = useTranslation();
  const q = useAdminOverview();
  return (
    <>
      <SectionTitle>{t('adminStats.indicators')}</SectionTitle>
      <Async query={q}>
        {() => {
          const o = q.data!;
          return (
            <View style={styles.tiles}>
              <StatTile tint={colors.tileTeal} icon={<Users color={colors.accent} size={22} />} label={t('adminStats.kpi.families')} value={String(o.families)} caption={t('adminStats.kpi.familiesCaption', { d7: o.newFamilies7d, d30: o.newFamilies30d })} />
              <StatTile tint={colors.tileIce} icon={<UserRound color={colors.accent} size={22} />} label={t('adminStats.kpi.parents')} value={String(o.parents)} />
              <StatTile tint={colors.tileViolet} icon={<Baby color={colors.accent} size={22} />} label={t('adminStats.kpi.children')} value={String(o.children)} />
              <StatTile tint={colors.tileTeal} icon={<Activity color={colors.accent} size={22} />} label={t('adminStats.kpi.activeParents')} value={String(o.active.today.parents)} caption={t('adminStats.kpi.activeCaption', { d7: o.active.d7.parents, d30: o.active.d30.parents })} />
              <StatTile tint={colors.tileIce} icon={<Activity color={colors.accent} size={22} />} label={t('adminStats.kpi.activeChildren')} value={String(o.active.today.children)} caption={t('adminStats.kpi.activeCaption', { d7: o.active.d7.children, d30: o.active.d30.children })} />
              <StatTile tint={colors.tileViolet} icon={<BellRing color={colors.accent} size={22} />} label={t('adminStats.kpi.notifications')} value={String(o.familiesWithNotifications)} caption={t('adminStats.kpi.notificationsCaption', { total: o.families })} />
            </View>
          );
        }}
      </Async>
    </>
  );
}

// ───────────── 2. graphiques ─────────────
function Charts() {
  const { t } = useTranslation();
  const q = useAdminSeries();
  return (
    <>
      <SectionTitle>{t('adminStats.charts.title')}</SectionTitle>
      <Async query={q}>
        {() => {
          const s = q.data!;
          const weeks = weekBars(s.weeks, (day, count) => t('adminStats.charts.weekLabel', { day, count }));
          const days = dayBars(s.days, (day, parents, children) => t('adminStats.charts.dayLabel', { day, parents, children }));
          return (
            <>
              <Card>
                <Text accessibilityRole="header" style={styles.section}>{t('adminStats.charts.weeks')}</Text>
                <SeriesChart bars={weeks} title={t('adminStats.charts.weeks')} />
              </Card>
              <Card>
                <Text accessibilityRole="header" style={styles.section}>{t('adminStats.charts.days')}</Text>
                <SeriesChart bars={days} title={t('adminStats.charts.days')} />
                <View style={styles.legend}>
                  <Legend tone={0} label={t('adminStats.charts.parents')} />
                  <Legend tone={1} label={t('adminStats.charts.children')} />
                </View>
                <Text style={typography.secondary}>{t('adminStats.charts.sinceDeploy')}</Text>
              </Card>
            </>
          );
        }}
      </Async>
    </>
  );
}

function Legend({ tone, label }: { tone: 0 | 1; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: chartTones[tone] }]} />
      <Text style={typography.secondary}>{label}</Text>
    </View>
  );
}

// ───────────── 3. usage ─────────────
const USAGE_ROWS = ['tasksCreated', 'tasksGenerated', 'tasksCompleted', 'tasksValidated', 'quizzesSubmitted', 'quizzesValidated', 'rewardRequests', 'aiCalls', 'avatarCalls'] as const;

function UsageSection() {
  const { t } = useTranslation();
  const q = useAdminUsage();
  return (
    <>
      <SectionTitle>{t('adminStats.usage.title')}</SectionTitle>
      <Async query={q}>
        {() => {
          const u = q.data!;
          const failed = (c: UsageCounters, key: (typeof USAGE_ROWS)[number]) => (key === 'aiCalls' ? c.aiFailed : key === 'avatarCalls' ? c.avatarFailed : 0);
          return (
            <>
              <Card>
                <View style={styles.usageHead}>
                  <Text style={[styles.usageLabel, styles.head]} />
                  <Text style={[styles.usageCol, styles.head]}>{t('adminStats.usage.d7')}</Text>
                  <Text style={[styles.usageCol, styles.head]}>{t('adminStats.usage.d30')}</Text>
                </View>
                {USAGE_ROWS.map((key) => {
                  const bad7 = failed(u.d7, key);
                  const bad30 = failed(u.d30, key);
                  const label = t(`adminStats.usage.${key}`);
                  return (
                    <View key={key} accessible accessibilityLabel={`${label}: ${t('adminStats.usage.d7')} ${u.d7[key]}, ${t('adminStats.usage.d30')} ${u.d30[key]}${bad30 > 0 ? `, ${t('adminStats.usage.failed', { count: bad30 })}` : ''}`} style={styles.usageRow}>
                      <Text style={styles.usageLabel}>{label}</Text>
                      <Text style={styles.usageCol}>{u.d7[key]}{bad7 > 0 ? `\n(${t('adminStats.usage.failed', { count: bad7 })})` : ''}</Text>
                      <Text style={styles.usageCol}>{u.d30[key]}{bad30 > 0 ? `\n(${t('adminStats.usage.failed', { count: bad30 })})` : ''}</Text>
                    </View>
                  );
                })}
              </Card>
              <Card>
                <Text accessibilityRole="header" style={styles.section}>{t('adminStats.usage.quizByClass')}</Text>
                {u.quizByClass.length === 0 ? <Text style={typography.secondary}>{t('adminStats.usage.noQuiz')}</Text> : null}
                {u.quizByClass.map((r) => {
                  const where = t('adminStats.usage.quizRow', { class: `${r.country} ${gradeText(t, r.country, r.grade)}`, subject: subjectText(t, r.subject) });
                  return (
                    <View key={`${r.country}-${r.grade}-${r.subject}`} accessible accessibilityLabel={`${where}. ${t('adminStats.usage.d7')}: ${t('adminStats.usage.quizValues', { submitted: r.submitted7d, validated: r.validated7d })}. ${t('adminStats.usage.d30')}: ${t('adminStats.usage.quizValues', { submitted: r.submitted30d, validated: r.validated30d })}`} style={styles.quizRow}>
                      <Text style={styles.usageLabel}>{where}</Text>
                      <Text style={styles.small}>{t('adminStats.usage.d7')} · {t('adminStats.usage.quizValues', { submitted: r.submitted7d, validated: r.validated7d })}</Text>
                      <Text style={styles.small}>{t('adminStats.usage.d30')} · {t('adminStats.usage.quizValues', { submitted: r.submitted30d, validated: r.validated30d })}</Text>
                    </View>
                  );
                })}
              </Card>
              <Card>
                <Text accessibilityRole="header" style={styles.section}>{t('adminStats.usage.aiByModel')}</Text>
                {u.aiByModel.length === 0 ? <Text style={typography.secondary}>{t('adminStats.usage.noAi')}</Text> : null}
                {u.aiByModel.map((m) => (
                  <View key={`${m.kind}-${m.model}`} style={styles.quizRow}>
                    <Text style={styles.usageLabel}>{t(`adminStats.usage.kind.${m.kind}`)} · {m.model || '—'}</Text>
                    <Text style={styles.small}>{t('adminStats.usage.aiValues', { calls7: m.calls7d, calls30: m.calls30d, failed: m.failed30d })}</Text>
                    {m.inputTokens30d + m.outputTokens30d > 0 ? <Text style={styles.small}>{t('adminStats.usage.tokens', { input: m.inputTokens30d, output: m.outputTokens30d })}</Text> : null}
                  </View>
                ))}
                <Text style={typography.secondary}>{t('adminStats.usage.costNote')}</Text>
              </Card>
            </>
          );
        }}
      </Async>
    </>
  );
}

// ───────────── 4. liste des familles ─────────────
/** Valeur retardée : la recherche n'interroge la base qu'une fois la saisie arrêtée. */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function Families() {
  const { t } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const term = useDebounced(search.trim(), 300);
  const q = useAdminFamilies(term, sort.sort, sort.dir, page);
  const data = q.data;
  const pages = data ? lastPage(data.total, data.pageSize) : 1;
  return (
    <>
      <SectionTitle>{t('adminStats.families.title')}</SectionTitle>
      <Card>
        <Field
          label={t('adminStats.families.search')}
          value={search}
          onChangeText={(v) => {
            setSearch(v);
            setPage(1);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        <Text style={typography.secondary}>{t('adminStats.families.sortBy')}</Text>
        <View style={styles.wrap}>
          {FAMILY_SORTS.map((column) => {
            const active = sort.sort === column;
            const arrow = active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';
            return (
              <Chip
                key={column}
                label={`${t(`adminStats.families.sort.${column}`)}${arrow}`}
                selected={active}
                onPress={() => {
                  setSort(nextSort(sort, column));
                  setPage(1);
                }}
              />
            );
          })}
        </View>
      </Card>
      <Async query={q}>
        {() => (
          <>
            <Text accessibilityLiveRegion="polite" style={typography.secondary}>{t('adminStats.families.count', { total: data!.total })}</Text>
            {data!.rows.length === 0 ? <Text style={typography.secondary}>{term === '' ? t('adminStats.families.empty') : t('adminStats.families.noMatch')}</Text> : null}
            {data!.rows.map((row) => (
              <FamilyCard key={row.familyId} row={row} onOpen={() => router.push({ pathname: '/admin/family', params: { id: row.familyId } })} />
            ))}
            <View style={styles.pager}>
              <View style={styles.flex}>
                <Button label={t('adminStats.families.prev')} variant="secondary" disabled={page <= 1} onPress={() => setPage(page - 1)} />
              </View>
              <Text style={styles.pageText}>{t('adminStats.families.page', { page: data!.page, pages })}</Text>
              <View style={styles.flex}>
                <Button label={t('adminStats.families.next')} variant="secondary" disabled={page >= pages} onPress={() => setPage(page + 1)} />
              </View>
            </View>
          </>
        )}
      </Async>
    </>
  );
}

export function FamilyCard({ row, onOpen }: { row: FamilyRow; onOpen: () => void }) {
  const { t } = useTranslation();
  const status = t(`adminStats.families.status.${row.status}`);
  const email = row.creatorEmail ?? t('adminStats.families.noEmail');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('adminStats.families.row', { name: row.name, email, status })} onPress={onOpen} style={styles.family}>
      <View style={styles.familyTop}>
        <Text numberOfLines={1} style={styles.familyName}>{row.name}</Text>
        <Text style={[styles.badge, row.status === 'active' ? styles.badgeOn : null]}>{status}</Text>
      </View>
      <Text numberOfLines={1} style={typography.secondary}>{email}</Text>
      <Text style={styles.small}>
        {countriesLabel(row.countries)} · {t('adminStats.families.parentsCount', { count: row.parents })} · {t('adminStats.families.childrenCount', { count: row.children })}
        {row.classes.length > 0 ? ` (${row.classes.map(classLabel).join(', ')})` : ''}
      </Text>
      <Text style={styles.small}>
        {t('adminStats.families.created', { date: formatDate(row.createdAt) })} · {t('adminStats.families.lastActive', { date: row.lastActiveAt ? formatDate(row.lastActiveAt) : t('adminStats.families.never') })}
      </Text>
      <Text style={styles.small}>{row.notifications ? t('adminStats.families.notificationsOn') : t('adminStats.families.notificationsOff')}</Text>
    </Pressable>
  );
}

// ───────────── 6. santé ─────────────
function HealthSection() {
  const { t } = useTranslation();
  const q = useAdminHealth();
  return (
    <>
      <SectionTitle>{t('adminStats.health.title')}</SectionTitle>
      <Async query={q}>
        {() => {
          const h = q.data!;
          return (
            <Card>
              <Text style={typography.body}>{t('adminStats.health.dbSize')} : {formatBytes(h.dbSizeBytes)}</Text>
              <Text style={typography.body}>{t('adminStats.health.devices')} : {h.activeDevices}</Text>
              <Text accessibilityRole="header" style={styles.section}>{t('adminStats.health.cron')}</Text>
              {h.cron === null ? <Text style={typography.secondary}>{t('adminStats.health.unknown')}</Text> : null}
              {(h.cron ?? []).map((job) => {
                const state = cronState(job);
                return (
                  <View key={job.jobname} accessible accessibilityLabel={`${job.jobname}, ${t(`adminStats.health.${state}`)}${job.lastRunAt ? `, ${t('adminStats.health.lastRun', { date: formatStamp(job.lastRunAt) })}` : ''}`} style={styles.quizRow}>
                    <Text style={styles.usageLabel}>{job.jobname} <Text style={typography.secondary}>({job.schedule})</Text></Text>
                    <Text style={[styles.small, state === 'failed' ? styles.bad : null]}>
                      {t(`adminStats.health.${state}`)}
                      {job.lastRunAt ? ` · ${t('adminStats.health.lastRun', { date: formatStamp(job.lastRunAt) })}` : ''}
                    </Text>
                  </View>
                );
              })}
            </Card>
          );
        }}
      </Async>
    </>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 10 },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: { ...typography.title, color: colors.text, fontSize: 17 },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TARGET, alignSelf: 'flex-start' },
  refreshText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 4, borderWidth: 1, borderColor: colors.ring },
  usageHead: { flexDirection: 'row', gap: 8, minHeight: 28 },
  usageRow: { flexDirection: 'row', gap: 8, minHeight: MIN_TARGET, alignItems: 'center' },
  usageLabel: { flex: 2, color: colors.text, fontSize: 14, fontWeight: '600' },
  usageCol: { flex: 1, color: colors.text, fontSize: 14, textAlign: 'right' },
  head: { fontWeight: '800' },
  quizRow: { gap: 2, paddingVertical: 6 },
  small: { fontSize: 12, color: colors.textSecondary },
  family: { gap: 3, minHeight: MIN_TARGET, padding: 14, borderRadius: 16, backgroundColor: colors.cardStrong, borderWidth: 1, borderColor: colors.glassBorder },
  familyTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  familyName: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' },
  badge: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  badgeOn: { color: colors.primary },
  bad: { color: colors.danger },
  pager: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageText: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
