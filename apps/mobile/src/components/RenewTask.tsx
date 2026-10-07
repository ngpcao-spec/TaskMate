import { onlineManager, useQueries } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { newId } from '@/api/ids';
import { taskKeys } from '@/api/keys';
import { fetchTasks } from '@/api/tasks';
import { Chip } from '@/components/Chip';
import { PickerField } from '@/components/PickerField';
import { Button, Card, Screen, ScreenHeader } from '@/components/ui';
import { formatDayTitle, formatMonthTitle, formatShortDate, formatWeekdayLabel, weekDays, type CalendarLanguage } from '@/domain/calendar';
import { todayInTz } from '@/domain/family-time';
import {
  DEFAULT_SERIES_WEEKS, MAX_CREATED, MAX_SERIES_WEEKS, addDaysIso, addMonths, duplicateKey, copyFields, isoWeekday, monthGrid, monthStartOf, planOneOff, planSeries, type SeriesEnd,
} from '@/domain/renew';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useCreateRecurrences } from '@/hooks/useRecurrences';
import { useCreateTasks } from '@/hooks/useTasks';
import { useToastStore } from '@/store/toast';
import { colors, MIN_TARGET, radius, typography } from '@/theme/tokens';
import type { TaskRow } from '@/types/models';

type Mode = 'days' | 'weekly';
type EndKind = SeriesEnd['kind'];

/**
 * « Renouveler la tâche » (parent, D-054). Deux modes : copies ponctuelles sur des jours précis, ou série hebdomadaire
 * (moteur de récurrence existant, avec fin de série). La tâche source n'est jamais modifiée.
 */
