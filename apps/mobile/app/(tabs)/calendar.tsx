import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'expo-router';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarCard } from '@/components/CalendarCard';
import { ProfilePills } from '@/components/ProfilePills';
import { WeekStrip } from '@/components/WeekStrip';
import {
  formatDayTitle,
  formatMonthTitle,
  groupByDay,
  shiftWeek,
  weekDays,
  type CalendarLanguage,
} from '@/domain/calendar';
import { timeInTz, todayInTz } from '@/domain/family-time';
import { taskPermissions } from '@/domain/permissions';
import { isOverdue, sortTasks } from '@/domain/task-time';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useNow } from '@/hooks/useNow';
import { useTasks } from '@/hooks/useTasks';
import { colors, MIN_TARGET, spacing, typography } from '@/theme/tokens';

const SWIPE_THRESHOLD = 60;

export default function CalendarScreen() {
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
  const first = days[0] ?? selected;
  const last = days[6] ?? selected;
  const tasksQuery = useTasks(d?.child?.id ?? null, first, last);

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
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const byDay = groupByDay(tasksQuery.data ?? [], days);
  const dayTasks = sortTasks(byDay[selected] ?? []);

  const renderCard = (task: (typeof dayTasks)[number]) => {
    const perms = taskPermissions(d.viewer, task);
    return (
      <CalendarCard
        key={task.id}
        task={task}
        overdue={isOverdue(task, today, nowTime)}
        onPress={perms.canEdit && !d.readOnly ? () => router.push({ pathname: '/task/[id]', params: { id: task.id } }) : undefined}
      />
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <GestureDetector gesture={swipe}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[typography.title, styles.flex, { color: colors.text }]}>
              {formatMonthTitle(selected, lang)}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('calendar.prevWeek')} onPress={() => setPicked(shiftWeek(selected, -1))} style={styles.iconButton}>
              <ChevronLeft color={colors.text} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('calendar.nextWeek')} onPress={() => setPicked(shiftWeek(selected, 1))} style={styles.iconButton}>
              <ChevronRight color={colors.text} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('calendar.pickDate')} onPress={() => setPickerOpen((v) => !v)} style={styles.iconButton}>
              <CalendarDays color={colors.primary} />
            </Pressable>
          </View>

          {pickerOpen ? (
            <DateTimePicker
              value={parseISO(selected)}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(event, date) => {
                setPickerOpen(false);
                if (event.type === 'set' && date) setPicked(format(date, 'yyyy-MM-dd'));
              }}
            />
          ) : null}

          {d.children.length > 1 ? <ProfilePills profiles={d.children} selectedId={d.child.id} onSelect={d.select} today={today} /> : null}

          <WeekStrip days={days} selected={selected} today={today} lang={lang} onSelect={setPicked} />

          {weekMode ? (
            <View style={styles.list}>
              {days.map((day) => (
                <View key={day} style={styles.daySection}>
                  <Text accessibilityRole="header" style={styles.dayHeading}>
                    {formatDayTitle(day, lang)}
                  </Text>
                  {(byDay[day] ?? []).length === 0 ? (
                    <Text style={typography.secondary}>{t('calendar.empty')}</Text>
                  ) : (
                    sortTasks(byDay[day] ?? []).map(renderCard)
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.list}>
              <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
                {formatDayTitle(selected, lang)}
              </Text>
              {tasksQuery.isPending ? (
                <ActivityIndicator color={colors.primary} />
              ) : dayTasks.length === 0 ? (
                <Text style={[typography.secondary, styles.empty]}>{t('calendar.empty')}</Text>
              ) : (
                dayTasks.map(renderCard)
              )}
            </View>
          )}

          <Pressable accessibilityRole="button" accessibilityLabel={weekMode ? t('calendar.viewDay') : t('calendar.viewWeek')} onPress={() => setWeekMode((v) => !v)} style={styles.toggle}>
            <Text style={styles.toggleText}>{weekMode ? t('calendar.viewDay') : t('calendar.viewWeek')}</Text>
          </Pressable>
        </ScrollView>
      </GestureDetector>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconButton: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 10 },
  daySection: { gap: 8 },
  dayHeading: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 8 },
  empty: { textAlign: 'center', paddingVertical: spacing.lg },
  toggle: { minHeight: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  toggleText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
