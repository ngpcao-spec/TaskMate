import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Badge, toneOf, weeklyStateText } from '@/components/quiz/WeeklyDueCard';
import { RoundButton } from '@/components/RoundButton';
import { subjectText } from '@/components/quiz/subject';
import { Button, Screen, ScreenHeader } from '@/components/ui';
import { formatDueDay, formatShortDay, shiftWeek, weekStart, type CalendarLanguage } from '@/domain/calendar';
import { todayInTz } from '@/domain/family-time';
import type { WeeklyItem } from '@/domain/weekly-quiz';
import { daysUntil, URGENT_DAYS, weekHeader, weekItems } from '@/domain/weekly-review';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useNow } from '@/hooks/useNow';
import { useWeeklyQuizzes } from '@/hooks/useWeeklyQuizzes';
import { colors, glass, MIN_TARGET, radius, typography } from '@/theme/tokens';

type Props = {
  /** Parent : l'enfant dont on ouvre l'écran (paramètre de route). Ignoré pour un enfant : il ne voit que lui (D-052). */
  childId?: string | null;
};

/**
 * Écran « Ôn tập » (D-084) : une carte par matière pour une semaine (lundi → dimanche, jour local de la famille), navigation ‹ ›.
 * Enfant : Bắt đầu / Tiếp tục / Xem kết quả. Parent (même écran, pour SON enfant) : Duyệt / Xem bài làm vers la validation existante.
 * Affichage seulement : les états, le tri, les semaines et le délai de grâce viennent de `domain/weekly-review`, les points du serveur.
 */
export function WeeklyReview({ childId }: Props) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const now = useNow();
  const lang = (['vi', 'fr', 'en'].includes(i18n.language) ? i18n.language : 'vi') as CalendarLanguage;
  const today = todayInTz(now, d?.me.family.timezone ?? 'Asia/Ho_Chi_Minh');
  const weekly = useWeeklyQuizzes(today, false);
  const [picked, setPicked] = useState<string | null>(null);
  if (!d) return <ActivityIndicator />;

  const role = d.viewer.role === 'parent' ? 'parent' : 'child';
  const wanted = role === 'parent' ? (childId ?? d.child?.id ?? null) : (d.child?.id ?? null);
  const group = weekly.groups.find((g) => g.childId === wanted) ?? null;
  const items = group?.items ?? [];
  const start = picked ?? weekStart(today);
  const header = weekHeader(items, start, today);
  const cards = weekItems(items, start, today);
  const title = role === 'parent' && group ? t('weekly.review.titleOf', { name: group.childName }) : t('weekly.review.title');
  const dates = `${formatShortDay(header.start)} – ${formatShortDay(header.end)}`;

  return (
    <Screen>
      <ScreenHeader title={title} />
      <View style={styles.weekRow}>
        <RoundButton label={t('weekly.review.prevWeek')} disabled={!header.canPrev} onPress={() => setPicked(shiftWeek(start, -1))}>
          <ChevronLeft color={header.canPrev ? colors.text : colors.textSecondary} />
        </RoundButton>
        <View accessible accessibilityLabel={t('weekly.review.weekA11y', { week: header.weekNo, dates, done: header.validated, total: header.total })} style={styles.weekText}>
          <Text style={styles.weekTitle}>{t('weekly.review.week', { week: header.weekNo })}</Text>
          <Text style={typography.secondary}>{t('weekly.review.weekSub', { dates, done: header.validated, total: header.total })}</Text>
        </View>
        <RoundButton label={t('weekly.review.nextWeek')} disabled={!header.canNext} onPress={() => setPicked(shiftWeek(start, 1))}>
          <ChevronRight color={header.canNext ? colors.text : colors.textSecondary} />
        </RoundButton>
      </View>

      {weekly.isPending ? <ActivityIndicator color={colors.primary} /> : null}
      {!weekly.isPending && cards.length === 0 ? <Text style={[typography.secondary, styles.empty]}>{t('weekly.review.empty')}</Text> : null}
      {cards.map((item) => (
        <WeeklyCard
          key={item.quizId}
          item={item}
          role={role}
          today={today}
          lang={lang}
          onOpen={(pathname, id) => router.push({ pathname, params: { id } })}
        />
      ))}
    </Screen>
  );
}

type Route = '/quiz/evaluate/[id]' | '/quiz/result/[id]' | '/quiz/attempt/[id]';

function WeeklyCard({ item, role, today, lang, onOpen }: { item: WeeklyItem; role: 'parent' | 'child'; today: string; lang: CalendarLanguage; onOpen: (path: Route, id: string) => void }) {
  const { t } = useTranslation();
  const subject = item.subject ? subjectText(t, item.subject) : item.title;
  const unfinished = item.state === 'todo' || item.state === 'in_progress';
  const days = item.dueOn ? daysUntil(item.dueOn, today) : null;
  const urgent = unfinished && days !== null && days <= URGENT_DAYS;
  const due = item.dueOn ? t('weekly.review.due', { day: formatDueDay(item.dueOn, lang) }) : null;
  const max = item.maxPoints > 0 && unfinished ? t('weekly.review.maxPoints', { points: item.maxPoints }) : null;
  const score = item.state === 'validated' && item.result ? t('weekly.review.score', { score: item.result.score, total: item.result.total }) : null;
  const stateText = weeklyStateText(t, item, role);
  const meta = [item.state === 'validated' ? null : due, max].filter(Boolean).join(' · ');

  let action: { label: string; variant: 'primary' | 'secondary'; run: () => void } | null = null;
  if (role === 'child') {
    if (item.state === 'todo') action = { label: t('weekly.review.start'), variant: 'primary', run: () => onOpen('/quiz/evaluate/[id]', item.quizId) };
    else if (item.state === 'in_progress') action = { label: t('weekly.review.resume'), variant: 'primary', run: () => onOpen('/quiz/evaluate/[id]', item.quizId) };
    else if (item.state === 'validated' && item.attemptId) action = { label: t('weekly.review.seeResult'), variant: 'secondary', run: () => onOpen('/quiz/result/[id]', item.attemptId as string) };
  } else if (item.attemptId) {
    if (item.state === 'waiting') action = { label: t('weekly.review.validate'), variant: 'primary', run: () => onOpen('/quiz/attempt/[id]', item.attemptId as string) };
    else if (item.state === 'validated') action = { label: t('weekly.review.seeWork'), variant: 'secondary', run: () => onOpen('/quiz/attempt/[id]', item.attemptId as string) };
  }

  return (
    <View accessible={false} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.flex}>
          <Text style={styles.subject}>{subject}</Text>
          <Text style={typography.secondary}>{item.title}</Text>
        </View>
        <Badge text={stateText} tone={toneOf(item, role)} />
      </View>
      {meta ? <Text style={[styles.meta, urgent ? styles.urgent : null]}>{meta}</Text> : null}
      {item.late ? <Text style={styles.urgent}>{t('weekly.late')}</Text> : null}
      {score ? <Text style={styles.meta}>{score}</Text> : null}
      {action ? <Button label={action.label} variant={action.variant} accessibilityLabel={`${action.label}: ${subject}`} onPress={action.run} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  weekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: MIN_TARGET + 4, gap: 8 },
  weekText: { flex: 1, alignItems: 'center' },
  weekTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  empty: { textAlign: 'center', paddingVertical: 24 },
  card: { ...glass, borderRadius: radius.card, padding: 16, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  subject: { fontSize: 18, fontWeight: '800', color: colors.text },
  meta: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  urgent: { color: colors.danger, fontSize: 13, fontWeight: '700' },
});