export function RenewTask({ task }: { task: TaskRow }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const create = useCreateTasks();
  const createSeries = useCreateRecurrences();
  const show = useToastStore((s) => s.show);
  const lang = (['vi', 'fr', 'en'].includes(i18n.language) ? i18n.language : 'vi') as CalendarLanguage;
  const tz = d?.me.family.timezone ?? 'Asia/Ho_Chi_Minh';
  const today = useMemo(() => todayInTz(new Date(), tz), [tz]);

  const [mode, setMode] = useState<Mode>('days');
  const [childIds, setChildIds] = useState<string[]>([task.child_id]);
  const [days, setDays] = useState<string[]>([]);
  const [weekdays, setWeekdays] = useState<number[]>([isoWeekday(task.date)]);
  const [start, setStart] = useState(() => (task.date >= today ? addDaysIso(task.date, 1) : today));
  const [endKind, setEndKind] = useState<EndKind>('weeks');
  const [weeks, setWeeks] = useState(DEFAULT_SERIES_WEEKS);
  const [endDate, setEndDate] = useState(() => addDaysIso(start, DEFAULT_SERIES_WEEKS * 7 - 1));
  const [confirmDuplicates, setConfirmDuplicates] = useState(false);

  const thisMonth = monthStartOf(today);
  const months = [thisMonth, addMonths(thisMonth, 1)];
  const rangeTo = [addDaysIso(addMonths(thisMonth, 2), -1), addDaysIso(start, 13)].sort().at(-1) as string;
  const existingQueries = useQueries({
    queries: childIds.map((id) => ({ queryKey: taskKeys.range(id, today, rangeTo), queryFn: () => fetchTasks(id, today, rangeTo) })),
  });
  const existing = useMemo(() => existingQueries.flatMap((q) => q.data ?? []), [existingQueries]);

  if (!d) return null;
  const children = d.children;
  const end: SeriesEnd = endKind === 'never' ? { kind: 'never' } : endKind === 'date' ? { kind: 'date', date: endDate } : { kind: 'weeks', weeks };

  const oneOff = planOneOff({ source: task, childIds, dates: days, existing });
  const series = planSeries({ source: task, childIds, weekdays, start, end, today, existing });
  const takenSet = new Set(existing.filter((x) => x.deleted_at === null).map(duplicateKey));
  const isTaken = (day: string) => childIds.some((id) => takenSet.has(duplicateKey(copyFields(task, id, day))));

  const toggleChild = (id: string) => setChildIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const toggleDay = (day: string) => setDays((cur) => (cur.includes(day) ? cur.filter((x) => x !== day) : [...cur, day]));
  const toggleWeekday = (iso: number) => setWeekdays((cur) => (cur.includes(iso) ? cur.filter((x) => x !== iso) : [...cur, iso]));

  const noChild = childIds.length === 0;
  const canConfirm =
    !noChild &&
    (mode === 'days'
      ? oneOff.count > 0 && !oneOff.tooMany
      : series.error === null && !series.tooMany && (series.conflicts.length === 0 || confirmDuplicates));

  const onConfirm = () => {
    if (!canConfirm) return;
    if (mode === 'days') {
      create.mutate({ familyId: d.me.family.id, memberId: d.me.member.id, tasks: oneOff.toCreate.map((f) => ({ ...f, id: newId() })) });
      show(onlineManager.isOnline() ? t('renew.created', { count: oneOff.count }) : t('taskForm.savedOffline'));
      router.back();
      return;
    }
    createSeries.mutate({ familyId: d.me.family.id, memberId: d.me.member.id, rows: series.series }, { onSuccess: () => router.back() });
  };

  const summary = (() => {
    if (noChild) return t('taskForm.errors.childRequired');
    if (mode === 'days') {
      if (oneOff.count === 0) return t('renew.summary.none');
      return t('renew.summary.oneOff', { count: oneOff.count, from: formatShortDate(oneOff.first as string), to: formatShortDate(oneOff.last as string) });
    }
    if (series.error) return t(`renew.errors.${series.error}`);
    if (series.count === null) return t('renew.summary.seriesNever', { count: series.upcoming });
    return t('renew.summary.series', { count: series.count, from: formatShortDate(series.first as string), to: formatShortDate(series.last as string) });
  })();
  const tooMany = mode === 'days' ? oneOff.tooMany : series.tooMany;
  const weekdayLabels = weekDays('2024-01-01');

  return (
    <Screen>
      <ScreenHeader title={t('renew.title')} />
      <Text style={typography.secondary}>{t('renew.source', { title: task.title })}</Text>

      <View style={styles.wrap} accessibilityRole="radiogroup">
        <Chip label={t('renew.mode.days')} selected={mode === 'days'} onPress={() => setMode('days')} />
        <Chip label={t('renew.mode.weekly')} selected={mode === 'weekly'} onPress={() => setMode('weekly')} />
      </View>

      {children.length > 1 ? (
        <>
          <Text style={typography.secondary}>{t('taskForm.forWhom')}</Text>
          <View style={styles.wrap}>
            {children.map((c) => (
              <Chip key={c.id} role="checkbox" label={c.name} color={c.color ?? undefined} selected={childIds.includes(c.id)} onPress={() => toggleChild(c.id)} />
            ))}
          </View>
        </>
      ) : null}

      {mode === 'days' ? (
        <>
          <Text style={typography.secondary}>{t('renew.days.hint')}</Text>
          <Text style={styles.legend}>{t('renew.days.legendTaken')}</Text>
          {months.map((month) => (
            <Card key={month}>
              <Text accessibilityRole="header" style={styles.monthTitle}>{formatMonthTitle(month, lang)}</Text>
              <View style={styles.weekRow}>
                {weekdayLabels.map((wd) => (
                  <Text key={wd} style={styles.weekdayHead}>{formatWeekdayLabel(wd, lang)}</Text>
                ))}
              </View>
              {monthGrid(month).map((week, wi) => (
                <View key={`${month}-${wi}`} style={styles.weekRow}>
                  {week.map((day, di) => {
                    if (!day) return <View key={`${month}-${wi}-${di}`} style={styles.cell} />;
                    const past = day < today;
                    const selected = days.includes(day);
                    const taken = isTaken(day);
                    return (
                      <Pressable
                        key={day}
                        accessibilityRole="checkbox"
                        accessibilityLabel={taken ? `${formatDayTitle(day, lang)}, ${t('renew.days.taken')}` : formatDayTitle(day, lang)}
                        accessibilityState={{ checked: selected, disabled: past }}
                        aria-checked={selected}
                        disabled={past}
                        onPress={() => toggleDay(day)}
                        style={[styles.cell, styles.day, selected && styles.daySelected, past && styles.dayPast]}
                      >
                        <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{Number(day.slice(8))}</Text>
                        {taken ? <View style={[styles.dot, selected && styles.dotSelected]} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </Card>
          ))}
        </>
      ) : (
        <Card>
          <Text style={typography.secondary}>{t('renew.weekly.weekdays')}</Text>
          <View style={styles.wrap}>
            {weekdayLabels.map((wd, i) => (
              <Chip key={wd} role="checkbox" label={formatWeekdayLabel(wd, lang)} selected={weekdays.includes(i + 1)} onPress={() => toggleWeekday(i + 1)} />
            ))}
          </View>
          <View style={styles.row}>
            <PickerField label={t('renew.weekly.start')} mode="date" value={start} onChange={setStart} />
          </View>
          <Text style={typography.secondary}>{t('renew.weekly.every')}</Text>
          <View style={styles.wrap} accessibilityRole="radiogroup">
            <Chip label={t('renew.weekly.end.weeks')} selected={endKind === 'weeks'} onPress={() => setEndKind('weeks')} />
            <Chip label={t('renew.weekly.end.date')} selected={endKind === 'date'} onPress={() => setEndKind('date')} />
            <Chip label={t('renew.weekly.end.never')} selected={endKind === 'never'} onPress={() => setEndKind('never')} />
          </View>
          {endKind === 'weeks' ? (
            <View style={styles.stepper}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('renew.weekly.weeksLess')} disabled={weeks <= 1} onPress={() => setWeeks((w) => Math.max(1, w - 1))} style={styles.stepBtn}>
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text accessibilityLiveRegion="polite" style={styles.stepValue}>{t('renew.weekly.weeksValue', { count: weeks })}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t('renew.weekly.weeksMore')} disabled={weeks >= MAX_SERIES_WEEKS} onPress={() => setWeeks((w) => Math.min(MAX_SERIES_WEEKS, w + 1))} style={styles.stepBtn}>
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          ) : null}
          {endKind === 'date' ? (
            <View style={styles.row}>
              <PickerField label={t('renew.weekly.endDate')} mode="date" value={endDate} onChange={setEndDate} />
            </View>
          ) : null}
        </Card>
      )}

      <Card>
        <Text accessibilityLiveRegion="polite" style={[typography.body, tooMany || (mode === 'weekly' && series.error) ? styles.warn : null]}>{summary}</Text>
        {mode === 'days' && oneOff.skipped.length > 0 ? <Text style={styles.note}>{t('renew.summary.skipped', { count: oneOff.skipped.length })}</Text> : null}
        {tooMany ? <Text accessibilityRole="alert" style={styles.warn}>{t('renew.summary.tooMany', { max: MAX_CREATED })}</Text> : null}
        {mode === 'weekly' && series.error === null && series.conflicts.length > 0 ? (
          <>
            <Text accessibilityRole="alert" style={styles.warn}>{t('renew.summary.conflict', { count: series.conflicts.length })}</Text>
            <Chip role="checkbox" label={t('renew.summary.conflictConfirm')} selected={confirmDuplicates} onPress={() => setConfirmDuplicates((v) => !v)} />
          </>
        ) : null}
      </Card>

      <Button label={t('renew.confirm')} onPress={onConfirm} disabled={!canConfirm} loading={createSeries.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  legend: { fontSize: 12, color: colors.textSecondary },
  monthTitle: { fontSize: 16, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  weekRow: { flexDirection: 'row', gap: 4 },
  weekdayHead: { flex: 1, textAlign: 'center', fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  cell: { flex: 1, minHeight: MIN_TARGET },
  day: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.card, borderWidth: 1, borderColor: '#E4ECF7', backgroundColor: colors.card },
  daySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayPast: { opacity: 0.35 },
  dayText: { fontSize: 15, fontWeight: '600', color: colors.text },
  dayTextSelected: { color: '#fff' },
  dot: { position: 'absolute', bottom: 5, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.warning },
  dotSelected: { backgroundColor: '#fff' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: { width: MIN_TARGET, height: MIN_TARGET, borderRadius: radius.pill, borderWidth: 1.5, borderColor: '#D5DFEC', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  stepText: { fontSize: 22, fontWeight: '700', color: colors.primary },
  stepValue: { fontSize: 16, fontWeight: '600', color: colors.text, minWidth: 96, textAlign: 'center' },
  warn: { color: colors.danger, fontSize: 14 },
  note: { fontSize: 13, color: colors.textSecondary },
});
