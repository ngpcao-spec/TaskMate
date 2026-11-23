import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'expo-router';
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWeeklyOpen, weeklyStateText } from '@/components/quiz/WeeklyDueCard';
import { formatDayNumber, formatDayTitle, formatMonthTitle, formatWeekdayLabel, groupByDay, shiftWeek, weekDays, type CalendarLanguage } from '@/domain/calendar';
import { timeInTz, todayInTz } from '@/domain/family-time';
import { goalIconFor, WEEKLY_REVIEW_ICON } from '@/domain/goal-icons';
import { taskPermissions } from '@/domain/permissions';
import { taskState } from '@/domain/task-state';
import { isOverdue, sortTasks, timeLabel } from '@/domain/task-time';
import { dueByDay, dueMarkedDays, type WeeklyItem } from '@/domain/weekly-quiz';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useNow } from '@/hooks/useNow';
import { useTasks } from '@/hooks/useTasks';
import { useWeeklyQuizzes } from '@/hooks/useWeeklyQuizzes';
import type { TaskRow } from '@/types/models';
import { v2Card, v2Colors, v2Font, v2Radius, v2Shadow, v2Spacing, v2Text, V2_TOUCH } from '../theme';
import { ChildPicker } from './ChildPicker';
import { GoalRow } from './GoalRow';
import { V2BackButton, V2_MAX_WIDTH } from './V2Screen';

const SWIPE_THRESHOLD = 60;

type Due = WeeklyItem & { childId: string; childName: string };

/** Bouton rond V2 (≥ 44 pt), comme ceux du haut de Hôm nay. */
function RoundV2({ label, onPress, children, testID }: { label: string; onPress: () => void; children: ReactNode; testID?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.round, pressed ? styles.pressed : null]} testID={testID}>
      {children}
    </Pressable>
  );
}

/** Bandeau de la semaine (V2) : T2…CN, jour choisi dans un rond vert, aujourd'hui en vert, point orange = date limite d'un quiz de la semaine. */
function V2WeekStrip({ days, selected, today, lang, onSelect, marks }: { days: readonly string[]; selected: string; today: string; lang: CalendarLanguage; onSelect: (d: string) => void; marks: ReadonlySet<string> }) {
  const { t } = useTranslation();
  return (
    <View style={styles.strip} testID="v2-week-strip">
      {days.map((day) => {
        const active = day === selected;
        const isToday = day === today;
        const marked = marks.has(day);
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={`${formatDayTitle(day, lang)}${isToday ? `, ${t('calendar.today')}` : ''}${marked ? `, ${t('weekly.dueMark')}` : ''}`}
            accessibilityState={{ selected: active }}
            aria-selected={active}
            onPress={() => onSelect(day)}
            style={styles.day}
          >
            <Text style={[styles.weekday, isToday ? styles.todayText : null]}>{formatWeekdayLabel(day, lang)}</Text>
            <View style={[styles.circle, active ? styles.circleActive : isToday ? styles.circleToday : null]}>
              <Text style={[styles.number, active ? styles.numberActive : isToday ? styles.todayText : null]}>{formatDayNumber(day)}</Text>
            </View>
            <View style={[styles.mark, marked ? styles.markOn : null]} />
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Lịch (V2) : même écran pour l'enfant (bouton calendrier de Hôm nay, `back`) et le parent (onglet Lịch). Même logique que le calendrier V1
 * (`domain/calendar`, `task-time`, `weekly-quiz`, mêmes hooks) dans le style de Hôm nay V2 : fond vert doux, cartes crème, Nunito, icônes
 * d'objectifs, « 10 ⚡ ». Aucune case à cocher ici (cocher reste dans Hôm nay) ; le parent ouvre une tâche pour la modifier.
 */
export function V2Calendar({ back = false }: { back?: boolean }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const now = useNow();
  const lang = (['vi', 'fr', 'en'].includes(i18n.language) ? i18n.language : 'vi') as CalendarLanguage;
  const tz = d?.me.family.timezone ?? 'Asia/Ho_Chi_Minh';
  const today = todayInTz(now, tz);
  const nowTime = timeInTz(now, tz);
  const [picked, setPicked] = useState<string | null>(null);
  const [weekMode, setWeekMode] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const selected = picked ?? today;
  const days = weekDays(selected);
  const tasksQuery = useTasks(d?.child?.id ?? null, days[0] ?? selected, days[6] ?? selected);
  const weekly = useWeeklyQuizzes(today, false);
  const role = d?.viewer.role === 'parent' ? 'parent' : 'child';
  const openDue = useWeeklyOpen(role, d?.select);

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-24, 24])
    .failOffsetY([-16, 16])
    .onEnd((e) => {
      if (e.translationX <= -SWIPE_THRESHOLD) setPicked(shiftWeek(selected, 1));
      else if (e.translationX >= SWIPE_THRESHOLD) setPicked(shiftWeek(selected, -1));
    });

  if (!d || !d.child) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={v2Colors.primary} />
      </View>
    );
  }

  const byDay = groupByDay(tasksQuery.data ?? [], days);
  const dueBy = dueByDay(weekly.groups.flatMap((g) => g.items.map((item): Due => ({ ...item, childId: g.childId, childName: g.childName }))), days) as Record<string, Due[]>;
  const marks = dueMarkedDays(dueBy);

  const taskRow = (task: TaskRow) => {
    const perms = taskPermissions(d.viewer, task);
    const state = taskState(task);
    const label = timeLabel(task);
    const subtitle = label.kind === 'range' ? `${label.start} - ${label.end}` : label.kind === 'deadline' ? t('taskForm.deadlineLabel', { time: label.end }) : t('taskForm.anytime');
    return (
      <GoalRow
        key={task.id}
        testID={`v2-cal-${task.id}`}
        icon={goalIconFor(task)}
        title={task.title}
        subtitle={subtitle}
        late={isOverdue(task, today, nowTime)}
        energy={task.points}
        checked={state !== 'todo'}
        pending={state === 'pending'}
        doneMark
        onOpen={perms.canEdit ? () => router.push({ pathname: '/task/[id]', params: { id: task.id } }) : undefined}
      />
    );
  };
  const dueRow = (x: Due) => (
    <GoalRow
      key={`${x.childId}-${x.quizId}`}
      icon={WEEKLY_REVIEW_ICON}
      title={t(role === 'parent' ? 'weekly.dueCardParent' : 'weekly.dueCard', { title: x.title, name: x.childName })}
      subtitle={[weeklyStateText(t, x, role), x.late ? t('weekly.late') : null].filter(Boolean).join(' · ')}
      late={x.late}
      energy={null}
      checked={x.state === 'validated'}
      onOpen={() => openDue(x, x.childId)}
    />
  );
  /** carte crème d'un jour : titre, objectifs, dates limites ; « Không có việc nào » si rien */
  const dayCard = (day: string, big: boolean) => {
    const tasks = sortTasks(byDay[day] ?? []);
    const dues = dueBy[day] ?? [];
    return (
      <View key={day} style={styles.dayCard} testID={`v2-cal-day-${day}`}>
        <Text accessibilityRole="header" style={big ? v2Text.title : v2Text.heading}>
          {formatDayTitle(day, lang)}
        </Text>
        {big && tasksQuery.isPending ? (
          <ActivityIndicator color={v2Colors.primary} />
        ) : tasks.length === 0 && dues.length === 0 ? (
          <Text style={[v2Text.body, styles.empty]}>{t('calendar.empty')}</Text>
        ) : (
          <View style={styles.rows}>
            {tasks.map(taskRow)}
            {dues.map(dueRow)}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen} testID="v2-calendar">
      <GestureDetector gesture={swipe} touchAction="pan-y">
        <ScrollView role="main" contentContainerStyle={styles.content}>
          <View style={styles.header}>
            {back ? <V2BackButton /> : null}
            <Text accessibilityRole="header" style={[v2Text.title, styles.flex]}>
              {t('tabs.calendar')}
            </Text>
            <RoundV2 label={t('calendar.pickDate')} onPress={() => setPickerOpen((v) => !v)} testID="v2-cal-pick">
              <CalendarDays size={22} color={v2Colors.onTopButton} />
            </RoundV2>
          </View>

          {pickerOpen ? (
            <View style={styles.picker}>
              <DateTimePicker
                value={parseISO(selected)}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(event, date) => {
                  setPickerOpen(false);
                  if (event.type === 'set' && date) setPicked(format(date, 'yyyy-MM-dd'));
                }}
              />
            </View>
          ) : null}

          {role === 'parent' ? <ChildPicker profiles={d.children} selectedId={d.child.id} onSelect={d.select} /> : null}

          <View style={styles.monthRow}>
            <Text style={[v2Text.heading, styles.flex, styles.month]}>{formatMonthTitle(selected, lang)}</Text>
            <RoundV2 label={t('calendar.prevWeek')} onPress={() => setPicked(shiftWeek(selected, -1))}>
              <ChevronLeft size={22} color={v2Colors.onTopButton} />
            </RoundV2>
            <RoundV2 label={t('calendar.nextWeek')} onPress={() => setPicked(shiftWeek(selected, 1))}>
              <ChevronRight size={22} color={v2Colors.onTopButton} />
            </RoundV2>
          </View>

          <V2WeekStrip days={days} selected={selected} today={today} lang={lang} onSelect={setPicked} marks={marks} />

          {weekMode ? days.map((day) => dayCard(day, false)) : dayCard(selected, true)}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={weekMode ? t('calendar.viewDay') : t('calendar.viewWeek')}
            onPress={() => setWeekMode((v) => !v)}
            style={({ pressed }) => [styles.toggle, pressed ? styles.pressed : null]}
            testID="v2-cal-toggle"
          >
            <CalendarRange size={22} color={v2Colors.primary} />
            <Text style={[v2Text.bodyBold, styles.flex]}>{weekMode ? t('calendar.viewDay') : t('calendar.viewWeek')}</Text>
            <ChevronRight size={22} color={v2Colors.textSecondary} />
          </Pressable>
        </ScrollView>
      </GestureDetector>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: v2Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  // bas de page : place pour le « + » flottant du parent
  content: { padding: v2Spacing.lg, gap: v2Spacing.md, paddingBottom: 96, width: '100%', maxWidth: V2_MAX_WIDTH, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: v2Spacing.md, minHeight: V2_TOUCH },
  flex: { flex: 1 },
  round: { width: V2_TOUCH, height: V2_TOUCH, borderRadius: V2_TOUCH / 2, backgroundColor: v2Colors.topButton, alignItems: 'center', justifyContent: 'center', ...v2Shadow },
  pressed: { transform: [{ scale: 0.96 }] },
  picker: { ...v2Card, padding: v2Spacing.sm },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: v2Spacing.sm },
  month: { textTransform: 'capitalize' },
  strip: { flexDirection: 'row', backgroundColor: v2Colors.card, borderRadius: v2Radius.card, paddingHorizontal: v2Spacing.xs, paddingVertical: v2Spacing.sm, ...v2Shadow },
  day: { flex: 1, minHeight: V2_TOUCH + 28, alignItems: 'center', justifyContent: 'center', gap: 4 },
  weekday: { ...v2Font(700, 12), color: v2Colors.textSecondary },
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  circleActive: { backgroundColor: v2Colors.primary },
  circleToday: { backgroundColor: v2Colors.primarySoft },
  number: v2Font(800, 16),
  numberActive: { color: v2Colors.onPrimary },
  todayText: { color: v2Colors.primary },
  mark: { width: 6, height: 6, borderRadius: 3 },
  markOn: { backgroundColor: v2Colors.energy },
  dayCard: { ...v2Card, gap: v2Spacing.sm },
  rows: { gap: v2Spacing.xs },
  empty: { color: v2Colors.textSecondary, textAlign: 'center', paddingVertical: v2Spacing.md },
  toggle: { ...v2Card, flexDirection: 'row', alignItems: 'center', gap: v2Spacing.md, minHeight: V2_TOUCH + 12, paddingVertical: v2Spacing.md },
});
